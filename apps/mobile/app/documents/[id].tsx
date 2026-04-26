import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Brand, Semantic, Shadows,
  FontSize, FontWeight, Radius, Space,
} from '@/constants/theme';

const API = process.env.EXPO_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed';
type Tab = 'summary' | 'actions' | 'workflow';

interface WorkflowStep {
  step_number: number;
  action:      string;
  priority:    'High' | 'Medium' | 'Low';
  description?: string;
  owner?:       string;
  deadline?:    string;
}

interface Entities {
  names:   string[];
  dates:   string[];
  clauses: string[];
  tasks:   string[];
  risks:   string[];
}

interface Analysis {
  document_id: string;
  status:      AnalysisStatus;
  summary:     string;
  entities:    Entities;
  workflow:    WorkflowStep[];
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  High:   { bg: Semantic.dangerBg,  text: Semantic.danger  },
  Medium: { bg: Semantic.warningBg, text: Semantic.warning  },
  Low:    { bg: Semantic.successBg, text: Semantic.success  },
};

const ACTION_SECTIONS = [
  { key: 'names'   as keyof Entities, label: 'Parties & Names',      icon: '👤' },
  { key: 'dates'   as keyof Entities, label: 'Key Dates',            icon: '📅' },
  { key: 'clauses' as keyof Entities, label: 'Contract Clauses',     icon: '📋' },
  { key: 'tasks'   as keyof Entities, label: 'Tasks & Deliverables', icon: '✅' },
  { key: 'risks'   as keyof Entities, label: 'Risks & Liabilities',  icon: '⚠️' },
];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'summary',  label: 'Summary',       icon: '📝' },
  { id: 'actions',  label: 'Action Points', icon: '✅' },
  { id: 'workflow', label: 'Workflow',       icon: '🔄' },
];

function SummaryTab({ summary }: { summary: string }) {
  const paragraphs = summary?.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) ?? [];
  return (
    <View style={card.wrap}>
      <Text style={card.summaryText}>
        {paragraphs.length > 0 ? paragraphs.join('\n\n') : 'No summary available.'}
      </Text>
    </View>
  );
}

function ActionsTab({ entities }: { entities: Entities }) {
  return (
    <View>
      {ACTION_SECTIONS.map(({ key, label, icon }) => (
        <View key={key} style={card.wrap}>
          <Text style={card.sectionTitle}>{icon}  {label}</Text>
          {entities[key].length === 0
            ? <Text style={card.emptyText}>None identified</Text>
            : entities[key].map((item, i) => (
                <View key={i} style={card.bulletRow}>
                  <Text style={card.bullet}>•</Text>
                  <Text style={card.bulletText}>{item}</Text>
                </View>
              ))
          }
        </View>
      ))}
    </View>
  );
}

