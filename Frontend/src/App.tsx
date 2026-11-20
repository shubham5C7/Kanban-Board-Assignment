import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useTenant } from './context/TenantContext';
import { Task, Column, User, FilterState, UndoAction, PresenceUser, TaskSnapshot } from './types';
import { api, ApiError } from './services/api';
import {
  connectSocket,
  joinTenantRoom,
  leaveTenantRoom,
  sendCardFocus,
  disconnectSocket,
  ConnectionStatus,
} from './services/socket';

import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { ActivityFeedModal } from './components/ActivityFeedModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { CreateBoardModal } from './components/CreateBoardModal';
import { OfflineBanner } from './components/OfflineBanner';
import { UndoToast } from './components/UndoToast';
import { BoardSkeleton } from './components/BoardSkeleton';
import { AITaskFromTextModal } from './components/AITaskFromTextModal';
import Confetti from 'react-confetti';

function taskSnapshot(task: Task): TaskSnapshot {
  const assignee = task.assigneeId;
  return {
    columnId: task.columnId,
    position: task.position,
    title: task.title,
    description: task.description,
    priority: task.priority,
    labels: [...(task.labels || [])],
    dueDate: task.dueDate || null,
    assigneeId: typeof assignee === 'string' ? assignee : assignee?._id || assignee?.id || null,
    deletedAt: task.deletedAt || null,
  };
}

