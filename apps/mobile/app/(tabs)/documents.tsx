import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Platform, Animated, StatusBar,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import {
  Brand, Category, Semantic, Shadows,
  FontSize, FontWeight, Radius, Space,
} from '@/constants/theme';

const API      = process.env.EXPO_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';
const MAX_SIZE = 5 * 1024 * 1024;

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'failed';
type Tab   = 'summary' | 'actions' | 'workflow';

interface Entities {
  names: string[]; dates: string[]; clauses: string[];
  tasks: string[]; risks: string[];
}
interface Analysis {
  document_id: string; status: string;
  summary: string; entities: Entities;
  workflow: unknown[]; mermaid_chart?: string;
}

/* ── Category config ──────────────────────────────────────────── */
const CATS = [
  { key: 'names'   as keyof Entities, label: 'People & Names', icon: '👤', ...Category.names   },
  { key: 'dates'   as keyof Entities, label: 'Key Dates',       icon: '📅', ...Category.dates   },
  { key: 'clauses' as keyof Entities, label: 'Clauses',         icon: '📋', ...Category.clauses },
  { key: 'tasks'   as keyof Entities, label: 'Action Tasks',    icon: '✅', ...Category.tasks   },
  { key: 'risks'   as keyof Entities, label: 'Risks',           icon: '⚠️', ...Category.risks   },
];

/* ── Summary tab ──────────────────────────────────────────────── */
function SummaryTab({ summary }: { summary: string }) {
  const paras = summary?.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) ?? [];
  return (
    <View style={tabCard.wrap}>
      <View style={tabCard.header}>
        <View style={[tabCard.iconBox, { backgroundColor: `${Brand.steer}18` }]}>
          <Text style={tabCard.icon}>📝</Text>
        </View>
        <View>
          <Text style={tabCard.title}>Executive Summary</Text>
          <Text style={tabCard.meta}>AI-generated overview</Text>
        </View>
      </View>
      {paras.length > 0
        ? paras.map((p, i) => <Text key={i} style={tabCard.body}>{p}</Text>)
        : <Text style={tabCard.empty}>No summary available.</Text>
      }
    </View>
  );
}

