'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { fetchSkills } from '../../features/skill/store/skillSlice';
import { RootState, AppDispatch } from '../store';
import { SkillGrid } from '../../features/skill/components/SkillGrid';
import { SkillSummaryBar } from '../../features/skill/components/SkillSummaryBar';

export default function SkillPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { skills, loading } = useSelector((s: RootState) => s.skill);

  useEffect(() => { dispatch(fetchSkills('org-123')); }, [dispatch]);

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:text-skill mb-2 block">← Dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-900">Skill</h1>
          <p className="text-gray-500">AI Capability Catalog</p>
        </div>
        <Link href="/skill/create" className="btn-secondary">+ New Skill</Link>
      </div>

      <SkillSummaryBar skills={skills} />

      <div className="mt-8">
        {loading
          ? <div className="text-gray-500">Loading skills…</div>
          : <SkillGrid skills={skills} />
        }
      </div>
    </main>
  );
}
