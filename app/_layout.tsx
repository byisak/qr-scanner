import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setupNotificationListeners, cancelLotteryNotification } from '../utils/lotteryNotification';
import { LOTTERY_FEATURE_ENABLED } from '../config/features';
import { loadHapticSettings } from '../utils/haptics';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { AuthProvider } from '../contexts/AuthContext';
import { SyncProvider } from '../contexts/SyncContext';
import { FeatureLockProvider } from '../contexts/FeatureLockContext';
import { AppLockProvider } from '../contexts/AppLockContext';
import { FeedbackProvider } from '../contexts/FeedbackContext';
import PaperThemeProvider from '../contexts/PaperThemeProvider';
import { FontAssets } from '../constants/Fonts';
import { useTrackingPermission } from '../hooks/useTrackingPermission';
import { trackScreenView } from '../utils/analytics';
import AppLockScreen from '../components/AppLockScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const { isLoading: isTrackingLoading } = useTrackingPermission();
  const router = useRouter();
  const pathname = usePathname();

  // 모든 화면 조회를 한 곳에서 기록 (Firebase가 화면별 조회 수·평균 참여 시간을 계산)
  useEffect(() => {
    if (!pathname) return;
    const name = pathname === '/' ? 'scan' : pathname.replace(/^\//, '');
    trackScreenView(name);
  }, [pathname]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !isTrackingLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isTrackingLoading]);

  // 진동 세기·패턴 설정을 미리 읽어 둔다 (첫 스캔부터 반영)
  useEffect(() => {
    loadHapticSettings();
  }, []);

  // 복권 알림 탭 → 히스토리 탭으로 이동 (이전엔 어디서도 연결돼 있지 않았다)
  // 복권 기능을 꺼 두면 리스너를 달지 않고, 예전에 예약된 복권 알림도 취소한다 (저장된 복권 데이터는 그대로)
  useEffect(() => {
    if (!LOTTERY_FEATURE_ENABLED) {
      cancelLotteryNotification().catch(() => {});
      return undefined;
    }
    return setupNotificationListeners(router);
  }, [router]);

  // Don't render until fonts are loaded and ATT is resolved
  if ((!fontsLoaded && !fontError) || isTrackingLoading) {
    return null;
  }

  return (
    <LanguageProvider>
      <FeatureLockProvider>
        <ThemeProvider>
          <PaperThemeProvider>
          <FeedbackProvider>
          <AuthProvider>
            <AppLockProvider>
              <SyncProvider>
                <StatusBar style="auto" />
                <AppLockScreen />
                <ThemedStack />
              </SyncProvider>
            </AppLockProvider>
          </AuthProvider>
          </FeedbackProvider>
          </PaperThemeProvider>
        </ThemeProvider>
      </FeatureLockProvider>
    </LanguageProvider>
  );
}

// 테마(라이트/다크)를 읽어 스택 바탕색을 맞춘다 — ThemeProvider 안쪽에서 렌더돼야 해서 따로 뺐다
function ThemedStack() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="result"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="webview"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="email-login"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="profile-settings"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="image-analysis"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="security-settings"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="pin-setup"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="pin-verify"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="pin-change"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
    </Stack>
  );
}
