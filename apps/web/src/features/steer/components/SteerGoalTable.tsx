'use client';

import Link from 'next/link';
import { SteerGoal } from '../store/steerSlice';

const PRIORITY_COLORS = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };
const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-600', active: 'bg-violet-100 text-violet-700', paused: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700', archived: 'bg-gray-100 text-gray-500' };

export function SteerGoalTable({ goals }: { goals: SteerGoal[] }) {
  if (!goals.length) return <div className="text-gray-400 text-center py-16">No steer goals yet. Create your first strategic AI goal.</div>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['Title', 'Type', 'Priority', 'Status', 'AI Alignment', 'Overdue'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {goals.map((goal) => (
            <tr key={goal.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/steer/${goal.id}`} className="font-semibold text-gray-900 hover:text-steer">{goal.title}</Link>
                <div className="text-xs text-gray-400 mt-0.5">{goal.description.slice(0, 60)}…</div>
              </td>
              <td className="px-4 py-3 text-gray-600 capitalize">{goal.goal_type}</td>
              <td className="px-4 py-3">
                <span className={`badge ${PRIORITY_COLORS[goal.priority]}`}>{goal.priority}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`badge ${STATUS_COLORS[goal.status]}`}>{goal.status}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(goal.ai_alignment_score * 100)}%`,
                        backgroundColor: goal.ai_alignment_score >= 0.7 ? '#22C55E' : goal.ai_alignment_score >= 0.4 ? '#EAB308' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="font-semibold text-gray-700">{Math.round(goal.ai_alignment_score * 100)}%</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {goal.is_overdue ? <span className="badge bg-red-100 text-red-700">Overdue</span> : <span className="text-gray-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
