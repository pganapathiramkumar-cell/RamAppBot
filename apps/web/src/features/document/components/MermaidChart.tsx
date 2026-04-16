'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

interface Props { chart: string; }

function MermaidChartInner({ chart }: Props) {
  const ref   = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!chart || !ref.current) return;
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            fontFamily:           'Inter, system-ui, sans-serif',
            fontSize:             '12px',
            /* Node colours — match the reference (teal start, blue info, amber verify, violet approval, green complete) */
            primaryColor:         '#dbeafe',
            primaryBorderColor:   '#3b82f6',
            primaryTextColor:     '#1e40af',
            secondaryColor:       '#d1fae5',
            secondaryBorderColor: '#10b981',
            tertiaryColor:        '#fef3c7',
            tertiaryBorderColor:  '#f59e0b',
            lineColor:            '#94a3b8',
            edgeLabelBackground:  '#f8fafc',
            background:           '#ffffff',
            clusterBkg:           '#f8fafc',
            titleColor:           '#0f172a',
          },
          flowchart: { curve: 'basis', padding: 20, useMaxWidth: true },
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);

        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          const svgEl = ref.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.width  = '100%';
            svgEl.style.height = 'auto';
            svgEl.removeAttribute('height');
          }
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 p-3 text-xs text-red-500"
           style={{ background: '#fef2f2' }}>
        ⚠️ Diagram error — {error}
      </div>
    );
  }

  return (
    <div className="relative min-h-[160px]">
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Rendering diagram…</span>
        </div>
      )}
      <div
        ref={ref}
        className="w-full overflow-x-auto"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.3s ease' }}
      />
    </div>
  );
}

export const MermaidChart = dynamic(() => Promise.resolve(MermaidChartInner), {
  ssr: false,
  loading: () => (
    <div className="min-h-[160px] flex flex-col items-center justify-center gap-2">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-slate-400">Loading diagram…</span>
    </div>
  ),
});
