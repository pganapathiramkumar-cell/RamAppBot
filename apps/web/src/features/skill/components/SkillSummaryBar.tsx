'use client';

import { Skill } from '../store/skillSlice';

export function SkillSummaryBar({ skills }: { skills: Skill[] }) {
  const deployed = skills.filter((s) => s.status === 'deployed').length;
  const avgAcc = skills.length ? Math.round((skills.reduce((a, s) => a + s.accuracy_score, 0) / skills.length) * 100) : 0;
  const totalUses = skills.reduce((a, s) => a + s.usage_count, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Total Skills', value: skills.length, color: 'text-gray-900' },
        { label: 'Deployed', value: deployed, color: 'text-skill' },
        { label: 'Avg Accuracy', value: `${avgAcc}%`, color: avgAcc >= 80 ? 'text-green-600' : 'text-yellow-600' },
        { label: 'Total Uses', value: totalUses.toLocaleString(), color: 'text-gray-900' },
      ].map(({ label, value, color }) => (
        <div key={label} className="card text-center">
          <div className={`text-3xl font-bold ${color}`}>{value}</div>
          <div className="text-sm text-gray-500 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}
