import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, LightTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor:   Brand.steer,
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8',
        tabBarStyle: {
          backgroundColor:  isDark ? '#111118' : '#ffffff',
          borderTopColor:   isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
          borderTopWidth:   1,
          paddingBottom:    Platform.OS === 'ios' ? 20 : 6,
          paddingTop:       8,
          height:           Platform.OS === 'ios' ? 80 : 60,
          ...Platform.select({
            ios: {
              shadowColor:   '#000',
              shadowOffset:  { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius:  12,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontSize:   10,
          fontWeight: '600',
          marginTop:  2,
        },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="house.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'DocuMind',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="doc.text.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="paperplane.fill" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <IconSymbol size={22} name={name as 'house.fill'} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: `${Brand.steer}18`,
  },
});
