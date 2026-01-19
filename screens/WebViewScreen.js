import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Linking, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { GlassView } from 'expo-glass-effect';

export default function WebViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { url } = params;
  const [loading, setLoading] = useState(true);

  // WebView 에러 발생 시 Safari/외부 브라우저로 열기
  const handleError = useCallback(async (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('WebView error:', nativeEvent);

    // iOS ATS 에러 (-1022) 또는 기타 로드 에러 시 외부 브라우저로 열기
    if (nativeEvent.code === -1022 || nativeEvent.description?.includes('App Transport Security')) {
      Alert.alert(
        t('webView.secureConnectionRequired'),
        t('webView.cannotOpenInApp'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => router.back() },
          {
            text: t('webView.open'),
            onPress: async () => {
              try {
                await Linking.openURL(url);
              } catch (e) {
                console.error('Open URL error:', e);
              }
              router.back();
            }
          },
        ]
      );
    }
  }, [url, router, t]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        allowFileAccess={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        startInLoadingState={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        onHttpError={handleError}
      />
      {loading && (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
      <TouchableOpacity
        style={[s.closeButton, { bottom: Math.max(insets.bottom, 16) + 16 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <GlassView style={s.glassIconContainer} glassEffectStyle="regular" isInteractive>
          <Ionicons name="xmark" size={28} color="rgba(0, 0, 0, 0.6)" />
        </GlassView>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
  },
  glassIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    // Fallback for unsupported platforms (GlassView becomes regular View)
    backgroundColor: Platform.OS === 'ios' ? undefined : 'rgba(242, 242, 247, 0.9)',
    overflow: 'hidden',
  },
});