export const App: React.FC = () => {
  const { user, token, isLoading: authLoading } = useAuth();
  const {
    currentOrg,
    currentTenant,
    userRole,
    currentBoard,
    refreshBoards,
  } = useTenant();

  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tenantMembers, setTenantMembers] = useState<User[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);

  // Real-time & Presence State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [remoteUpdatedTaskIds, setRemoteUpdatedTaskIds] = useState<Set<string>>(new Set());
  const [lastSeenSeq, setLastSeenSeq] = useState<number>(0);

  // Selection & UI State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [conflictData, setConflictData] = useState<{ currentRecord: Task; message: string } | null>(null);
  const [moveNotice, setMoveNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ search: '', priority: '', assigneeId: '', label: '' });
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [redoAction, setRedoAction] = useState<UndoAction | null>(null);

  // Modals & Navigation
  const [activityOpen, setActivityOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskDefaultCol, setCreateTaskDefaultCol] = useState<string | undefined>();
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aiTaskFromTextOpen, setAiTaskFromTextOpen] = useState(false);

  // Offline queue for mutations
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  // Confetti celebration state when task is completed
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<any>(null);
  const [windowDim, setWindowDim] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDim({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setUndoAction(null);
    setRedoAction(null);
  }, [currentTenant?._id, currentBoard?._id]);

  const triggerConfetti = () => {
    if (confettiTimerRef.current) {
      clearTimeout(confettiTimerRef.current);
    }
    setShowConfetti(true);
    // Strict 2-second fast confetti burst
    confettiTimerRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 2000);
  };

  // 1. Load Board Data & Columns
  useEffect(() => {
    if (!currentTenant || !currentBoard) {
      setColumns([]);
      setTasks([]);
      return;
    }

    const loadBoard = async () => {
      setBoardLoading(true);
      try {
        const data = await api.getBoard(currentTenant._id, currentBoard._id);
        const seenColIds = new Set<string>();
        const seenColNames = new Set<string>();
        const uniqueLoadedColumns = (data.columns || []).filter(c => {
          if (!c?._id || seenColIds.has(c._id)) return false;
          const nameKey = (c.name || '').trim().toLowerCase();
          if (seenColNames.has(nameKey)) return false;
          seenColIds.add(c._id);
          seenColNames.add(nameKey);
          return true;
        });
        setColumns(uniqueLoadedColumns);
        setTasks(data.tasks);
        if (typeof (data as any).latestSeq === 'number') {
          setLastSeenSeq((data as any).latestSeq);
        }

        // Fetch tenant members for assignment
        const membersData = await api.getMembers(currentTenant._id);
        setTenantMembers(membersData.members.map(m => m.user));
      } catch (err) {
        console.error('[App] Error loading board data', err);
      } finally {
        setBoardLoading(false);
      }
    };

    loadBoard();
  }, [currentTenant?._id, currentBoard?._id]);

  // 2. Real-Time Socket Connection & Scoped Room Management
  useEffect(() => {
    if (!token || !currentTenant) return;

    const socket = connectSocket(token, {
      onStatusChange: status => {
        setConnectionStatus(status);
        if (status === 'connected' && lastSeenSeq > 0) {
          // Replay missed events on reconnect
          api.getMissedEvents(currentTenant._id, lastSeenSeq).then(res => {
            if (res.events && res.events.length > 0) {
              handleBatchEvents(res.events);
              setLastSeenSeq(res.latestSeq);
            }
          });
        }
      },
      onPresenceUpdate: users => {
        setPresenceUsers(users);
      },
      onTaskEvent: evt => {
        if (evt.seq) setLastSeenSeq(seq => Math.max(seq, evt.seq!));
        handleTaskEvent(evt);
      },
      onColumnEvent: evt => {
        if (evt.seq) setLastSeenSeq(seq => Math.max(seq, evt.seq!));
        handleColumnEvent(evt);
      },
      onBoardEvent: evt => {
        if (evt.seq) setLastSeenSeq(seq => Math.max(seq, evt.seq!));
        refreshBoards();
      },
      onReplayEvents: events => {
        handleBatchEvents(events);
      },
    });

    joinTenantRoom(currentTenant._id, currentBoard?._id, lastSeenSeq);

    return () => {
      leaveTenantRoom(currentTenant._id);
    };
  }, [token, currentTenant?._id, currentBoard?._id]);

  // 3. Focus tracking for selected task
  useEffect(() => {
    if (currentTenant) {
      sendCardFocus(currentTenant._id, selectedTask?._id || null);
    }
  }, [selectedTask?._id, currentTenant?._id]);

  // 4. Handle Real-Time Events
  const handleTaskEvent = (evt: { type: string; data: any; actorId: string }) => {
    const isSelf = evt.actorId === user?.id;

    if (evt.type === 'task.created') {
      const newTask = evt.data.task;
      if (!newTask) return;
      const targetId = (newTask._id || newTask.id)?.toString();
      setTasks(prev => {
        if (prev.some(t => (t._id || (t as any).id)?.toString() === targetId)) {
          return prev.map(t =>
            (t._id || (t as any).id)?.toString() === targetId ? newTask : t
          );
        }
        return [...prev, newTask];
      });
    } else if (evt.type === 'task.moved') {
      const updated = evt.data.task;
      setTasks(prev => prev.map(t => (t._id === updated._id ? updated : t)));

      // Trigger Confetti if card moved to Done
      const targetCol = columns.find(c => c._id === updated.columnId);
      const prevColId = evt.data.previousColumnId;
      const prevCol = columns.find(c => c._id === prevColId);
      const isTargetDone = targetCol && /done|completed|finished/i.test(targetCol.name);
      const wasPrevDone = prevCol && /done|completed|finished/i.test(prevCol.name);
      if (isTargetDone && !wasPrevDone) {
        triggerConfetti();
      }

      if (!isSelf) {
        // Flash animation for remote move
        setRemoteUpdatedTaskIds(prev => new Set(prev).add(updated._id));
        setTimeout(() => {
          setRemoteUpdatedTaskIds(prev => {
            const next = new Set(prev);
            next.delete(updated._id);
            return next;
          });
        }, 1400);
      }
    } else if (evt.type === 'task.updated') {
      const updated = evt.data.task;
      setTasks(prev => prev.map(t => (t._id === updated._id ? updated : t)));

      // If this task is open in panel and edit was by someone else, check for conflict
      if (selectedTask?._id === updated._id && !isSelf) {
        setConflictData({
          currentRecord: updated,
          message: 'This task was modified by another teammate.',
        });
      }
    } else if (evt.type === 'task.deleted') {
      const { taskId } = evt.data;
      setTasks(prev => prev.filter(t => t._id !== taskId));
      if (selectedTask?._id === taskId) {
        setSelectedTask(null);
      }
    }
  };

  const handleColumnEvent = (evt: { type: string; data: any; actorId: string }) => {
    if (evt.type === 'column.created') {
      const newCol = evt.data.column;
      if (!newCol) return;
      // Ensure column belongs to the current board
      if (currentBoard && newCol.boardId && newCol.boardId.toString() !== currentBoard._id.toString()) {
        return;
      }
      setColumns(prev => {
        if (
          prev.some(
            c =>
              c._id === newCol._id ||
              c.name.trim().toLowerCase() === newCol.name.trim().toLowerCase()
          )
        ) {
          return prev;
        }
        return [...prev, newCol];
      });
    } else if (evt.type === 'column.updated') {
      setColumns(prev => prev.map(c => (c._id === evt.data.column._id ? evt.data.column : c)));
    } else if (evt.type === 'column.deleted') {
      setColumns(prev => prev.filter(c => c._id !== evt.data.columnId));
    }
  };

  const handleBatchEvents = (events: any[]) => {
    const highestSeq = events.reduce((max, evt) => Math.max(max, Number(evt.seq) || 0), 0);
    if (highestSeq) setLastSeenSeq(seq => Math.max(seq, highestSeq));
    events.forEach(evt => {
      if (evt.type?.startsWith('column.')) {
        handleColumnEvent(evt);
      } else if (evt.type?.startsWith('task.')) {
        handleTaskEvent({ type: evt.type, data: evt.data, actorId: evt.actorId });
      }
    });
  };

  // 5. Active card viewers map
  const activeViewersMap: Record<string, string> = {};
  presenceUsers.forEach(p => {
    if (p.activeTaskId && p.userId !== user?.id) {
      activeViewersMap[p.activeTaskId] = p.name;
    }
  });

  // 6. Optimistic Move Task with OCC and Undo
  const handleMoveTask = async (
    taskId: string,
    targetColumnId: string,
    beforePosition: string | null,
    afterPosition: string | null,
    expectedVersion: number
  ) => {
    if (!currentTenant) return;

    const originalTask = tasks.find(t => t._id === taskId);
    if (!originalTask) return;

    const previousColumnId = originalTask.columnId;
    const previousPosition = originalTask.position;

    // Optimistically update local state immediately
    setTasks(prev =>
      prev.map(t =>
        t._id === taskId
          ? { ...t, columnId: targetColumnId, version: t.version + 1 }
          : t
      )
    );

    try {
      const res = await api.moveTask(currentTenant._id, taskId, {
        targetColumnId,
        beforePosition,
        afterPosition,
        expectedVersion,
      });

      // Update with server confirmed task & position
      setTasks(prev => prev.map(t => (t._id === taskId ? res.task : t)));

      // Trigger Confetti blast if task was moved to Done / Completed
      const targetCol = columns.find(c => c._id === targetColumnId);
      const prevCol = columns.find(c => c._id === previousColumnId);
      const isTargetDone = targetCol && /done|completed|finished/i.test(targetCol.name);
      const wasPrevDone = prevCol && /done|completed|finished/i.test(prevCol.name);
      if (isTargetDone && !wasPrevDone) {
        triggerConfetti();
      }

      // Set Undo Toast
      setUndoAction({
        taskId,
        tenantId: currentTenant._id,
        boardId: currentBoard?._id || originalTask.boardId,
        title: originalTask.title,
        beforeState: taskSnapshot(originalTask),
        afterState: taskSnapshot(res.task),
        expectedVersion: res.task.version,
        timestamp: Date.now(),
      });
      setRedoAction(null);
    } catch (err: any) {
      console.error('[App] Move failed, rolling back', err);
      const latestTask = err instanceof ApiError && err.currentRecord
        ? err.currentRecord as Task
        : null;
      if (err instanceof ApiError && (err.code === 'task_not_found' || (err.code === 'version_conflict' && err.currentRecord === null))) {
        setTasks(prev => prev.filter(task => task._id !== taskId));
        setMoveNotice('This card was deleted by someone else and has been removed from the board.');
      } else if (err instanceof ApiError && ['column_deleted', 'column_board_mismatch'].includes(err.code)) {
        try {
          if (!currentBoard) throw new Error('No active board to refresh');
          const latestBoard = await api.getBoard(currentTenant._id, currentBoard._id);
          setColumns(latestBoard.columns);
          setTasks(latestBoard.tasks);
          setMoveNotice(err.code === 'column_deleted'
            ? 'That column was removed. The board has been refreshed; choose another column.'
            : 'Cards can only be moved between columns on the same board.');
        } catch {
          setTasks(prev => prev.map(task => task._id === taskId
            ? { ...task, columnId: previousColumnId, position: previousPosition, version: originalTask.version }
            : task));
          setMoveNotice('The board changed while moving this card. Refresh the board and try again.');
        }
      } else {
        setTasks(prev => prev.map(task => task._id === taskId
          ? latestTask || { ...task, columnId: previousColumnId, position: previousPosition, version: originalTask.version }
          : task));
        if (latestTask && selectedTask?._id === taskId) setSelectedTask(latestTask);
        if (err instanceof ApiError && err.statusCode === 409) {
          setMoveNotice('This card changed while you were moving it. Its latest position is shown; try again if needed.');
        } else {
          setMoveNotice(err.message || 'Could not move the card. Its previous position has been restored.');
        }
      }
    }
  };

  // 7. Perform Undo
  const handleUndo = async (action: UndoAction) => {
    if (!currentTenant || action.tenantId !== currentTenant._id || (currentBoard && action.boardId !== currentBoard._id)) return;

    try {
      const res = await api.undoTask(currentTenant._id, action.taskId, {
        expectedVersion: action.expectedVersion,
        previousState: action.beforeState,
      });

      setTasks(prev => res.task.deletedAt
        ? prev.filter(task => task._id !== action.taskId)
        : prev.some(task => task._id === action.taskId)
          ? prev.map(task => task._id === action.taskId ? res.task : task)
          : [...prev, res.task]);
      if (selectedTask?._id === action.taskId) setSelectedTask(res.task);
      setUndoAction(null);
      setRedoAction(null);
      setRedoAction({ ...action, expectedVersion: res.task.version, timestamp: Date.now() });
    } catch (err: any) {
      const latest = err instanceof ApiError ? err.currentRecord as Task | undefined : undefined;
      if (latest) {
        setTasks(prev => prev.map(task => task._id === latest._id ? latest : task));
        if (selectedTask?._id === latest._id) setSelectedTask(latest);
      }
      setUndoAction(null);
      setMoveNotice('Undo was not applied because this task changed. The latest version is shown.');
    }
  };

  const handleRedo = async (action: UndoAction) => {
    if (!currentTenant || action.tenantId !== currentTenant._id || (currentBoard && action.boardId !== currentBoard._id)) return;
    try {
      const res = await api.undoTask(currentTenant._id, action.taskId, {
        expectedVersion: action.expectedVersion,
        previousState: action.afterState,
      });
      setTasks(prev => res.task.deletedAt
        ? prev.filter(task => task._id !== action.taskId)
        : prev.some(task => task._id === action.taskId)
          ? prev.map(task => task._id === action.taskId ? res.task : task)
          : [...prev, res.task]);
      if (selectedTask?._id === action.taskId) setSelectedTask(res.task);
      setRedoAction(null);
      setUndoAction({ ...action, expectedVersion: res.task.version, timestamp: Date.now() });
    } catch (err: any) {
      const latest = err instanceof ApiError ? err.currentRecord as Task | undefined : undefined;
      if (latest) {
        setTasks(prev => prev.map(task => task._id === latest._id ? latest : task));
        if (selectedTask?._id === latest._id) setSelectedTask(latest);
      }
      setRedoAction(null);
      setMoveNotice('Redo was not applied because this task changed. The latest version is shown.');
    }
  };

  // 8. Update Task from side panel
  const handleUpdateTask = async (
    taskId: string,
    updates: Partial<Task>,
    expectedVersion?: number
  ) => {
    if (!currentTenant) return;
    const originalTask = tasks.find(task => task._id === taskId);

    try {
      const res = await api.updateTask(currentTenant._id, taskId, {
        ...updates,
        expectedVersion,
      });

      setTasks(prev => prev.map(t => (t._id === taskId ? res.task : t)));
      setSelectedTask(res.task);
      setConflictData(null);
      if (originalTask) {
        const beforeState = taskSnapshot(originalTask);
        const afterState = taskSnapshot(res.task);
        if (JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
          setUndoAction({
            taskId,
            tenantId: currentTenant._id,
            boardId: currentBoard?._id || originalTask.boardId,
            title: res.task.title,
            beforeState,
            afterState,
            expectedVersion: res.task.version,
            timestamp: Date.now(),
          });
          setRedoAction(null);
        }
      }

      // Trigger Confetti if updated to Done / Completed
      if (updates.columnId) {
        const targetCol = columns.find(c => c._id === updates.columnId);
        const prevTask = tasks.find(t => t._id === taskId);
        const prevCol = prevTask ? columns.find(c => c._id === prevTask.columnId) : null;
        const isTargetDone = targetCol && /done|completed|finished/i.test(targetCol.name);
        const wasPrevDone = prevCol && /done|completed|finished/i.test(prevCol.name);
        if (isTargetDone && !wasPrevDone) {
          triggerConfetti();
        }
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 409) {
        if (err.currentRecord) {
          const latest = err.currentRecord as Task;
          setTasks(prev => prev.map(task => task._id === latest._id ? latest : task));
          setConflictData({ currentRecord: latest, message: err.message });
        } else {
          setConflictData(null);
          setMoveNotice('This task was removed or changed again. Refresh the board before editing it.');
        }
      } else {
        alert(err.message || 'Failed to update task');
      }
    }
  };

  // 9. Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!currentTenant) return;
    if (!confirm('Are you sure you want to delete this task?')) return;
    const originalTask = tasks.find(task => task._id === taskId);

    try {
      await api.deleteTask(currentTenant._id, taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      if (originalTask) {
        const deletedState = { ...taskSnapshot(originalTask), deletedAt: new Date().toISOString() };
        setUndoAction({
          taskId,
          tenantId: currentTenant._id,
          boardId: originalTask.boardId,
          title: originalTask.title,
          beforeState: taskSnapshot(originalTask),
          afterState: deletedState,
          expectedVersion: originalTask.version + 1,
          timestamp: Date.now(),
        });
        setRedoAction(null);
      }
      setSelectedTask(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  // 10. Resolve Conflict in Side Panel
  const handleResolveConflict = async (resolved: Partial<Task>) => {
    if (!selectedTask || !currentTenant) return;
    const remoteBefore = conflictData?.currentRecord || selectedTask;
    const currentVersion = conflictData?.currentRecord.version || selectedTask.version;

    try {
      const res = await api.updateTask(currentTenant._id, selectedTask._id, {
        ...resolved,
        expectedVersion: currentVersion,
      });

      setTasks(prev => prev.map(t => (t._id === selectedTask._id ? res.task : t)));
      setSelectedTask(res.task);
      setConflictData(null);
      const beforeState = taskSnapshot(remoteBefore);
      const afterState = taskSnapshot(res.task);
      if (JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
        setUndoAction({
          taskId: res.task._id,
          tenantId: currentTenant._id,
          boardId: res.task.boardId,
          title: res.task.title,
          beforeState,
          afterState,
          expectedVersion: res.task.version,
          timestamp: Date.now(),
        });
        setRedoAction(null);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.currentRecord) {
        const latest = err.currentRecord as Task;
        setTasks(prev => prev.map(task => task._id === latest._id ? latest : task));
        setConflictData({ currentRecord: latest, message: err.message });
      } else {
        setMoveNotice(err.message || 'Conflict resolution failed. Refresh the task and try again.');
      }
    }
  };

  const handleAcceptRemoteTask = (latest: Task) => {
    setTasks(prev => prev.map(task => task._id === latest._id ? latest : task));
    setSelectedTask(latest);
    setConflictData(null);
  };

  // 11. Create Task Submit
  const handleCreateTask = async (data: any) => {
    if (!currentTenant) return;
    const res = await api.createTask(currentTenant._id, data.columnId, data);
    setTasks(prev => {
      const targetId = (res.task._id || (res.task as any).id)?.toString();
      if (prev.some(t => (t._id || (t as any).id)?.toString() === targetId)) {
        return prev.map(t =>
          (t._id || (t as any).id)?.toString() === targetId ? res.task : t
        );
      }
      return [...prev, res.task];
    });
    setUndoAction({
      taskId: res.task._id,
      tenantId: currentTenant._id,
      boardId: res.task.boardId,
      title: res.task.title,
      beforeState: { deletedAt: new Date().toISOString() },
      afterState: taskSnapshot(res.task),
      expectedVersion: res.task.version,
      timestamp: Date.now(),
    });
    setRedoAction(null);
  };

  // 12. Create Board Submit
  const handleCreateBoard = async (name: string, description?: string) => {
    if (!currentTenant) return;
    await api.createBoard(currentTenant._id, { name, description });
    await refreshBoards();
  };

  // 13. Keyboard Shortcuts (C, /, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCreateTaskOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('task-search-input');
        searchInput?.focus();
      } else if (e.key === 'Escape') {
        setSelectedTask(null);
        setActivityOpen(false);
        setCreateTaskOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-xs">
        Connecting to workspace...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* 1. Left Sidebar */}
      <Sidebar
        onOpenActivity={() => setActivityOpen(true)}
        onOpenNewBoard={() => setCreateBoardOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          boardName={currentBoard?.name || 'No Board Selected'}
          boardDescription={currentBoard?.description}
          presenceUsers={presenceUsers}
          connectionStatus={connectionStatus}
          filters={filters}
          onFilterChange={setFilters}
          onOpenCreateTask={() => {
            setCreateTaskDefaultCol(columns[0]?._id);
            setCreateTaskOpen(true);
          }}
          onOpenAITaskFromText={() => setAiTaskFromTextOpen(true)}
          onlineCount={presenceUsers.length}
          onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)}
        />

        {/* Offline Status Banner */}
        <OfflineBanner
          status={connectionStatus}
          queuedCount={offlineQueue.length}
          onRetry={() => {
            if (currentTenant) joinTenantRoom(currentTenant._id, currentBoard?._id, lastSeenSeq);
          }}
        />
        {moveNotice && (
          <div role="status" className="mx-3 mt-2 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-100">
            <span>{moveNotice}</span>
            <button type="button" onClick={() => setMoveNotice(null)} className="shrink-0 rounded-md px-2 py-0.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-900" aria-label="Dismiss message">Dismiss</button>
          </div>
        )}

        {/* Board Surface */}
        <main className="flex-1 flex overflow-hidden relative">
          {boardLoading ? (
            <BoardSkeleton />
          ) : (
            <KanbanBoard
              columns={columns}
              tasks={tasks}
              filters={filters}
              selectedTaskId={selectedTask?._id || null}
              remoteUpdatedTaskIds={remoteUpdatedTaskIds}
              activeViewersMap={activeViewersMap}
              onSelectTask={task => {
                setSelectedTask(task);
                setConflictData(null);
              }}
              onAddTask={colId => {
                setCreateTaskDefaultCol(colId);
                setCreateTaskOpen(true);
              }}
              onMoveTask={handleMoveTask}
            />
          )}

          {/* Right-Side Task Detail Panel */}
          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              columns={columns}
              members={tenantMembers}
              currentUserId={user.id}
              tenantId={currentTenant?._id}
              userRole={userRole}
              activeViewerName={activeViewersMap[selectedTask._id]}
              conflictData={conflictData}
              onClose={() => setSelectedTask(null)}
              onUpdate={handleUpdateTask}
              onDelete={handleDeleteTask}
              onResolveConflict={handleResolveConflict}
              onAcceptRemote={handleAcceptRemoteTask}
            />
          )}
        </main>
      </div>

      {/* Activity Feed Modal */}
      {currentTenant && (
        <ActivityFeedModal
          tenantId={currentTenant._id}
          isOpen={activityOpen}
          onClose={() => setActivityOpen(false)}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={createTaskOpen}
        columns={columns}
        members={tenantMembers}
        defaultColumnId={createTaskDefaultCol}
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={handleCreateTask}
      />

      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={createBoardOpen}
        onClose={() => setCreateBoardOpen(false)}
        onSubmit={handleCreateBoard}
      />

      {/* AI Task from Text Modal */}
      <AITaskFromTextModal
        isOpen={aiTaskFromTextOpen}
        columns={columns}
        onClose={() => setAiTaskFromTextOpen(false)}
        onCreateTask={handleCreateTask}
      />

      {/* Floating Undo Toast (Cmd+Z) */}
      <UndoToast
        action={undoAction}
        redoAction={redoAction}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDismiss={() => { setUndoAction(null); setRedoAction(null); }}
      />

      {/* Confetti Celebration on Task Completion (Fast velocity, strictly 2 seconds) */}
      {showConfetti && (
        <Confetti
          width={windowDim.width}
          height={windowDim.height}
          recycle={false}
          numberOfPieces={380}
          gravity={0.55}
          initialVelocityY={30}
          initialVelocityX={{ min: -14, max: 14 }}
          friction={0.98}
          tweenDuration={1500}
          onConfettiComplete={() => setShowConfetti(false)}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
};
export default App;
