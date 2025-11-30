// screens/SettingsScreen.js - 설정 화면
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
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../locales';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { themeMode } = useTheme();
  const [on, setOn] = useState(false);
  const [url, setUrl] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(false);
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(6);

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const u = await SecureStore.getItemAsync('baseUrl');
        const h = await AsyncStorage.getItem('hapticEnabled');
        const p = await AsyncStorage.getItem('photoSaveEnabled');
        const b = await AsyncStorage.getItem('selectedBarcodes');

        if (e === 'true') {
          setOn(true);
          setUrl(u || '');
        }

        if (h !== null) {
          setHapticEnabled(h === 'true');
        }

        if (p !== null) {
          setPhotoSaveEnabled(p === 'true');
        }

        if (b) {
          const parsed = JSON.parse(b);
          setSelectedBarcodesCount(parsed.length || 6);
        }
      } catch (error) {
        console.error('Load settings error:', error);
      }
    })();
  }, []);

  // 화면이 포커스될 때마다 바코드 개수 업데이트
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const b = await AsyncStorage.getItem('selectedBarcodes');
          if (b) {
            const parsed = JSON.parse(b);
            setSelectedBarcodesCount(parsed.length || 6);
          }
        } catch (error) {
          console.error('Load barcode count error:', error);
        }
      })();
    }, [])
  );

  useEffect(() => {
    SecureStore.setItemAsync('scanLinkEnabled', on.toString());
    if (!on) {
      SecureStore.deleteItemAsync('baseUrl');
      setUrl('');
    }
  }, [on]);

  useEffect(() => {
    if (on && url.trim()) {
      const t = setTimeout(() => SecureStore.setItemAsync('baseUrl', url.trim()), 500);
      return () => clearTimeout(t);
    }
  }, [url, on]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('hapticEnabled', hapticEnabled.toString());
      } catch (error) {
        console.error('Save haptic settings error:', error);
      }
    })();
  }, [hapticEnabled]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('photoSaveEnabled', photoSaveEnabled.toString());
      } catch (error) {
        console.error('Save photo save settings error:', error);
      }
    })();
  }, [photoSaveEnabled]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={s.c} contentContainerStyle={s.content}>
        <Text style={s.title}>{t('settings.title')}</Text>

        {/* 바코드 인식 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.barcodeSettings')}</Text>

          {/* 햅틱 피드백 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.hapticFeedback')}</Text>
              <Text style={s.desc}>{t('settings.hapticDesc')}</Text>
              {hapticEnabled && <Text style={s.ok}>{t('settings.enabled')}</Text>}
            </View>
            <Switch
              value={hapticEnabled}
              onValueChange={setHapticEnabled}
              trackColor={{ true: '#34C759', false: '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.hapticFeedback')}
            />
          </View>

          {/* 사진 저장 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.photoSave')}</Text>
              <Text style={s.desc}>{t('settings.photoSaveDesc')}</Text>
              {photoSaveEnabled && <Text style={s.ok}>{t('settings.enabled')}</Text>}
            </View>
            <Switch
              value={photoSaveEnabled}
              onValueChange={setPhotoSaveEnabled}
              trackColor={{ true: '#34C759', false: '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.photoSave')}
            />
          </View>

          {/* 바코드 선택 (클릭하면 새 페이지로) */}
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/barcode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.selectBarcodes')}</Text>
              <Text style={s.desc}>{selectedBarcodesCount}{t('settings.selectedCount')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          {/* 기록 내보내기 */}
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/export-history')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.exportHistory')}</Text>
              <Text style={s.desc}>{t('settings.exportHistoryDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          {/* 카메라 선택 */}
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/camera-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.cameraSelection')}</Text>
              <Text style={s.desc}>{t('settings.cameraSelectionDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          {/* 언어 선택 */}
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/language-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.languageSelection')}</Text>
              <Text style={s.desc}>
                {languages.find(lang => lang.code === language)?.name || '한국어'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          {/* 화면 모드 선택 */}
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/display-mode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.displayMode')}</Text>
              <Text style={s.desc}>
                {t(`displayModeSelection.${themeMode}`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* URL 연동 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.autoMove')}</Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('settings.useScanUrl')}</Text>
              <Text style={s.desc}>{t('settings.useScanUrlDesc')}</Text>
              {on && <Text style={s.ok}>{t('settings.enabled')}</Text>}
            </View>
            <Switch
              value={on}
              onValueChange={setOn}
              trackColor={{ true: '#34C759', false: '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.useScanUrl')}
            />
          </View>

          {on && (
            <>
              <Text style={s.urlInfo}>
                {t('settings.urlInfo')}
              </Text>
              <TextInput
                style={s.input}
                value={url}
                onChangeText={setUrl}
                placeholder={t('settings.urlPlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="url"
                accessibilityLabel={t('settings.useScanUrl')}
              />
              <Text style={s.save}>{t('settings.autoSaved')}</Text>

              <View style={s.exampleBox}>
                <Text style={s.exampleTitle}>{t('settings.exampleTitle')}</Text>
                <Text style={s.exampleText}>{t('settings.exampleUrl')}</Text>
                <Text style={s.exampleDesc}>
                  {t('settings.exampleDesc')}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  c: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 30,
    color: '#000',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 10,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 18,
  },
  ok: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 6,
    fontWeight: '600',
  },
  urlInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 20,
    lineHeight: 20,
  },
  input: {
    marginTop: 15,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    color: '#000',
  },
  save: {
    marginTop: 10,
    textAlign: 'center',
    color: '#34C759',
    fontWeight: '600',
    fontSize: 12,
  },
  exampleBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  exampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#007AFF',
    marginBottom: 8,
  },
  exampleDesc: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
  },
});
