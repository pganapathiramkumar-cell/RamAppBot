'use client';

import { useRef, useState, useEffect, DragEvent, ChangeEvent, useCallback } from 'react';
import { AnalysisViewer } from '../../features/document/components/AnalysisViewer';
import { Analysis } from '../../features/document/store/documentSlice';

const DOC_API = process.env.NEXT_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';
const MAX_SIZE = 5 * 1024 * 1024;

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'failed';

const FEATURES = [
  { icon: '📝', label: 'Smart Summary',    desc: 'Concise executive summary of any PDF'    },
  { icon: '✅', label: 'Action Points',    desc: 'Key tasks, dates, risks and obligations' },
  { icon: '🔄', label: 'Workflow Diagram', desc: 'Visual flowchart of the document process' },
];

export default function RamBotPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase]       = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [docId, setDocId]       = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [dots, setDots]         = useState('');

  useEffect(() => {
    if (phase !== 'processing') return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
    return () => clearInterval(t);
  }, [phase]);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${DOC_API}/analyses/${id}`);
      if (!res.ok) return;
      const data: Analysis = await res.json();
      if (data.status === 'done') { setAnalysis(data); setPhase('done'); }
      else if (data.status === 'failed') { setError('Analysis failed. Please try again.'); setPhase('failed'); }
    } catch { /* keep polling */ }
  }, []);

  useEffect(() => {
    if (phase !== 'processing' || !docId) return;
    const t = setInterval(() => poll(docId), 3000);
    return () => clearInterval(t);
  }, [phase, docId, poll]);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.'); setPhase('failed'); return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`);
      setPhase('failed'); return;
    }
    setFilename(file.name); setError(null); setPhase('uploading');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${DOC_API}/documents/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message ?? `Upload failed (${res.status})`);
      }
      const doc = await res.json();
      setDocId(doc.id); setPhase('processing');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach the document service.');
      setPhase('failed');
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function reset() {
    setPhase('idle'); setDocId(null); setAnalysis(null);
    setError(null); setFilename(''); setDots('');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ── Navbar ── */}
      <nav className="border-b border-white/8 backdrop-blur-sm sticky top-0 z-50 bg-[#0a0a0f]/80">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm">
              🤖
            </div>
            <span className="font-semibold text-sm tracking-tight">RamBot</span>
            <span className="text-white/20 text-sm">|</span>
            <span className="text-white/40 text-xs">AI Document Intelligence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/40">Powered by Groq · Llama 3.3</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6">

        {/* ── Hero (idle only) ── */}
        {phase === 'idle' && (
          <>
            <div className="pt-20 pb-12 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Enterprise AI Platform
              </div>
              <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                Understand any document<br />in seconds
              </h1>
              <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
                Upload a PDF and RamBot instantly generates an executive summary,
                structured action points, and a visual workflow diagram.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex justify-center gap-3 mb-10 flex-wrap">
              {FEATURES.map(({ icon, label, desc }) => (
                <div key={label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
                  <span className="text-base">{icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-white/80">{label}</p>
                    <p className="text-xs text-white/35">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload zone */}
            <div
              role="button" tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`
                relative rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all duration-200
                ${dragOver
                  ? 'border-violet-500 bg-violet-500/10 scale-[1.01]'
                  : 'border-white/10 bg-white/[0.03] hover:border-violet-500/50 hover:bg-white/[0.06]'}
              `}
            >
              <input
                ref={inputRef} type="file" accept=".pdf,application/pdf"
                className="hidden" onChange={onInputChange}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center text-2xl mx-auto mb-5">
                📄
              </div>
              <p className="text-base font-semibold text-white/80 mb-1">
                {dragOver ? 'Release to upload' : 'Drop your PDF here'}
              </p>
              <p className="text-sm text-white/35 mb-5">or click to browse your files</p>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                Choose PDF
              </span>
              <p className="text-xs text-white/25 mt-4">Maximum file size: 5 MB · PDF only</p>
            </div>
          </>
        )}

        {/* ── UPLOADING ── */}
        {phase === 'uploading' && (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-base font-semibold text-white/80">Uploading file</p>
            <p className="text-sm text-white/35 mt-1 max-w-xs mx-auto truncate">{filename}</p>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {phase === 'processing' && (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-base font-semibold text-white/80">Analysing your document{dots}</p>
            <p className="text-sm text-white/35 mt-2 mb-8">
              AI is reading the PDF — this takes about 15–30 seconds
            </p>
            <div className="flex justify-center gap-2">
              {['Summary', 'Action Points', 'Workflow'].map((label) => (
                <span key={label} className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium animate-pulse">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && analysis && (
          <div className="py-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/8">
                <span className="text-sm">📄</span>
                <span className="text-sm text-white/70 max-w-xs truncate font-medium">{filename}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                  Done
                </span>
              </div>
              <button
                onClick={reset}
                className="text-sm text-violet-400 hover:text-violet-300 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors"
              >
                + New document
              </button>
            </div>
            <AnalysisViewer analysis={analysis} />
          </div>
        )}

        {/* ── FAILED ── */}
        {phase === 'failed' && (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl mx-auto mb-5">
              ⚠️
            </div>
            <p className="text-base font-semibold text-white/80 mb-1">Something went wrong</p>
            <p className="text-sm text-red-400/80 mb-8 max-w-sm mx-auto">{error}</p>
            <button
              onClick={reset}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        <div className="pb-16" />
      </main>
    </div>
  );
}
