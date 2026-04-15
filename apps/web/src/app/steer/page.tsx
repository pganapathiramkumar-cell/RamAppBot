'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { fetchSteerGoals } from '../../features/steer/store/steerSlice';
import { RootState, AppDispatch } from '../store';
import { SteerGoalTable } from '../../features/steer/components/SteerGoalTable';
import { AlignmentSummaryCard } from '../../features/steer/components/AlignmentSummaryCard';

export default function SteerPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { goals, loading } = useSelector((s: RootState) => s.steer);

  useEffect(() => { dispatch(fetchSteerGoals('org-123')); }, [dispatch]);

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:text-steer mb-2 block">← Dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-900">Steer</h1>
          <p className="text-gray-500">AI Strategic Goals</p>
        </div>
        <Link href="/steer/create" className="btn-primary">+ New Goal</Link>
      </div>

      <AlignmentSummaryCard goals={goals} />

      <div className="mt-8">
        {loading
          ? <div className="text-gray-500">Loading goals…</div>
          : <SteerGoalTable goals={goals} />
        }
      </div>
    </main>
  );
}
