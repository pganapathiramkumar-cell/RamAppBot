import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Brand, Shadows, FontSize, FontWeight, Radius, Space } from '@/constants/theme';

const FEATURES = [
  { icon: '📋', label: 'Strategic Goal Management',  desc: 'Create and manage enterprise AI strategic goals with full lifecycle support', color: Brand.steer   },
  { icon: '🎯', label: 'AI Alignment Scoring',       desc: 'Real-time alignment scores (0–100%) computed by Llama 3.2',                 color: '#10b981'     },
  { icon: '🔗', label: 'Dependency Analysis',         desc: 'Map and visualise dependencies across your AI initiatives',                  color: '#3b82f6'     },
  { icon: '📊', label: 'Organisation Dashboard',      desc: 'Bird's-eye view of all goals, alignment health and risks',                   color: '#f59e0b'     },
  { icon: '⚠️', label: 'Overdue Detection',            desc: 'Automated alerts for at-risk and overdue strategic goals',                   color: '#ef4444'     },
  { icon: '🔄', label: 'Full Lifecycle',               desc: 'DRAFT → ACTIVE → PAUSED → COMPLETED flow built in',                        color: '#8b5cf6'     },
];

const PRIORITIES = [
  { label: 'Critical', color: '#ef4444', bg: '#fee2e2' },
  { label: 'High',     color: '#f97316', bg: '#ffedd5' },
  { label: 'Medium',   color: '#f59e0b', bg: '#fef3c7' },
  { label: 'Low',      color: '#10b981', bg: '#d1fae5' },
];

export default function SteerScreen() {
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back to Home</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroLogo}>
            <Text style={s.heroEmoji}>🧭</Text>
          </View>
          <Text style={s.heroTitle}>Steer</Text>
          <Text style={s.heroSub}>AI Strategic Goal Management</Text>
          <View style={s.comingSoonBadge}>
            <Text style={s.comingSoonText}>Coming Soon</Text>
          </View>
        </View>

        {/* Description card */}
        <View style={s.descCard}>
          <Text style={s.descTitle}>What is Steer?</Text>
          <Text style={s.descBody}>
            Steer lets you define enterprise AI strategic goals, track alignment scores
            computed by Llama 3.2, and get dependency analysis across your organisation's
            AI initiatives — all in one place.
          </Text>
        </View>

        {/* Priority legend */}
        <View style={s.priorityRow}>
          {PRIORITIES.map((p) => (
            <View key={p.label} style={[s.priorityChip, { backgroundColor: p.bg }]}>
              <View style={[s.priorityDot, { backgroundColor: p.color }]} />
              <Text style={[s.priorityLabel, { color: p.color }]}>{p.label}</Text>
            </View>
          ))}
        </View>

        {/* Feature list */}
        <Text style={s.sectionLabel}>PLANNED FEATURES</Text>
        <View style={s.featureList}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.featureCard}>
              <View style={[s.featureIconWrap, { backgroundColor: `${f.color}18` }]}>
                <Text style={s.featureIcon}>{f.icon}</Text>
              </View>
              <View style={s.featureBody}>
                <Text style={[s.featureLabel, { color: f.color }]}>{f.label}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#f8fafc' },
  scroll: {
    paddingHorizontal: Space.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 28,
    paddingBottom: Space['5xl'],
  },

  backBtn:  { marginBottom: Space.xl },
  backText: { fontSize: FontSize.sm, color: Brand.steer, fontWeight: FontWeight.semibold },

  hero: { alignItems: 'center', marginBottom: Space['3xl'] },
  heroLogo: {
    width: 72, height: 72, borderRadius: Radius.xl,
    backgroundColor: Brand.steer,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.sm, ...Shadows.lg,
  },
  heroEmoji:   { fontSize: 34 },
  heroTitle:   { fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: '#0f172a', letterSpacing: -0.5 },
  heroSub:     { fontSize: FontSize.sm, color: '#94a3b8', fontWeight: FontWeight.medium, marginTop: 3, marginBottom: Space.md },
  comingSoonBadge: {
    backgroundColor: `${Brand.steer}15`,
    borderRadius: Radius.full, borderWidth: 1, borderColor: `${Brand.steer}35`,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  comingSoonText: { fontSize: FontSize.xs, color: Brand.steer, fontWeight: FontWeight.bold },

  descCard: {
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    padding: Space.lg, marginBottom: Space.xl,
    borderLeftWidth: 4, borderLeftColor: Brand.steer, ...Shadows.sm,
  },
  descTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#0f172a', marginBottom: 6 },
  descBody:  { fontSize: FontSize.sm, color: '#475569', lineHeight: 22 },

  priorityRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: Space['3xl'],
  },
  priorityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    color: '#94a3b8', letterSpacing: 1.2, marginBottom: Space.md,
  },
  featureList: { gap: Space.sm },
  featureCard: {
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    padding: Space.md, flexDirection: 'row', alignItems: 'flex-start', gap: Space.md,
    ...Shadows.sm,
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureIcon:  { fontSize: 22 },
  featureBody:  { flex: 1 },
  featureLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: 3 },
  featureDesc:  { fontSize: FontSize.xs, color: '#64748b', lineHeight: 18 },
});
