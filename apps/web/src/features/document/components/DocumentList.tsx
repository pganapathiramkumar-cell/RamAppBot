'use client';

import Link from 'next/link';
import { useDispatch } from 'react-redux';
import { Document, deleteDocument, retryAnalysis } from '../store/documentSlice';
import { AppDispatch } from '../../../app/store';

const STATUS_STYLES: Record<string, string> = {
  done:       'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending:    'bg-yellow-100 text-yellow-700',
  failed:     'bg-red-100 text-red-700',
};

function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentList({ documents }: { documents: Document[] }) {
  const dispatch = useDispatch<AppDispatch>();

  if (!documents.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        No documents yet. Upload a PDF above to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-2xl">📄</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{doc.filename}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(doc.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`badge ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {doc.status}
            </span>

            {doc.status === 'done' && (
              <Link
                href={`/documents/${doc.id}`}
                className="btn-primary text-sm py-1.5 px-4"
              >
                View Analysis
              </Link>
            )}

            {(doc.status === 'done' || doc.status === 'failed') && (
              <button
                onClick={() => dispatch(retryAnalysis({ id: doc.id }))}
                className="text-sm py-1.5 px-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                title="Re-run analysis"
              >
                ↺ Reanalyze
              </button>
            )}

            <button
              onClick={() => dispatch(deleteDocument({ id: doc.id }))}
              className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Delete document"
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
