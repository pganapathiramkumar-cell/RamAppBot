'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { fetchSkills } from '../../features/skill/store/skillSlice';
import { RootState, AppDispatch } from '../store';
import { SkillGrid } from '../../features/skill/components/SkillGrid';
import { SkillSummaryBar } from '../../features/skill/components/SkillSummaryBar';
import { PageLayout } from '../../components/layout/PageLayout';

export default function SkillPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { skills, loading } = useSelector((s: RootState) => s.skill);

  useEffect(() => { dispatch(fetchSkills('org-123')); }, [dispatch]);

  return (
    <PageLayout
      title="Skill Catalog"
      subtitle="Manage and evaluate AI capabilities across your organisation"
      breadcrumb="Skill"
      action={
        <Link href="/skill/create" className="btn-skill">
          + New Skill
        </Link>
      }
    >
      <div className="space-y-6 animate-fade-in-up">
        <SkillSummaryBar skills={skills} loading={loading} />

        {loading ? (
          <SkillGridSkeleton />
        ) : (
          <SkillGrid skills={skills} />
        )}
      </div>
    </PageLayout>
  );
}

function SkillGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-3/4" />
          <div className="flex gap-2 pt-1">
            <div className="skeleton h-3 w-16 rounded-full" />
            <div className="skeleton h-3 w-12 rounded-full" />
            <div className="skeleton h-3 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
