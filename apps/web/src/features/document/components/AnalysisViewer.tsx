'use client';

import { useState } from 'react';
import { Analysis } from '../store/documentSlice';
import { MermaidChart } from './MermaidChart';

type Tab = 'summary' | 'action-points' | 'workflow';

function SummaryTab({ summary, analysedAt }: { summary: string; analysedAt?: string }) {
  if (!summary) return <p className="text-white/30 text-center py-8">No summary available.</p>;

  const paragraphs = summary.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const formattedDate = analysedAt
    ? new Date(analysedAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-5 bg-violet-500 rounded-full" />
          <h3 className="font-semibold text-white/80 text-sm">Executive Summary</h3>
        </div>
        {formattedDate && (
          <span className="text-xs text-white/25 bg-white/5 border border-white/8 px-3 py-1 rounded-full font-mono">
            {formattedDate}
          </span>
        )}
      </div>
      {paragraphs.map((para, i) => (
        <p key={i} className="text-white/60 leading-relaxed text-sm">{para}</p>
      ))}
    </div>
  );
}

function ActionPointsTab({ entities }: { entities: Analysis['entities'] }) {
  const sections = [
    { label: 'Names',   icon: '👤', items: entities.names   },
    { label: 'Dates',   icon: '📅', items: entities.dates   },
    { label: 'Clauses', icon: '📋', items: entities.clauses },
    { label: 'Tasks',   icon: '✅', items: entities.tasks   },
    { label: 'Risks',   icon: '⚠️', items: entities.risks   },
  ];
  const filled = sections.filter(s => s.items.length > 0);

  if (filled.length === 0)
    return <p className="text-white/30 text-center py-8">No action points extracted.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {filled.map(({ label, icon, items }) => (
        <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>{icon}</span> {label}
          </h3>
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="text-sm text-white/65 flex gap-2 leading-snug">
                <span className="text-white/20 flex-shrink-0 mt-0.5">–</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function WorkflowTab({ mermaidChart }: { mermaidChart?: string }) {
  if (!mermaidChart) return (
    <p className="text-white/30 text-center py-8">No workflow diagram available.</p>
  );
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-0.5 h-5 bg-violet-500 rounded-full" />
        <h3 className="font-semibold text-white/80 text-sm">Document Workflow</h3>
      </div>
      <MermaidChart chart={mermaidChart} />
    </div>
  );
}

export function AnalysisViewer({ analysis }: { analysis: Analysis }) {
  const [tab, setTab] = useState<Tab>('summary');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'summary',       label: 'Summary',       icon: '📝' },
    { id: 'action-points', label: 'Action Points', icon: '✅' },
    { id: 'workflow',      label: 'Workflow',       icon: '🔄' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-white/[0.04] border border-white/8 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${tab === t.id
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'}
            `}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary'       && <SummaryTab     summary={analysis.summary} analysedAt={analysis.analysed_at} />}
      {tab === 'action-points' && <ActionPointsTab entities={analysis.entities} />}
      {tab === 'workflow'      && <WorkflowTab     mermaidChart={analysis.mermaid_chart} />}
    </div>
  );
}
