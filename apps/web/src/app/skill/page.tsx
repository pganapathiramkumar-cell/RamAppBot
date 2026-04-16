'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { fetchSkills, Skill } from '../../features/skill/store/skillSlice';
import { RootState, AppDispatch } from '../store';
import { PageLayout } from '../../components/layout/PageLayout';

/* ── Status config ──────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  draft:        { label: 'Draft',        dot: '#94a3b8', bg: '#f1f5f9', text: '#475569' },
  under_review: { label: 'Under Review', dot: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  approved:     { label: 'Approved',     dot: '#10b981', bg: '#d1fae5', text: '#065f46' },
  deployed:     { label: 'Deployed',     dot: '#6366f1', bg: '#ede9fe', text: '#4338ca' },
  deprecated:   { label: 'Deprecated',  dot: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
};

const CAT_COLORS: Record<string, string> = {
  nlp:            '#3b82f6',
  vision:         '#8b5cf6',
  rag:            '#0d9488',
  agents:         '#f97316',
  classification: '#0ea5e9',
  generation:     '#ec4899',
};
function catColor(cat: string) {
  return CAT_COLORS[cat.toLowerCase().replace(/[^a-z]/g, '')] ?? '#6366f1';
}

/* ── Accuracy ring ──────────────────────────────────────────── */
function AccuracyRing({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const r = 14, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="16" cy="16" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

/* ── Skill card ─────────────────────────────────────────────── */
function SkillCard({ skill }: { skill: Skill }) {
  const st  = STATUS_CFG[skill.status] ?? STATUS_CFG.draft;
  const col = catColor(skill.category);
  return (
    <Link href={`/skill/${skill.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        cursor: 'pointer', transition: 'box-shadow 0.18s, transform 0.18s',
        display: 'flex', flexDirection: 'column',
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Colour bar */}
        <div style={{ height: 4, background: col }} />

        <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Category + status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                           letterSpacing: '0.07em', color: col }}>
              {skill.category.replace(/_/g, ' ')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                           background: st.bg, color: st.text, padding: '3px 9px', borderRadius: 99 }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: st.dot, display: 'inline-block' }} />
              {st.label}
            </span>
          </div>

          {/* Name */}
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>
            {skill.name}
          </p>

          {/* Description */}
          <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.55,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {skill.description}
          </p>

          {/* Metrics row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        paddingTop: 10, borderTop: '1px solid #f8fafc', marginTop: 'auto' }}>
            <AccuracyRing value={skill.accuracy_score} />
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#94a3b8' }}>
              <span>⏱ {skill.latency_ms > 0 ? `${skill.latency_ms}ms` : '—'}</span>
              <span>📈 {skill.usage_count.toLocaleString()}</span>
            </div>
          </div>

          {/* Tags */}
          {skill.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {skill.tags.slice(0, 4).map((tag) => (
                <span key={tag} style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b',
                                         padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>
                  #{tag}
                </span>
              ))}
              {skill.tags.length > 4 && (
                <span style={{ fontSize: 11, background: '#f1f5f9', color: '#94a3b8',
                               padding: '2px 8px', borderRadius: 99 }}>
                  +{skill.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Summary metric card ────────────────────────────────────── */
function MetricCard({ icon, iconBg, value, label, sub, barPct, barColor }: {
  icon: string; iconBg: string; value: string | number;
  label: string; sub?: string; barPct?: number; barColor?: string;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {icon}
        </div>
        {barPct != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{barPct}%</span>
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 2px', letterSpacing: '-0.5px' }}>
        {value}
      </p>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>{sub}</p>}
      {barPct != null && barColor && (
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: 2,
                        transition: 'width 0.7s ease' }} />
        </div>
      )}
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────── */
function SkillSkeleton({ viewport }: { viewport: 'mobile' | 'tablet' | 'desktop' }) {
  const columns = viewport === 'mobile' ? '1fr' : viewport === 'tablet' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 16 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0',
                              padding: '0 0 18px', overflow: 'hidden' }}>
          <div style={{ height: 4, background: '#e2e8f0' }} />
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['60%', '20%'], ['70%'], ['90%'], ['75%']].map((widths, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 8 }}>
                {widths.map((w, wi) => (
                  <div key={wi} style={{ height: 10, borderRadius: 5, background: '#f1f5f9',
                                         width: w, animation: 'shimmer 1.4s ease infinite',
                                         backgroundImage: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
                                         backgroundSize: '200% 100%' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────── */
function EmptySkills() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
                  padding: '60px 20px', textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f0fdfa',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 30, margin: '0 auto 16px' }}>⚡</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>No skills in catalog yet</p>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
        Add your first AI skill to start building your capability catalog.
      </p>
      <Link href="/skill/create" style={{
        display: 'inline-block', background: 'linear-gradient(135deg,#0d9488,#059669)',
        color: '#fff', padding: '10px 24px', borderRadius: 12, fontSize: 13,
        fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 12px rgba(13,148,136,0.25)',
      }}>
        + Add First Skill
      </Link>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function SkillPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { skills, loading, error } = useSelector((s: RootState) => s.skill);
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) setViewport('mobile');
      else if (window.innerWidth < 1200) setViewport('tablet');
      else setViewport('desktop');
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = 'Skill AI | RamBot';
    dispatch(fetchSkills('org-123'));
  }, [dispatch]);

  const deployed  = skills.filter((s) => s.status === 'deployed').length;
  const avgAcc    = skills.length ? Math.round((skills.reduce((a, s) => a + s.accuracy_score, 0) / skills.length) * 100) : 0;
  const totalUses = skills.reduce((a, s) => a + s.usage_count, 0);

  const metrics = [
    { icon: '⚡', iconBg: '#f0fdfa', value: skills.length, label: 'Total Skills',  sub: 'across all categories' },
    { icon: '🚀', iconBg: '#ede9fe', value: deployed, label: 'Deployed',
      sub: `${skills.length ? Math.round(deployed / skills.length * 100) : 0}% of catalog`,
      barPct: skills.length ? Math.round(deployed / skills.length * 100) : 0,
      barColor: 'linear-gradient(90deg,#6366f1,#8b5cf6)' },
    { icon: '🎯', iconBg: avgAcc >= 80 ? '#d1fae5' : '#fef3c7', value: `${avgAcc}%`, label: 'Avg Accuracy',
      sub: avgAcc >= 80 ? 'Excellent quality' : avgAcc >= 60 ? 'Good quality' : 'Needs improvement',
      barPct: avgAcc,
      barColor: avgAcc >= 80 ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#fbbf24,#f59e0b)' },
    { icon: '📊', iconBg: '#dbeafe', value: totalUses >= 1000 ? `${(totalUses / 1000).toFixed(1)}k` : totalUses,
      label: 'Total Uses', sub: 'across all deployed skills' },
  ];

  return (
    <PageLayout
      title="Skill Catalog"
      subtitle="Manage and evaluate AI capabilities across your organisation"
      breadcrumb="Skill AI"
      action={
        <Link href="/skill/create" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg,#0d9488,#059669)',
          color: '#fff', padding: '9px 20px', borderRadius: 12,
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(13,148,136,0.25)',
        }}>
          + New Skill
        </Link>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Metric bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: viewport === 'mobile' ? '1fr' : viewport === 'tablet' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16 }}>
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>

        {/* ── Status filter pills ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'space-between',
                      flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: viewport === 'desktop' ? 'wrap' : 'nowrap', overflowX: viewport === 'desktop' ? 'visible' : 'auto', width: viewport === 'mobile' ? '100%' : 'auto', paddingBottom: viewport === 'mobile' ? 2 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', alignSelf: 'center' }}>Filter:</span>
            {Object.values(STATUS_CFG).map((st) => (
              <span key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                                            fontWeight: 600, background: st.bg, color: st.text,
                                            padding: '4px 12px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: st.dot, display: 'inline-block' }} />
                {st.label}
                <span style={{ opacity: 0.6 }}>
                  ({skills.filter((s) => s.status === Object.keys(STATUS_CFG).find((k) => STATUS_CFG[k] === st)).length})
                </span>
              </span>
            ))}
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>
            {skills.length} skill{skills.length !== 1 ? 's' : ''} total
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && !loading && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12,
                        padding: '12px 16px', fontSize: 13, color: '#92400e', fontWeight: 500 }}>
            ⚠️ Could not load skills — backend may be offline. Showing empty state.
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <SkillSkeleton viewport={viewport} />
        ) : skills.length === 0 ? (
          <EmptySkills />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: viewport === 'mobile' ? '1fr' : viewport === 'tablet' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 16 }}>
            {skills.map((skill) => <SkillCard key={skill.id} skill={skill} />)}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
