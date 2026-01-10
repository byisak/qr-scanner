import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Linking, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';

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
      <View style={[s.close, { top: Platform.OS === 'ios' ? insets.top + 10 : insets.top + 10 }]}>
        <TouchableOpacity style={s.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#333" />
          <Text style={s.closeText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
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
  close: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  closeText: {
    marginLeft: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
});
