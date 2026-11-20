import React, { useEffect, useState } from 'react';
import { UndoAction } from '../types';
import { RotateCcw, X } from 'lucide-react';

interface UndoToastProps {
  action: UndoAction | null;
  onUndo: (action: UndoAction) => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ action, onUndo, onDismiss }) => {
  if (!action) return null;

  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    setTimeLeft(5);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [action]);

  // Global Ctrl+Z shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo(action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, onUndo]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-lg shadow-float text-xs font-medium animate-slide-in border border-slate-700 dark:border-slate-200">
      <span>Moved "{action.title}"</span>

      <button
        onClick={() => onUndo(action)}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Undo ({timeLeft}s)</span>
        <kbd className="text-[10px] bg-blue-700 px-1 rounded font-mono">⌘Z</kbd>
      </button>

      <button
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-white dark:hover:text-slate-900 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
