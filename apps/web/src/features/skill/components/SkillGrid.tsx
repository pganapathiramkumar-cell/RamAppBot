'use client';

import Link from 'next/link';
import { Skill } from '../store/skillSlice';

/* ── Visual config per status ─────────────────────────────────── */
const STATUS: Record<string, { badge: string; dot: string; label: string }> = {
  draft:        { badge: 'badge-gray',   dot: 'bg-slate-400',   label: 'Draft'         },
  under_review: { badge: 'badge-yellow', dot: 'bg-amber-400',   label: 'Under Review'  },
  approved:     { badge: 'badge-green',  dot: 'bg-emerald-400', label: 'Approved'      },
  deployed:     { badge: 'badge-violet', dot: 'bg-violet-500',  label: 'Deployed'      },
  deprecated:   { badge: 'badge-red',    dot: 'bg-red-400',     label: 'Deprecated'    },
};

/* ── Category gradient headers ────────────────────────────────── */
const CAT_STYLE: Record<string, string> = {
  nlp:            'from-blue-500   to-indigo-500',
  vision:         'from-violet-500 to-purple-600',
  rag:            'from-teal-500   to-emerald-500',
  agents:         'from-orange-400 to-red-500',
  classification: 'from-sky-500    to-cyan-500',
  generation:     'from-pink-500   to-rose-500',
  default:        'from-slate-400  to-slate-500',
};

function getCatGradient(category: string) {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  return CAT_STYLE[key] ?? CAT_STYLE.default;
}

function AccuracyRing({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const r     = 16;
  const circ  = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;

  return (
    <div className="flex items-center gap-1.5">
      <svg width="36" height="36" className="-rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function SkillGrid({ skills }: { skills: Skill[] }) {
  if (!skills.length) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-4">⚡</span>
        <p className="font-semibold text-slate-700 text-lg">No skills yet</p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          Add your first AI skill to start building your capability catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skills.map((skill, i) => {
        const st = STATUS[skill.status] ?? STATUS.draft;
        const grad = getCatGradient(skill.category);
        return (
          <Link
            key={skill.id}
            href={`/skill/${skill.id}`}
            className={`card-interactive overflow-hidden flex flex-col animate-fade-in-up opacity-0 stagger-${Math.min(i + 1, 4)}`}
          >
            {/* Gradient header strip */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${grad} flex-shrink-0`} />

            <div className="p-5 flex flex-col gap-3 flex-1">
              {/* Category + Status row */}
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>
                  {skill.category.replace(/_/g, ' ')}
                </span>
                <span className={`${st.badge} flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>

              {/* Name */}
              <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-teal-700 transition-colors">
                {skill.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed flex-1">
                {skill.description}
              </p>

              {/* Metrics row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <AccuracyRing value={skill.accuracy_score} />
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="text-slate-300">⏱</span>
                    {skill.latency_ms > 0 ? `${skill.latency_ms}ms` : '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-300">📈</span>
                    {skill.usage_count.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skill.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                      #{tag}
                    </span>
                  ))}
                  {skill.tags.length > 4 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                      +{skill.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
