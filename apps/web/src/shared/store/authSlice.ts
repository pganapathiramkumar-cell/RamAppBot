import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const login = createAsyncThunk('auth/login', async ({ email, password }: { email: string; password: string }) => {
  const { data } = await axios.post(`${API}/auth/login`, { email, password });
  if (typeof window !== 'undefined') localStorage.setItem('access_token', data.access_token);
  return data;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { accessToken: null as string | null, loading: false, error: null as string | null },
  reducers: {
    logout: (state) => { state.accessToken = null; if (typeof window !== 'undefined') localStorage.removeItem('access_token'); },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => { s.loading = true; })
      .addCase(login.fulfilled, (s, a) => { s.loading = false; s.accessToken = a.payload.access_token; })
      .addCase(login.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Login failed'; });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
