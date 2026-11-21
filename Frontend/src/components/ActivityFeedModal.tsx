import React, { useEffect, useState } from 'react';
import { ActivityLog } from '../types';
import { api } from '../services/api';
import { X, Activity, User, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityFeedModal: React.FC<ActivityFeedModalProps> = ({
  tenantId,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const loadActivity = async () => {
      setIsLoading(true);
      try {
        const res = await api.getActivity(tenantId);
        setLogs(res.logs);
      } catch (err) {
        console.error('[Activity] Error fetching logs', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadActivity();
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full sm:w-[420px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-float flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tenant Activity Feed
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading activity feed...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 italic">No activity recorded yet</div>
          ) : (
            logs.map(log => (
              <div
                key={log._id}
                className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{log.actorName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 mr-1.5">
                    {log.action === 'BOARD_DELETED' ? 'Board deleted' : log.action.replace('_', ' ')}
                  </span>
                  {log.details?.title && `"${log.details.title}" `}
                  {log.details?.toColumnName && `to ${log.details.toColumnName}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
