import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'draft' | 'under_review' | 'approved' | 'deployed' | 'deprecated';
  proficiency_level: string;
  tags: string[];
  accuracy_score: number;
  latency_ms: number;
  usage_count: number;
  organization_id: string;
  created_at: string;
}

interface SkillState {
  skills: Skill[];
  loading: boolean;
  error: string | null;
}

const initialState: SkillState = { skills: [], loading: false, error: null };

export const fetchSkills = createAsyncThunk('skill/fetch', async (orgId: string) => {
  const { data } = await axios.get(`${API}/skill`, { params: { organization_id: orgId } });
  return data as Skill[];
});

export const createSkill = createAsyncThunk('skill/create', async (payload: Partial<Skill>) => {
  const { data } = await axios.post(`${API}/skill`, payload);
  return data as Skill;
});

const skillSlice = createSlice({
  name: 'skill',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSkills.pending, (s) => { s.loading = true; })
      .addCase(fetchSkills.fulfilled, (s, a) => { s.loading = false; s.skills = a.payload; })
      .addCase(fetchSkills.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; })
      .addCase(createSkill.fulfilled, (s, a) => { s.skills.unshift(a.payload); });
  },
});

export default skillSlice.reducer;
