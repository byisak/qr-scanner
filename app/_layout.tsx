import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { SyncProvider } from '../contexts/SyncContext';
import { FeatureLockProvider } from '../contexts/FeatureLockContext';
import { AppLockProvider } from '../contexts/AppLockContext';
import { FontAssets } from '../constants/Fonts';
import { useTrackingPermission } from '../hooks/useTrackingPermission';
import AppLockScreen from '../components/AppLockScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const { isLoading: isTrackingLoading } = useTrackingPermission();

  useEffect(() => {
    if ((fontsLoaded || fontError) && !isTrackingLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isTrackingLoading]);

  // Don't render until fonts are loaded and ATT is resolved
  if ((!fontsLoaded && !fontError) || isTrackingLoading) {
    return null;
  }

  return (
    <LanguageProvider>
      <FeatureLockProvider>
        <ThemeProvider>
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
        </ThemeProvider>
      </FeatureLockProvider>
    </LanguageProvider>
  );
}
