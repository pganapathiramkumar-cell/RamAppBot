'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { fetchSteerGoals, SteerGoal } from '../../features/steer/store/steerSlice';
import { RootState, AppDispatch } from '../store';
import { PageLayout } from '../../components/layout/PageLayout';

/* ── Config ─────────────────────────────────────────────────── */
const PRIORITY_CFG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  critical: { label: 'Critical', dot: '#ef4444', bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  high:     { label: 'High',     dot: '#f97316', bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
  medium:   { label: 'Medium',   dot: '#f59e0b', bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  low:      { label: 'Low',      dot: '#10b981', bg: '#d1fae5', text: '#065f46', border: '#10b981' },
};
const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  draft:     { label: 'Draft',     dot: '#94a3b8', bg: '#f1f5f9', text: '#475569' },
  active:    { label: 'Active',    dot: '#6366f1', bg: '#ede9fe', text: '#4338ca' },
  paused:    { label: 'Paused',    dot: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  completed: { label: 'Completed', dot: '#10b981', bg: '#d1fae5', text: '#065f46' },
  archived:  { label: 'Archived',  dot: '#cbd5e1', bg: '#f8fafc', text: '#94a3b8' },
};
const TYPE_ICONS: Record<string, string> = {
  strategic: '🏆', operational: '⚙️', compliance: '📜', innovation: '💡',
};

/* ── Alignment bar ──────────────────────────────────────────── */
function AlignBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const grad  = pct >= 70
    ? 'linear-gradient(90deg,#34d399,#10b981)'
    : pct >= 40
    ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
    : 'linear-gradient(90deg,#f87171,#ef4444)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: grad,
                      borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

/* ── Metric card ────────────────────────────────────────────── */
function MetricCard({ icon, iconBg, value, label, sub, valueColor, barPct, barColor }: {
  icon: string; iconBg: string; value: string | number; label: string;
  sub?: string; valueColor?: string; barPct?: number; barColor?: string;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: valueColor ?? '#0f172a',
                  margin: '0 0 2px', letterSpacing: '-0.5px' }}>
        {value}
      </p>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0' }}>{sub}</p>}
      {barPct != null && barColor && (
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: barColor,
                        borderRadius: 2, transition: 'width 0.7s ease' }} />
        </div>
      )}
    </div>
  );
}

/* ── Goal row ───────────────────────────────────────────────── */
function GoalRow({ goal }: { goal: SteerGoal }) {
  const prio = PRIORITY_CFG[goal.priority] ?? PRIORITY_CFG.medium;
  const stat = STATUS_CFG[goal.status]     ?? STATUS_CFG.draft;
  const icon = TYPE_ICONS[goal.goal_type]  ?? '📋';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 100px 110px 160px 90px',
      gap: 16, alignItems: 'center',
      padding: '14px 20px',
      borderBottom: '1px solid #f8fafc',
      borderLeft: `3px solid ${prio.border}`,
      transition: 'background 0.12s',
    }}
      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = '#fafbfc'}
      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
    >
      {/* Title */}
      <div>
        <Link href={`/steer/${goal.id}`} style={{
          fontSize: 13, fontWeight: 700, color: '#0f172a', textDecoration: 'none',
        }}
          onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#4f46e5'}
          onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#0f172a'}
        >
          {goal.title}
        </Link>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {goal.description.slice(0, 65)}{goal.description.length > 65 ? '…' : ''}
        </p>
      </div>

      {/* Type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, textTransform: 'capitalize' }}>
          {goal.goal_type}
        </span>
      </div>

      {/* Priority */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                     fontWeight: 600, background: prio.bg, color: prio.text,
                     padding: '3px 10px', borderRadius: 99, width: 'fit-content' }}>
        <span style={{ width: 5, height: 5, borderRadius: 3, background: prio.dot, display: 'inline-block' }} />
        {prio.label}
      </span>

      {/* Status */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                     fontWeight: 600, background: stat.bg, color: stat.text,
                     padding: '3px 10px', borderRadius: 99, width: 'fit-content' }}>
        <span style={{ width: 5, height: 5, borderRadius: 3, background: stat.dot, display: 'inline-block' }} />
        {stat.label}
      </span>

      {/* AI Alignment */}
      <AlignBar score={goal.ai_alignment_score} />

      {/* Overdue */}
      {goal.is_overdue ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                       fontWeight: 600, background: '#fee2e2', color: '#991b1b',
                       padding: '3px 10px', borderRadius: 99 }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} />
          Overdue
        </span>
      ) : (
        <span style={{ fontSize: 13, color: '#cbd5e1' }}>—</span>
      )}
    </div>
  );
}

