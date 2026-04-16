'use client';

import { Analysis } from '../store/documentSlice';
import { MermaidChart } from './MermaidChart';

/* ── Smart Summary panel ─────────────────────────────────────── */
function SummaryPanel({ summary }: { summary: string }) {
  const bullets = summary
    ? summary
        .split(/\n+/)
        .map((l) => l.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Smart Summary</p>
        <p className="text-[11px] text-slate-400">AI-Generated Executive Overview</p>
      </div>

      {/* Content */}
      <div className="px-5 py-4 flex-1">
        {bullets.length > 0 ? (
          <ul className="space-y-3">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: '#2563eb' }}
                />
                <span className="text-sm text-slate-600 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        ) : summary ? (
          <p className="text-sm text-slate-600 leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-slate-400 italic text-center py-6">No summary available.</p>
        )}
      </div>
    </div>
  );
}

/* ── Action Points panel ─────────────────────────────────────── */
const DOT_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

function ActionPointsPanel({ entities }: { entities: Analysis['entities'] }) {
  const sections = [
    { label: 'Tasks',   items: entities.tasks   },
    { label: 'Dates',   items: entities.dates   },
    { label: 'Risks',   items: entities.risks   },
    { label: 'Names',   items: entities.names   },
    { label: 'Clauses', items: entities.clauses },
  ];
  const filled = sections.filter((s) => s.items.length > 0);

  /* Flatten all items with a colour per section */
  const allItems: { text: string; color: string; group: string }[] = [];
  filled.forEach((sec, si) => {
    sec.items.forEach((item) =>
      allItems.push({ text: item, color: DOT_COLORS[si % DOT_COLORS.length], group: sec.label })
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Action Points</p>
          <p className="text-[11px] text-slate-400">Key Tasks and Deadlines</p>
        </div>
        {allItems.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#eff6ff', color: '#2563eb' }}>
            {allItems.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-5 py-4 flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {allItems.length > 0 ? (
          <ul className="space-y-2.5">
            {allItems.map((item, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: item.color }}
                />
                <span className="text-sm text-slate-600 leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 italic text-center py-6">No action points extracted.</p>
        )}
      </div>

      {/* Legend */}
      {filled.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-50 flex flex-wrap gap-2">
          {filled.map((sec, si) => (
            <span key={sec.label} className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: DOT_COLORS[si % DOT_COLORS.length] }} />
              {sec.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Workflow Diagram panel ───────────────────────────────────── */
function WorkflowPanel({ mermaidChart }: { mermaidChart?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Workflow Diagram</p>
        <p className="text-[11px] text-slate-400">Automated Process Flowchart</p>
      </div>

      {/* Content */}
      <div className="px-4 py-4 flex-1">
        {mermaidChart ? (
          <MermaidChart chart={mermaidChart} />
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <span className="text-2xl mb-2 opacity-40">🔄</span>
            <p className="text-sm text-slate-400 italic">No workflow available.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main viewer — all 3 panels side by side ─────────────────── */
export function AnalysisViewer({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-800">Analysis Results</h2>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: '#f0fdf4', color: '#065f46' }}>
          ✓ Complete
        </span>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryPanel      summary={analysis.summary} />
        <ActionPointsPanel entities={analysis.entities} />
        <WorkflowPanel     mermaidChart={analysis.mermaid_chart} />
      </div>
    </div>
  );
}
