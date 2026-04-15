'use client';

import Link from 'next/link';
import { Skill } from '../store/skillSlice';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  deployed: 'bg-violet-100 text-violet-700',
  deprecated: 'bg-red-100 text-red-600',
};

export function SkillGrid({ skills }: { skills: Skill[] }) {
  if (!skills.length) return <div className="text-gray-400 text-center py-16">No skills in catalog yet. Add your first AI skill.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skills.map((skill) => (
        <Link key={skill.id} href={`/skill/${skill.id}`} className="card hover:shadow-md transition-shadow block group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-skill uppercase tracking-wide">{skill.category.replace('_', ' ')}</span>
            <span className={`badge ${STATUS_COLORS[skill.status]}`}>{skill.status.replace('_', ' ')}</span>
          </div>
          <h3 className="font-bold text-gray-900 group-hover:text-skill transition-colors mb-2">{skill.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mb-4">{skill.description}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{Math.round(skill.accuracy_score * 100)}% acc</span>
            <span>{skill.latency_ms > 0 ? `${skill.latency_ms}ms` : '—'}</span>
            <span>{skill.usage_count.toLocaleString()} uses</span>
          </div>
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {skill.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
