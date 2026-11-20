import React from 'react';

export const BoardSkeleton: React.FC = () => {
  const columns = [
    { titleWidth: 'w-20', count: 3, cards: ['w-5/6', 'w-3/4', 'w-full'] },
    { titleWidth: 'w-24', count: 4, cards: ['w-full', 'w-4/5', 'w-2/3', 'w-3/4'] },
    { titleWidth: 'w-16', count: 2, cards: ['w-3/4', 'w-5/6'] },
    { titleWidth: 'w-14', count: 3, cards: ['w-2/3', 'w-full', 'w-4/5'] },
  ];

  return (
    <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-start select-none">
      {columns.map((col, idx) => (
        <div
          key={idx}
          className="w-72 sm:w-80 flex-shrink-0 flex flex-col h-full rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/40"
        >
          {/* Column Header Skeleton */}
          <div className="p-3 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              {/* Color indicator dot */}
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse shrink-0" />
              {/* Column Title bar */}
              <div
                className={`h-3.5 ${col.titleWidth} rounded bg-slate-300/80 dark:bg-slate-700/80 animate-pulse skeleton-shimmer`}
              />
              {/* Count badge */}
              <div className="w-5 h-4 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>

            {/* Header action button placeholder */}
            <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>

          {/* Cards Skeleton Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {col.cards.map((widthClass, cIdx) => (
              <div
                key={cIdx}
                className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/90 shadow-subtle space-y-3"
              >
                {/* Title Line 1 */}
                <div
                  className={`h-3 ${widthClass} rounded bg-slate-200 dark:bg-slate-700 skeleton-shimmer`}
                />

                {/* Title Line 2 (subtle shorter line for realistic variation) */}
                {cIdx % 2 === 0 && (
                  <div className="h-2.5 w-1/2 rounded bg-slate-200/70 dark:bg-slate-700/60 skeleton-shimmer" />
                )}

                {/* Card Meta Row Skeleton */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {/* Priority icon placeholder */}
                    <div className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-700" />

                    {/* Date Pill placeholder */}
                    <div className="w-12 h-4 rounded bg-slate-100 dark:bg-slate-700/60 skeleton-shimmer" />

                    {/* Tag pill placeholder */}
                    <div className="w-10 h-4 rounded bg-slate-100 dark:bg-slate-700/60 skeleton-shimmer" />
                  </div>

                  {/* Assignee Avatar placeholder */}
                  <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
