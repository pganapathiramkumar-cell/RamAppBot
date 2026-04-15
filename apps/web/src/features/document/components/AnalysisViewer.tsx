'use client';

import { useState } from 'react';
import { Analysis } from '../store/documentSlice';
import { MermaidChart } from './MermaidChart';

type Tab = 'summary' | 'action-points' | 'workflow';

function SummaryTab({ summary, analysedAt }: { summary: string; analysedAt?: string }) {
  if (!summary) return <p className="text-gray-400 text-center py-8">No summary available.</p>;

  const paragraphs = summary.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

  const formattedDate = analysedAt
    ? new Date(analysedAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-indigo-500 rounded-full" />
          <h3 className="font-semibold text-gray-800">Executive Summary</h3>
        </div>
        {formattedDate && (
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full font-mono">
            Analysed: {formattedDate}
          </span>
        )}
      </div>
      {paragraphs.length > 1
        ? paragraphs.map((para, i) => (
            <p key={i} className="text-gray-700 leading-relaxed text-base">{para}</p>
          ))
        : <p className="text-gray-700 leading-relaxed text-base">{summary}</p>
      }
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
    return <p className="text-gray-400 text-center py-8">No action points extracted.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filled.map(({ label, icon, items }) => (
        <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span>{icon}</span> {label}
          </h3>
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
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
    <p className="text-gray-400 text-center py-8">No workflow diagram available.</p>
  );
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-indigo-500 rounded-full" />
        <h3 className="font-semibold text-gray-800">Document Workflow</h3>
      </div>
      <MermaidChart chart={mermaidChart} />
    </div>
  );
}

export function AnalysisViewer({ analysis }: { analysis: Analysis }) {
  const [tab, setTab] = useState<Tab>('summary');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'summary',      label: 'Summary',       icon: '📝' },
    { id: 'action-points', label: 'Action Points', icon: '✅' },
    { id: 'workflow',     label: 'Workflow',       icon: '🔄' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-2xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              px-5 py-2 rounded-xl text-sm font-semibold transition-all
              ${tab === t.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'summary'       && <SummaryTab     summary={analysis.summary} analysedAt={analysis.analysed_at} />}
      {tab === 'action-points' && <ActionPointsTab entities={analysis.entities} />}
      {tab === 'workflow'      && <WorkflowTab     mermaidChart={analysis.mermaid_chart} />}
    </div>
  );
}
