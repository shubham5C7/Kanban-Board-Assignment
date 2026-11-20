import React, { useEffect, useState } from 'react';
import { UndoAction } from '../types';
import { RotateCcw, X } from 'lucide-react';

interface UndoToastProps {
  action: UndoAction | null;
  redoAction: UndoAction | null;
  onUndo: (action: UndoAction) => void;
  onRedo: (action: UndoAction) => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  action,
  redoAction,
  onUndo,
  onRedo,
  onDismiss,
}) => {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (!action) return;
    setTimeLeft(5);
    const interval = setInterval(() => {
      setTimeLeft(previous => {
        if (previous <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [action?.timestamp]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (event.shiftKey && redoAction) {
        event.preventDefault();
        onRedo(redoAction);
      } else if (!event.shiftKey && action) {
        event.preventDefault();
        onUndo(action);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, redoAction, onUndo, onRedo]);

  if (!action && !redoAction) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-lg shadow-float text-xs font-medium animate-slide-in border border-slate-700 dark:border-slate-200">
      <span>{action ? `Changed "${action.title}"` : `Undid "${redoAction?.title}"`}</span>
      {action && (
        <button onClick={() => onUndo(action)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs transition-colors">
          <RotateCcw className="w-3 h-3" />
          <span>Undo ({timeLeft}s)</span>
          <kbd className="text-[10px] bg-blue-700 px-1 rounded font-mono">Ctrl+Z</kbd>
        </button>
      )}
      {redoAction && (
        <button onClick={() => onRedo(redoAction)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs transition-colors">
          <RotateCcw className="w-3 h-3" />
          <span>Redo</span>
          <kbd className="text-[10px] bg-blue-700 px-1 rounded font-mono">Ctrl+Shift+Z</kbd>
        </button>
      )}
      <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-white dark:hover:text-slate-900 transition-colors" aria-label="Dismiss history actions">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
