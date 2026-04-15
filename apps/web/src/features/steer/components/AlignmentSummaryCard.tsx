'use client';

import { SteerGoal } from '../store/steerSlice';

export function AlignmentSummaryCard({ goals }: { goals: SteerGoal[] }) {
  const avg = goals.length ? Math.round((goals.reduce((a, g) => a + g.ai_alignment_score, 0) / goals.length) * 100) : 0;
  const active = goals.filter((g) => g.status === 'active').length;
  const overdue = goals.filter((g) => g.is_overdue).length;
  const completed = goals.filter((g) => g.status === 'completed').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Avg AI Alignment', value: `${avg}%`, color: avg >= 70 ? 'text-green-600' : avg >= 40 ? 'text-yellow-600' : 'text-red-600' },
        { label: 'Total Goals', value: goals.length, color: 'text-gray-900' },
        { label: 'Active', value: active, color: 'text-steer' },
        { label: 'Overdue', value: overdue, color: overdue > 0 ? 'text-red-600' : 'text-green-600' },
      ].map(({ label, value, color }) => (
        <div key={label} className="card text-center">
          <div className={`text-3xl font-bold ${color}`}>{value}</div>
          <div className="text-sm text-gray-500 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}
