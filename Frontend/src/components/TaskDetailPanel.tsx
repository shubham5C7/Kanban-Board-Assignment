import React, { useState, useEffect, useRef } from 'react';
import { Task, Column, User, TaskPriority, ActivityLog } from '../types';
import {
  X,
  Calendar,
  User as UserIcon,
  Tag,
  AlertCircle,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  GitCompare,
  Layout,
  AlignLeft,
  CheckSquare,
  Sparkles,
  ChevronDown,
  Loader2,
  ListChecks,
} from 'lucide-react';
import { format } from 'date-fns';
import { summarizeTask, breakdownTask } from '../services/gemini';
import { api } from '../services/api';

interface TaskDetailPanelProps {
  task: Task | null;
  columns: Column[];
  members: User[];
  currentUserId: string;
  tenantId?: string;
  userRole?: string | null;
  activeViewerName?: string;
  conflictData: { currentRecord: Task; message: string } | null;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>, expectedVersion?: number) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onResolveConflict: (resolvedTask: Partial<Task>) => Promise<void>;
}

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  columns,
  members,
  currentUserId,
  tenantId,
  userRole,
  activeViewerName,
  conflictData,
  onClose,
  onUpdate,
  onDelete,
  onResolveConflict,
}) => {
  if (!task) return null;

  const [title, setTitle] = useState(task.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [columnId, setColumnId] = useState(task.columnId);
  const taskAssigneeId = task.assigneeId?._id || task.assigneeId?.id || '';
  const [assigneeId, setAssigneeId] = useState(taskAssigneeId);
  const [labelsInput, setLabelsInput] = useState(task.labels?.join(', ') || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // ── AI Feature States ──────────────────────────────────────────────────────
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [subtasks, setSubtasks] = useState<{ text: string; done: boolean }[]>([]);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  // Sync state if task changes externally
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setColumnId(task.columnId);
    setAssigneeId(task.assigneeId?._id || task.assigneeId?.id || '');
    setLabelsInput(task.labels?.join(', ') || '');
    setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
  }, [task]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Unified auto-save method
  const handleSave = async (overrides?: Partial<Task>) => {
    setIsSaving(true);
    try {
      const labels = labelsInput
        .split(',')
        .map(l => l.trim())
        .filter(Boolean);

      const validTitle = (overrides?.title !== undefined ? overrides.title : title).trim();
      if (!validTitle) {
        setTitle(task.title);
        setTitleError(null);
        setIsSaving(false);
        return;
      }

      const payload: Partial<Task> = {
        title: validTitle,
        description: description.trim(),
        priority,
        columnId,
        labels,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        ...overrides,
      };

      if (assigneeId) {
        payload.assigneeId = assigneeId as any;
      } else {
        payload.assigneeId = null;
      }

      await onUpdate(task._id, payload, task.version);
    } catch (err) {
      console.error('[TaskDetailPanel] Auto-save error', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Automatic Debounced Auto-Save for Text Fields (Title, Description, Labels)
  const isFirstRender = useRef(true);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleSave();
    }, 550);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [title, description, labelsInput]);

  const currentTaskAssigneeId = task.assigneeId?._id || task.assigneeId?.id;
  const canDelete =
    userRole === 'ORG_ADMIN' ||
    userRole === 'TENANT_ADMIN' ||
    (userRole === 'MEMBER' && currentTaskAssigneeId === currentUserId);

  // ── AI: Summarize Task ─────────────────────────────────────────────────────
  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummaryError(null);
    setAiSummary(null);
    try {
      let logs: ActivityLog[] = [];
      if (tenantId) {
        try {
          const res = await api.getActivity(tenantId);
          logs = (res.logs || []).filter(
            (l: ActivityLog) => l.entityId === task._id
          ) as ActivityLog[];
        } catch {
          // non-fatal — summarize without activity
        }
      }
      const summary = await summarizeTask(task, logs);
      setAiSummary(summary);
    } catch (err: any) {
      setSummaryError(err.message || 'Failed to generate summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // ── AI: Break Down Task ────────────────────────────────────────────────────
  const handleBreakdown = async () => {
    setIsBreakingDown(true);
    setBreakdownError(null);
    try {
      const items = await breakdownTask(task);
      setSubtasks(items.map(text => ({ text, done: false })));
    } catch (err: any) {
      setBreakdownError(err.message || 'Failed to generate subtasks.');
    } finally {
      setIsBreakingDown(false);
    }
  };

  const handleSaveSubtasksAsDescription = () => {
    const markdown = subtasks
      .map(s => `- [${s.done ? 'x' : ' '}] ${s.text}`)
      .join('\n');
    setDescription(markdown);
    setSubtasks([]);
    // debounce will auto-save
  };

  // Sync AI state when task changes
  useEffect(() => {
    setAiSummary(null);
    setSummaryError(null);
    setSubtasks([]);
    setBreakdownError(null);
  }, [task?._id]);

  const currentColumn = columns.find(c => c._id === columnId) || columns.find(c => c._id === task.columnId);
  const parsedLabels = labelsInput
    .split(',')
    .map(l => l.trim())
    .filter(Boolean);

  const priorityColors = {
    URGENT: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
    HIGH: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    MEDIUM: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    LOW: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };

  return (
    /* Trello-Style Centered Card Modal Dialog with Darkened Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto select-none transition-all"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ========================================================
            1. Trello Header: Icon, Large Title & Auto-Save Status
           ======================================================== */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 space-y-2 bg-slate-50/50 dark:bg-slate-850/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
              <CheckSquare className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    if (!e.target.value.trim()) {
                      setTitleError('Task title cannot be empty');
                    } else {
                      setTitleError(null);
                    }
                  }}
                  onBlur={() => {
                    if (!title.trim()) {
                      setTitle(task.title);
                      setTitleError(null);
                    } else {
                      handleSave();
                    }
                  }}
                  placeholder="Task title..."
                  className={`w-full text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 bg-transparent border-0 border-b ${
                    titleError
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-[#5D8FFC]'
                  } focus:outline-none transition-all px-1 py-0.5 rounded-sm`}
                />
                {titleError && (
                  <p className="px-1 text-[11px] text-rose-500 font-medium">{titleError}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1 px-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>in list</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-2">
                    {currentColumn?.name || 'Backlog'}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                    v{task.version}
                  </span>
                  {activeViewerName && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      {activeViewerName} viewing
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Controls: Auto-Save Badge & Close */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Live Auto-Save Pill */}
              <div className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {isSaving ? (
                  <span className="flex items-center gap-1 text-blue-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              <button
                onClick={onClose}
                title="Close modal (Esc)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            2. Conflict Resolution Banner (OCC 409 diff)
           ======================================================== */}
        {conflictData && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 p-4 space-y-2 shrink-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  Concurrent Edit Conflict Detected
                </div>
                <div className="text-amber-800 dark:text-amber-300">
                  Another teammate updated this card to version {conflictData.currentRecord.version}.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onResolveConflict({ title, description, priority })}
                className="px-2.5 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Keep My Version
              </button>
              <button
                onClick={() => onResolveConflict(conflictData.currentRecord)}
                className="px-2.5 py-1 text-xs font-medium rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 transition-colors"
              >
                Take Their Version
              </button>
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="px-2.5 py-1 text-xs font-medium rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 transition-colors flex items-center gap-1"
              >
                <GitCompare className="w-3 h-3" />
                <span>{showDiff ? 'Hide Diff' : 'View Diff'}</span>
              </button>
            </div>

            {showDiff && (
              <div className="mt-2 p-2 bg-white dark:bg-slate-900 rounded border border-amber-200 dark:border-amber-800 text-xs space-y-2 font-mono">
                <div className="grid grid-cols-2 gap-2 pb-1 border-b text-[10px] uppercase font-bold text-slate-400">
                  <div>Your Changes</div>
                  <div>Their Version</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="text-blue-600 dark:text-blue-400">{title}</div>
                  <div className="text-emerald-600 dark:text-emerald-400">{conflictData.currentRecord.title}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="text-slate-600 dark:text-slate-300">{description || '(empty)'}</div>
                  <div className="text-slate-600 dark:text-slate-300">{conflictData.currentRecord.description || '(empty)'}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            3. Responsive Trello Body: Main Area + Actions
           ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
          {/* Main Area (md:cols 1-8) */}
          <div className="md:col-span-8 space-y-5">
            {/* Quick Meta Chips (Assignee, Priority, Due Date) */}
            <div className="flex flex-wrap items-start gap-2.5 sm:gap-3 text-xs">
              {/* Assignee Pill */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Assignee
                </span>
                <div className="flex min-h-[26px] items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {task.assigneeId?.name || 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Priority Pill */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Priority
                </span>
                <span className={`inline-flex min-h-[26px] items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${priorityColors[priority]}`}>
                  {priority}
                </span>
              </div>

              {/* Due Date Pill */}
              {dueDate && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                    Due Date
                  </span>
                  <div className="flex min-h-[26px] items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{format(new Date(dueDate), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Labels List */}
            {parsedLabels.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Labels
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {parsedLabels.map((lbl, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    >
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description Area (Auto-saves continuously on typing) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-400" />
                  <span>Description</span>
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  (Auto-saves on typing)
                </span>
              </div>
              <textarea
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={() => handleSave()}
                placeholder="Add a more detailed description to this card..."
                className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#5D8FFC] focus:ring-4 focus:ring-[#5D8FFC]/10 leading-relaxed transition-all"
              />

              {/* ── AI Action Buttons ──────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Summarize */}
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50 transition-colors"
                >
                  {isSummarizing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{isSummarizing ? 'Summarizing…' : 'AI Summary'}</span>
                </button>

                {/* Break Down */}
                <button
                  onClick={handleBreakdown}
                  disabled={isBreakingDown}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
                >
                  {isBreakingDown ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ListChecks className="w-3 h-3" />
                  )}
                  <span>{isBreakingDown ? 'Breaking down…' : 'Break Down'}</span>
                </button>
              </div>

              {/* AI Summary Result */}
              {summaryError && (
                <div className="p-3 text-[11px] rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                  {summaryError}
                </div>
              )}
              {aiSummary && (
                <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-violet-600 dark:text-violet-400">
                    <Sparkles className="w-3 h-3" />
                    <span>AI Summary</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {aiSummary}
                  </p>
                </div>
              )}

              {/* Subtask Breakdown Result */}
              {breakdownError && (
                <div className="p-3 text-[11px] rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                  {breakdownError}
                </div>
              )}
              {subtasks.length > 0 && (
                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">
                      <ListChecks className="w-3 h-3" />
                      <span>AI Subtasks</span>
                    </div>
                    <button
                      onClick={handleSaveSubtasksAsDescription}
                      className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Save to Description
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {subtasks.map((sub, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sub.done}
                          onChange={() =>
                            setSubtasks(prev =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, done: !s.done } : s
                              )
                            )
                          }
                          className="mt-0.5 h-3.5 w-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span
                          className={`text-[11px] leading-relaxed ${
                            sub.done
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {sub.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Action Sidebar (md:cols 9-12) */}
          <div className="md:col-span-4 space-y-3.5 text-xs border-t md:border-t-0 md:border-l border-slate-200/80 dark:border-slate-800/80 pt-4 md:pt-0 md:pl-5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
              Properties & Actions
            </span>

            {/* Move to Column */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Status / Column
              </label>
              <select
                value={columnId}
                onChange={e => {
                  const newCol = e.target.value;
                  setColumnId(newCol);
                  handleSave({ columnId: newCol });
                }}
                className="w-full py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5D8FFC]"
              >
                {columns.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={e => {
                  const val = e.target.value;
                  setAssigneeId(val);
                  const assigned = members.find(m => m.id === val || m._id === val);
                  handleSave({ assigneeId: assigned ? (assigned as any) : null });
                }}
                className="w-full py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5D8FFC]"
              >
                <option value="">Unassigned</option>
                {members.map(m => {
                  const mId = m._id || m.id;
                  return (
                    <option key={mId} value={mId}>
                      {m.name}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => {
                  const nextP = e.target.value as TaskPriority;
                  setPriority(nextP);
                  handleSave({ priority: nextP });
                }}
                className="w-full py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5D8FFC]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => {
                  const d = e.target.value;
                  setDueDate(d);
                  handleSave({ dueDate: d ? new Date(d).toISOString() : null });
                }}
                className="w-full py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5D8FFC]"
              />
            </div>

            {/* Labels Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Labels (comma-separated)
              </label>
              <input
                type="text"
                value={labelsInput}
                onChange={e => setLabelsInput(e.target.value)}
                onBlur={() => handleSave()}
                placeholder="e.g. Design, Mobile"
                className="w-full py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5D8FFC]"
              />
            </div>

            {/* Delete Task */}
            {canDelete && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(task._id);
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Card</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            4. Footer: Auto-Save Status & Creation Date
           ======================================================== */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-850/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            {isSaving ? (
              <span className="flex items-center gap-1 text-blue-500 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving changes to server...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All changes auto-saved</span>
              </span>
            )}
          </div>
          <span>Created {format(new Date(task.createdAt), 'MMM d, yyyy')}</span>
        </div>
      </div>
    </div>
  );
};
