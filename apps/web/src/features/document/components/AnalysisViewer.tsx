'use client';

import { useEffect, useState } from 'react';
import { Analysis, DocumentSnapshot, Entities } from '../store/documentSlice';
import { MermaidChart } from './MermaidChart';

type ViewerTab = 'summary' | 'actions' | 'workflow';

const TABS: { id: ViewerTab; title: string; subtitle: string }[] = [
  { id: 'summary', title: 'Smart Summary', subtitle: 'AI-Generated Executive Overview' },
  { id: 'actions', title: 'Action Points', subtitle: 'Key Tasks and Deadlines' },
  { id: 'workflow', title: 'Workflow Diagram', subtitle: 'Automated Process Flowchart' },
];

const EMPTY_SNAPSHOT: DocumentSnapshot = {
  primary_topic: '',
  secondary_topics: [],
  word_count: 0,
  key_ideas: [],
  important_entities: {
    tools: [],
    systems: [],
    metrics: [],
    people: [],
    organizations: [],
  },
  relationships: [],
  key_concepts: [],
};

function SummaryPanel({ summary, snapshot }: { summary: string; snapshot: DocumentSnapshot }) {
  const bullets = summary
    ? summary
        .split(/\n+/)
        .map((line) => line.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-slate-400">Smart Summary</p>
        <p className="text-[11px] text-slate-400">AI-Generated Executive Overview</p>
      </div>
      <div className="flex-1 px-5 py-4">
        <SnapshotHeader snapshot={snapshot} />
        {bullets.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                <span className="text-sm leading-relaxed text-slate-600">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : summary ? (
          <p className="text-sm leading-relaxed text-slate-600">{summary}</p>
        ) : (
          <p className="py-6 text-center text-sm italic text-slate-400">No summary available.</p>
        )}
      </div>
    </div>
  );
}

const DOT_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

function ActionPointsPanel({ entities }: { entities: Entities }) {
  const sections = [
    { label: 'Tasks', items: entities.tasks, color: DOT_COLORS[0] },
    { label: 'Risks', items: entities.risks, color: DOT_COLORS[2] },
    { label: 'Dates', items: entities.dates, color: DOT_COLORS[1] },
    { label: 'Clauses', items: entities.clauses, color: DOT_COLORS[4] },
  ];
  const filled = sections.filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-slate-400">Action Points</p>
          <p className="text-[11px] text-slate-400">Key Tasks and Deadlines</p>
        </div>
        {filled.length > 0 && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
            {filled.reduce((sum, section) => sum + section.items.length, 0)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 md:max-h-80">
        {filled.length > 0 ? (
          <div className="space-y-4">
            {filled.map((section) => (
              <div key={section.label}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{section.label}</p>
                <ul className="space-y-2.5">
                  {section.items.slice(0, 5).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: section.color }} />
                      <span className="text-sm leading-relaxed text-slate-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm italic text-slate-400">No action points extracted.</p>
        )}
      </div>

      {filled.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-50 px-5 py-3">
          {filled.map((section, i) => (
            <span key={section.label} className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: section.color }} />
              {section.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowPanel({ mermaidChart }: { mermaidChart?: string }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-slate-400">Workflow Diagram</p>
        <p className="text-[11px] text-slate-400">Automated Process Flowchart</p>
      </div>
      <div className="flex-1 px-4 py-4">
        {mermaidChart ? (
          <MermaidChart chart={mermaidChart} />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <span className="mb-2 text-2xl opacity-40">🔄</span>
            <p className="text-sm italic text-slate-400">No workflow available.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalysisViewer({ analysis }: { analysis: Analysis }) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewerTab>('summary');

  useEffect(() => {
    const syncViewport = () => setIsMobile(window.innerWidth < 960);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobile) setActiveTab('summary');
  }, [isMobile]);

  const cards = [
    { id: 'summary' as const, node: <SummaryPanel summary={analysis.summary ?? ''} snapshot={analysis.snapshot ?? EMPTY_SNAPSHOT} /> },
    { id: 'actions' as const, node: <ActionPointsPanel entities={analysis.entities ?? { names: [], dates: [], clauses: [], tasks: [], risks: [] }} /> },
    { id: 'workflow' as const, node: <WorkflowPanel mermaidChart={analysis.mermaid_chart} /> },
  ];

  const visibleCards = isMobile ? cards.filter((card) => card.id === activeTab) : cards;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <h2 className="text-lg font-bold text-slate-800">Analysis Results</h2>
        <span
          className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: '#f0fdf4', color: '#065f46' }}
        >
          ✓ Complete
        </span>
      </div>

      {isMobile && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="min-w-[120px] rounded-2xl px-4 py-3 text-left transition"
              style={{
                background: activeTab === tab.id ? '#0f172a' : '#ffffff',
                color: activeTab === tab.id ? '#ffffff' : '#334155',
                border: activeTab === tab.id ? '1px solid #0f172a' : '1px solid #e2e8f0',
                boxShadow: activeTab === tab.id ? '0 12px 24px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div className="mb-1 text-sm font-bold">{tab.title}</div>
              <div className="text-[11px] opacity-75">{tab.subtitle}</div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-1 xl:grid-cols-3">
        {visibleCards.map((card) => (
          <div key={card.id}>{card.node}</div>
        ))}
      </div>
    </div>
  );
}

function SnapshotHeader({ snapshot }: { snapshot: DocumentSnapshot }) {
  const entityGroups = [
    { label: 'Tools', values: snapshot.important_entities.tools },
    { label: 'Systems', values: snapshot.important_entities.systems },
    { label: 'Metrics', values: snapshot.important_entities.metrics },
    { label: 'People', values: snapshot.important_entities.people },
    { label: 'Organizations', values: snapshot.important_entities.organizations },
  ].filter((group) => group.values.length > 0);

  return (
    <div className="border-b border-slate-100 pb-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SnapshotMetric label="Primary topic" value={snapshot.primary_topic || 'Not identified'} />
        <SnapshotMetric label="Word count" value={snapshot.word_count ? snapshot.word_count.toLocaleString() : '0'} />
      </div>

      {snapshot.secondary_topics.length > 0 && (
        <SnapshotTagGroup title="Secondary topics" tags={snapshot.secondary_topics} />
      )}

      {snapshot.key_concepts.length > 0 && (
        <SnapshotTagGroup title="Key concepts" tags={snapshot.key_concepts} />
      )}

      {snapshot.key_ideas.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Key ideas</p>
          <ul className="space-y-2">
            {snapshot.key_ideas.slice(0, 5).map((idea, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
                <span className="text-xs leading-relaxed text-slate-600">{idea}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entityGroups.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Important entities</p>
          <div className="space-y-2">
            {entityGroups.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">{group.label}:</span>
                {group.values.slice(0, 5).map((value) => (
                  <span key={value} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot.relationships.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Relationships</p>
          <ul className="space-y-2">
            {snapshot.relationships.slice(0, 4).map((relation, i) => (
              <li key={i} className="text-xs leading-relaxed text-slate-600">{relation}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-bold leading-snug text-slate-900">{value}</p>
    </div>
  );
}

function SnapshotTagGroup({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.slice(0, 8).map((tag) => (
          <span key={tag} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
