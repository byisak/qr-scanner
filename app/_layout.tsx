import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as QuickActions from 'expo-quick-actions';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { SyncProvider } from '../contexts/SyncContext';
import { FeatureLockProvider } from '../contexts/FeatureLockContext';
import { FontAssets } from '../constants/Fonts';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // 퀵 액션 핸들러
  useEffect(() => {
    const subscription = QuickActions.addListener((action) => {
      if (action?.params?.screen) {
        switch (action.params.screen) {
          case 'scan':
            router.replace('/(tabs)/scan');
            break;
          case 'history':
            router.replace('/(tabs)/history');
            break;
          case 'generate':
            router.replace('/(tabs)/generate');
            break;
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [router]);

  // Don't render until fonts are loaded
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <LanguageProvider>
      <FeatureLockProvider>
        <ThemeProvider>
          <AuthProvider>
            <SyncProvider>
              <StatusBar style="auto" />
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
            </Stack>
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </FeatureLockProvider>
    </LanguageProvider>
  );
}
