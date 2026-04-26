import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  html: string;
}

export function MermaidViewer({ html }: Props) {
  return (
    <WebView
      source={{ html }}
      style={styles.webview}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  webview: { width: '100%', height: 400, backgroundColor: '#ffffff' },
});
