import React from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { WebView } from 'react-native-webview';

export default function WebViewScreen({ route, navigation }) {
  const { url } = route.params;
  return (
    <View style={{ flex: 1 }}>
      <WebView source={{ uri: url }} style={{ flex: 1 }} />
      <View style={s.close}>
        <Button title="닫기" onPress={() => navigation.goBack()} />
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
