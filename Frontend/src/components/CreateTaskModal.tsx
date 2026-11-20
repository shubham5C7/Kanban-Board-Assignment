import React, { useState, useRef } from 'react';
import { Column, User, TaskPriority } from '../types';
import { X, Plus } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  columns: Column[];
  members: User[];
  defaultColumnId?: string;
  onClose: () => void;
  onSubmit: (taskData: {
    columnId: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    assigneeId?: string;
    labels?: string[];
  }) => Promise<void>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  columns,
  members,
  defaultColumnId,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId || columns[0]?._id || '');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [labels, setLabels] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Task title cannot be empty or whitespace only.');
      return;
    }
    if (!columnId) {
      return;
    }
    if (submittingRef.current || isSubmitting) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setTitleError(null);
    try {
      const parsedLabels = labels
        .split(',')
        .map(l => l.trim())
        .filter(Boolean);

      const validAssignee =
        assigneeId && assigneeId.trim() !== '' && assigneeId !== 'undefined'
          ? assigneeId
          : undefined;

      await onSubmit({
        columnId,
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: validAssignee,
        labels: parsedLabels,
      });

      setTitle('');
      setTitleError(null);
      setDescription('');
      setLabels('');
      setAssigneeId('');
      onClose();
    } catch (err) {
      console.error('[CreateTaskModal] Error creating task', err);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-float p-5 sm:p-6 space-y-4 my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Create New Task
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                if (titleError && e.target.value.trim()) setTitleError(null);
              }}
              placeholder="e.g. Implement WebSocket reconnection"
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border ${
                titleError
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
              } rounded-md focus:outline-none focus:ring-1`}
            />
            {titleError && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{titleError}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Column
              </label>
              <select
                value={columnId}
                onChange={e => setColumnId(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none"
              >
                {columns.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none"
            >
              <option value="">Unassigned</option>
              {members.map(m => {
                const memberId = m._id || m.id;
                return (
                  <option key={memberId} value={memberId}>
                    {m.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              value={labels}
              onChange={e => setLabels(e.target.value)}
              placeholder="Backend, P0, Auth"
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none"
            />
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Task details and acceptance criteria..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md shadow-sm transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
