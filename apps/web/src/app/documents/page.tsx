'use client';

import { useRef, useState, useEffect, DragEvent, ChangeEvent, useCallback } from 'react';
import Link from 'next/link';
import { MermaidChart } from '../../features/document/components/MermaidChart';
import { Analysis, DocumentSnapshot } from '../../features/document/store/documentSlice';

const DOC_API = process.env.NEXT_PUBLIC_DOCUMENT_API_URL || 'https://ramappbot.onrender.com/api/v1';
const MAX_SIZE = 5 * 1024 * 1024;
type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'failed';
type MobileTab = 'summary' | 'actions' | 'workflow';

const NAV_LINKS = [
  { href: '/documents', label: 'DocuMind', active: true },
];

export default function RamVectorPage() {
  const inputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('summary');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = 'DocuMind | RamVector';
  }, []);

  /* Silent wake-ping — keeps Render warm before the user uploads */
  useEffect(() => {
    fetch(DOC_API.replace('/api/v1', '') + '/health', { method: 'GET' }).catch(() => null);
  }, []);

  useEffect(() => {
    if (phase !== 'processing') return;
    const steps = [12, 28, 42, 56, 68, 79, 88, 93];
    let i = 0;
    const t = setInterval(() => {
      if (i < steps.length) setProgress(steps[i++]);
      else clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [phase]);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${DOC_API}/analyses/${id}`);
      if (!res.ok) return;
      const data: Analysis = await res.json();
      if (data.status === 'done') {
        setProgress(100);
        setTimeout(() => {
          setAnalysis(data);
          setPhase('done');
        }, 400);
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
      setError('Only PDF files are supported.');
      setPhase('failed');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`);
      setPhase('failed');
      return;
    }

    setFilename(file.name);
    setError(null);
    setProgress(0);
    setMobileTab('summary');
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
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function reset() {
    setPhase('idle');
    setDocId(null);
    setAnalysis(null);
    setError(null);
    setFilename('');
    setProgress(0);
    setMobileTab('summary');
  }

  async function retryAnalysis() {
    if (!docId) return;
    setAnalysis(null);
    setProgress(0);
    setPhase('processing');
    try {
      await fetch(`${DOC_API}/analyses/${docId}/retry`, { method: 'POST' });
    } catch {
      // polling will pick up the reset status
    }
  }

  const isPartialResult =
    analysis?.summary === 'Summary unavailable — please retry.' ||
    (analysis !== null && (analysis.snapshot?.word_count ?? 1) === 0);

  const mobileCards = [
    {
      id: 'summary' as const,
      title: 'Smart Summary',
      subtitle: 'AI-Generated Executive Overview',
      icon: '📝',
      iconBg: '#eff6ff',
      content: <SummaryContent summary={analysis?.summary ?? ''} snapshot={analysis?.snapshot} />,
    },
    {
      id: 'actions' as const,
      title: 'Action Points',
      subtitle: 'Key Tasks and Deadlines',
      icon: '✅',
      iconBg: '#f0fdf4',
      content: <ActionContent entities={analysis?.entities} />,
    },
    {
      id: 'workflow' as const,
      title: 'Workflow Diagram',
      subtitle: 'Automated Process Flowchart',
      icon: '🔄',
      iconBg: '#f5f3ff',
      content: <WorkflowContent chart={analysis?.mermaid_chart} />,
    },
  ];

  const visibleMobileCard = mobileCards.find((card) => card.id === mobileTab) ?? mobileCards[0];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f4f8' }}>
      <header style={{ background: '#0f1a2e', position: 'sticky', top: 0, zIndex: 50 }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: isMobile ? '10px 16px' : '0 24px',
            minHeight: isMobile ? 72 : 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              RV
            </div>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: 14, letterSpacing: '-0.3px' }}>
              RamVector
            </span>
          </Link>

          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              width: isMobile ? '100%' : 'auto',
              overflowX: isMobile ? 'auto' : 'visible',
              order: isMobile ? 3 : 2,
              paddingBottom: isMobile ? 2 : 0,
            }}
          >
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '6px 16px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  color: item.active ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: item.active ? '#2563eb' : 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, order: isMobile ? 2 : 3 }}>
            {!isMobile && (
              <Link
                href="/privacy"
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}
              >
                Privacy
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
          padding: isMobile ? '16px' : '28px 24px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: isMobile ? '100%' : 260,
            flexShrink: 0,
            position: isMobile ? 'static' : 'sticky',
            top: isMobile ? undefined : 76,
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => (phase === 'idle' || phase === 'failed' ? inputRef.current?.click() : undefined)}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              background: dragOver ? '#eff6ff' : '#ffffff',
              borderRadius: 20,
              border: `2px dashed ${dragOver ? '#2563eb' : '#bfdbfe'}`,
              padding: isMobile ? '24px 18px' : '32px 20px',
              textAlign: 'center',
              cursor: phase === 'done' || phase === 'uploading' || phase === 'processing' ? 'default' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={onInputChange}
              onClick={(e) => e.stopPropagation()}
            />

            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: 'linear-gradient(135deg,#eff6ff,#eef2ff)',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="6" y="5" width="20" height="26" rx="3" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2" />
                <rect x="10" y="5" width="20" height="26" rx="3" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.2" />
                <line x1="20" y1="32" x2="20" y2="22" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
                <polyline points="15,27 20,22 25,27" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {phase === 'idle' && (
              <>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                  {dragOver ? 'Release to upload' : 'Drag & Drop your PDF here'}
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>or Browse Files</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  style={{
                    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  }}
                >
                  📄 Choose PDF File
                </button>
                <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 12 }}>Max size 5 MB  ·  PDF format only</p>
              </>
            )}

            {(phase === 'uploading' || phase === 'processing') && (
              <>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 4 }}>
                  {phase === 'uploading' ? 'Uploading…' : 'Analysing…'}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    marginBottom: 14,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {filename}
                </p>
                {phase === 'processing' && (
                  <div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 3,
                          background: 'linear-gradient(90deg,#2563eb,#6366f1)',
                          width: `${progress}%`,
                          transition: 'width 0.7s ease',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, textAlign: 'right' }}>{progress}%</p>
                  </div>
                )}
              </>
            )}

            {phase === 'done' && (
              <>
                <div
                  style={{
                    background: '#f0fdf4',
                    borderRadius: 10,
                    padding: '8px 12px',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                  <span
                    style={{
                      fontSize: 12,
                      color: '#065f46',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      textAlign: 'left',
                    }}
                  >
                    {filename}
                  </span>
                </div>
                {isPartialResult && (
                  <button
                    onClick={retryAnalysis}
                    style={{
                      background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '9px 20px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: 8,
                      boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                    }}
                  >
                    Retry Analysis
                  </button>
                )}
                <button
                  onClick={reset}
                  style={{
                    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
                  }}
                >
                  + New Document
                </button>
              </>
            )}

            {phase === 'failed' && (
              <>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', marginBottom: 8 }}>Upload failed</p>
                <button
                  onClick={reset}
                  style={{
                    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Try Again
                </button>
              </>
            )}
          </div>

          {(phase === 'idle' || phase === 'failed') && (
            <div
              style={{
                marginTop: 16,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 12,
                }}
              >
                What you&apos;ll get
              </p>
              {[
                { icon: '📝', label: 'Smart Summary', color: '#2563eb' },
                { icon: '✅', label: 'Action Points', color: '#10b981' },
                { icon: '🔄', label: 'Workflow Diagram', color: '#7c3aed' },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: `${f.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    {f.icon}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
          <div
            style={{
              display: 'flex',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 10 : 0,
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                Smart Summary
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', fontWeight: 500 }}>
                {phase === 'done' ? 'AI-Generated Analysis Complete' : 'AI-Generated Executive Overview'}
              </p>
            </div>
            {phase === 'done' && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: '#f0fdf4',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                }}
              >
                ✓ Complete
              </span>
            )}
          </div>

          {isMobile && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
              {mobileCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setMobileTab(card.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 16,
                    border: mobileTab === card.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: mobileTab === card.id ? '#eff6ff' : '#fff',
                    color: mobileTab === card.id ? '#1d4ed8' : '#475569',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    minWidth: 110,
                  }}
                >
                  {card.title}
                </button>
              ))}
            </div>
          )}

          {isMobile ? (
            <ResultCard
              title={visibleMobileCard.title}
              subtitle={visibleMobileCard.subtitle}
              icon={visibleMobileCard.icon}
              iconBg={visibleMobileCard.iconBg}
              isEmpty={phase !== 'done'}
              isLoading={phase === 'uploading' || phase === 'processing'}
              progress={progress}
            >
              {phase === 'done' && visibleMobileCard.content}
            </ResultCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <ResultCard
                title="Smart Summary"
                subtitle="AI-Generated Executive Overview"
                icon="📝"
                iconBg="#eff6ff"
                isEmpty={phase !== 'done'}
                isLoading={phase === 'uploading' || phase === 'processing'}
                progress={progress}
              >
                {phase === 'done' && analysis && <SummaryContent summary={analysis.summary ?? ''} snapshot={analysis.snapshot} />}
              </ResultCard>

              <ResultCard
                title="Action Points"
                subtitle="Key Tasks and Deadlines"
                icon="✅"
                iconBg="#f0fdf4"
                isEmpty={phase !== 'done'}
                isLoading={phase === 'uploading' || phase === 'processing'}
                progress={progress}
              >
                {phase === 'done' && analysis && <ActionContent entities={analysis.entities} />}
              </ResultCard>

              <ResultCard
                title="Workflow Diagram"
                subtitle="Automated Process Flowchart"
                icon="🔄"
                iconBg="#f5f3ff"
                isEmpty={phase !== 'done'}
                isLoading={phase === 'uploading' || phase === 'processing'}
                progress={progress}
              >
                {phase === 'done' && analysis && <WorkflowContent chart={analysis.mermaid_chart ?? ''} />}
              </ResultCard>
            </div>
          )}

          {phase === 'failed' && error && (
            <div
              style={{
                marginTop: 16,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 14,
                padding: '14px 18px',
                fontSize: 13,
                color: '#dc2626',
                fontWeight: 500,
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: isMobile ? '10px 16px' : '0 24px',
            minHeight: isMobile ? 52 : 44,
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 4 : 0,
          }}
        >
          <span style={{ fontSize: 12, color: '#94a3b8' }}>&copy; 2026 RamVector. All rights reserved.</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Intelligent Document Platform</span>
        </div>
      </footer>
    </div>
  );
}

function ResultCard({
  title,
  subtitle,
  icon,
  iconBg,
  isEmpty,
  isLoading,
  progress,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  isEmpty: boolean;
  isLoading: boolean;
  progress: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 320,
      }}
    >
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #f1f5f9' }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: 0, marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontWeight: 500 }}>{subtitle}</p>
      </div>

      <div style={{ flex: 1, padding: '14px 18px', overflow: 'hidden' }}>
        {isLoading ? (
          <LoadingState progress={progress} />
        ) : isEmpty ? (
          <EmptyState icon={icon} iconBg={iconBg} title={title} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, iconBg, title }: { icon: string; iconBg: string; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        paddingTop: 24,
        paddingBottom: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          marginBottom: 14,
          opacity: 0.7,
        }}
      >
        {icon}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>{title} will appear here</p>
      <p style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 400 }}>Upload a PDF to get started</p>
      <div style={{ width: '100%', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[85, 70, 90, 60].map((w, i) => (
          <div key={i} style={{ height: 8, borderRadius: 4, background: '#f1f5f9', width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function LoadingState({ progress }: { progress: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
      {[90, 75, 85, 60, 80].map((w, i) => (
        <div
          key={i}
          style={{
            height: 10,
            borderRadius: 5,
            background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s ease infinite',
            width: `${w}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      {progress > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg,#2563eb,#6366f1)',
                width: `${progress}%`,
                transition: 'width 0.7s ease',
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryContent({ summary, snapshot }: { summary: string; snapshot?: DocumentSnapshot }) {
  const lines = summary
    ? summary.split(/\n+/).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 6)
    : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {snapshot && <SnapshotHeader snapshot={snapshot} />}
      {!lines.length ? (
        <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No summary available.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((l, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: '#2563eb', flexShrink: 0, marginTop: 5 }} />
              <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{l}</span>
            </li>
          ))}
        </ul>
      )}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
        }}
      >
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
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            Key ideas
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshot.key_ideas.slice(0, 5).map((idea, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#0ea5e9', flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{idea}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entityGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Important entities
          </p>
          {entityGroups.map((group) => (
            <div key={group.label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{group.label}:</span>
              {group.values.slice(0, 5).map((value) => (
                <span
                  key={value}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#334155',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 999,
                    padding: '4px 8px',
                  }}
                >
                  {value}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {snapshot.relationships.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            Relationships
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {snapshot.relationships.slice(0, 4).map((relation, i) => (
              <li key={i} style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                {relation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

function SnapshotTagGroup({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tags.slice(0, 8).map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#1d4ed8',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 999,
              padding: '4px 8px',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

const DOT_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

function ActionContent({ entities }: { entities?: Analysis['entities'] }) {
  if (!entities) return <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No action points extracted.</p>;
  const groups = [
    { label: 'Tasks', items: entities.tasks, color: DOT_COLORS[0] },
    { label: 'Risks', items: entities.risks, color: DOT_COLORS[2] },
    { label: 'Dates', items: entities.dates, color: DOT_COLORS[1] },
    { label: 'Clauses', items: entities.clauses, color: DOT_COLORS[4] },
  ].filter((group) => group.items.length > 0);

  if (!groups.length) return <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No action points extracted.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((group) => (
        <div key={group.label}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {group.label}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.items.slice(0, 5).map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: group.color, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTop: '1px solid #f8fafc' }}>
        {groups.map((group) => (
          <span key={group.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: group.color, display: 'inline-block' }} />
            {group.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorkflowContent({ chart }: { chart?: string }) {
  if (!chart) return <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No workflow available.</p>;
  return <MermaidChart chart={chart} />;
}
