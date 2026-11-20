import React from 'react';
import { PresenceUser, FilterState } from '../types';
import { Search, Menu, Sparkles } from 'lucide-react';
import { ConnectionStatus } from '../services/socket';

interface NavbarProps {
  boardName: string;
  boardDescription?: string;
  presenceUsers: PresenceUser[];
  connectionStatus: ConnectionStatus;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onOpenCreateTask: () => void;
  onOpenAITaskFromText?: () => void;
  onlineCount: number;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  boardName,
  boardDescription,
  filters,
  onFilterChange,
  onOpenCreateTask,
  onOpenAITaskFromText,
  onToggleSidebar,
}) => {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 shrink-0 select-none">
      {/* 1. Mobile Menu Toggle & Board Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Toggle Sidebar Menu"
            className="md:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
            aria-label="Open Sidebar Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
            {boardName}
          </h1>
          {boardDescription && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden lg:block">
              {boardDescription}
            </p>
          )}
        </div>
      </div>

      {/* 2. Search & Filters */}
      <div className="flex items-center gap-2 flex-1 max-w-xs sm:max-w-md justify-center">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            id="task-search-input"
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-2 sm:pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <kbd className="hidden sm:inline-block absolute right-2 top-2 text-[10px] font-mono text-slate-400 bg-slate-200 dark:bg-slate-700 px-1 rounded">
            /
          </kbd>
        </div>

        {/* Priority Filter (Hidden on very small screens to avoid overflow) */}
        <select
          value={filters.priority}
          onChange={e => onFilterChange({ ...filters, priority: e.target.value })}
          className="hidden sm:block text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none shrink-0"
        >
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* 3. Presence Avatars & New Task Button */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* AI Task from Text Button */}
        {onOpenAITaskFromText && (
          <button
            onClick={onOpenAITaskFromText}
            title="Generate tasks from meeting notes with AI"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-xs font-medium transition-colors shadow-sm shrink-0"
            aria-label="AI Generate Tasks"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Tasks</span>
          </button>
        )}

        {/* New Task Button */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors shrink-0"
        >
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>
    </header>
  );
};
