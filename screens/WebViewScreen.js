import React from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function WebViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { url } = params;

  return (
    <View style={{ flex: 1 }}>
      <WebView source={{ uri: url as string }} style={{ flex: 1 }} />
      <View style={s.close}>
        <Button title="닫기" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  close: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
});