/* ── Actions tab ──────────────────────────────────────────────── */
function ActionsTab({ entities }: { entities: Entities }) {
  const filled = CATS.filter((c) => (entities[c.key] as string[])?.length > 0);
  if (!filled.length) {
    return (
      <View style={tabCard.wrap}>
        <Text style={tabCard.empty}>No action points extracted.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: Space.sm }}>
      {filled.map((cat) => {
        const items = entities[cat.key] as string[];
        return (
          <View key={cat.key} style={[actionCard.wrap, { backgroundColor: cat.bg, borderColor: cat.border }]}>
            <View style={actionCard.header}>
              <Text style={actionCard.icon}>{cat.icon}</Text>
              <Text style={[actionCard.label, { color: cat.text }]}>{cat.label}</Text>
              <View style={[actionCard.countBadge, { backgroundColor: cat.accent }]}>
                <Text style={actionCard.countText}>{items.length}</Text>
              </View>
            </View>
            {items.map((item, i) => (
              <View key={i} style={actionCard.row}>
                <View style={[actionCard.dot, { backgroundColor: cat.accent }]} />
                <Text style={[actionCard.item, { color: cat.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/* ── Workflow tab ─────────────────────────────────────────────── */
function WorkflowTab({ chart }: { chart?: string }) {
  if (!chart) {
    return (
      <View style={tabCard.wrap}>
        <Text style={tabCard.empty}>No workflow diagram available.</Text>
      </View>
    );
  }
  const escaped = chart.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const html = `<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#fff;padding:16px;font-family:system-ui,sans-serif}
    .mermaid{width:100%}
    svg{width:100%!important;height:auto!important}
    .node rect,.node circle,.node ellipse,.node polygon{fill:#e0e7ff;stroke:#6366f1;stroke-width:1.5px}
    .edgePath .path{stroke:#94a3b8}
  </style>
</head>
<body>
  <div class="mermaid">\${String.raw\`${escaped}\`}</div>
  <script>
    mermaid.initialize({
      startOnLoad:true,
      theme:'base',
      themeVariables:{
        fontSize:'13px',fontFamily:'system-ui,sans-serif',
        primaryColor:'#e0e7ff',primaryBorderColor:'#6366f1',
        primaryTextColor:'#1e1b4b',lineColor:'#94a3b8',
        edgeLabelBackground:'#f8fafc',
      },
      flowchart:{curve:'basis',padding:20}
    });
  </script>
</body></html>`;

  return (
    <View style={wfStyle.wrap}>
      <View style={tabCard.header}>
        <View style={[tabCard.iconBox, { backgroundColor: `${Brand.skill}18` }]}>
          <Text style={tabCard.icon}>🔄</Text>
        </View>
        <View>
          <Text style={tabCard.title}>Document Workflow</Text>
          <Text style={tabCard.meta}>Visual process diagram</Text>
        </View>
      </View>
      <WebView
        source={{ html }}
        style={wfStyle.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
      />
    </View>
  );
}

/* ── Main screen ──────────────────────────────────────────────── */
export default function DocumentsScreen() {
  const [phase,     setPhase]     = useState<Phase>('idle');
  const [docId,     setDocId]     = useState<string | null>(null);
  const [analysis,  setAnalysis]  = useState<Analysis | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [filename,  setFilename]  = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [progress,  setProgress]  = useState(0);
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  /* Pulse during processing */
  useEffect(() => {
    if (phase !== 'processing') { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, pulseAnim]);

  /* Animate progress bar */
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  /* Fake progress steps */
  useEffect(() => {
    if (phase !== 'processing') return;
    const steps = [15, 30, 45, 60, 72, 83, 91];
    let i = 0;
    const t = setInterval(() => {
      if (i < steps.length) setProgress(steps[i++]); else clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [phase]);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/analyses/${id}`);
      if (!res.ok) return;
      const data: Analysis = await res.json();
      if (data.status === 'done') {
        setProgress(100);
        setTimeout(() => { setAnalysis(data); setPhase('done'); }, 500);
      } else if (data.status === 'failed') {
        setError('Analysis failed. Please try again.');
        setPhase('failed');
      }
    } catch { /* keep polling */ }
  }, []);

  useEffect(() => {
    if (phase !== 'processing' || !docId) return;
    const t = setInterval(() => poll(docId), 3000);
    return () => clearInterval(t);
  }, [phase, docId, poll]);

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf', copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_SIZE) {
      Alert.alert('File too large', 'Please choose a PDF under 5 MB.'); return;
    }
    setFilename(asset.name); setError(null); setProgress(0); setPhase('uploading');
    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: 'application/pdf' } as unknown as Blob);
    try {
      const res = await fetch(`${API}/documents/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message ?? `Upload failed (${res.status})`);
      }
      const doc = await res.json();
      setDocId(doc.id); setPhase('processing');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach the document service.');
      setPhase('failed');
    }
  }

  function reset() {
    setPhase('idle'); setDocId(null); setAnalysis(null);
    setError(null); setFilename(''); setActiveTab('summary'); setProgress(0);
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'summary', label: 'Summary',      icon: '📝' },
    { id: 'actions', label: 'Action Points',icon: '✅' },
    { id: 'workflow',label: 'Workflow',      icon: '🔄' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLogo}>
            <Text style={s.headerLogoEmoji}>📄</Text>
          </View>
          <Text style={s.headerTitle}>DocuMind</Text>
          <Text style={s.headerSub}>AI Document Intelligence</Text>
        </View>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <View>
            {/* Feature pills */}
            <View style={s.featurePills}>
              {[
                { icon: '📝', label: 'Smart Summary',  color: Brand.steer  },
                { icon: '✅', label: 'Action Points',  color: Brand.skill  },
                { icon: '🔄', label: 'Workflow',        color: Brand.docuMind },
              ].map((f) => (
                <View key={f.label} style={[s.featurePill, { borderColor: `${f.color}30` }]}>
                  <Text style={s.featurePillIcon}>{f.icon}</Text>
                  <Text style={[s.featurePillLabel, { color: f.color }]}>{f.label}</Text>
                </View>
              ))}
            </View>

            {/* Upload zone */}
            <TouchableOpacity style={s.uploadBox} onPress={pickAndUpload} activeOpacity={0.85}>
              <View style={s.uploadIconWrap}>
                <Text style={s.uploadIconText}>⬆️</Text>
              </View>
              <Text style={s.uploadTitle}>Tap to upload a PDF</Text>
              <Text style={s.uploadSub}>Maximum 5 MB · PDF only</Text>
              <View style={s.uploadBtn}>
                <Text style={s.uploadBtnText}>Choose File →</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── UPLOADING ── */}
        {phase === 'uploading' && (
          <View style={s.stateCard}>
            <ActivityIndicator size="large" color={Brand.steer} />
            <Text style={s.stateTitle}>Uploading your PDF…</Text>
            <Text style={s.stateSub} numberOfLines={1}>{filename}</Text>
          </View>
        )}

        {/* ── PROCESSING ── */}
        {phase === 'processing' && (
          <View style={s.stateCard}>
            <View style={s.spinnerRing}>
              <ActivityIndicator size="large" color={Brand.steer} />
              <Text style={s.spinnerEmoji}>🤖</Text>
            </View>
            <Text style={s.stateTitle}>Analysing document…</Text>
            <Text style={s.stateSub}>This takes about 15–30 seconds.</Text>

            {/* Progress bar */}
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <Animated.View
                  style={[
                    s.progressFill,
                    { width: progressAnim.interpolate({ inputRange: [0,100], outputRange: ['0%','100%'] }) },
                  ]}
                />
              </View>
              <Text style={s.progressPct}>{progress}%</Text>
            </View>

            {/* Output pills */}
            <View style={s.pillRow}>
              {['Summary', 'Action Points', 'Workflow'].map((l) => (
                <Animated.View key={l} style={[s.pill, { opacity: pulseAnim }]}>
                  <Text style={s.pillText}>{l}</Text>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && analysis && (
          <View>
            {/* File chip */}
            <View style={s.fileChip}>
              <View style={s.fileChipIcon}><Text>📄</Text></View>
              <View style={s.fileChipBody}>
                <Text style={s.fileChipName} numberOfLines={1}>{filename}</Text>
                <Text style={s.fileChipMeta}>Analysis complete</Text>
              </View>
              <View style={s.fileChipBadge}>
                <View style={s.fileChipDot} />
                <Text style={s.fileChipBadgeText}>Done</Text>
              </View>
              <TouchableOpacity onPress={reset} style={s.newBtn}>
                <Text style={s.newBtnText}>+ New</Text>
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={s.tabBar}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={[s.tabBtn, activeTab === t.id && s.tabBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={s.tabIcon}>{t.icon}</Text>
                  <Text style={[s.tabLabel, activeTab === t.id && s.tabLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Content */}
            {activeTab === 'summary'  && <SummaryTab summary={analysis.summary} />}
            {activeTab === 'actions'  && <ActionsTab entities={analysis.entities} />}
            {activeTab === 'workflow' && <WorkflowTab chart={analysis.mermaid_chart} />}
          </View>
        )}

        {/* ── FAILED ── */}
        {phase === 'failed' && (
          <View style={s.errorCard}>
            <View style={s.errorIconWrap}><Text style={s.errorIconText}>⚠️</Text></View>
            <Text style={s.errorTitle}>Something went wrong</Text>
            <Text style={s.errorMsg}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={reset} activeOpacity={0.85}>
              <Text style={s.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#f8fafc' },
  scroll: {
    paddingHorizontal: Space.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 28,
    paddingBottom: Space['5xl'],
  },

  /* Header */
  header: { alignItems: 'center', marginBottom: Space['3xl'] },
  headerLogo: {
    width: 64, height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Brand.docuMind,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.sm,
    ...Shadows.lg,
  },
  headerLogoEmoji: { fontSize: 30 },
  headerTitle: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold,
    color: '#0f172a', letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: FontSize.sm, color: '#94a3b8',
    fontWeight: FontWeight.medium, marginTop: 3,
  },

  /* Feature pills */
  featurePills: {
    flexDirection: 'row', gap: Space.sm,
    marginBottom: Space.xl, flexWrap: 'wrap',
    justifyContent: 'center',
  },
  featurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ffffff',
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
    ...Shadows.sm,
  },
  featurePillIcon: { fontSize: 13 },
  featurePillLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  /* Upload zone */
  uploadBox: {
    backgroundColor: '#ffffff',
    borderRadius: Radius['2xl'],
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#e2e8f0',
    padding: Space['4xl'], alignItems: 'center',
    ...Shadows.md,
  },
  uploadIconWrap: {
    width: 72, height: 72, borderRadius: Radius.xl,
    backgroundColor: `${Brand.docuMind}15`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.lg,
  },
  uploadIconText: { fontSize: 36 },
  uploadTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    color: '#0f172a', marginBottom: 4,
  },
  uploadSub: {
    fontSize: FontSize.sm, color: '#94a3b8', marginBottom: Space.xl,
  },
  uploadBtn: {
    backgroundColor: Brand.docuMind,
    borderRadius: Radius.lg,
    paddingHorizontal: Space['3xl'], paddingVertical: 12,
    ...Shadows.md,
  },
  uploadBtnText: {
    color: '#ffffff', fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },

  /* State cards (uploading/processing) */
  stateCard: {
    backgroundColor: '#ffffff', borderRadius: Radius['2xl'],
    padding: Space['4xl'], alignItems: 'center', ...Shadows.md,
  },
  stateTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    color: '#0f172a', marginTop: Space.lg, textAlign: 'center',
  },
  stateSub: {
    fontSize: FontSize.sm, color: '#94a3b8',
    marginTop: 6, textAlign: 'center', lineHeight: 20,
  },

  /* Spinner ring */
  spinnerRing: {
    width: 72, height: 72,
    borderRadius: 36, borderWidth: 2, borderColor: `${Brand.steer}30`,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  spinnerEmoji: {
    position: 'absolute', fontSize: 24,
  },

  /* Progress */
  progressWrap: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: Space.xl,
  },
  progressTrack: {
    flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: Radius.full,
    backgroundColor: Brand.steer,
  },
  progressPct: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    color: Brand.steer, width: 32, textAlign: 'right',
  },

  /* Pills (processing) */
  pillRow: { flexDirection: 'row', gap: 8, marginTop: Space.xl, flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: `${Brand.steer}15`,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: `${Brand.steer}30`,
  },
  pillText: { fontSize: FontSize.xs, color: Brand.steer, fontWeight: FontWeight.semibold },

  /* File chip */
  fileChip: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm,
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    padding: Space.md, marginBottom: Space.md, ...Shadows.sm,
  },
  fileChipIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: `${Brand.docuMind}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  fileChipBody: { flex: 1, minWidth: 0 },
  fileChipName: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
    color: '#0f172a', lineHeight: 18,
  },
  fileChipMeta: { fontSize: FontSize.xs, color: '#94a3b8', marginTop: 1 },
  fileChipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Semantic.successBg,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  fileChipDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Semantic.success,
  },
  fileChipBadgeText: { fontSize: FontSize.xs, color: Semantic.successText, fontWeight: FontWeight.bold },
  newBtn: {
    backgroundColor: `${Brand.steer}15`,
    borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6,
  },
  newBtnText: { color: Brand.steer, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row', backgroundColor: '#f1f5f9',
    borderRadius: Radius.xl, padding: 4, marginBottom: Space.md,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: Radius.lg, gap: 4,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    ...Shadows.sm,
  },
  tabIcon: { fontSize: 13 },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#94a3b8' },
  tabLabelActive: { color: Brand.steer },

  /* Error card */
  errorCard: {
    backgroundColor: '#ffffff', borderRadius: Radius['2xl'],
    padding: Space['4xl'], alignItems: 'center',
    borderWidth: 1, borderColor: Semantic.dangerBg, ...Shadows.md,
  },
  errorIconWrap: {
    width: 64, height: 64, borderRadius: Radius.xl,
    backgroundColor: Semantic.dangerBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: Space.md,
  },
  errorIconText: { fontSize: 30 },
  errorTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    color: '#0f172a', marginBottom: 6,
  },
  errorMsg: {
    fontSize: FontSize.sm, color: Semantic.danger,
    textAlign: 'center', lineHeight: 20, marginBottom: Space['3xl'],
  },
  retryBtn: {
    width: '100%', backgroundColor: Brand.steer,
    borderRadius: Radius.lg, paddingVertical: 14,
    alignItems: 'center', ...Shadows.md,
  },
  retryText: { color: '#ffffff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});

const tabCard = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    padding: Space.lg, ...Shadows.sm, marginBottom: Space.xs,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    marginBottom: Space.md, paddingBottom: Space.md,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#0f172a' },
  meta:  { fontSize: FontSize.xs, color: '#94a3b8', marginTop: 1 },
  body:  { fontSize: FontSize.sm, color: '#475569', lineHeight: 22, marginBottom: 8 },
  empty: { fontSize: FontSize.sm, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingVertical: Space.xl },
});

const actionCard = StyleSheet.create({
  wrap: {
    borderRadius: Radius.xl, padding: Space.md,
    borderWidth: 1, marginBottom: Space.xs,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: Space.sm,
  },
  icon:  { fontSize: 15 },
  label: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  countBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: FontSize.xs, color: '#ffffff', fontWeight: FontWeight.bold },
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  dot:  { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  item: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
});

const wfStyle = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    overflow: 'hidden', ...Shadows.sm,
  },
  webview: { width: '100%', height: 400, backgroundColor: '#ffffff' },
});
