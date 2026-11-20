import React, { useState } from 'react';
import { Column, TaskPriority } from '../types';
import { DraftTask, parseMeetingNoteToTasks } from '../services/gemini';
import {
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface AITaskFromTextModalProps {
  isOpen: boolean;
  columns: Column[];
  onClose: () => void;
  onCreateTask: (taskData: {
    columnId: string;
    title: string;
    description?: string;
    priority: TaskPriority;
  }) => Promise<void>;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  URGENT: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  HIGH: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  MEDIUM: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  LOW: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

export const AITaskFromTextModal: React.FC<AITaskFromTextModalProps> = ({
  isOpen,
  columns,
  onClose,
  onCreateTask,
}) => {
  const [inputText, setInputText] = useState('');
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingIndices, setCreatingIndices] = useState<Set<number>>(new Set());
  const [createdIndices, setCreatedIndices] = useState<Set<number>>(new Set());
  const [isCreatingAll, setIsCreatingAll] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setError(null);
    setDraftTasks([]);
    setCreatedIndices(new Set());
    try {
      const tasks = await parseMeetingNoteToTasks(inputText, columns);
      if (tasks.length === 0) {
        setError("No tasks found. Try pasting a meeting note with action items like 'we need to fix X' or 'Alice will handle Y'.");
      } else {
        setDraftTasks(tasks);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate tasks. Check your Gemini API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateOne = async (draft: DraftTask, idx: number) => {
    if (creatingIndices.has(idx) || createdIndices.has(idx)) return;
    setCreatingIndices(prev => new Set(prev).add(idx));
    try {
      await onCreateTask({
        columnId: draft.suggestedColumnId,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
      });
      setCreatedIndices(prev => new Set(prev).add(idx));
    } catch (err: any) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setCreatingIndices(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const handleCreateAll = async () => {
    setIsCreatingAll(true);
    setError(null);
    const pending = draftTasks
      .map((d, i) => ({ draft: d, idx: i }))
      .filter(({ idx }) => !createdIndices.has(idx));

    for (const { draft, idx } of pending) {
      await handleCreateOne(draft, idx);
    }
    setIsCreatingAll(false);
  };

  const handleRemoveDraft = (idx: number) => {
    setDraftTasks(prev => prev.filter((_, i) => i !== idx));
    setCreatedIndices(prev => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  const updateDraft = (idx: number, patch: Partial<DraftTask>) => {
    setDraftTasks(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const pendingCount = draftTasks.filter((_, i) => !createdIndices.has(i)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Task Generator
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste a meeting note or Slack message — AI extracts tasks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Input Area */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Paste your meeting note, Slack message, or requirements
            </label>
            <textarea
              rows={5}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`E.g. "In today's standup: Alice will fix the login bug (urgent), Bob needs to add pagination to the user list, and we should look into the memory leak next sprint..."`}
              className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10 leading-relaxed resize-none transition-all"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !inputText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating tasks...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Tasks</span>
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Draft Tasks List */}
          {draftTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {draftTasks.length} task{draftTasks.length > 1 ? 's' : ''} found
                </span>
                {pendingCount > 1 && (
                  <button
                    onClick={handleCreateAll}
                    disabled={isCreatingAll || pendingCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {isCreatingAll && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Create All ({pendingCount})</span>
                  </button>
                )}
              </div>

              {draftTasks.map((draft, idx) => {
                const isDone = createdIndices.has(idx);
                const isCreating = creatingIndices.has(idx);

                return (
                  <div
                    key={idx}
                    className={`border rounded-xl p-3.5 space-y-2.5 transition-all ${
                      isDone
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 opacity-70'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'
                    }`}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={draft.title}
                        disabled={isDone}
                        onChange={e => updateDraft(idx, { title: e.target.value })}
                        className="flex-1 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-violet-400 focus:outline-none py-0.5 px-1 transition-colors disabled:cursor-not-allowed"
                      />
                      {!isDone && (
                        <button
                          onClick={() => handleRemoveDraft(idx)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                          title="Remove draft"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <textarea
                      rows={2}
                      value={draft.description}
                      disabled={isDone}
                      onChange={e => updateDraft(idx, { description: e.target.value })}
                      className="w-full text-[11px] text-slate-600 dark:text-slate-300 bg-transparent resize-none focus:outline-none disabled:cursor-not-allowed leading-relaxed"
                    />

                    {/* Meta: Priority + Column + Action */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <select
                        value={draft.priority}
                        disabled={isDone}
                        onChange={e => updateDraft(idx, { priority: e.target.value as TaskPriority })}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${PRIORITY_STYLES[draft.priority]} bg-transparent focus:outline-none disabled:cursor-not-allowed`}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>

                      <select
                        value={draft.suggestedColumnId}
                        disabled={isDone}
                        onChange={e => {
                          const col = columns.find(c => c._id === e.target.value);
                          updateDraft(idx, {
                            suggestedColumnId: e.target.value,
                            suggestedColumnName: col?.name ?? '',
                          });
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none disabled:cursor-not-allowed"
                      >
                        {columns.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>

                      <div className="flex-1" />

                      {isDone ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Created
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCreateOne(draft, idx)}
                          disabled={isCreating || !draft.title.trim()}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-medium rounded-md transition-colors"
                        >
                          {isCreating && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>Create Task</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>Powered by Google Gemini</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
