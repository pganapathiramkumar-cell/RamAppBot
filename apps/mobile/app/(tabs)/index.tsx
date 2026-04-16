import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ScrollView, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Brand, Shadows, FontSize, FontWeight, Radius, Space } from '@/constants/theme';

const MODULES = [
  {
    title:    'Steer',
    subtitle: 'AI Strategic Goals',
    icon:     '🧭',
    route:    '/steer' as const,
    desc:     'Define strategic AI goals, track alignment scores and get dependency analysis.',
    gradient: ['#7c3aed', '#4f46e5'],
    tag:      'Strategy',
    tagColor: '#ede9fe',
    tagText:  '#5b21b6',
    stats:    [{ label: 'Avg Alignment', value: '—' }, { label: 'Goals', value: '—' }],
  },
  {
    title:    'Skill',
    subtitle: 'AI Capability Catalog',
    icon:     '⚡',
    route:    '/skill' as const,
    desc:     'Manage your AI skill catalog, evaluate quality and identify capability gaps.',
    gradient: ['#0d9488', '#059669'],
    tag:      'Capabilities',
    tagColor: '#ccfbf1',
    tagText:  '#0f766e',
    stats:    [{ label: 'Total Skills', value: '—' }, { label: 'Deployed', value: '—' }],
  },
  {
    title:    'DocuMind',
    subtitle: 'Document Intelligence',
    icon:     '📄',
    route:    '/(tabs)/documents' as const,
    desc:     'Upload PDFs up to 5 MB. Get a summary, structured action points and a workflow.',
    gradient: ['#4f46e5', '#7c3aed'],
    tag:      'Analysis',
    tagColor: '#e0e7ff',
    tagText:  '#3730a3',
    stats:    [{ label: 'Max Size', value: '5 MB' }, { label: 'Format', value: 'PDF' }],
  },
];

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroLogo}>
            <Text style={styles.heroLogoEmoji}>🤖</Text>
          </View>
          <Text style={styles.heroTitle}>RamBot</Text>
          <Text style={styles.heroSubtitle}>Enterprise AI Platform</Text>
          <View style={styles.heroPill}>
            <View style={styles.liveDot} />
            <Text style={styles.heroLiveText}>Live · Powered by Groq</Text>
          </View>
        </View>

        {/* Section label */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>MODULES</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Module cards */}
        {MODULES.map((m, idx) => (
          <TouchableOpacity
            key={m.title}
            style={styles.card}
            onPress={() => router.push(m.route)}
            activeOpacity={0.88}
          >
            {/* Left accent bar */}
            <View style={[styles.cardAccent, { backgroundColor: m.gradient[0] }]} />

            <View style={styles.cardContent}>
              {/* Header row */}
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${m.gradient[0]}18` }]}>
                  <Text style={styles.cardIconText}>{m.icon}</Text>
                </View>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{m.title}</Text>
                  <Text style={styles.cardSubtitle}>{m.subtitle}</Text>
                </View>
                <View style={[styles.cardTag, { backgroundColor: m.tagColor }]}>
                  <Text style={[styles.cardTagText, { color: m.tagText }]}>{m.tag}</Text>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.cardDesc}>{m.desc}</Text>

              {/* Stats row */}
              <View style={styles.cardStats}>
                {m.stats.map((s) => (
                  <View key={s.label} style={styles.cardStat}>
                    <Text style={styles.cardStatValue}>{s.value}</Text>
                    <Text style={styles.cardStatLabel}>{s.label}</Text>
                  </View>
                ))}
                <View style={[styles.cardArrow, { backgroundColor: `${m.gradient[0]}15` }]}>
                  <Text style={[styles.cardArrowText, { color: m.gradient[0] }]}>›</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 RamBot Enterprise</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingHorizontal: Space.xl,
    paddingTop:        Platform.OS === 'ios' ? 60 : 28,
    paddingBottom:     Space['4xl'],
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    marginBottom: Space['3xl'],
  },
  heroLogo: {
    width:           72,
    height:          72,
    borderRadius:    Radius.xl,
    backgroundColor: '#7c3aed',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Space.md,
    ...Shadows.lg,
  },
  heroLogoEmoji: { fontSize: 36 },
  heroTitle: {
    fontSize:   FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    color:      '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize:   FontSize.sm,
    color:      '#94a3b8',
    fontWeight: FontWeight.medium,
    marginBottom: Space.md,
  },
  heroPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: '#ecfdf5',
    borderRadius:    Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     '#a7f3d0',
  },
  liveDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: '#10b981',
  },
  heroLiveText: {
    fontSize:   FontSize.xs,
    color:      '#065f46',
    fontWeight: FontWeight.semibold,
  },

  /* Section label */
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  Space.md,
  },
  sectionLabel: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.bold,
    color:         '#94a3b8',
    letterSpacing: 1.2,
  },
  sectionLine: {
    flex:            1,
    height:          1,
    backgroundColor: '#e2e8f0',
  },

  /* Card */
  card: {
    backgroundColor: '#ffffff',
    borderRadius:    Radius.xl,
    marginBottom:    Space.md,
    flexDirection:   'row',
    overflow:        'hidden',
    ...Shadows.md,
  },
  cardAccent: {
    width: 4,
    flexShrink: 0,
  },
  cardContent: {
    flex:    1,
    padding: Space.lg,
    gap:     Space.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Space.md,
  },
  cardIconWrap: {
    width:          46,
    height:         46,
    borderRadius:   Radius.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  cardIconText:  { fontSize: 22 },
  cardTitleBlock: { flex: 1 },
  cardTitle: {
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
    color:      '#0f172a',
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize:   FontSize.xs,
    color:      '#94a3b8',
    fontWeight: FontWeight.medium,
    marginTop:  1,
  },
  cardTag: {
    borderRadius:    Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf:       'flex-start',
  },
  cardTagText: {
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  cardDesc: {
    fontSize:   FontSize.sm,
    color:      '#64748b',
    lineHeight: 19,
  },

  /* Stats row */
  cardStats: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Space.sm,
    marginTop:      Space.xs,
  },
  cardStat: {
    flex:            1,
    backgroundColor: '#f8fafc',
    borderRadius:    Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems:      'center',
  },
  cardStatValue: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    color:      '#0f172a',
  },
  cardStatLabel: {
    fontSize:  FontSize.xs,
    color:     '#94a3b8',
    marginTop: 1,
  },
  cardArrow: {
    width:          36,
    height:         36,
    borderRadius:   Radius.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  cardArrowText: {
    fontSize:   24,
    fontWeight: FontWeight.bold,
    lineHeight: 28,
  },

  footer: {
    alignItems: 'center',
    marginTop:  Space.xl,
  },
  footerText: {
    fontSize: FontSize.xs,
    color:    '#cbd5e1',
  },
});
