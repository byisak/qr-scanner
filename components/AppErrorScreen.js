// components/AppErrorScreen.js - 화면을 그리다 오류가 났을 때 하얀 화면 대신 보여 주는 화면
// expo-router가 app/_layout.tsx의 ErrorBoundary로 쓴다. 이때는 테마·언어 Provider 밖이라 여기서 직접 해결한다.
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { recordNonFatal, crashBreadcrumb } from '../utils/crashReporting';

const TEXTS = {
  ko: { title: '문제가 발생했습니다', body: '화면을 표시하는 중 오류가 났습니다. 다시 시도해 주세요. 계속되면 앱을 완전히 종료한 뒤 다시 열어 주세요.', retry: '다시 시도' },
  en: { title: 'Something went wrong', body: 'An error occurred while showing this screen. Please try again. If it keeps happening, close the app completely and reopen it.', retry: 'Try again' },
  ja: { title: '問題が発生しました', body: '画面の表示中にエラーが発生しました。もう一度お試しください。繰り返される場合は、アプリを完全に終了してから開き直してください。', retry: '再試行' },
  es: { title: 'Algo salió mal', body: 'Se produjo un error al mostrar esta pantalla. Inténtalo de nuevo. Si continúa, cierra la aplicación por completo y vuelve a abrirla.', retry: 'Reintentar' },
  zh: { title: '出现问题', body: '显示此页面时出错。请重试。如果问题持续，请完全关闭应用后重新打开。', retry: '重试' },
};

const pickTexts = () => {
  try {
    const lang = String(Intl.DateTimeFormat().resolvedOptions().locale || '').slice(0, 2).toLowerCase();
    return TEXTS[lang] || TEXTS.en;
  } catch {
    return TEXTS.en;
  }
};

export function ErrorBoundary({ error, retry }) {
  const dark = useColorScheme() === 'dark';
  const text = pickTexts();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {}); // 시작 직후 오류면 스플래시가 계속 가리고 있다
    crashBreadcrumb('render error screen shown');
    recordNonFatal(error, 'RenderError');
  }, [error]);

  return (
    <View style={[styles.root, { backgroundColor: dark ? '#111315' : '#FFFFFF' }]}>
      <Text style={[styles.title, { color: dark ? '#F2F3F5' : '#16181A' }]} accessibilityRole="header">{text.title}</Text>
      <Text style={[styles.body, { color: dark ? '#A9AEB4' : '#5A6068' }]}>{text.body}</Text>
      {__DEV__ && error?.message ? (
        <Text style={[styles.detail, { color: dark ? '#A9AEB4' : '#5A6068' }]} numberOfLines={6}>{String(error.message)}</Text>
      ) : null}
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel={text.retry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{text.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  detail: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  button: { marginTop: 28, minHeight: 48, minWidth: 160, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#2F6FEB', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
