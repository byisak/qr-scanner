import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator, BackHandler, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function WebViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { url } = params;
  const [loading, setLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const webViewRef = useRef(null);
  const canGoBackRef = useRef(false);

  // Android 하드웨어 뒤로가기: 웹 히스토리가 있으면 한 페이지 뒤로, 없으면 화면 닫기
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const openInBrowser = useCallback(async () => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error('Open URL error:', e);
    }
  }, [url]);

  const handleError = useCallback(async (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('WebView error:', nativeEvent);

    // iOS ATS 에러(-1022), Android 평문 HTTP 차단(net::ERR_CLEARTEXT_NOT_PERMITTED) 등
    // 인앱에서 못 여는 경우 외부 브라우저로 열기
    const isBlocked =
      nativeEvent.code === -1022 ||
      nativeEvent.description?.includes('App Transport Security') ||
      nativeEvent.description?.includes('ERR_CLEARTEXT_NOT_PERMITTED') ||
      nativeEvent.description?.includes('ERR_UNKNOWN_URL_SCHEME');
    if (isBlocked) {
      Alert.alert(
        t('webView.secureConnectionRequired'),
        t('webView.cannotOpenInApp'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => router.back() },
          {
            text: t('webView.open'),
            onPress: async () => {
              await openInBrowser();
              router.back();
            }
          },
        ]
      );
      return;
    }
    // 오프라인·DNS 실패 등: 빈 화면 대신 다시 시도/브라우저로 열기를 보여준다
    setLoadFailed(true);
  }, [router, t, openInBrowser]);

  const handleHttpError = useCallback((syntheticEvent) => {
    const { statusCode } = syntheticEvent.nativeEvent;
    if (statusCode >= 400) setLoadFailed(true);
  }, []);

  const retry = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* 헤더: 떠 있는 닫기 버튼이 본문 하단을 가리던 것을 위로 올리고, 지금 보는 문서 제목을 보여준다 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {pageTitle}
        </Text>
        <TouchableOpacity
          onPress={openInBrowser}
          style={s.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('webView.open')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="open-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          onNavigationStateChange={(navState) => {
            canGoBackRef.current = navState.canGoBack;
            if (navState.title && !navState.title.startsWith('http')) setPageTitle(navState.title);
          }}
          source={{ uri: url }}
          // 다크모드에서 로딩 중 흰 화면이 번쩍이지 않게
          style={{ flex: 1, backgroundColor: colors.background }}
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          mixedContentMode="always"
          allowFileAccess={true}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={handleError}
          onHttpError={handleHttpError}
        />
        {loading && !loadFailed && (
          <View style={[s.overlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        {loadFailed && (
          <View style={[s.overlay, { backgroundColor: colors.background }]}>
            <Ionicons name="cloud-offline-outline" size={56} color={colors.textTertiary} />
            <Text style={[s.errorTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('webView.loadFailed')}
            </Text>
            <TouchableOpacity
              style={[s.errorButton, { backgroundColor: colors.primary }]}
              onPress={retry}
              accessibilityRole="button"
            >
              <Text style={[s.errorButtonText, { fontFamily: fonts.semiBold }]}>{t('scanner.retryPermission')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.errorButton, { backgroundColor: colors.inputBackground }]}
              onPress={openInBrowser}
              accessibilityRole="button"
            >
              <Text style={[s.errorButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('webView.open')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    marginHorizontal: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 17,
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    minWidth: 200,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
