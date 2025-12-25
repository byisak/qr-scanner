// screens/BackupImportScreen.js - 백업 가져오기 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 모듈 로딩 함수
const loadModules = async () => {
  try {
    const dpModule = await import('expo-document-picker');
    const fsModule = await import('expo-file-system');
    return {
      getDocumentAsync: dpModule.getDocumentAsync,
      readAsStringAsync: fsModule.readAsStringAsync,
    };
  } catch (error) {
    console.error('Module load error:', error);
    throw new Error('네이티브 모듈을 로드할 수 없습니다. Development Build가 필요합니다.');
  }
};

export default function BackupImportScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null);

  const importOptions = [
    {
      id: 'local',
      title: '로컬에서 가져오기',
      description: '기기에 저장된 백업 파일을 선택합니다',
      icon: 'phone-portrait-outline',
      iconColor: '#007AFF',
      available: true,
    },
    {
      id: 'icloud',
      title: 'iCloud에서 가져오기',
      description: 'iCloud Drive에서 백업을 가져옵니다',
      icon: 'cloud-outline',
      iconColor: '#5AC8FA',
      available: Platform.OS === 'ios',
    },
    {
      id: 'google',
      title: 'Google Drive에서 가져오기',
      description: 'Google Drive에서 백업을 가져옵니다',
      icon: 'logo-google',
      iconColor: '#4285F4',
      available: true,
    },
  ];

  const restoreBackupData = async (backupData) => {
    try {
      // 버전 확인
      if (!backupData.version || !backupData.data) {
        throw new Error('유효하지 않은 백업 파일입니다.');
      }

      // 데이터 복원
      const entries = Object.entries(backupData.data);
      for (const [key, value] of entries) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        await AsyncStorage.setItem(key, stringValue);
      }

      return true;
    } catch (error) {
      console.error('Restore backup data error:', error);
      throw error;
    }
  };

  const handleLocalImport = async () => {
    setIsLoading(true);
    setLoadingType('local');

    try {
      // 모듈 동적 로딩
      const { getDocumentAsync, readAsStringAsync } = await loadModules();

      const result = await getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setIsLoading(false);
        setLoadingType(null);
        return;
      }

      const fileUri = result.assets[0].uri;
      const fileContent = await readAsStringAsync(fileUri);
      const backupData = JSON.parse(fileContent);

      Alert.alert(
        '백업 복원',
        `백업 날짜: ${new Date(backupData.createdAt).toLocaleDateString()}\n\n기존 데이터를 덮어쓰시겠습니까?`,
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '복원',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreBackupData(backupData);
                Alert.alert('성공', '백업이 성공적으로 복원되었습니다. 앱을 다시 시작해주세요.');
              } catch (error) {
                Alert.alert('오류', error.message || '백업 복원 중 오류가 발생했습니다.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Local import error:', error);
      Alert.alert('오류', '백업 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleICloudImport = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('알림', 'iCloud 가져오기는 iOS에서만 사용 가능합니다.');
      return;
    }

    setIsLoading(true);
    setLoadingType('icloud');

    try {
      // iCloud 가져오기 로직 (추후 구현)
      Alert.alert('준비 중', 'iCloud 가져오기 기능은 준비 중입니다.');
    } catch (error) {
      console.error('iCloud import error:', error);
      Alert.alert('오류', 'iCloud에서 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleGoogleImport = async () => {
    setIsLoading(true);
    setLoadingType('google');

    try {
      // Google Drive 가져오기 로직 (추후 구현)
      Alert.alert('준비 중', 'Google Drive 가져오기 기능은 준비 중입니다.');
    } catch (error) {
      console.error('Google import error:', error);
      Alert.alert('오류', 'Google Drive에서 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleImport = (type) => {
    switch (type) {
      case 'local':
        handleLocalImport();
        break;
      case 'icloud':
        handleICloudImport();
        break;
      case 'google':
        handleGoogleImport();
        break;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          백업 가져오기
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 경고 문구 */}
        <View style={[styles.warningCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="warning-outline" size={24} color="#D97706" />
          <Text style={[styles.warningText, { color: '#92400E', fontFamily: fonts.regular }]}>
            백업을 복원하면 현재 데이터가 덮어쓰기됩니다. 중요한 데이터는 미리 백업해주세요.
          </Text>
        </View>

        {/* 가져오기 옵션들 */}
        <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
          {importOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                !option.available && styles.optionDisabled,
              ]}
              onPress={() => handleImport(option.id)}
              disabled={isLoading || !option.available}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: `${option.iconColor}15` }]}>
                <Ionicons name={option.icon} size={28} color={option.available ? option.iconColor : colors.textTertiary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle,
                  { color: option.available ? colors.text : colors.textTertiary, fontFamily: fonts.semiBold }
                ]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {option.description}
                </Text>
                {!option.available && (
                  <Text style={[styles.unavailableText, { color: colors.error, fontFamily: fonts.regular }]}>
                    {Platform.OS === 'android' ? 'iOS 전용 기능입니다' : '사용 불가'}
                  </Text>
                )}
              </View>
              {isLoading && loadingType === option.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={24} color={option.available ? colors.textTertiary : colors.border} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 복원 안내 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            복원 안내
          </Text>
          <View style={styles.guideList}>
            {[
              '백업 파일은 .json 형식이어야 합니다',
              '복원 후 앱을 다시 시작해야 적용됩니다',
              '다른 기기의 백업도 복원 가능합니다',
              '호환되지 않는 버전은 복원이 불가합니다',
            ].map((text, index) => (
              <View key={index} style={styles.guideItem}>
                <View style={[styles.bulletPoint, { backgroundColor: colors.primary }]} />
                <Text style={[styles.guideText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  optionsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  unavailableText: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  guideList: {
    gap: 12,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  guideText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpace: {
    height: 40,
  },
});