function WorkflowTab({ steps }: { steps: WorkflowStep[] }) {
  if (!steps.length) {
    return (
      <View style={card.wrap}>
        <Text style={card.emptyText}>No workflow steps available.</Text>
      </View>
    );
  }
  return (
    <View>
      {steps.map((step) => {
        const p = PRIORITY_STYLE[step.priority] ?? { bg: '#f9fafb', text: '#374151' };
        return (
          <View key={step.step_number} style={card.workflowRow}>
            <View style={card.stepBadge}>
              <Text style={card.stepNumber}>{step.step_number}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={card.workflowTop}>
                <Text style={card.actionText} numberOfLines={2}>{step.action}</Text>
                <View style={[card.priorityBadge, { backgroundColor: p.bg }]}>
                  <Text style={[card.priorityText, { color: p.text }]}>{step.priority}</Text>
                </View>
              </View>
              {step.description ? <Text style={card.description}>{step.description}</Text> : null}
              {(step.owner || step.deadline) ? (
                <View style={card.metaRow}>
                  {step.owner    ? <Text style={card.metaText}>👤 {step.owner}</Text>    : null}
                  {step.deadline ? <Text style={card.metaText}>📅 {step.deadline}</Text> : null}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [analysis,  setAnalysis]  = useState<Analysis | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  const fetchAnalysis = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/analyses/${id}`);
      if (res.ok) setAnalysis(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  useEffect(() => {
    if (!analysis || analysis.status === 'done' || analysis.status === 'failed') return;
    const interval = setInterval(fetchAnalysis, 4000);
    return () => clearInterval(interval);
  }, [analysis?.status, fetchAnalysis]);

  async function retryAnalysis() {
    await fetch(`${API}/analyses/${id}/retry`, { method: 'POST' });
    setAnalysis((prev) => prev ? { ...prev, status: 'pending' } : prev);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backText}>← Documents</Text>
        </TouchableOpacity>
        <Text style={s.title}>Analysis</Text>
      </View>

      {loading && !analysis && (
        <ActivityIndicator style={{ marginTop: 60 }} color={Brand.steer} />
      )}

      {analysis && (analysis.status === 'pending' || analysis.status === 'processing') && (
        <View style={s.stateBox}>
          <ActivityIndicator size="large" color={Brand.steer} />
          <Text style={s.stateTitle}>Analysing document…</Text>
          <Text style={s.stateSub}>Summary · Action Points · Workflow</Text>
        </View>
      )}

      {analysis?.status === 'failed' && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>Analysis failed. Please try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={retryAnalysis}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {analysis?.status === 'done' && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabBar}
            contentContainerStyle={s.tabBarContent}
          >
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.tabBtn, activeTab === t.id && s.tabBtnActive]}
                onPress={() => setActiveTab(t.id)}
              >
                <Text style={s.tabIcon}>{t.icon}</Text>
                <Text style={[s.tabLabel, activeTab === t.id && s.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
            {activeTab === 'summary'  && <SummaryTab  summary={analysis.summary}     />}
            {activeTab === 'actions'  && <ActionsTab  entities={analysis.entities}   />}
            {activeTab === 'workflow' && <WorkflowTab steps={analysis.workflow}       />}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
  },
  header: {
    paddingHorizontal: Space.xl,
    marginBottom:      Space.lg,
  },
  backText: {
    fontSize:   FontSize.sm,
    color:      Brand.steer,
    fontWeight: FontWeight.semibold,
    marginBottom: Space.sm,
  },
  title: {
    fontSize:   FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    color:      '#0f172a',
    letterSpacing: -0.5,
  },

  stateBox: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Space.md,
    paddingHorizontal: Space.xl,
  },
  stateTitle: {
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.semibold,
    color:      '#0f172a',
  },
  stateSub: {
    fontSize: FontSize.sm,
    color:    '#94a3b8',
  },

  errorBox: {
    alignItems: 'center',
    marginTop:  60,
    gap:        Space.md,
    paddingHorizontal: Space.xl,
  },
  errorText: {
    fontSize:   FontSize.base,
    color:      Semantic.danger,
    fontWeight: FontWeight.semibold,
    textAlign:  'center',
  },
  retryBtn: {
    backgroundColor:  Brand.steer,
    borderRadius:     Radius.md,
    paddingHorizontal: Space['2xl'],
    paddingVertical:  Space.sm,
    ...Shadows.sm,
  },
  retryBtnText: {
    color:      '#ffffff',
    fontWeight: FontWeight.bold,
    fontSize:   FontSize.base,
  },

  tabBar:        { flexShrink: 0 },
  tabBarContent: { paddingHorizontal: Space.xl, gap: Space.sm, paddingBottom: 4 },
  tabBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius:    Radius.full,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: { backgroundColor: Brand.steer },
  tabIcon:      { fontSize: 13 },
  tabLabel: {
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.semibold,
    color:      '#94a3b8',
  },
  tabLabelActive: { color: '#ffffff' },

  content:      { flex: 1 },
  contentInner: { padding: Space.xl, paddingBottom: Space['4xl'] },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff',
    borderRadius:    Radius.xl,
    padding:         Space.lg,
    marginBottom:    Space.sm,
    ...Shadows.sm,
  },
  summaryText: {
    fontSize:   FontSize.base,
    lineHeight: 24,
    color:      '#374151',
  },
  sectionTitle: {
    fontWeight:   FontWeight.bold,
    fontSize:     FontSize.sm,
    color:        '#111827',
    marginBottom: Space.sm,
  },
  emptyText: {
    fontSize:   FontSize.sm,
    color:      '#94a3b8',
    fontStyle:  'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    gap:           Space.sm,
    marginBottom:  4,
  },
  bullet:     { color: '#d1d5db', fontSize: FontSize.base },
  bulletText: { flex: 1, fontSize: FontSize.sm, color: '#374151', lineHeight: 20 },

  workflowRow: {
    backgroundColor: '#ffffff',
    borderRadius:    Radius.xl,
    padding:         Space.md,
    marginBottom:    Space.sm,
    flexDirection:   'row',
    gap:             Space.md,
    ...Shadows.sm,
  },
  stepBadge: {
    width:          34,
    height:         34,
    borderRadius:   Radius.sm,
    backgroundColor: `${Brand.steer}15`,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  stepNumber: {
    fontWeight: FontWeight.bold,
    color:      Brand.steer,
    fontSize:   FontSize.sm,
  },
  workflowTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            Space.sm,
  },
  actionText: {
    flex:       1,
    fontWeight: FontWeight.semibold,
    fontSize:   FontSize.sm,
    color:      '#111827',
  },
  priorityBadge: {
    paddingHorizontal: Space.sm,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
    flexShrink:        0,
  },
  priorityText: {
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  description: {
    fontSize:   FontSize.xs,
    color:      '#6b7280',
    marginTop:  4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    gap:           Space.md,
    marginTop:     Space.sm,
  },
  metaText: {
    fontSize: FontSize.xs,
    color:    '#94a3b8',
  },
});
