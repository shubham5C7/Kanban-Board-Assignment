import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragCancelEvent,
  CollisionDetection,
  DropAnimation,
  defaultDropAnimationSideEffects,
  Announcements,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { Column as ColumnType, Task, FilterState } from '../types';
import { Column } from './Column';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  columns: ColumnType[];
  tasks: Task[];
  filters: FilterState;
  selectedTaskId: string | null;
  remoteUpdatedTaskIds: Set<string>;
  activeViewersMap: Record<string, string>;
  onSelectTask: (task: Task) => void;
  onAddTask: (columnId: string) => void;
  onMoveTask: (
    taskId: string,
    targetColumnId: string,
    beforePosition: string | null,
    afterPosition: string | null,
    expectedVersion: number
  ) => Promise<void>;
}

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
  duration: 180,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  tasks,
  filters,
  selectedTaskId,
  remoteUpdatedTaskIds,
  activeViewersMap,
  onSelectTask,
  onAddTask,
  onMoveTask,
}) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const originalTasksRef = useRef<Task[]>(tasks);

  // Deduplicate columns by both _id and normalized name to prevent duplicate column rendering in the DOM
  const uniqueColumns = useMemo(() => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    return columns.filter(col => {
      if (!col?._id || seenIds.has(col._id)) return false;
      const nameKey = (col.name || '').trim().toLowerCase();
      if (seenNames.has(nameKey)) return false;
      seenIds.add(col._id);
      seenNames.add(nameKey);
      return true;
    });
  }, [columns]);

  // Sync localTasks when external tasks prop changes and user is not actively dragging
  useEffect(() => {
    if (!activeTask) {
      setLocalTasks(tasks);
      originalTasksRef.current = tasks;
    }
  }, [tasks, activeTask]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Human-readable screen reader announcements for accessible drag & drop
  const getTaskTitle = (taskId: string | number) => {
    const task = localTasks.find(t => t._id === taskId);
    return task?.title || 'Task';
  };

  const getTargetColumnName = (overId: string | number | undefined) => {
    if (!overId) return undefined;
    const directCol = uniqueColumns.find(c => c._id === overId);
    if (directCol) return directCol.name;
    const task = localTasks.find(t => t._id === overId);
    if (task) {
      const parentCol = uniqueColumns.find(c => c._id === task.columnId);
      if (parentCol) return parentCol.name;
    }
    return undefined;
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const taskTitle = getTaskTitle(active.id);
      return `Picked up task "${taskTitle}".`;
    },
    onDragOver({ active, over }) {
      const taskTitle = getTaskTitle(active.id);
      if (!over) {
        return `Task "${taskTitle}" is no longer over a droppable area.`;
      }
      const colName = getTargetColumnName(over.id);
      if (colName) {
        return `Task "${taskTitle}" is over column "${colName}".`;
      }
      return `Task "${taskTitle}" is moving.`;
    },
    onDragEnd({ active, over }) {
      const taskTitle = getTaskTitle(active.id);
      if (!over) {
        return `Task "${taskTitle}" was dropped outside of a droppable area.`;
      }
      const colName = getTargetColumnName(over.id);
      if (colName) {
        return `Task "${taskTitle}" was placed in column "${colName}".`;
      }
      return `Task "${taskTitle}" was dropped.`;
    },
    onDragCancel({ active }) {
      const taskTitle = getTaskTitle(active.id);
      return `Movement cancelled. Task "${taskTitle}" returned to original position.`;
    },
  };

  // Custom collision detection: prefer pointerWithin first for responsive column detection, fallback to closestCorners
  const collisionDetectionStrategy: CollisionDetection = args => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCorners(args);
  };

  // Filter tasks
  const filteredTasks = localTasks.filter(task => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }
    const currentAssigneeId = task.assigneeId?._id || task.assigneeId?.id;
    if (filters.assigneeId && currentAssigneeId !== filters.assigneeId) {
      return false;
    }
    return true;
  });

  const getColumnTasks = (columnId: string) =>
    filteredTasks
      .filter(t => t.columnId === columnId)
      .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = localTasks.find(t => t._id === active.id);
    if (task) {
      setActiveTask(task);
      originalTasksRef.current = localTasks;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeItem = localTasks.find(t => t._id === activeId);
    if (!activeItem) return;

    // Check if `over` is a column or a task
    const isOverColumn = uniqueColumns.some(c => c._id === overId);
    const targetColumnId = isOverColumn
      ? overId
      : localTasks.find(t => t._id === overId)?.columnId;

    if (!targetColumnId) return;

    if (activeItem.columnId !== targetColumnId) {
      // Cross-column move during hover: update activeItem's columnId so cards slide smoothly
      setLocalTasks(prev => {
        const overIndex = prev.findIndex(t => t._id === overId);
        let newIndex: number;

        if (isOverColumn) {
          newIndex = prev.length;
        } else {
          newIndex = overIndex >= 0 ? overIndex : prev.length;
        }

        return prev.map(t => {
          if (t._id === activeId) {
            return { ...t, columnId: targetColumnId };
          }
          return t;
        });
      });
    } else if (!isOverColumn) {
      // Same column reorder during hover
      setLocalTasks(prev => {
        const oldIndex = prev.findIndex(t => t._id === activeId);
        const newIndex = prev.findIndex(t => t._id === overId);
        if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(prev, oldIndex, newIndex);
        }
        return prev;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setLocalTasks(originalTasksRef.current);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceTask = originalTasksRef.current.find(t => t._id === activeId);
    if (!sourceTask) return;

    const isOverColumn = uniqueColumns.some(c => c._id === overId);
    const targetColumnId = isOverColumn
      ? overId
      : localTasks.find(t => t._id === overId)?.columnId || sourceTask.columnId;

    const destinationTasks = localTasks
      .filter(t => t.columnId === targetColumnId && t._id !== activeId)
      .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));

    let targetIndex: number;
    if (isOverColumn) {
      targetIndex = destinationTasks.length;
    } else {
      const idx = destinationTasks.findIndex(t => t._id === overId);
      targetIndex = idx >= 0 ? idx : destinationTasks.length;
    }

    let beforePosition: string | null = null;
    let afterPosition: string | null = null;

    if (destinationTasks.length === 0) {
      beforePosition = null;
      afterPosition = null;
    } else if (targetIndex <= 0) {
      beforePosition = null;
      afterPosition = destinationTasks[0]?.position || null;
    } else if (targetIndex >= destinationTasks.length) {
      beforePosition = destinationTasks[destinationTasks.length - 1]?.position || null;
      afterPosition = null;
    } else {
      beforePosition = destinationTasks[targetIndex - 1]?.position || null;
      afterPosition = destinationTasks[targetIndex]?.position || null;
    }

    await onMoveTask(
      sourceTask._id,
      targetColumnId,
      beforePosition,
      afterPosition,
      sourceTask.version
    );
  };

  const handleDragCancel = (event: DragCancelEvent) => {
    setActiveTask(null);
    setLocalTasks(originalTasksRef.current);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-start select-none">
        {uniqueColumns.map(column => (
          <Column
            key={column._id}
            column={column}
            tasks={getColumnTasks(column._id)}
            selectedTaskId={selectedTaskId}
            remoteUpdatedTaskIds={remoteUpdatedTaskIds}
            activeViewersMap={activeViewersMap}
            onSelectTask={onSelectTask}
            onAddTask={onAddTask}
          />
        ))}

        {uniqueColumns.length === 0 && (
          <div className="flex-1 h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
            No columns yet in this board.
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={dropAnimationConfig}>
        {activeTask ? (
          <div className="w-72 sm:w-80">
            <TaskCard
              task={activeTask}
              isSelected={true}
              isOverlay={true}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
