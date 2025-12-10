import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { PurchaseProvider } from '../contexts/PurchaseContext';
import { AdProvider } from '../contexts/AdContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <PurchaseProvider>
          <AdProvider>
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
                name="premium"
                options={{
                  presentation: 'modal',
                  headerShown: false
                }}
              />
            </Stack>
          </AdProvider>
        </PurchaseProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
