'use client';

import { Skill } from '../store/skillSlice';

const METRICS = (skills: Skill[]) => {
  const deployed = skills.filter((s) => s.status === 'deployed').length;
  const reviewed = skills.filter((s) => s.status === 'approved' || s.status === 'deployed').length;
  const avgAcc   = skills.length
    ? Math.round((skills.reduce((a, s) => a + s.accuracy_score, 0) / skills.length) * 100)
    : 0;
  const totalUses = skills.reduce((a, s) => a + s.usage_count, 0);

  return [
    {
      label: 'Total Skills',
      value: skills.length,
      icon: '⚡',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      valueColor: 'text-slate-900',
      bar: null,
    },
    {
      label: 'Deployed',
      value: deployed,
      icon: '🚀',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      valueColor: 'text-violet-700',
      bar: skills.length ? Math.round((deployed / skills.length) * 100) : 0,
      barColor: 'bg-gradient-to-r from-violet-500 to-indigo-500',
    },
    {
      label: 'Avg Accuracy',
      value: `${avgAcc}%`,
      icon: '🎯',
      iconBg: avgAcc >= 80 ? 'bg-emerald-100' : 'bg-amber-100',
      iconColor: avgAcc >= 80 ? 'text-emerald-600' : 'text-amber-600',
      valueColor: avgAcc >= 80 ? 'text-emerald-700' : 'text-amber-700',
      bar: avgAcc,
      barColor: avgAcc >= 80
        ? 'bg-gradient-to-r from-emerald-400 to-green-500'
        : 'bg-gradient-to-r from-amber-400 to-yellow-500',
    },
    {
      label: 'Total Uses',
      value: totalUses >= 1000 ? `${(totalUses / 1000).toFixed(1)}k` : totalUses.toLocaleString(),
      icon: '📊',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
      bar: null,
    },
  ];
};

export function SkillSummaryBar({ skills, loading }: { skills: Skill[]; loading?: boolean }) {
  const metrics = METRICS(skills);

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
            {m.bar !== null && (
              <span className={`text-xs font-semibold ${m.valueColor}`}>{m.bar}%</span>
            )}
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
        </div>
      ))}
    </div>
  );
}
