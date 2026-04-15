import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface SteerGoal {
  id: string;
  title: string;
  description: string;
  goal_type: 'strategic' | 'operational' | 'compliance' | 'innovation';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  ai_alignment_score: number;
  success_criteria: string[];
  is_overdue: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface SteerState {
  goals: SteerGoal[];
  loading: boolean;
  error: string | null;
}

const initialState: SteerState = { goals: [], loading: false, error: null };

export const fetchSteerGoals = createAsyncThunk('steer/fetch', async (orgId: string) => {
  const { data } = await axios.get(`${API}/steer`, { params: { organization_id: orgId } });
  return data as SteerGoal[];
});

export const createSteerGoal = createAsyncThunk('steer/create', async (payload: Partial<SteerGoal>) => {
  const { data } = await axios.post(`${API}/steer`, payload);
  return data as SteerGoal;
});

const steerSlice = createSlice({
  name: 'steer',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSteerGoals.pending, (s) => { s.loading = true; })
      .addCase(fetchSteerGoals.fulfilled, (s, a) => { s.loading = false; s.goals = a.payload; })
      .addCase(fetchSteerGoals.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; })
      .addCase(createSteerGoal.fulfilled, (s, a) => { s.goals.unshift(a.payload); });
  },
});

export default steerSlice.reducer;
