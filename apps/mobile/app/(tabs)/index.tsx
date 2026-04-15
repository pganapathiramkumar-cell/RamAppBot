import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

const modules = [
  {
    title: 'Steer',
    subtitle: 'AI Strategic Goals',
    icon: '🧭',
    bg: '#f3e8ff',
    route: '/steer' as const,
    desc: 'Define strategic AI goals, track alignment scores and get dependency analysis.',
  },
  {
    title: 'Skill',
    subtitle: 'AI Capability Catalog',
    icon: '⚡',
    bg: '#fff7ed',
    route: '/skill' as const,
    desc: 'Manage your AI skill catalog, evaluate quality and identify capability gaps.',
  },
  {
    title: 'DocuMind',
    subtitle: 'Document RAG Analysis',
    icon: '📄',
    bg: '#eef2ff',
    route: '/(tabs)/documents' as const,
    desc: 'Upload PDFs up to 5 MB. Get a summary, structured action points and a workflow.',
  },
];

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🤖</Text>
          <ThemedText type="title" style={styles.heroTitle}>Rambot</ThemedText>
          <ThemedText style={styles.heroSubtitle}>Enterprise AI Platform</ThemedText>
        </View>

        {/* Module cards */}
        {modules.map((m) => (
          <TouchableOpacity
            key={m.title}
            style={styles.card}
            onPress={() => router.push(m.route)}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIcon, { backgroundColor: m.bg }]}>
              <Text style={styles.cardIconText}>{m.icon}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{m.title}</Text>
              <Text style={styles.cardSubtitle}>{m.subtitle}</Text>
              <Text style={styles.cardDesc}>{m.desc}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 70 : 32, paddingBottom: 40 },
  hero:         { alignItems: 'center', marginBottom: 32 },
  heroEmoji:    { fontSize: 52, marginBottom: 8 },
  heroTitle:    { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { fontSize: 15, opacity: 0.5, marginTop: 4, textAlign: 'center' },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3, gap: 14 },
  cardIcon:     { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardIconText: { fontSize: 26 },
  cardBody:     { flex: 1 },
  cardTitle:    { fontWeight: '700', fontSize: 17, color: '#111827', marginBottom: 1 },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  cardDesc:     { fontSize: 12, color: '#9ca3af', lineHeight: 18 },
  arrow:        { fontSize: 22, color: '#d1d5db', flexShrink: 0 },
});
