// screens/ScanUrlSettingsScreen.js - 스캔 연동 URL 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function ScanUrlSettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const u = await SecureStore.getItemAsync('baseUrl');
        if (e === 'true') {
          setEnabled(true);
          setUrl(u || '');
        }
      } catch (error) {
        console.error('Load scan URL settings error:', error);
      }
    })();
  }, []);

  useEffect(() => {
    SecureStore.setItemAsync('scanLinkEnabled', enabled.toString());
    if (!enabled) {
      SecureStore.deleteItemAsync('baseUrl');
      setUrl('');
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled && url.trim()) {
      const t = setTimeout(() => SecureStore.setItemAsync('baseUrl', url.trim()), 500);
      return () => clearTimeout(t);
    }
  }, [url, enabled]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.useScanUrl')}</Text>
        <View style={styles.headerRight} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* 토글 설정 */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{t('settings.useScanUrl')}</Text>
                <Text style={[styles.desc, { color: colors.textTertiary }]}>{t('settings.useScanUrlDesc')}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                thumbColor="#fff"
                accessibilityLabel={t('settings.useScanUrl')}
              />
            </View>

            {enabled && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                <Text style={[styles.urlInfo, { color: colors.textSecondary }]}>
                  {t('settings.urlInfo')}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={url}
                  onChangeText={setUrl}
                  placeholder={t('settings.urlPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                  accessibilityLabel={t('settings.useScanUrl')}
                />
                <Text style={[styles.save, { color: colors.success }]}>{t('settings.autoSaved')}</Text>

                <View style={[styles.exampleBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Text style={[styles.exampleTitle, { color: colors.textSecondary }]}>{t('settings.exampleTitle')}</Text>
                  <Text style={[styles.exampleText, { color: colors.primary }]}>{t('settings.exampleUrl')}</Text>
                  <Text style={[styles.exampleDesc, { color: colors.textTertiary }]}>
                    {t('settings.exampleDesc')}
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 36,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  urlInfo: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    marginTop: 15,
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  save: {
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
  },
  exampleBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  exampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  exampleDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
});
