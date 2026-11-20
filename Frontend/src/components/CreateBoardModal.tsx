import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
}

export const CreateBoardModal: React.FC<CreateBoardModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Board name cannot be empty or whitespace only.');
      return;
    }
    if (submittingRef.current || isSubmitting) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setNameError(null);
    try {
      await onSubmit(name.trim(), description.trim());
      setName('');
      setNameError(null);
      setDescription('');
      onClose();
    } catch (err) {
      console.error('[CreateBoardModal] Error creating board', err);
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
        className="w-full max-w-sm max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-float p-5 sm:p-6 space-y-4 my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Create Board
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
              Board Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError(null);
              }}
              placeholder="e.g. Sprint 24 & Core Delivery"
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border ${
                nameError
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
              } rounded-md focus:outline-none focus:ring-1`}
            />
            {nameError && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{nameError}</p>
            )}
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Board purpose and goals..."
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
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md shadow-sm transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
