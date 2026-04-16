'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { fetchSteerGoals } from '../../features/steer/store/steerSlice';
import { RootState, AppDispatch } from '../store';
import { SteerGoalTable } from '../../features/steer/components/SteerGoalTable';
import { AlignmentSummaryCard } from '../../features/steer/components/AlignmentSummaryCard';
import { PageLayout } from '../../components/layout/PageLayout';

export default function SteerPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { goals, loading } = useSelector((s: RootState) => s.steer);

  useEffect(() => { dispatch(fetchSteerGoals('org-123')); }, [dispatch]);

  return (
    <PageLayout
      title="Strategic AI Goals"
      subtitle="Define, track and align your AI strategy with organisational objectives"
      breadcrumb="Steer"
      action={
        <Link href="/steer/create" className="btn-primary">
          + New Goal
        </Link>
      }
    >
      <div className="space-y-6 animate-fade-in-up">
        <AlignmentSummaryCard goals={goals} loading={loading} />

        {loading ? (
          <TableSkeleton />
        ) : (
          <SteerGoalTable goals={goals} />
        )}
      </div>
    </PageLayout>
  );
}

function TableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3 flex gap-4">
        {[180, 80, 70, 80, 100, 60].map((w, i) => (
          <div key={i} className={`skeleton h-3`} style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b border-slate-50 px-5 py-4 flex gap-4 items-center">
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-32" />
          </div>
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-2 w-24 rounded-full" />
          <div className="skeleton h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
