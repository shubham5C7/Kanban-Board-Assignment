import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../services/socket';

interface OfflineBannerProps {
  status: ConnectionStatus;
  queuedCount: number;
  onRetry: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ status, queuedCount, onRetry }) => {
  if (status === 'connected') return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in shrink-0">
      <div className="flex items-center gap-2">
        <WifiOff className="w-3.5 h-3.5" />
        <span>
          {status === 'reconnecting'
            ? 'Connection lost. Reconnecting to live sync server...'
            : 'You are currently offline. Local actions are queued and will automatically sync on reconnect.'}
        </span>
        {queuedCount > 0 && (
          <span className="bg-amber-600/30 text-amber-950 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {queuedCount} changes queued
          </span>
        )}
      </div>

      <button
        onClick={onRetry}
        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded text-[11px] transition-colors"
      >
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span>Sync Now</span>
      </button>
    </div>
  );
};
