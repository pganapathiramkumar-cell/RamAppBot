'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { uploadDocument } from '../store/documentSlice';
import { AppDispatch, RootState } from '../../../app/store';

export function UploadZone() {
  const dispatch = useDispatch<AppDispatch>();
  const { uploading, error } = useSelector((s: RootState) => s.document);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  function validate(file: File): string | null {
    if (!file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are supported.';
    if (file.size > MAX_SIZE) return `File exceeds 5 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    dispatch(uploadDocument({ file }));
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

  const displayError = localError || error;

  return (
    <div className="mb-8">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`
          border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/30'}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onInputChange} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-indigo-600 font-medium">Analysing document…</p>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4">📄</div>
            <p className="text-lg font-semibold text-gray-700">Drop a PDF here or click to browse</p>
            <p className="text-sm text-gray-400 mt-1">Maximum file size: 5 MB</p>
          </>
        )}
      </div>

      {displayError && (
        <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {displayError}
        </div>
      )}
    </div>
  );
}
