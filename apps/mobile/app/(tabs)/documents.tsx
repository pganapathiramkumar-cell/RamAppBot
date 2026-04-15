import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Platform, Animated,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import { ThemedView } from '@/components/themed-view';

const API = process.env.EXPO_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1';
const MAX_SIZE = 5 * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────────
type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'failed';
type Tab   = 'summary' | 'actions' | 'workflow';

interface Entities {
  names: string[]; dates: string[]; clauses: string[];
  tasks: string[]; risks: string[];
}
interface Analysis {
  document_id: string; status: string;
  summary: string; entities: Entities;
  workflow: unknown[];
  mermaid_chart?: string;
}

// ── Sub-components ─────────────────────────────────────────────

function SummaryTab({ summary }: { summary: string }) {
  return (
    <View style={card.wrap}>
      <Text style={card.label}>📝  Executive Summary</Text>
      <Text style={card.body}>{summary || 'No summary available.'}</Text>
    </View>
  );
}

function ActionsTab({ entities }: { entities: Entities }) {
  const sections = [
    { label: 'Names',   icon: '👤', items: entities.names   },
    { label: 'Dates',   icon: '📅', items: entities.dates   },
    { label: 'Clauses', icon: '📋', items: entities.clauses },
    { label: 'Tasks',   icon: '✅', items: entities.tasks   },
    { label: 'Risks',   icon: '⚠️', items: entities.risks   },
  ];
  const filled = sections.filter(s => s.items.length > 0);
  if (filled.length === 0) return (
    <View style={card.wrap}><Text style={card.empty}>No action points extracted.</Text></View>
  );
  return (
    <View style={{ gap: 10 }}>
      {filled.map(({ label, icon, items }) => (
        <View key={label} style={card.wrap}>
          <Text style={card.label}>{icon}  {label}</Text>
          {items.map((item, i) => (
            <Text key={i} style={card.bullet}>• {item}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function WorkflowTab({ chart }: { chart?: string }) {
  if (!chart) return (
    <View style={card.wrap}>
      <Text style={card.empty}>No workflow diagram available.</Text>
    </View>
  );

  const escaped = chart.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; padding: 12px; font-family: system-ui, sans-serif; }
    .mermaid { width: 100%; }
    svg { width: 100% !important; height: auto !important; }
  </style>
</head>
<body>
  <div class="mermaid">\${String.raw\`${escaped}\`}</div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: { fontSize: '13px', fontFamily: 'system-ui, sans-serif' },
      flowchart: { curve: 'basis', padding: 16 }
    });
  </script>
</body>
</html>`;

  return (
    <View style={wf.container}>
      <WebView
        source={{ html }}
        style={wf.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={() => true}
      />
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function DocumentsScreen() {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [docId, setDocId]       = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const dotAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation while processing
  useEffect(() => {
    if (phase !== 'processing') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, dotAnim]);

  // Poll backend while processing
  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/analyses/${id}`);
      if (!res.ok) return;
      const data: Analysis = await res.json();
      if (data.status === 'done') { setAnalysis(data); setPhase('done'); }
      else if (data.status === 'failed') { setError('Analysis failed. Please try again.'); setPhase('failed'); }
    } catch { /* keep polling */ }
  }, []);

  useEffect(() => {
    if (phase !== 'processing' || !docId) return;
    const t = setInterval(() => poll(docId), 3000);
    return () => clearInterval(t);
  }, [phase, docId, poll]);

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];

    if (asset.size && asset.size > MAX_SIZE) {
      Alert.alert('File too large', 'Please choose a PDF under 5 MB.'); return;
    }

    setFilename(asset.name);
    setError(null);
    setPhase('uploading');

    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: 'application/pdf' } as unknown as Blob);

    try {
      const res = await fetch(`${API}/documents/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message ?? `Upload failed (${res.status})`);
      }
      const doc = await res.json();
      setDocId(doc.id);
      setPhase('processing');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach the document service.');
      setPhase('failed');
    }
  }

  function reset() {
    setPhase('idle'); setDocId(null); setAnalysis(null);
    setError(null); setFilename(''); setActiveTab('summary');
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: '📝 Summary'      },
    { id: 'actions', label: '✅ Action Points' },
    { id: 'workflow', label: '🔄 Workflow'     },
  ];

  return (
    <ThemedView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerEmoji}>🤖</Text>
          <Text style={s.headerTitle}>RamBot</Text>
          <Text style={s.headerSub}>Enterprise AI Platform</Text>
        </View>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <TouchableOpacity style={s.uploadBox} onPress={pickAndUpload} activeOpacity={0.8}>
            <Text style={s.uploadIcon}>📄</Text>
            <Text style={s.uploadTitle}>Tap to upload a PDF</Text>
            <Text style={s.uploadSub}>Maximum file size: 5 MB</Text>
          </TouchableOpacity>
        )}

        {/* ── UPLOADING ── */}
        {phase === 'uploading' && (
          <View style={s.spinnerBox}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={s.spinnerTitle}>Uploading…</Text>
            <Text style={s.spinnerSub} numberOfLines={1}>{filename}</Text>
          </View>
        )}

        {/* ── PROCESSING ── */}
        {phase === 'processing' && (
          <View style={s.spinnerBox}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={s.spinnerTitle}>Analysing your document…</Text>
            <Text style={s.spinnerSub}>
              Generating summary, action points and workflow.{'\n'}
              Please wait — this takes about 15–30 seconds.
            </Text>
            <View style={s.pillRow}>
              {['Summary', 'Action Points', 'Workflow'].map((l) => (
                <Animated.View key={l} style={[s.pill, { opacity: dotAnim }]}>
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
            <View style={s.chipRow}>
              <View style={s.chip}>
                <Text style={s.chipIcon}>📄</Text>
                <Text style={s.chipName} numberOfLines={1}>{filename}</Text>
                <View style={s.chipBadge}><Text style={s.chipBadgeText}>Done</Text></View>
              </View>
              <TouchableOpacity onPress={reset} style={s.newBtn}>
                <Text style={s.newBtnText}>+ New</Text>
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={s.tabBar}>
              {tabs.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={[s.tabBtn, activeTab === t.id && s.tabBtnActive]}
                >
                  <Text style={[s.tabLabel, activeTab === t.id && s.tabLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab content */}
            {activeTab === 'summary' && <SummaryTab summary={analysis.summary} />}
            {activeTab === 'actions' && <ActionsTab entities={analysis.entities} />}
            {activeTab === 'workflow' && <WorkflowTab chart={analysis.mermaid_chart} />}
          </View>
        )}

        {/* ── FAILED ── */}
        {phase === 'failed' && (
          <View style={s.errorBox}>
            <Text style={s.errorIcon}>❌</Text>
            <Text style={s.errorTitle}>Something went wrong</Text>
            <Text style={s.errorMsg}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={reset}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </ThemedView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 64 : 32, paddingBottom: 48 },
  header:         { alignItems: 'center', marginBottom: 28 },
  headerEmoji:    { fontSize: 48, marginBottom: 6 },
  headerTitle:    { fontSize: 30, fontWeight: '800', color: '#111827' },
  headerSub:      { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  uploadBox:      { borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 24, padding: 48, alignItems: 'center', backgroundColor: '#fafafa' },
  uploadIcon:     { fontSize: 52, marginBottom: 12 },
  uploadTitle:    { fontSize: 17, fontWeight: '700', color: '#374151' },
  uploadSub:      { fontSize: 13, color: '#9ca3af', marginTop: 6 },
  spinnerBox:     { backgroundColor: 'white', borderRadius: 24, padding: 40, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  spinnerTitle:   { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 16 },
  spinnerSub:     { fontSize: 13, color: '#9ca3af', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  pillRow:        { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  pill:           { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#eef2ff', borderRadius: 20 },
  pillText:       { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  chipRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flex: 1, marginRight: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  chipIcon:       { fontSize: 16 },
  chipName:       { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  chipBadge:      { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  chipBadgeText:  { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  newBtn:         { backgroundColor: '#eef2ff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  newBtnText:     { color: '#4f46e5', fontSize: 13, fontWeight: '700' },
  tabBar:         { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 16, padding: 4, marginBottom: 16 },
  tabBtn:         { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  tabBtnActive:   { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabLabel:       { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  tabLabelActive: { color: '#4f46e5' },
  errorBox:       { backgroundColor: 'white', borderRadius: 24, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#fee2e2' },
  errorIcon:      { fontSize: 44, marginBottom: 10 },
  errorTitle:     { fontSize: 17, fontWeight: '700', color: '#374151' },
  errorMsg:       { fontSize: 13, color: '#ef4444', marginTop: 6, textAlign: 'center' },
  retryBtn:       { marginTop: 20, backgroundColor: '#4f46e5', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 16 },
  retryText:      { color: 'white', fontWeight: '700', fontSize: 15 },
});

const card = StyleSheet.create({
  wrap:  { backgroundColor: 'white', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
  body:  { fontSize: 14, color: '#4b5563', lineHeight: 22 },
  bullet:{ fontSize: 13, color: '#4b5563', lineHeight: 22, marginBottom: 4 },
  empty: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
});

const wf = StyleSheet.create({
  container: { backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  webview:   { width: '100%', height: 420, backgroundColor: 'white' },
});
