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
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function ScanUrlSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [enabled, setEnabled] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [urlList, setUrlList] = useState([]); // [{ id: string, url: string, enabled: boolean }]

  // 초기 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const savedUrlList = await SecureStore.getItemAsync('scanUrlList');

        if (e === 'true') {
          setEnabled(true);
        }

        if (savedUrlList) {
          const parsed = JSON.parse(savedUrlList);
          setUrlList(parsed);
        } else {
          // 기존 단일 URL 마이그레이션
          const oldUrl = await SecureStore.getItemAsync('baseUrl');
          if (oldUrl) {
            const migratedList = [{ id: Date.now().toString(), url: oldUrl, enabled: true }];
            setUrlList(migratedList);
            await SecureStore.setItemAsync('scanUrlList', JSON.stringify(migratedList));
            await SecureStore.deleteItemAsync('baseUrl');
          }
        }
      } catch (error) {
        console.error('Load scan URL settings error:', error);
      }
    })();
  }, []);

  // 기능 활성화 상태 저장
  useEffect(() => {
    SecureStore.setItemAsync('scanLinkEnabled', enabled.toString());
  }, [enabled]);

  // URL 리스트 변경 시 저장
  useEffect(() => {
    if (urlList.length > 0) {
      SecureStore.setItemAsync('scanUrlList', JSON.stringify(urlList));

      // 활성화된 URL을 baseUrl에도 저장 (하위 호환성)
      const activeUrl = urlList.find(item => item.enabled);
      if (activeUrl) {
        SecureStore.setItemAsync('baseUrl', activeUrl.url);
      } else {
        SecureStore.deleteItemAsync('baseUrl');
      }
    }
  }, [urlList]);

  // URL 추가
  const handleAddUrl = () => {
    const trimmedUrl = inputUrl.trim();
    if (!trimmedUrl) {
      Alert.alert(t('settings.error'), t('settings.urlEmptyError'));
      return;
    }

    // 중복 체크
    const isDuplicate = urlList.some(item => item.url === trimmedUrl);
    if (isDuplicate) {
      Alert.alert(t('settings.error'), t('settings.urlDuplicateError'));
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      url: trimmedUrl,
      enabled: urlList.length === 0, // 첫 번째 URL은 자동 활성화
    };

    setUrlList(prev => [...prev, newItem]);
    setInputUrl('');
    Keyboard.dismiss();
  };

  // URL 삭제
  const handleDeleteUrl = (id) => {
    Alert.alert(
      t('settings.deleteSession'),
      t('settings.deleteUrlConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setUrlList(prev => prev.filter(item => item.id !== id));
          },
        },
      ]
    );
  };

  // URL 활성화 토글
  const handleToggleUrl = (id, value) => {
    setUrlList(prev => prev.map(item => ({
      ...item,
      enabled: item.id === id ? value : item.enabled,
    })));
  };

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

                {/* URL 입력 및 추가 버튼 */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={inputUrl}
                    onChangeText={setInputUrl}
                    placeholder={t('settings.urlPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="url"
                    accessibilityLabel={t('settings.useScanUrl')}
                  />
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddUrl}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* URL 리스트 */}
                {urlList.length > 0 && (
                  <View style={styles.urlListContainer}>
                    <Text style={[styles.urlListTitle, { color: colors.textSecondary }]}>
                      {t('settings.urlListTitle')} ({urlList.length})
                    </Text>
                    {urlList.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.urlItem,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: item.enabled ? colors.success : colors.border
                          }
                        ]}
                      >
                        <View style={styles.urlItemContent}>
                          <Text
                            style={[
                              styles.urlItemText,
                              { color: item.enabled ? colors.text : colors.textTertiary }
                            ]}
                            numberOfLines={2}
                          >
                            {item.url}
                          </Text>
                          <View style={styles.urlItemActions}>
                            <Switch
                              value={item.enabled}
                              onValueChange={(value) => handleToggleUrl(item.id, value)}
                              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                              thumbColor="#fff"
                              style={styles.urlItemSwitch}
                            />
                            <TouchableOpacity
                              onPress={() => handleDeleteUrl(item.id)}
                              style={styles.deleteButton}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                    <Text style={[styles.urlListInfo, { color: colors.textTertiary }]}>
                      {t('settings.urlToggleInfo')}
                    </Text>
                  </View>
                )}

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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 10,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  inputFlex: {
    flex: 1,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlListContainer: {
    marginTop: 20,
  },
  urlListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  urlItem: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  urlItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urlItemText: {
    flex: 1,
    fontSize: 14,
    marginRight: 10,
  },
  urlItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlItemSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  deleteButton: {
    padding: 6,
  },
  urlListInfo: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
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
