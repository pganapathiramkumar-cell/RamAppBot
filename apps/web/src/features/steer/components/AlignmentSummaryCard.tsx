'use client';

import { SteerGoal } from '../store/steerSlice';

export function AlignmentSummaryCard({ goals, loading }: { goals: SteerGoal[]; loading?: boolean }) {
  const avg       = goals.length
    ? Math.round((goals.reduce((a, g) => a + g.ai_alignment_score, 0) / goals.length) * 100)
    : 0;
  const active    = goals.filter((g) => g.status === 'active').length;
  const overdue   = goals.filter((g) => g.is_overdue).length;
  const completed = goals.filter((g) => g.status === 'completed').length;

  const avgColor  = avg >= 70 ? 'text-emerald-700'
                  : avg >= 40 ? 'text-amber-700'
                  : 'text-red-700';
  const avgBar    = avg >= 70 ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : avg >= 40 ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                  : 'bg-gradient-to-r from-red-400 to-rose-500';
  const avgBg     = avg >= 70 ? 'bg-emerald-100' : avg >= 40 ? 'bg-amber-100' : 'bg-red-100';

  const metrics = [
    {
      label: 'AI Alignment',
      value: `${avg}%`,
      icon: '🎯',
      iconBg: avgBg,
      valueColor: avgColor,
      bar: avg,
      barColor: avgBar,
      sub: avg >= 70 ? 'On track' : avg >= 40 ? 'Needs attention' : 'Critical',
      subColor: avg >= 70 ? 'text-emerald-600' : avg >= 40 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Total Goals',
      value: goals.length,
      icon: '📋',
      iconBg: 'bg-indigo-100',
      valueColor: 'text-slate-900',
      bar: null,
      sub: `${completed} completed`,
      subColor: 'text-slate-400',
    },
    {
      label: 'Active',
      value: active,
      icon: '▶️',
      iconBg: 'bg-violet-100',
      valueColor: 'text-violet-700',
      bar: goals.length ? Math.round((active / goals.length) * 100) : 0,
      barColor: 'bg-gradient-to-r from-violet-500 to-indigo-500',
      sub: goals.length ? `${Math.round((active / goals.length) * 100)}% of total` : '—',
      subColor: 'text-slate-400',
    },
    {
      label: 'Overdue',
      value: overdue,
      icon: overdue > 0 ? '⚠️' : '✅',
      iconBg: overdue > 0 ? 'bg-red-100' : 'bg-emerald-100',
      valueColor: overdue > 0 ? 'text-red-700' : 'text-emerald-700',
      bar: null,
      sub: overdue > 0 ? 'Needs review' : 'All on schedule',
      subColor: overdue > 0 ? 'text-red-500' : 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={`metric-card animate-fade-in-up stagger-${i + 1} opacity-0`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center text-lg`}>
              {m.icon}
            </span>
          </div>
          <div className={`text-2xl font-bold tracking-tight ${m.valueColor}`}>
            {loading ? <span className="skeleton h-7 w-16 block" /> : m.value}
          </div>
          <div className="text-xs font-medium text-slate-500">{m.label}</div>
          {m.bar !== null && (
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${m.barColor}`}
                style={{ width: loading ? '0%' : `${m.bar}%` }}
              />
            </div>
          )}
          <div className={`text-[11px] font-medium ${m.subColor} mt-1`}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
}
