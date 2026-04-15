'use client';

import { useRef, useState, useEffect, DragEvent, ChangeEvent, useCallback } from 'react';
import { AnalysisViewer } from '../../features/document/components/AnalysisViewer';
import { Analysis } from '../../features/document/store/documentSlice';

const DOC_API = process.env.NEXT_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';
const MAX_SIZE = 5 * 1024 * 1024;

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'failed';

export default function RamBotPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase]       = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [docId, setDocId]       = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [dots, setDots]         = useState('');

  // Animated dots while processing
  useEffect(() => {
    if (phase !== 'processing') return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Poll for analysis when processing
  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${DOC_API}/analyses/${id}`);
      if (!res.ok) return;
      const data: Analysis = await res.json();
      if (data.status === 'done') {
        setAnalysis(data);
        setPhase('done');
      } else if (data.status === 'failed') {
        setError('Analysis failed. Please try again.');
        setPhase('failed');
      }
    } catch {
      // keep polling
    }
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

    setFilename(file.name);
    setError(null);
    setPhase('uploading');

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${DOC_API}/documents/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message ?? `Upload failed (${res.status})`);
      }
      const doc = await res.json();
      setDocId(doc.id);
      setPhase('processing');
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
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* ── Header ── */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🤖</div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">RamBot</h1>
          <p className="text-gray-500 mt-2 text-base">Enterprise AI Platform · Upload a PDF to get started</p>
        </div>

        {/* ── IDLE: Upload zone ── */}
        {phase === 'idle' && (
          <div
            role="button" tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`
              border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all
              ${dragOver
                ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'}
            `}
          >
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onInputChange} onClick={(e) => e.stopPropagation()} />
            <div className="text-6xl mb-5">📄</div>
            <p className="text-xl font-semibold text-gray-700">Drop a PDF here or click to browse</p>
            <p className="text-sm text-gray-400 mt-2">Maximum file size: 5 MB</p>
          </div>
        )}

        {/* ── UPLOADING spinner ── */}
        {phase === 'uploading' && (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-gray-100">
            <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-lg font-semibold text-gray-700">Uploading {filename}</p>
            <p className="text-sm text-gray-400 mt-1">Please wait…</p>
          </div>
        )}

        {/* ── PROCESSING spinner ── */}
        {phase === 'processing' && (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-gray-100">
            <div className="w-14 h-14 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-lg font-semibold text-gray-700">Analysing your document{dots}</p>
            <p className="text-sm text-gray-400 mt-2">
              Our AI is reading the PDF and generating your summary,<br />
              action points and workflow. This takes about 15–30 seconds.
            </p>
            <div className="flex justify-center gap-2 mt-6">
              {['Summary', 'Action Points', 'Workflow'].map((label) => (
                <span key={label} className="px-3 py-1 bg-indigo-50 text-indigo-400 text-xs font-medium rounded-full animate-pulse">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── DONE: Results + tabs ── */}
        {phase === 'done' && analysis && (
          <div>
            {/* File chip */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-full px-4 py-2 shadow-sm">
                <span className="text-lg">📄</span>
                <span className="text-sm font-medium text-gray-700 max-w-xs truncate">{filename}</span>
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Done</span>
              </div>
              <button
                onClick={reset}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
              >
                + Upload another PDF
              </button>
            </div>

            <AnalysisViewer analysis={analysis} />
          </div>
        )}

        {/* ── FAILED ── */}
        {phase === 'failed' && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-red-100">
            <div className="text-5xl mb-4">❌</div>
            <p className="text-lg font-semibold text-gray-700 mb-2">Something went wrong</p>
            <p className="text-sm text-red-500 mb-8">{error}</p>
            <button
              onClick={reset}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
