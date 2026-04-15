'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  chart: string;
}

export function MermaidChart({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            primaryColor: '#e0e7ff',
            primaryBorderColor: '#6366f1',
            lineColor: '#94a3b8',
            edgeLabelBackground: '#f8fafc',
          },
          flowchart: { curve: 'basis', padding: 20 },
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);

        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = ref.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
            svgEl.removeAttribute('height');
          }
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
      <div className="text-xs text-red-500 bg-red-50 rounded-xl p-4">
        Chart render error — {error}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full overflow-x-auto bg-white rounded-2xl border border-gray-100 p-6 min-h-[200px] flex items-center justify-center"
    >
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
