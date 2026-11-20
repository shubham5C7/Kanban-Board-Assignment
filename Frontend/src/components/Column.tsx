import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Column as ColumnType, Task } from '../types';
import { TaskCard } from './TaskCard';
import { MoreHorizontal } from 'lucide-react';

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  selectedTaskId: string | null;
  remoteUpdatedTaskIds: Set<string>;
  activeViewersMap: Record<string, string>;
  onSelectTask: (task: Task) => void;
  onAddTask: (columnId: string) => void;
}

export const Column: React.FC<ColumnProps> = ({
  column,
  tasks,
  selectedTaskId,
  remoteUpdatedTaskIds,
  activeViewersMap,
  onSelectTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column._id,
    data: { column },
  });

  const taskIds = tasks.map(t => t._id);

  return (
    <div
      ref={setNodeRef}
      className={`w-[85vw] max-w-[320px] sm:w-80 flex-shrink-0 flex flex-col h-full rounded-xl border bg-slate-100/70 dark:bg-slate-900/50 transition-colors select-none ${
        isOver
          ? 'border-blue-500/80 bg-blue-50/30 dark:bg-blue-950/20'
          : 'border-slate-200/80 dark:border-slate-800'
      }`}
    >
      {/* 1. Column Header (Sticky) */}
      <div className="p-3 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: column.color || '#64748b' }}
          />
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            {column.name}
          </h2>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
        </div>
      </div>

      {/* 2. Tasks Container (Independent scroll) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              isSelected={selectedTaskId === task._id}
              isRemoteUpdated={remoteUpdatedTaskIds.has(task._id)}
              activeViewerName={activeViewersMap[task._id]}
              onClick={() => onSelectTask(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-24 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );
};
