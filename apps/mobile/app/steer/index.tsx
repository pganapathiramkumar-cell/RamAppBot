import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

export default function SteerScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <Text style={styles.back} onPress={() => router.back()}>← Back</Text>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🧭</Text>
          <ThemedText type="title" style={styles.title}>Steer</ThemedText>
          <ThemedText style={styles.subtitle}>AI Strategic Goal Management</ThemedText>
        </View>

        {/* Coming Soon card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coming Soon</Text>
          <Text style={styles.cardDesc}>
            The Steer module lets you define enterprise AI strategic goals, track
            alignment scores computed by Llama 3.2, and get dependency analysis
            across your organisation's AI initiatives.
          </Text>
          <View style={styles.featureList}>
            {[
              '📋  Create & manage strategic AI goals',
              '🎯  AI alignment score (0–100%)',
              '🔗  Goal dependency analysis',
              '✅  Activate & complete goal lifecycle',
              '📊  Organisation-wide goal dashboard',
            ].map((f) => (
              <Text key={f} style={styles.feature}>{f}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 32, paddingBottom: 40 },
  back:        { color: '#4f46e5', fontSize: 16, marginBottom: 24 },
  hero:        { alignItems: 'center', marginBottom: 32 },
  heroEmoji:   { fontSize: 52, marginBottom: 8 },
  title:       { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle:    { fontSize: 14, opacity: 0.5, marginTop: 4, textAlign: 'center' },
  card:        { backgroundColor: 'white', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  cardTitle:   { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10 },
  cardDesc:    { fontSize: 14, color: '#6b7280', lineHeight: 22, marginBottom: 16 },
  featureList: { gap: 10 },
  feature:     { fontSize: 14, color: '#374151', lineHeight: 22 },
});
