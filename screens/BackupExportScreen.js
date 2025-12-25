// screens/BackupExportScreen.js - 백업 내보내기 화면
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
    const fsModule = await import('expo-file-system');
    const shModule = await import('expo-sharing');
    return {
      File: fsModule.File,
      Paths: fsModule.Paths,
      isAvailableAsync: shModule.isAvailableAsync,
      shareAsync: shModule.shareAsync,
    };
  } catch (error) {
    console.error('Module load error:', error);
    throw new Error('네이티브 모듈을 로드할 수 없습니다.');
  }
};

export default function BackupExportScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null);

  const backupOptions = [
    {
      id: 'local',
      title: '로컬 백업',
      description: '기기에 백업 파일을 저장합니다',
      icon: 'phone-portrait-outline',
      iconColor: '#007AFF',
      available: true,
    },
    {
      id: 'icloud',
      title: 'iCloud 백업',
      description: 'iCloud Drive에 백업을 저장합니다',
      icon: 'cloud-outline',
      iconColor: '#5AC8FA',
      available: Platform.OS === 'ios',
    },
    {
      id: 'google',
      title: 'Google Drive 백업',
      description: 'Google Drive에 백업을 저장합니다',
      icon: 'logo-google',
      iconColor: '#4285F4',
      available: true,
    },
  ];

  const createBackupData = async () => {
    try {
      // AsyncStorage에서 모든 키 가져오기
      const allKeys = await AsyncStorage.getAllKeys();
      const allData = await AsyncStorage.multiGet(allKeys);

      const backupData = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        platform: Platform.OS,
        data: {},
      };

      allData.forEach(([key, value]) => {
        try {
          backupData.data[key] = JSON.parse(value);
        } catch {
          backupData.data[key] = value;
        }
      });

      return backupData;
    } catch (error) {
      console.error('Create backup data error:', error);
      throw error;
    }
  };

  const handleLocalBackup = async () => {
    setIsLoading(true);
    setLoadingType('local');

    try {
      // 모듈 동적 로딩
      const { File, Paths, isAvailableAsync, shareAsync } = await loadModules();

      const backupData = await createBackupData();
      // 고유한 파일명 생성 (날짜 + 시간 + 랜덤)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const random = Math.random().toString(36).substring(2, 8);
      const fileName = `qr_scanner_backup_${timestamp}_${random}.json`;

      // 새로운 File API 사용
      const backupFile = new File(Paths.cache, fileName);

      // 파일이 이미 존재하면 삭제 시도
      try {
        if (backupFile.exists) {
          await backupFile.delete();
        }
      } catch (e) {
        // 파일이 없으면 무시
      }

      await backupFile.create();
      await backupFile.write(JSON.stringify(backupData, null, 2));

      if (await isAvailableAsync()) {
        await shareAsync(backupFile.uri, {
          mimeType: 'application/json',
          dialogTitle: '백업 파일 저장',
          UTI: 'public.json',
        });
        Alert.alert('성공', '백업 파일이 생성되었습니다.');
      } else {
        Alert.alert('알림', `백업 파일이 저장되었습니다:\n${backupFile.uri}`);
      }
    } catch (error) {
      console.error('Local backup error:', error);
      Alert.alert('오류', error.message || '백업 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleICloudBackup = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('알림', 'iCloud 백업은 iOS에서만 사용 가능합니다.');
      return;
    }

    setIsLoading(true);
    setLoadingType('icloud');

    try {
      const backupData = await createBackupData();
      // iCloud 백업 로직 (추후 구현)
      Alert.alert('준비 중', 'iCloud 백업 기능은 준비 중입니다.');
    } catch (error) {
      console.error('iCloud backup error:', error);
      Alert.alert('오류', 'iCloud 백업 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleGoogleBackup = async () => {
    setIsLoading(true);
    setLoadingType('google');

    try {
      const backupData = await createBackupData();
      // Google Drive 백업 로직 (추후 구현)
      Alert.alert('준비 중', 'Google Drive 백업 기능은 준비 중입니다.');
    } catch (error) {
      console.error('Google backup error:', error);
      Alert.alert('오류', 'Google Drive 백업 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleBackup = (type) => {
    switch (type) {
      case 'local':
        handleLocalBackup();
        break;
      case 'icloud':
        handleICloudBackup();
        break;
      case 'google':
        handleGoogleBackup();
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
          백업 내보내기
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 문구 */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            스캔 기록, 설정, 그룹 정보 등을 백업합니다. 백업 방식을 선택해주세요.
          </Text>
        </View>

        {/* 백업 옵션들 */}
        <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
          {backupOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                !option.available && styles.optionDisabled,
              ]}
              onPress={() => handleBackup(option.id)}
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

        {/* 백업 포함 항목 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            백업에 포함되는 항목
          </Text>
          <View style={styles.includeList}>
            {[
              { icon: 'scan-outline', text: '스캔 기록' },
              { icon: 'folder-outline', text: '그룹 정보' },
              { icon: 'settings-outline', text: '앱 설정' },
              { icon: 'star-outline', text: '즐겨찾기' },
              { icon: 'barcode-outline', text: '바코드 타입 설정' },
            ].map((item, index) => (
              <View key={index} style={styles.includeItem}>
                <Ionicons name={item.icon} size={20} color={colors.success} />
                <Text style={[styles.includeText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {item.text}
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
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
  includeList: {
    gap: 12,
  },
  includeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  includeText: {
    fontSize: 15,
  },
  bottomSpace: {
    height: 40,
  },
});
