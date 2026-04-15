import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

const API = process.env.EXPO_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';

// ── Types ──────────────────────────────────────────────────────
interface WorkflowStep {
  step_number: number;
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  description?: string;
  owner?: string;
  deadline?: string;
}
interface Entities {
  names: string[];
  dates: string[];
  clauses: string[];
  tasks: string[];
  risks: string[];
}
interface Analysis {
  document_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  summary: string;
  entities: Entities;
  workflow: WorkflowStep[];
}

type Tab = 'summary' | 'action-points' | 'workflow';

// ── Priority colours ──────────────────────────────────────────
const PRIORITY: Record<string, { bg: string; text: string }> = {
  High:   { bg: '#fef2f2', text: '#dc2626' },
  Medium: { bg: '#fefce8', text: '#ca8a04' },
  Low:    { bg: '#f0fdf4', text: '#16a34a' },
};

// ── Sub-components ─────────────────────────────────────────────
function SummaryTab({ summary }: { summary: string }) {
  return (
    <View style={tab.card}>
      <Text style={tab.summaryText}>{summary || 'No summary available.'}</Text>
    </View>
  );
}

function ActionPointsTab({ entities }: { entities: Entities }) {
  const sections = [
    { label: 'Parties & Names',      icon: '👤', items: entities.names   },
    { label: 'Key Dates',            icon: '📅', items: entities.dates   },
    { label: 'Contract Clauses',     icon: '📋', items: entities.clauses },
    { label: 'Tasks & Deliverables', icon: '✅', items: entities.tasks   },
    { label: 'Risks & Liabilities',  icon: '⚠️', items: entities.risks   },
  ];

  return (
    <View>
      {sections.map(({ label, icon, items }) => (
        <View key={label} style={tab.card}>
          <Text style={tab.sectionTitle}>{icon}  {label}</Text>
          {items.length === 0
            ? <Text style={tab.emptyItem}>None identified</Text>
            : items.map((item, i) => (
                <View key={i} style={tab.bulletRow}>
                  <Text style={tab.bullet}>•</Text>
                  <Text style={tab.bulletText}>{item}</Text>
                </View>
              ))
          }
        </View>
      ))}
    </View>
  );
}

function WorkflowTab({ steps }: { steps: WorkflowStep[] }) {
  if (!steps.length) return <Text style={tab.emptyItem}>No workflow steps available.</Text>;

  return (
    <View>
      {steps.map((step) => {
        const p = PRIORITY[step.priority] ?? { bg: '#f9fafb', text: '#374151' };
        return (
          <View key={step.step_number} style={tab.workflowCard}>
            <View style={tab.stepBadge}>
              <Text style={tab.stepNumber}>{step.step_number}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={tab.workflowTop}>
                <Text style={tab.action} numberOfLines={2}>{step.action}</Text>
                <View style={[tab.priorityBadge, { backgroundColor: p.bg }]}>
                  <Text style={[tab.priorityText, { color: p.text }]}>{step.priority}</Text>
                </View>
              </View>
              {step.description && <Text style={tab.description}>{step.description}</Text>}
              {(step.owner || step.deadline) && (
                <View style={tab.metaRow}>
                  {step.owner    && <Text style={tab.meta}>👤 {step.owner}</Text>}
                  {step.deadline && <Text style={tab.meta}>📅 {step.deadline}</Text>}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/analyses/${id}`);
      if (res.ok) setAnalysis(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll while not done
  useEffect(() => {
    if (!analysis || analysis.status === 'done' || analysis.status === 'failed') return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [analysis?.status, load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary',       label: '📝 Summary'       },
    { id: 'action-points', label: '✅ Action Points' },
    { id: 'workflow',      label: '🔄 Workflow'      },
  ];

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>← Documents</Text>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Analysis</ThemedText>
      </View>

      {/* Loading */}
      {loading && !analysis && (
        <ActivityIndicator style={{ marginTop: 60 }} />
      )}

      {/* Processing */}
      {analysis && (analysis.status === 'pending' || analysis.status === 'processing') && (
        <View style={styles.processingBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.processingText}>Analysing document…</Text>
          <Text style={styles.processingSubtext}>Summary → Action Points → Workflow</Text>
        </View>
      )}

      {/* Failed */}
      {analysis?.status === 'failed' && (
        <View style={styles.failBox}>
          <Text style={styles.failText}>Analysis failed.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={async () => {
              await fetch(`${API}/analyses/${id}/retry`, { method: 'POST' });
              setAnalysis((a) => a ? { ...a, status: 'pending' } : a);
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Done */}
      {analysis?.status === 'done' && (
        <>
          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.id)}
              >
                <Text style={[styles.tabBtnText, activeTab === t.id && styles.tabBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab content */}
          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {activeTab === 'summary'       && <SummaryTab      summary={analysis.summary}    />}
            {activeTab === 'action-points' && <ActionPointsTab entities={analysis.entities}  />}
            {activeTab === 'workflow'      && <WorkflowTab     steps={analysis.workflow}     />}
          </ScrollView>
        </>
      )}
    </ThemedView>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 24 },
  header:          { paddingHorizontal: 20, marginBottom: 16 },
  back:            { color: '#6b7280', fontSize: 14, marginBottom: 6 },
  title:           {},
  processingBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText:  { fontSize: 16, fontWeight: '600', color: '#374151' },
  processingSubtext: { fontSize: 13, color: '#9ca3af' },
  failBox:         { alignItems: 'center', marginTop: 60, gap: 12 },
  failText:        { fontSize: 15, color: '#dc2626', fontWeight: '600' },
  retryBtn:        { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:    { color: '#fff', fontWeight: '700' },
  tabBar:          { flexShrink: 0 },
  tabBarContent:   { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  tabBtn:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
  tabBtnActive:    { backgroundColor: '#4f46e5' },
  tabBtnText:      { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabBtnTextActive: { color: '#fff' },
  content:         { flex: 1 },
  contentInner:    { padding: 20, paddingBottom: 40 },
});

const tab = StyleSheet.create({
  card:          { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  summaryText:   { fontSize: 15, lineHeight: 24, color: '#374151' },
  sectionTitle:  { fontWeight: '700', fontSize: 14, color: '#111827', marginBottom: 10 },
  emptyItem:     { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  bulletRow:     { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bullet:        { color: '#d1d5db', fontSize: 14 },
  bulletText:    { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  workflowCard:  { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  stepBadge:     { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumber:    { fontWeight: '700', color: '#4f46e5', fontSize: 14 },
  workflowTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  action:        { flex: 1, fontWeight: '600', fontSize: 14, color: '#111827' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
  priorityText:  { fontSize: 11, fontWeight: '700' },
  description:   { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 18 },
  metaRow:       { flexDirection: 'row', gap: 12, marginTop: 6 },
  meta:          { fontSize: 11, color: '#9ca3af' },
});