function GoalMobileCard({ goal }: { goal: SteerGoal }) {
  const prio = PRIORITY_CFG[goal.priority] ?? PRIORITY_CFG.medium;
  const stat = STATUS_CFG[goal.status] ?? STATUS_CFG.draft;
  const icon = TYPE_ICONS[goal.goal_type] ?? '📋';
  const pct = Math.round(goal.ai_alignment_score * 100);

  return (
    <Link href={`/steer/${goal.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
              {goal.title}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              {goal.description.slice(0, 110)}{goal.description.length > 110 ? '…' : ''}
            </p>
          </div>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, background: prio.bg, color: prio.text, padding: '4px 10px', borderRadius: 999 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: prio.dot, display: 'inline-block' }} />
            {prio.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, background: stat.bg, color: stat.text, padding: '4px 10px', borderRadius: 999 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: stat.dot, display: 'inline-block' }} />
            {stat.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: 999 }}>
            {goal.goal_type}
          </span>
          {goal.is_overdue && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 999 }}>
              Overdue
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              AI Alignment
            </p>
            <AlignBar score={goal.ai_alignment_score} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: pct >= 70 ? '#065f46' : pct >= 40 ? '#92400e' : '#991b1b' }}>
            {pct}%
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Table skeleton ─────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
                  overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
                    padding: '12px 20px', display: 'grid',
                    gridTemplateColumns: '1fr 110px 100px 110px 160px 90px', gap: 16 }}>
        {[140, 80, 70, 80, 100, 60].map((w, i) => (
          <div key={i} style={{ height: 8, borderRadius: 4, background: '#e2e8f0', width: w }} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid #f8fafc',
                               display: 'grid', gridTemplateColumns: '1fr 110px 100px 110px 160px 90px',
                               gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ height: 10, borderRadius: 4, background: '#f1f5f9', width: '60%',
                          backgroundImage: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
                          backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease infinite' }} />
            <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', width: '40%' }} />
          </div>
          {[70, 60, 70, 90, 50].map((w, j) => (
            <div key={j} style={{ height: 20, borderRadius: 99, background: '#f1f5f9', width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileGoalSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ height: 12, width: '55%', borderRadius: 6, background: '#f1f5f9', marginBottom: 10 }} />
          <div style={{ height: 10, width: '88%', borderRadius: 5, background: '#f8fafc', marginBottom: 6 }} />
          <div style={{ height: 10, width: '72%', borderRadius: 5, background: '#f8fafc', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ height: 24, width: 82, borderRadius: 999, background: '#f1f5f9' }} />
            <div style={{ height: 24, width: 94, borderRadius: 999, background: '#f1f5f9' }} />
            <div style={{ height: 24, width: 70, borderRadius: 999, background: '#f1f5f9' }} />
          </div>
          <div style={{ height: 6, width: '100%', borderRadius: 99, background: '#e2e8f0' }} />
        </div>
      ))}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────── */
function EmptyGoals() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
                  padding: '60px 20px', textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: '#ede9fe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 30, margin: '0 auto 16px' }}>🧭</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>No strategic goals yet</p>
      <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 320, margin: '0 auto 24px', lineHeight: 1.6 }}>
        Create your first AI strategic goal to begin aligning your organisation.
      </p>
      <Link href="/steer/create" style={{
        display: 'inline-block', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        color: '#fff', padding: '10px 24px', borderRadius: 12, fontSize: 13,
        fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 12px rgba(124,58,237,0.25)',
      }}>
        + Create First Goal
      </Link>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function SteerPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { goals, loading, error } = useSelector((s: RootState) => s.steer);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = 'Steer AI | RamBot';
    dispatch(fetchSteerGoals('org-123'));
  }, [dispatch]);

  const avg       = goals.length ? Math.round((goals.reduce((a, g) => a + g.ai_alignment_score, 0) / goals.length) * 100) : 0;
  const active    = goals.filter((g) => g.status === 'active').length;
  const overdue   = goals.filter((g) => g.is_overdue).length;
  const completed = goals.filter((g) => g.status === 'completed').length;

  const avgColor  = avg >= 70 ? '#065f46'  : avg >= 40 ? '#92400e' : '#991b1b';
  const avgBarCol = avg >= 70
    ? 'linear-gradient(90deg,#34d399,#10b981)'
    : avg >= 40
    ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
    : 'linear-gradient(90deg,#f87171,#ef4444)';

  const metrics = [
    { icon: '🎯', iconBg: avg >= 70 ? '#d1fae5' : avg >= 40 ? '#fef3c7' : '#fee2e2',
      value: `${avg}%`, label: 'AI Alignment', valueColor: avgColor,
      sub: avg >= 70 ? 'On track' : avg >= 40 ? 'Needs attention' : 'Critical',
      barPct: avg, barColor: avgBarCol },
    { icon: '📋', iconBg: '#dbeafe', value: goals.length, label: 'Total Goals',
      sub: `${completed} completed` },
    { icon: '▶️', iconBg: '#ede9fe', value: active, label: 'Active Goals',
      valueColor: '#4338ca',
      sub: goals.length ? `${Math.round(active / goals.length * 100)}% of total` : '—',
      barPct: goals.length ? Math.round(active / goals.length * 100) : 0,
      barColor: 'linear-gradient(90deg,#818cf8,#6366f1)' },
    { icon: overdue > 0 ? '⚠️' : '✅', iconBg: overdue > 0 ? '#fee2e2' : '#d1fae5',
      value: overdue, label: 'Overdue',
      valueColor: overdue > 0 ? '#991b1b' : '#065f46',
      sub: overdue > 0 ? 'Requires review' : 'All on schedule' },
  ];

  return (
    <PageLayout
      title="Strategic AI Goals"
      subtitle="Define, track and align your AI strategy with organisational objectives"
      breadcrumb="Steer AI"
      action={
        <Link href="/steer/create" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
          color: '#fff', padding: '9px 20px', borderRadius: 12,
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(124,58,237,0.25)',
        }}>
          + New Goal
        </Link>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Metrics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16 }}>
          {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
        </div>

        {/* ── Priority legend + count ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', alignSelf: 'center' }}>Priority:</span>
            {Object.values(PRIORITY_CFG).map((p) => (
              <span key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                                            fontWeight: 600, background: p.bg, color: p.text,
                                            padding: '4px 12px', borderRadius: 99 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: p.dot, display: 'inline-block' }} />
                {p.label}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>
            {goals.length} goal{goals.length !== 1 ? 's' : ''} · {overdue} overdue
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && !loading && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12,
                        padding: '12px 16px', fontSize: 13, color: '#92400e', fontWeight: 500 }}>
            ⚠️ Could not load goals — backend may be offline. Showing empty state.
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          isMobile ? <MobileGoalSkeleton /> : <TableSkeleton />
        ) : goals.length === 0 ? (
          <EmptyGoals />
        ) : isMobile ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {goals.map((goal) => <GoalMobileCard key={goal.id} goal={goal} />)}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
                        overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {/* Table head */}
            <div style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
                          padding: '11px 20px', display: 'grid',
                          gridTemplateColumns: '1fr 110px 100px 110px 160px 90px', gap: 16 }}>
              {['Goal', 'Type', 'Priority', 'Status', 'AI Alignment', 'Overdue'].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
                                       textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)}

            {/* Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #f8fafc',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{goals.length} goals</span>
              <span style={{ fontSize: 12, color: overdue > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                {overdue > 0 ? `${overdue} overdue` : 'All on schedule ✓'}
              </span>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
