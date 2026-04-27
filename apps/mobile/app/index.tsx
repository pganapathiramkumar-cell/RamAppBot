import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Platform, Animated, StatusBar,
  BackHandler, AppState, AppStateStatus, Linking, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {
  Brand, Category, Semantic, Shadows,
  FontSize, FontWeight, Radius, Space,
} from '@/constants/theme';

/* ── Constants ───────────────────────────────────────────────────── */
const API             = process.env.EXPO_PUBLIC_DOCUMENT_API_URL || 'https://ramappbot.onrender.com/api/v1';
const MAX_SIZE        = 5 * 1024 * 1024;
const MAX_POLL        = 40;        // 40 × 3 s = 2 min hard cap
const UPLOAD_COOLDOWN = 5_000;     // ms between consecutive uploads
const PRIVACY_URL     = 'https://ramappbot.onrender.com/privacy';

// Module-level flag: resets when the app is fully killed — acceptable for a session consent
let _sessionConsentGiven = false;

/* ── Helpers ─────────────────────────────────────────────────────── */
function getFriendlyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === 'AbortError')
      return 'The request took too long. Please try again in a moment.';
    if (/network request failed/i.test(error.message) || /could not reach/i.test(error.message))
      return 'No internet connection. Please check your network and try again.';
    return error.message;
  }
  return 'Something went wrong while contacting the document service. Please try again.';
}

/* ── Types ───────────────────────────────────────────────────────── */
type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'failed';
type Tab   = 'summary' | 'actions' | 'workflow';

interface Entities {
  names: string[]; dates: string[]; clauses: string[];
  tasks: string[]; risks: string[];
}
interface DocumentSnapshot {
  primary_topic:      string;
  word_count:         number;
  secondary_topics:   string[];
  key_concepts:       string[];
  key_ideas:          string[];
  important_entities: {
    tools: string[]; systems: string[]; metrics: string[];
    people: string[]; organizations: string[];
  };
  relationships: string[];
}
interface WorkflowStep {
  step_number:  number;
  action:       string;
  priority:     'High' | 'Medium' | 'Low';
  description?: string;
  owner?:       string;
  deadline?:    string;
}
interface Analysis {
  document_id: string; status: string;
  summary:     string;
  snapshot?:   DocumentSnapshot;
  entities:    Entities;
  workflow:    WorkflowStep[];
}

/* ── UI config ───────────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  High:   { color: Semantic.danger,  bg: Semantic.dangerBg,  label: 'High'   },
  Medium: { color: Semantic.warning, bg: Semantic.warningBg, label: 'Medium' },
  Low:    { color: Semantic.success, bg: Semantic.successBg, label: 'Low'    },
};

const CATS = [
  { key: 'names'   as keyof Entities, label: 'Parties & Names',      icon: '👤', ...Category.names   },
  { key: 'dates'   as keyof Entities, label: 'Key Dates',            icon: '📅', ...Category.dates   },
  { key: 'clauses' as keyof Entities, label: 'Contract Clauses',     icon: '📋', ...Category.clauses },
  { key: 'tasks'   as keyof Entities, label: 'Tasks & Deliverables', icon: '✅', ...Category.tasks   },
  { key: 'risks'   as keyof Entities, label: 'Risks & Liabilities',  icon: '⚠️', ...Category.risks   },
];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'summary',  label: 'Summary',       icon: '📝' },
  { id: 'actions',  label: 'Action Points', icon: '✅' },
  { id: 'workflow', label: 'Workflow',       icon: '🔄' },
];

/* ── RamVector geometric logo ────────────────────────────────────── */
function RamVectorLogo() {
  return (
    <View style={logo.wrap}>
      <View style={logo.halo} />
      <View style={logo.diamond} />
      <View style={logo.diamondAccent} />
      <View style={logo.initialsWrap}>
        <Text style={logo.initials}>RV</Text>
      </View>
    </View>
  );
}

