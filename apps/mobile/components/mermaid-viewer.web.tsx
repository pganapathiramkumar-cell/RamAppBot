import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  html: string;
}

export function MermaidViewer({ html }: Props) {
  return (
    <View style={styles.wrap}>
      {/* iframe is valid in Expo web (React DOM) — cast required because RN types don't include it */}
      {React.createElement('iframe', {
        srcDoc: html,
        style: {
          width: '100%',
          height: 400,
          border: 'none',
          borderRadius: 12,
          backgroundColor: '#ffffff',
        },
        sandbox: 'allow-scripts',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden' },
});
