'use client';

import Link from 'next/link';
import { SteerGoal } from '../store/steerSlice';

const PRIORITY: Record<string, { badge: string; row: string; dot: string }> = {
  critical: { badge: 'badge-red',    row: 'border-l-[3px] border-l-red-400',    dot: 'bg-red-400'    },
  high:     { badge: 'badge-orange', row: 'border-l-[3px] border-l-orange-400', dot: 'bg-orange-400' },
  medium:   { badge: 'badge-yellow', row: 'border-l-[3px] border-l-amber-400',  dot: 'bg-amber-400'  },
  low:      { badge: 'badge-green',  row: 'border-l-[3px] border-l-emerald-400',dot: 'bg-emerald-400'},
};

const STATUS: Record<string, { badge: string; dot: string; label: string }> = {
  draft:     { badge: 'badge-gray',   dot: 'bg-slate-300',   label: 'Draft'     },
  active:    { badge: 'badge-violet', dot: 'bg-violet-500',  label: 'Active'    },
  paused:    { badge: 'badge-yellow', dot: 'bg-amber-400',   label: 'Paused'    },
  completed: { badge: 'badge-green',  dot: 'bg-emerald-400', label: 'Completed' },
  archived:  { badge: 'badge-gray',   dot: 'bg-slate-200',   label: 'Archived'  },
};

const GOAL_TYPE_ICONS: Record<string, string> = {
  strategic: '🏆',
  operational: '⚙️',
  compliance: '📜',
  innovation: '💡',
};

function AlignmentBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const grad  = pct >= 70
    ? 'linear-gradient(90deg,#34d399,#10b981)'
    : pct >= 40
    ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
    : 'linear-gradient(90deg,#f87171,#ef4444)';

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: grad, transition: 'width 0.5s ease' }}
        />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function SteerGoalTable({ goals }: { goals: SteerGoal[] }) {
  if (!goals.length) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-4">🧭</span>
        <p className="font-semibold text-slate-700 text-lg">No strategic goals yet</p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          Create your first AI strategic goal to begin aligning your organisation.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in-up opacity-0">
      {/* Table header */}
      <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 hidden md:grid grid-cols-[1fr_100px_90px_100px_140px_80px] gap-4 items-center">
        {['Goal', 'Type', 'Priority', 'Status', 'AI Alignment', 'Overdue'].map((h) => (
          <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50">
        {goals.map((goal) => {
          const prio = PRIORITY[goal.priority] ?? PRIORITY.medium;
          const stat = STATUS[goal.status]     ?? STATUS.draft;
          const typeIcon = GOAL_TYPE_ICONS[goal.goal_type] ?? '📋';

          return (
            <div
              key={goal.id}
              className={`px-5 py-4 hover:bg-slate-50/80 transition-colors grid grid-cols-1 md:grid-cols-[1fr_100px_90px_100px_140px_80px] gap-3 md:gap-4 items-center ${prio.row}`}
            >
              {/* Title */}
              <div>
                <Link
                  href={`/steer/${goal.id}`}
                  className="font-semibold text-slate-900 hover:text-violet-700 text-sm transition-colors line-clamp-1"
                >
                  {goal.title}
                </Link>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                  {goal.description.slice(0, 70)}{goal.description.length > 70 ? '…' : ''}
                </p>
              </div>

              {/* Type */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{typeIcon}</span>
                <span className="text-xs text-slate-600 capitalize font-medium">{goal.goal_type}</span>
              </div>

              {/* Priority */}
              <div>
                <span className={`${prio.badge} flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                  {goal.priority}
                </span>
              </div>

              {/* Status */}
              <div>
                <span className={`${stat.badge} flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stat.dot}`} />
                  {stat.label}
                </span>
              </div>

              {/* AI Alignment */}
              <AlignmentBar score={goal.ai_alignment_score} />

              {/* Overdue */}
              <div>
                {goal.is_overdue ? (
                  <span className="badge-red flex items-center gap-1 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Overdue
                  </span>
                ) : (
                  <span className="text-slate-300 text-sm font-medium">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">{goals.length} goal{goals.length !== 1 ? 's' : ''}</span>
        <span className="text-xs text-slate-400">
          {goals.filter((g) => g.is_overdue).length} overdue
        </span>
      </div>
    </div>
  );
}