/* ── Summary tab ─────────────────────────────────────────────────── */
function SummaryTab({ summary, snapshot }: { summary: string; snapshot?: DocumentSnapshot }) {
  const paras = summary?.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) ?? [];

  const entityGroups = snapshot ? [
    { label: 'People',        values: snapshot.important_entities.people        },
    { label: 'Organizations', values: snapshot.important_entities.organizations },
    { label: 'Tools',         values: snapshot.important_entities.tools         },
    { label: 'Systems',       values: snapshot.important_entities.systems       },
    { label: 'Metrics',       values: snapshot.important_entities.metrics       },
  ].filter((g) => g.values?.length > 0) : [];

  return (
    <View style={{ gap: Space.sm }}>
      {snapshot && (
        <View style={card.wrap}>
          <View style={card.headerRow}>
            <View style={[card.iconBox, { backgroundColor: `${Brand.steer}15` }]}>
              <Text style={card.icon}>📝</Text>
            </View>
            <View>
              <Text style={card.title}>Executive Summary</Text>
              <Text style={card.meta}>AI-generated overview</Text>
            </View>
          </View>
          <View style={snap.metricRow}>
            {snapshot.primary_topic ? (
              <View style={snap.metricCard}>
                <Text style={snap.metricLabel}>Primary Topic</Text>
                <Text style={snap.metricValue} numberOfLines={2}>{snapshot.primary_topic}</Text>
              </View>
            ) : null}
            {snapshot.word_count ? (
              <View style={snap.metricCard}>
                <Text style={snap.metricLabel}>Word Count</Text>
                <Text style={snap.metricValue}>{snapshot.word_count.toLocaleString()}</Text>
              </View>
            ) : null}
          </View>
          {snapshot.secondary_topics?.length > 0 && (
            <View style={snap.section}>
              <Text style={snap.sectionLabel}>SECONDARY TOPICS</Text>
              <View style={snap.tagRow}>
                {snapshot.secondary_topics.slice(0, 8).map((t) => (
                  <View key={t} style={[snap.tag, { backgroundColor: `${Brand.steer}10`, borderColor: `${Brand.steer}25` }]}>
                    <Text style={[snap.tagText, { color: Brand.steer }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {snapshot.key_concepts?.length > 0 && (
            <View style={snap.section}>
              <Text style={snap.sectionLabel}>KEY CONCEPTS</Text>
              <View style={snap.tagRow}>
                {snapshot.key_concepts.slice(0, 8).map((c) => (
                  <View key={c} style={[snap.tag, { backgroundColor: `${Brand.docuMind}10`, borderColor: `${Brand.docuMind}25` }]}>
                    <Text style={[snap.tagText, { color: Brand.docuMind }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {snapshot?.key_ideas?.length > 0 && (
        <View style={card.wrap}>
          <Text style={snap.sectionLabel}>KEY IDEAS</Text>
          {snapshot.key_ideas.slice(0, 6).map((idea, i) => (
            <View key={i} style={snap.ideaRow}>
              <View style={snap.ideaDot} />
              <Text style={snap.ideaText}>{idea}</Text>
            </View>
          ))}
        </View>
      )}

      {entityGroups.length > 0 && (
        <View style={card.wrap}>
          <Text style={snap.sectionLabel}>IMPORTANT ENTITIES</Text>
          {entityGroups.map((group) => (
            <View key={group.label} style={snap.entityGroup}>
              <Text style={snap.entityGroupLabel}>{group.label}</Text>
              <View style={snap.tagRow}>
                {group.values.slice(0, 5).map((v) => (
                  <View key={v} style={[snap.tag, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                    <Text style={[snap.tagText, { color: '#334155' }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {snapshot?.relationships?.length > 0 && (
        <View style={card.wrap}>
          <Text style={snap.sectionLabel}>RELATIONSHIPS</Text>
          {snapshot.relationships.slice(0, 4).map((r, i) => (
            <View key={i} style={snap.ideaRow}>
              <View style={[snap.ideaDot, { backgroundColor: Brand.skill }]} />
              <Text style={snap.ideaText}>{r}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={card.wrap}>
        {!snapshot && (
          <View style={[card.headerRow, { marginBottom: Space.md }]}>
            <View style={[card.iconBox, { backgroundColor: `${Brand.steer}15` }]}>
              <Text style={card.icon}>📝</Text>
            </View>
            <View>
              <Text style={card.title}>Executive Summary</Text>
              <Text style={card.meta}>AI-generated overview</Text>
            </View>
          </View>
        )}
        {paras.length > 0
          ? paras.map((p, i) => <Text key={i} style={card.body}>{p}</Text>)
          : <Text style={card.empty}>No summary available.</Text>
        }
      </View>
    </View>
  );
}

/* ── Actions tab ─────────────────────────────────────────────────── */
function ActionsTab({ entities }: { entities: Entities }) {
  const filled = CATS.filter((c) => (entities[c.key] as string[])?.length > 0);
  if (!filled.length) {
    return (
      <View style={card.wrap}>
        <Text style={card.empty}>No action points extracted.</Text>
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
              <View style={[actionCard.badge, { backgroundColor: cat.accent }]}>
                <Text style={actionCard.badgeText}>{items.length}</Text>
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

/* ── Workflow tab ────────────────────────────────────────────────── */
function WorkflowTab({ steps }: { steps: WorkflowStep[] }) {
  if (!steps || steps.length === 0) {
    return (
      <View style={card.wrap}>
        <Text style={card.empty}>No workflow steps available.</Text>
      </View>
    );
  }
  return (
    <View style={card.wrap}>
      <View style={card.headerRow}>
        <View style={[card.iconBox, { backgroundColor: `${Brand.docuMind}15` }]}>
          <Text style={card.icon}>🔄</Text>
        </View>
        <View>
          <Text style={card.title}>Document Workflow</Text>
          <Text style={card.meta}>{steps.length} step{steps.length !== 1 ? 's' : ''} identified</Text>
        </View>
      </View>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const p = PRIORITY_CONFIG[step.priority] ?? PRIORITY_CONFIG.Low;
        return (
          <View key={step.step_number} style={flow.row}>
            <View style={flow.spine}>
              <View style={[flow.circle, { backgroundColor: p.color }]}>
                <Text style={flow.circleNum}>{step.step_number}</Text>
              </View>
              {!isLast && <View style={[flow.line, { backgroundColor: `${p.color}30` }]} />}
            </View>
            <View style={[flow.content, !isLast && flow.contentGap]}>
              <View style={flow.topRow}>
                <Text style={flow.action} numberOfLines={2}>{step.action}</Text>
                <View style={[flow.badge, { backgroundColor: p.bg }]}>
                  <Text style={[flow.badgeText, { color: p.color }]}>{p.label}</Text>
                </View>
              </View>
              {step.description ? <Text style={flow.desc}>{step.description}</Text> : null}
              {(step.owner || step.deadline) ? (
                <View style={flow.metaRow}>
                  {step.owner    ? <Text style={flow.metaText}>👤 {step.owner}</Text>    : null}
                  {step.deadline ? <Text style={flow.metaText}>📅 {step.deadline}</Text> : null}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── GDPR Consent Modal ──────────────────────────────────────────── */
function ConsentModal({ onAccept }: { onAccept: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={[cv.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={cv.logoWrap}>
          <View style={cv.logoDiamond} />
          <View style={cv.logoAccent} />
          <View style={cv.logoInitialsWrap}>
            <Text style={cv.logoText}>RV</Text>
          </View>
        </View>
        <Text style={cv.heading}>Your Privacy Matters</Text>
        <Text style={cv.body}>
          Before you continue, please know that RamVector processes the PDF
          documents you upload using AI to generate summaries, action points,
          and workflow diagrams. Your documents are transmitted securely over
          HTTPS and are not retained permanently on our servers.
        </Text>
        <View style={cv.infoBox}>
          <Text style={cv.infoTitle}>What we process</Text>
          <Text style={cv.infoRow}>• PDF text content for AI analysis</Text>
          <Text style={cv.infoRow}>• Document metadata (filename, file size)</Text>
          <Text style={cv.infoRow}>• AI results are returned only to you</Text>
        </View>
        <TouchableOpacity
          style={cv.policyLink}
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => null)}
          activeOpacity={0.7}
        >
          <Text style={cv.policyLinkText}>Read our full Privacy Policy →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cv.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
          <Text style={cv.acceptBtnText}>I Understand &amp; Accept</Text>
        </TouchableOpacity>
        <Text style={cv.footNote}>
          You can withdraw consent at any time by uninstalling the app.
        </Text>
      </View>
    </Modal>
  );
}

/* ── Main screen ─────────────────────────────────────────────────── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  /* Consent */
  const [showConsent,    setShowConsent]    = useState(!_sessionConsentGiven);

  /* App-switcher privacy cover */
  const [privacyOverlay, setPrivacyOverlay] = useState(false);

  /* Core */
  const [phase,     setPhase]     = useState<Phase>('idle');
  const [docId,     setDocId]     = useState<string | null>(null);
  const [analysis,  setAnalysis]  = useState<Analysis | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [filename,  setFilename]  = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [progress,  setProgress]  = useState(0);

  /* Animation */
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  /* Guards & refs */
  const isPickerOpen   = useRef(false);
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef   = useRef(0);
  const lastUploadRef  = useRef(0);

  /* Pulse animation during processing */
  useEffect(() => {
    if (phase !== 'processing') { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, pulseAnim]);

  /* Progress bar animation */
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress, duration: 600, useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  /* Simulated progress steps while AI processes */
  useEffect(() => {
    if (phase !== 'processing') return;
    const steps = [15, 30, 45, 60, 72, 83, 91];
    let i = 0;
    const t = setInterval(() => {
      if (i < steps.length) setProgress(steps[i++]); else clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [phase]);

  /* Android back button — cancel processing instead of navigating away */
  useEffect(() => {
    if (phase !== 'processing') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      reset();
      return true;
    });
    return () => sub.remove();
  }, [phase]);

  /* App-switcher privacy overlay — hides document content in recents */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setPrivacyOverlay(next !== 'active');
    });
    return () => sub.remove();
  }, []);

  /* Cleanup upload timer on unmount */
  useEffect(() => {
    return () => {
      if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
    };
  }, []);

  /* Poll analysis result */
  const poll = useCallback(async (id: string) => {
    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL) {
      setError('Analysis is taking longer than expected. Please try uploading again.');
      setPhase('failed');
      return;
    }
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
    /* Rate limit — prevent rapid-fire uploads */
    if (Date.now() - lastUploadRef.current < UPLOAD_COOLDOWN) return;
    /* Double-tap guard */
    if (isPickerOpen.current) return;
    isPickerOpen.current = true;

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf', copyToCacheDirectory: true,
    });
    isPickerOpen.current = false;

    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_SIZE) {
      Alert.alert('File too large', 'Please choose a PDF under 5 MB.');
      return;
    }
    setFilename(asset.name);
    setError(null);
    setProgress(0);
    pollCountRef.current  = 0;
    lastUploadRef.current = Date.now();
    setPhase('uploading');

    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: 'application/pdf' } as unknown as Blob);

    const controller = new AbortController();
    uploadTimerRef.current = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${API}/documents/upload`, {
        method: 'POST', body: form, signal: controller.signal,
      });
      if (uploadTimerRef.current) { clearTimeout(uploadTimerRef.current); uploadTimerRef.current = null; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message ?? `Upload failed (${res.status})`);
      }
      const doc = await res.json();
      setDocId(doc.id);
      setPhase('processing');
    } catch (e: unknown) {
      if (uploadTimerRef.current) { clearTimeout(uploadTimerRef.current); uploadTimerRef.current = null; }
      setError(getFriendlyErrorMessage(e));
      setPhase('failed');
    }
  }

  function reset() {
    if (uploadTimerRef.current) { clearTimeout(uploadTimerRef.current); uploadTimerRef.current = null; }
    pollCountRef.current = 0;
    setPhase('idle');
    setDocId(null);
    setAnalysis(null);
    setError(null);
    setFilename('');
    setActiveTab('summary');
    setProgress(0);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1a2e" />

      {/* GDPR consent — shown once per session, no new packages needed */}
      {showConsent && (
        <ConsentModal onAccept={() => {
          _sessionConsentGiven = true;
          setShowConsent(false);
        }} />
      )}

      {/* App-switcher privacy cover — hides document data in iOS/Android recents */}
      {privacyOverlay && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0f1a2e', zIndex: 9999 }]}
              pointerEvents="none" />
      )}

      {/* ── Header bar ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <View style={s.headerLogoMark}>
            <Text style={s.headerLogoText}>RV</Text>
          </View>
          <Text style={s.headerBrand}>RamVector</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + Space['4xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Centre-cap at 600 pt for tablet & large phones */}
        <View style={s.contentWrapper}>

          {/* ── IDLE: hero + upload ── */}
          {phase === 'idle' && (
            <>
              <View style={s.hero}>
                <RamVectorLogo />
                <Text style={s.heroTitle}>RamVector</Text>
                <Text style={s.heroSub}>Intelligent Document Analysis</Text>
                <Text style={s.heroDesc}>
                  Upload any PDF and instantly receive an AI-generated executive
                  summary, structured action points and a visual workflow diagram.
                </Text>
                <View style={s.chips}>
                  {[
                    { icon: '📝', label: 'Smart Summary',    color: Brand.steer    },
                    { icon: '✅', label: 'Action Points',    color: Brand.skill    },
                    { icon: '🔄', label: 'Workflow Diagram', color: Brand.docuMind },
                  ].map((f) => (
                    <View key={f.label} style={[s.chip, { borderColor: `${f.color}35` }]}>
                      <Text style={s.chipIcon}>{f.icon}</Text>
                      <Text style={[s.chipLabel, { color: f.color }]}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={s.uploadZone} onPress={pickAndUpload} activeOpacity={0.85}>
                <View style={s.uploadIconWrap}>
                  <Text style={s.uploadIconText}>⬆️</Text>
                </View>
                <Text style={s.uploadTitle}>Tap to upload a PDF</Text>
                <Text style={s.uploadSub}>Maximum 5 MB · PDF only</Text>
                <View style={s.uploadBtn}>
                  <Text style={s.uploadBtnText}>Choose File</Text>
                </View>
              </TouchableOpacity>
            </>
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
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  <Animated.View
                    style={[
                      s.progressFill,
                      { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                </View>
                <Text style={s.progressPct}>{progress}%</Text>
              </View>
              <View style={s.pillRow}>
                {['Summary', 'Action Points', 'Workflow'].map((l) => (
                  <Animated.View key={l} style={[s.pill, { opacity: pulseAnim }]}>
                    <Text style={s.pillText}>{l}</Text>
                  </Animated.View>
                ))}
              </View>
              <TouchableOpacity style={s.cancelBtn} onPress={reset} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>✕  Cancel Analysis</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── DONE ── */}
          {phase === 'done' && analysis && (
            <View>
              <View style={s.fileChip}>
                <View style={s.fileChipIcon}><Text>📄</Text></View>
                <View style={s.fileChipBody}>
                  <Text style={s.fileChipName} numberOfLines={1}>{filename}</Text>
                  <Text style={s.fileChipMeta}>Analysis complete</Text>
                </View>
                <View style={s.doneBadge}>
                  <View style={s.doneDot} />
                  <Text style={s.doneBadgeText}>Done</Text>
                </View>
                <TouchableOpacity onPress={reset} style={s.newBtn}>
                  <Text style={s.newBtnText}>+ New</Text>
                </TouchableOpacity>
              </View>

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

              {activeTab === 'summary'  && <SummaryTab  summary={analysis.summary} snapshot={analysis.snapshot} />}
              {activeTab === 'actions'  && <ActionsTab  entities={analysis.entities}      />}
              {activeTab === 'workflow' && <WorkflowTab steps={analysis.workflow}          />}

              <TouchableOpacity style={s.uploadNewBtn} onPress={reset} activeOpacity={0.85}>
                <Text style={s.uploadNewBtnText}>⬆️  Upload New Document</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── FAILED ── */}
          {phase === 'failed' && (
            <View style={s.errorCard}>
              <View style={s.errorIconWrap}><Text style={s.errorIconText}>⚠️</Text></View>
              <Text style={s.errorTitle}>Something went wrong</Text>
              <Text style={s.errorMsg}>{error || 'Something went wrong while processing your document.'}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={reset} activeOpacity={0.85}>
                <Text style={s.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.footer}>© 2026 RamVector. All rights reserved.</Text>

        </View>
      </ScrollView>
    </View>
  );
}

/* ── Logo styles ─────────────────────────────────────────────────── */
const logo = StyleSheet.create({
  wrap: { width: 104, height: 104, alignSelf: 'center', marginBottom: Space['2xl'] },
  halo: {
    position: 'absolute', inset: 0, borderRadius: 52,
    backgroundColor: `${Brand.steer}10`,
    borderWidth: 1.5, borderColor: `${Brand.steer}20`,
  },
  diamond: {
    position: 'absolute', top: 16, left: 16,
    width: 72, height: 72,
    backgroundColor: Brand.steer, borderRadius: 16,
    transform: [{ rotate: '45deg' }],
  },
  diamondAccent: {
    position: 'absolute', top: 28, left: 28,
    width: 48, height: 48,
    backgroundColor: `${Brand.steerDark}`,
    borderRadius: 10,
    transform: [{ rotate: '45deg' }],
    opacity: 0.45,
  },
  initialsWrap: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 26, fontWeight: FontWeight.extrabold, color: '#ffffff', letterSpacing: -1 },
});

/* ── Screen styles ───────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    backgroundColor: '#0f1a2e',
    paddingBottom: 14, paddingHorizontal: Space.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  headerLogoMark: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Brand.steer, alignItems: 'center', justifyContent: 'center',
  },
  headerLogoText: { fontSize: 11, fontWeight: FontWeight.extrabold, color: '#fff', letterSpacing: -0.5 },
  headerBrand:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#ffffff', letterSpacing: -0.3 },

  scroll: { paddingHorizontal: Space.xl, paddingTop: Space['2xl'], paddingBottom: Space['5xl'] },

  /* Tablet / large phone: centre-cap content at 600 pt */
  contentWrapper: { maxWidth: 600, width: '100%', alignSelf: 'center' },

  /* Hero */
  hero: { alignItems: 'center', marginBottom: Space['3xl'] },
  heroTitle: {
    fontSize: FontSize['3xl'], fontWeight: FontWeight.extrabold,
    color: '#0f172a', letterSpacing: -1, marginBottom: 6,
  },
  heroSub:  { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Brand.steer, marginBottom: Space.md },
  heroDesc: {
    fontSize: FontSize.sm, color: '#64748b',
    textAlign: 'center', lineHeight: 20,
    marginBottom: Space.xl, maxWidth: 320,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space.sm },
  chip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ffffff', borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6, ...Shadows.sm,
  },
  chipIcon:  { fontSize: 13 },
  chipLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  /* Upload zone */
  uploadZone: {
    backgroundColor: '#ffffff', borderRadius: Radius['2xl'],
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#bfdbfe',
    padding: Space['4xl'], alignItems: 'center',
    marginBottom: Space.lg, ...Shadows.md,
  },
  uploadIconWrap: {
    width: 72, height: 72, borderRadius: Radius.xl,
    backgroundColor: `${Brand.docuMind}12`,
    alignItems: 'center', justifyContent: 'center', marginBottom: Space.lg,
  },
  uploadIconText: { fontSize: 36 },
  uploadTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#0f172a', marginBottom: 4 },
  uploadSub:      { fontSize: FontSize.sm, color: '#64748b', marginBottom: Space.xl },
  uploadBtn: {
    backgroundColor: Brand.steer, borderRadius: Radius.lg,
    paddingHorizontal: Space['3xl'], paddingVertical: 13, ...Shadows.md,
  },
  uploadBtnText: { color: '#ffffff', fontSize: FontSize.base, fontWeight: FontWeight.bold },

  /* State cards */
  stateCard: {
    backgroundColor: '#ffffff', borderRadius: Radius['2xl'],
    padding: Space['4xl'], alignItems: 'center',
    ...Shadows.md, marginBottom: Space.lg,
  },
  stateTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    color: '#0f172a', marginTop: Space.lg, textAlign: 'center',
  },
  stateSub: { fontSize: FontSize.sm, color: '#64748b', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  spinnerRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: `${Brand.steer}25`,
    alignItems: 'center', justifyContent: 'center',
  },
  spinnerEmoji:  { position: 'absolute', fontSize: 24 },
  progressWrap:  { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Space.xl },
  progressTrack: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: Radius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: Radius.full, backgroundColor: Brand.steer },
  progressPct:   { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Brand.steer, width: 32, textAlign: 'right' },
  pillRow:       { flexDirection: 'row', gap: 8, marginTop: Space.xl, flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: `${Brand.steer}12`,
    borderRadius: Radius.full, borderWidth: 1, borderColor: `${Brand.steer}25`,
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
    backgroundColor: `${Brand.docuMind}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  fileChipBody:  { flex: 1, minWidth: 0 },
  fileChipName:  { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#0f172a' },
  fileChipMeta:  { fontSize: FontSize.xs, color: '#64748b', marginTop: 1 },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Semantic.successBg, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  doneDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: Semantic.success },
  doneBadgeText:{ fontSize: FontSize.xs, color: Semantic.successText, fontWeight: FontWeight.bold },
  newBtn:       { backgroundColor: `${Brand.steer}12`, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  newBtnText:   { color: Brand.steer, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  /* Tab bar */
  tabBar: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: Radius.xl, padding: 4, marginBottom: Space.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: Radius.lg, gap: 4 },
  tabBtnActive:   { backgroundColor: '#ffffff', ...Shadows.sm },
  tabIcon:        { fontSize: 13 },
  tabLabel:       { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#64748b' },
  tabLabelActive: { color: Brand.steer },

  /* Error */
  errorCard: {
    backgroundColor: '#ffffff', borderRadius: Radius['2xl'],
    padding: Space['4xl'], alignItems: 'center',
    borderWidth: 1, borderColor: Semantic.dangerBg,
    ...Shadows.md, marginBottom: Space.lg,
  },
  errorIconWrap: {
    width: 64, height: 64, borderRadius: Radius.xl,
    backgroundColor: Semantic.dangerBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: Space.md,
  },
  errorIconText: { fontSize: 30 },
  errorTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#0f172a', marginBottom: 6 },
  errorMsg: {
    fontSize: FontSize.sm, color: Semantic.danger,
    textAlign: 'center', lineHeight: 20, marginBottom: Space['3xl'],
  },
  retryBtn:  { width: '100%', backgroundColor: Brand.steer, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', ...Shadows.md },
  retryText: { color: '#ffffff', fontSize: FontSize.base, fontWeight: FontWeight.bold },

  /* Cancel button */
  cancelBtn: {
    marginTop: Space.xl, borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: Radius.lg, paddingVertical: 11, paddingHorizontal: Space['3xl'], alignItems: 'center',
  },
  cancelBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#64748b' },

  /* Upload new document */
  uploadNewBtn:     { marginTop: Space.xl, backgroundColor: Brand.steer, borderRadius: Radius.lg, paddingVertical: 15, alignItems: 'center', ...Shadows.md },
  uploadNewBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#ffffff' },

  footer: { textAlign: 'center', fontSize: FontSize.xs, color: '#94a3b8', marginTop: Space['3xl'] },
});

/* ── Result card styles ──────────────────────────────────────────── */
const card = StyleSheet.create({
  wrap: { backgroundColor: '#ffffff', borderRadius: Radius.xl, padding: Space.lg, ...Shadows.sm, marginBottom: Space.sm },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    marginBottom: Space.md, paddingBottom: Space.md,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  iconBox:  { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 20 },
  title:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#0f172a' },
  meta:     { fontSize: FontSize.xs, color: '#64748b', marginTop: 1 },
  body:     { fontSize: FontSize.sm, color: '#475569', lineHeight: 22, marginBottom: 8 },
  empty:    { fontSize: FontSize.sm, color: '#64748b', fontStyle: 'italic', textAlign: 'center', paddingVertical: Space.xl },
});

const actionCard = StyleSheet.create({
  wrap:      { borderRadius: Radius.xl, padding: Space.md, borderWidth: 1, marginBottom: Space.xs },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Space.sm },
  icon:      { fontSize: 15 },
  label:     { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  badge:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: FontSize.xs, color: '#ffffff', fontWeight: FontWeight.bold },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  dot:       { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  item:      { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
});

/* ── Flow stepper styles ─────────────────────────────────────────── */
const flow = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'stretch', gap: Space.md },
  spine:      { alignItems: 'center', width: 28, flexShrink: 0 },
  circle:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  circleNum:  { fontSize: 11, fontWeight: FontWeight.extrabold, color: '#ffffff' },
  line:       { flex: 1, width: 2, marginTop: 4, marginBottom: 4, borderRadius: 1 },
  content:    { flex: 1, paddingTop: 2 },
  contentGap: { paddingBottom: Space.lg },
  topRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Space.sm, marginBottom: 4 },
  action:     { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#0f172a', lineHeight: 19 },
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, flexShrink: 0, alignSelf: 'flex-start' },
  badgeText:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  desc:       { fontSize: FontSize.xs, color: '#64748b', lineHeight: 17, marginBottom: 5 },
  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md, marginTop: 2 },
  metaText:   { fontSize: FontSize.xs, color: '#64748b' },
});

/* ── Snapshot styles ─────────────────────────────────────────────── */
const snap = StyleSheet.create({
  metricRow:        { flexDirection: 'row', gap: Space.sm, marginBottom: Space.md },
  metricCard:       { flex: 1, backgroundColor: '#f8fafc', borderRadius: Radius.md, borderWidth: 1, borderColor: '#e2e8f0', padding: Space.sm },
  metricLabel:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  metricValue:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#0f172a', lineHeight: 18 },
  section:          { marginBottom: Space.md },
  sectionLabel:     { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Space.sm },
  tagRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:              { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:          { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  ideaRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm, marginBottom: Space.sm },
  ideaDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.steer, marginTop: 5, flexShrink: 0 },
  ideaText:         { flex: 1, fontSize: FontSize.sm, color: '#475569', lineHeight: 20 },
  entityGroup:      { marginBottom: Space.md },
  entityGroupLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#475569', marginBottom: 5 },
});

/* ── Consent modal styles ────────────────────────────────────────── */
const cv = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#ffffff',
    paddingHorizontal: Space['3xl'],
    alignItems: 'center', justifyContent: 'center',
  },
  logoWrap: { width: 80, height: 80, alignSelf: 'center', marginBottom: Space['2xl'] },
  logoDiamond: {
    position: 'absolute', top: 8, left: 8,
    width: 64, height: 64,
    backgroundColor: Brand.steer, borderRadius: 14,
    transform: [{ rotate: '45deg' }],
  },
  logoAccent: {
    position: 'absolute', top: 20, left: 20,
    width: 40, height: 40,
    backgroundColor: Brand.steerDark,
    borderRadius: 8, transform: [{ rotate: '45deg' }], opacity: 0.45,
  },
  logoInitialsWrap: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  logoText:         { fontSize: 22, fontWeight: FontWeight.extrabold, color: '#ffffff' },
  heading: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold,
    color: '#0f172a', textAlign: 'center',
    marginBottom: Space.md, letterSpacing: -0.5,
  },
  body: {
    fontSize: FontSize.sm, color: '#475569',
    textAlign: 'center', lineHeight: 22, marginBottom: Space['2xl'],
  },
  infoBox: {
    width: '100%', backgroundColor: '#f8fafc',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: '#e2e8f0',
    padding: Space.lg, marginBottom: Space.xl,
  },
  infoTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    color: '#64748b', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: Space.sm,
  },
  infoRow:      { fontSize: FontSize.sm, color: '#475569', lineHeight: 22 },
  policyLink:   { marginBottom: Space['2xl'] },
  policyLinkText: { fontSize: FontSize.sm, color: Brand.steer, fontWeight: FontWeight.semibold, textDecorationLine: 'underline' },
  acceptBtn: {
    width: '100%', backgroundColor: Brand.steer,
    borderRadius: Radius.lg, paddingVertical: 16,
    alignItems: 'center', ...Shadows.md, marginBottom: Space.lg,
  },
  acceptBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#ffffff' },
  footNote:      { fontSize: FontSize.xs, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
