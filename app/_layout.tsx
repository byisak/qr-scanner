import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setupNotificationListeners } from '../utils/lotteryNotification';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { SyncProvider } from '../contexts/SyncContext';
import { FeatureLockProvider } from '../contexts/FeatureLockContext';
import { AppLockProvider } from '../contexts/AppLockContext';
import { FeedbackProvider } from '../contexts/FeedbackContext';
import { FontAssets } from '../constants/Fonts';
import { useTrackingPermission } from '../hooks/useTrackingPermission';
import AppLockScreen from '../components/AppLockScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const { isLoading: isTrackingLoading } = useTrackingPermission();
  const router = useRouter();

  useEffect(() => {
    if ((fontsLoaded || fontError) && !isTrackingLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isTrackingLoading]);

  // 복권 알림 탭 → 히스토리 탭으로 이동 (이전엔 어디서도 연결돼 있지 않았다)
  useEffect(() => {
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
          <FeedbackProvider>
          <AuthProvider>
            <AppLockProvider>
              <SyncProvider>
                <StatusBar style="auto" />
                <AppLockScreen />
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
              </SyncProvider>
            </AppLockProvider>
          </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </FeatureLockProvider>
    </LanguageProvider>
  );
}
