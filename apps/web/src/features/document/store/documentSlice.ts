import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const DOC_API = process.env.NEXT_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  content_hash: string;
  created_at: string;
}

export interface WorkflowStep {
  step_number: number;
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  description?: string;
  owner?: string;
  deadline?: string;
}

export interface Entities {
  names: string[];
  dates: string[];
  clauses: string[];
  tasks: string[];
  risks: string[];
}

export interface Analysis {
  document_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  summary: string;
  entities: Entities;
  workflow: WorkflowStep[];
  mermaid_chart?: string;
  analysed_at?: string;
}

interface DocumentState {
  documents: Document[];
  analyses: Record<string, Analysis>;
  uploading: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: DocumentState = {
  documents: [],
  analyses: {},
  uploading: false,
  loading: false,
  error: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${DOC_API}${path}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiDelete(path: string, token?: string): Promise<void> {
  const res = await fetch(`${DOC_API}${path}`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

async function apiPost<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${DOC_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

// ── Thunks ─────────────────────────────────────────────────────────────────────

export const uploadDocument = createAsyncThunk(
  'document/upload',
  async ({ file, token }: { file: File; token?: string }, { rejectWithValue }) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${DOC_API}/documents/upload`, {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err?.detail?.message ?? `Upload failed (${res.status})`);
    }
    return res.json() as Promise<Document>;
  }
);

export const fetchDocuments = createAsyncThunk(
  'document/fetchAll',
  async (token?: string) => {
    const data = await apiGet<Document[] | { items: Document[] }>('/documents', token);
    return Array.isArray(data) ? data : (data.items ?? []);
  }
);

export const deleteDocument = createAsyncThunk(
  'document/delete',
  async ({ id, token }: { id: string; token?: string }) => {
    await apiDelete(`/documents/${id}`, token);
    return id;
  }
);

export const fetchAnalysis = createAsyncThunk(
  'document/fetchAnalysis',
  async ({ id, token }: { id: string; token?: string }) => {
    const data = await apiGet<Analysis>(`/analyses/${id}`, token);
    return data;
  }
);

export const retryAnalysis = createAsyncThunk(
  'document/retryAnalysis',
  async ({ id, token }: { id: string; token?: string }) => {
    const data = await apiPost<Analysis>(`/analyses/${id}/retry`, undefined, token);
    return data;
  }
);

// ── Slice ──────────────────────────────────────────────────────────────────────

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(uploadDocument.pending, (s) => { s.uploading = true; s.error = null; })
      .addCase(uploadDocument.fulfilled, (s, a) => {
        s.uploading = false;
        // Avoid duplicate if dedup returned an existing doc
        if (!s.documents.find((d) => d.id === a.payload.id)) {
          s.documents.unshift(a.payload);
        }
      })
      .addCase(uploadDocument.rejected, (s, a) => {
        s.uploading = false;
        s.error = (a.payload as string) ?? a.error.message ?? 'Upload failed';
      })
      .addCase(fetchDocuments.pending, (s) => { s.loading = true; })
      .addCase(fetchDocuments.fulfilled, (s, a) => { s.loading = false; s.documents = a.payload; })
      .addCase(fetchDocuments.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; })
      .addCase(deleteDocument.fulfilled, (s, a) => {
        s.documents = s.documents.filter((d) => d.id !== a.payload);
        delete s.analyses[a.payload];
      })
      .addCase(fetchAnalysis.pending, (s) => { s.loading = true; })
      .addCase(fetchAnalysis.fulfilled, (s, a) => {
        s.loading = false;
        if (a.payload?.document_id) {
          s.analyses[a.payload.document_id] = a.payload;
        }
      })
      .addCase(fetchAnalysis.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; })
      .addCase(retryAnalysis.fulfilled, (s, a) => {
        if (a.payload?.document_id) {
          // Clear cached analysis so UI returns to polling state
          delete s.analyses[a.payload.document_id];
          // Mark the document as pending in the list so auto-poll kicks in
          const doc = s.documents.find((d) => d.id === a.payload.document_id);
          if (doc) doc.status = 'pending';
        }
      });
  },
});

export default documentSlice.reducer;
