'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAnalysis, retryAnalysis } from '../../../features/document/store/documentSlice';
import { RootState, AppDispatch } from '../../store';
import { AnalysisViewer } from '../../../features/document/components/AnalysisViewer';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { analyses, loading } = useSelector((s: RootState) => s.document);
  const analysis = analyses[id];

  useEffect(() => {
    if (id) dispatch(fetchAnalysis({ id }));
  }, [id, dispatch]);

  // Poll every 3s while pipeline is running
  useEffect(() => {
    if (analysis?.status === 'done' || analysis?.status === 'failed') return;
    const timer = setInterval(() => {
      if (id) dispatch(fetchAnalysis({ id }));
    }, 3000);
    return () => clearInterval(timer);
  }, [analysis?.status, id, dispatch]);

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/documents" className="text-sm text-gray-500 hover:text-indigo-600 mb-2 block">
            ← Documents
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Analysis</h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">{id}</p>
        </div>
        {analysis?.status === 'failed' && (
          <button
            onClick={() => dispatch(retryAnalysis({ id }))}
            className="btn-primary"
          >
            Retry Analysis
          </button>
        )}
      </div>

      {/* States */}
      {loading && !analysis && (
        <div className="flex items-center gap-3 text-gray-500 py-16 justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading analysis…
        </div>
      )}

      {(analysis?.status === 'pending' || analysis?.status === 'processing') && (
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Analysis in progress…</p>
          <p className="text-sm text-gray-400 mt-1">Running Summary → Action Points → Workflow chains</p>
        </div>
      )}

      {analysis?.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-center">
          Analysis failed. Click Retry to try again.
        </div>
      )}

      {analysis?.status === 'done' && (
        <AnalysisViewer analysis={analysis} />
      )}
    </main>
  );
}
