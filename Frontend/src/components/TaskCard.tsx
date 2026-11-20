import React from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskPriority } from '../types';
import { AlertCircle, ArrowUp, ArrowDown, Minus, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  isRemoteUpdated?: boolean;
  isOverlay?: boolean;
  activeViewerName?: string;
  onClick: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isSelected,
  isRemoteUpdated,
  isOverlay,
  activeViewerName,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { task },
    animateLayoutChanges: args => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span title="Urgent">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </span>
        );
      case 'HIGH':
        return (
          <span title="High">
            <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
          </span>
        );
      case 'MEDIUM':
        return (
          <span title="Medium">
            <Minus className="w-3.5 h-3.5 text-blue-500" />
          </span>
        );
      case 'LOW':
        return (
          <span title="Low">
            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
          </span>
        );
    }
  };

  const formattedDate = task.dueDate ? format(new Date(task.dueDate), 'MMM d') : null;

  // Placeholder when dragging
  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative p-3 rounded-lg border-2 border-dashed border-blue-400/50 dark:border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20 min-h-[76px] transition-all select-none"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? undefined : style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative p-3 rounded-lg border text-left cursor-grab active:cursor-grabbing select-none ${
        isOverlay
          ? 'bg-white dark:bg-slate-800 border-blue-500 shadow-float rotate-2 scale-[1.02] z-50 ring-2 ring-blue-500/20'
          : 'bg-white dark:bg-slate-800/95 border-slate-200 dark:border-slate-700/80 shadow-subtle hover:border-slate-400 dark:hover:border-slate-500'
      } ${
        isSelected ? 'ring-2 ring-blue-500 border-transparent' : ''
      } ${
        isRemoteUpdated ? 'animate-highlight-fade' : ''
      }`}
    >
      {/* Active Teammate Viewing Pill */}
      {activeViewerName && (
        <div className="absolute -top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-600 text-white shadow-sm flex items-center gap-1 z-10 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>{activeViewerName} viewing</span>
        </div>
      )}

      {/* Task Title (max 2 lines with break-words to prevent overflow) */}
      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 break-words mb-1.5 leading-snug">
        {task.title}
      </h3>

      {/* Task Description (clamped to 2 lines, word wrapped cleanly) */}
      {task.description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed mb-2.5">
          {task.description}
        </p>
      )}

      {/* Task Meta Row: Priority, Due Date, Labels, Assignee */}
      <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-auto pt-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Priority Icon */}
          <span className="shrink-0">{getPriorityIcon(task.priority)}</span>

          {/* Due Date */}
          {formattedDate && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded shrink-0">
              <Calendar className="w-2.5 h-2.5 shrink-0" />
              <span>{formattedDate}</span>
            </span>
          )}

          {/* Label Chips */}
          {task.labels && task.labels.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {task.labels.slice(0, 2).map(label => (
                <span
                  key={label}
                  className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[80px]"
                >
                  {label}
                </span>
              ))}
              {task.labels.length > 2 && (
                <span className="text-[9px] text-slate-400 shrink-0">+{task.labels.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {/* Assignee Avatar */}
        {task.assigneeId && (
          <img
            src={
              task.assigneeId.avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${task.assigneeId.name}`
            }
            alt={task.assigneeId.name}
            title={task.assigneeId.name}
            className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-100 shrink-0 ml-auto"
          />
        )}
      </div>
    </div>
  );
};
