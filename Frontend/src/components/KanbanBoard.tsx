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
  DragCancelEvent,
  CollisionDetection,
  Announcements,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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

  // Hold a stable task snapshot while dragging so remote updates or hover changes
  // cannot make neighboring cards jump around under the pointer.
  useEffect(() => {
    if (!activeTask) {
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
    const task = originalTasksRef.current.find(t => t._id === taskId);
    return task?.title || 'Task';
  };

  const getTargetColumnName = (overId: string | number | undefined) => {
    if (!overId) return undefined;
    const directCol = uniqueColumns.find(c => c._id === overId);
    if (directCol) return directCol.name;
    const task = originalTasksRef.current.find(t => t._id === overId);
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
      // The source card keeps a placeholder droppable while its overlay moves.
      // Ignore that placeholder so it cannot win the drop and send the card
      // back to its original location.
      return pointerCollisions.filter(collision => collision.id !== args.active.id);
    }
    return closestCorners(args).filter(collision => collision.id !== args.active.id);
  };

  // Filter tasks
  const visibleTasks = activeTask ? originalTasksRef.current : tasks;
  const filteredTasks = visibleTasks.filter(task => {
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
      .sort((a, b) => a.position < b.position ? -1 : a.position > b.position ? 1 : a._id.localeCompare(b._id));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t._id === active.id);
    if (task) {
      setActiveTask(task);
      originalTasksRef.current = tasks;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveTask(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      setActiveTask(null);
      return;
    }

    const sourceTask = originalTasksRef.current.find(t => t._id === activeId);
    if (!sourceTask) {
      setActiveTask(null);
      return;
    }

    const isOverColumn = uniqueColumns.some(c => c._id === overId);
    const targetColumnId = isOverColumn
      ? overId
      : originalTasksRef.current.find(t => t._id === overId)?.columnId || sourceTask.columnId;

    const destinationTasks = originalTasksRef.current
      .filter(t => t.columnId === targetColumnId && t._id !== activeId)
      .sort((a, b) => a.position.localeCompare(b.position) || a._id.localeCompare(b._id));

    let targetIndex: number;
    if (isOverColumn) {
      targetIndex = destinationTasks.length;
    } else {
      const idx = destinationTasks.findIndex(t => t._id === overId);
      // Drop onto a card means insert immediately before it. The existing
      // cards keep their relative order and naturally shift down one slot.
      targetIndex = idx >= 0 ? idx : destinationTasks.length;
    }

    if (sourceTask.columnId === targetColumnId) {
      const sourceIndex = originalTasksRef.current
        .filter(task => task.columnId === sourceTask.columnId)
        .sort((a, b) => a.position.localeCompare(b.position) || a._id.localeCompare(b._id))
        .findIndex(task => task._id === sourceTask._id);
      if (sourceIndex === targetIndex) {
        setActiveTask(null);
        return;
      }
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

    const movePromise = onMoveTask(
      sourceTask._id,
      targetColumnId,
      beforePosition,
      afterPosition,
      sourceTask.version
    );
    // Remove the overlay now so dnd-kit cannot animate it back to its source
    // placeholder while the server request is pending. The parent has already
    // applied the optimistic destination before awaiting its request.
    setActiveTask(null);
    await movePromise;
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3 sm:p-5 flex gap-3 sm:gap-4 items-stretch select-none snap-x snap-proximity">
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

      <DragOverlay dropAnimation={null}>
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
