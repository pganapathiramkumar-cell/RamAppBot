import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Brand, Shadows, FontSize, FontWeight, Radius, Space, Semantic } from '@/constants/theme';

const FEATURES = [
  { icon: '🧠', label: 'AI Capability Catalog',     desc: 'NLP, Vision, RAG, Agents and more',               color: Brand.skill  },
  { icon: '🏷️', label: 'Auto-Tagging',               desc: 'AI-powered tagging via Llama 3.2',                color: Brand.steer  },
  { icon: '⭐', label: 'Quality Scoring',            desc: 'Accuracy and latency metrics per skill',           color: '#f59e0b'    },
  { icon: '🔄', label: 'Lifecycle Management',       desc: 'DRAFT → REVIEW → APPROVED → DEPLOYED',            color: Brand.docuMind },
  { icon: '🔍', label: 'Gap Analysis',               desc: 'Identify skill gaps vs. Steer goals',              color: '#ef4444'    },
  { icon: '📊', label: 'Usage Analytics',            desc: 'Track performance and adoption across your org',   color: '#8b5cf6'    },
];

export default function SkillScreen() {
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
            <Text style={s.heroEmoji}>⚡</Text>
          </View>
          <Text style={s.heroTitle}>Skill Catalog</Text>
          <Text style={s.heroSub}>AI Capability Management</Text>
          <View style={s.comingSoonBadge}>
            <Text style={s.comingSoonText}>Coming Soon</Text>
          </View>
        </View>

        {/* Description card */}
        <View style={s.descCard}>
          <Text style={s.descTitle}>What is Skill?</Text>
          <Text style={s.descBody}>
            The Skill module lets you build and manage your enterprise AI capability catalog —
            from draft through review, approval and deployment — with AI-powered tagging and
            quality evaluation.
          </Text>
        </View>

        {/* Feature grid */}
        <Text style={s.sectionLabel}>PLANNED FEATURES</Text>
        <View style={s.featureGrid}>
          {FEATURES.map((f, i) => (
            <View key={f.label} style={s.featureCard}>
              <View style={[s.featureIconWrap, { backgroundColor: `${f.color}18` }]}>
                <Text style={s.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={[s.featureLabel, { color: f.color }]}>{f.label}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: {
    paddingHorizontal: Space.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 28,
    paddingBottom: Space['5xl'],
  },
  backBtn: { marginBottom: Space.xl },
  backText: { fontSize: FontSize.sm, color: Brand.steer, fontWeight: FontWeight.semibold },

  hero: { alignItems: 'center', marginBottom: Space['3xl'] },
  heroLogo: {
    width: 72, height: 72, borderRadius: Radius.xl,
    backgroundColor: Brand.skill,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.sm, ...Shadows.lg,
  },
  heroEmoji:   { fontSize: 34 },
  heroTitle:   { fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: '#0f172a', letterSpacing: -0.5 },
  heroSub:     { fontSize: FontSize.sm, color: '#94a3b8', fontWeight: FontWeight.medium, marginTop: 3, marginBottom: Space.md },
  comingSoonBadge: {
    backgroundColor: `${Brand.skill}18`,
    borderRadius: Radius.full, borderWidth: 1, borderColor: `${Brand.skill}40`,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  comingSoonText: { fontSize: FontSize.xs, color: Brand.skill, fontWeight: FontWeight.bold },

  descCard: {
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    padding: Space.lg, marginBottom: Space['3xl'],
    borderLeftWidth: 4, borderLeftColor: Brand.skill, ...Shadows.sm,
  },
  descTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#0f172a', marginBottom: 6 },
  descBody:  { fontSize: FontSize.sm, color: '#475569', lineHeight: 22 },

  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    color: '#94a3b8', letterSpacing: 1.2,
    marginBottom: Space.md,
  },
  featureGrid: { gap: Space.sm },
  featureCard: {
    backgroundColor: '#ffffff', borderRadius: Radius.xl,
    padding: Space.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Space.md,
    ...Shadows.sm,
  },
  featureIconWrap: {
    width: 40, height: 40, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureIcon:  { fontSize: 20 },
  featureLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: 2, flex: 1 },
  featureDesc:  { fontSize: FontSize.xs, color: '#64748b', lineHeight: 17 },
});
