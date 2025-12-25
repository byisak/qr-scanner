// screens/BackupExportScreen.js - 백업 내보내기 화면
import React, { useState, useEffect } from 'react';
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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { saveToICloud, isICloudAvailable, getICloudBackupInfo } from '../services/iCloudService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth 설정
const GOOGLE_CLIENT_ID = '585698187056-3tqjnjbcdidddn9ddvp2opp0mgj7tgd4.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '585698187056-rfr4k7k4vkb9rjhngb0tdnh5afqgogot.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
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

  // Google OAuth
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'qrscanner',
      }),
    },
    discovery
  );

  const [pendingGoogleBackup, setPendingGoogleBackup] = useState(false);

  useEffect(() => {
    if (response?.type === 'success' && pendingGoogleBackup) {
      const { authentication } = response;
      if (authentication?.accessToken) {
        uploadToGoogleDrive(authentication.accessToken);
      }
      setPendingGoogleBackup(false);
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setIsLoading(false);
      setLoadingType(null);
      setPendingGoogleBackup(false);
    }
  }, [response]);

  const backupOptions = [
    {
      id: 'local',
      title: '로컬 파일로 저장',
      description: '기기에 백업 파일을 저장합니다',
      icon: 'phone-portrait-outline',
      iconColor: '#34C759',
      available: true,
    },
    {
      id: 'icloud',
      title: 'iCloud 백업',
      description: 'iCloud에 자동 동기화됩니다',
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
      const backupData = await createBackupData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `QR_Scanner_Backup_${timestamp}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: '백업 파일 저장',
          UTI: 'public.json',
        });
        Alert.alert('성공', '백업 파일이 생성되었습니다.');
      } else {
        Alert.alert('오류', '공유 기능을 사용할 수 없습니다.');
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
      const result = await saveToICloud();

      if (result.success) {
        Alert.alert(
          '백업 완료',
          `iCloud에 자동으로 백업되었습니다.\n\n백업 시간: ${new Date(result.timestamp).toLocaleString()}\n\n다른 기기에서도 자동으로 동기화됩니다.`
        );
      }
    } catch (error) {
      console.error('iCloud backup error:', error);
      Alert.alert('오류', error.message || 'iCloud 백업 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleGoogleBackup = async () => {
    setIsLoading(true);
    setLoadingType('google');
    setPendingGoogleBackup(true);

    try {
      await promptAsync();
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('오류', 'Google 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingType(null);
      setPendingGoogleBackup(false);
    }
  };

  const uploadToGoogleDrive = async (accessToken) => {
    try {
      const backupData = await createBackupData();
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `QR_Scanner_Backup_${timestamp}.json`;
      const fileContent = JSON.stringify(backupData, null, 2);

      // 파일 메타데이터
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
      };

      // Multipart 업로드
      const boundary = 'foo_bar_baz';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelimiter;

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (response.ok) {
        const result = await response.json();
        Alert.alert('성공', `Google Drive에 백업이 완료되었습니다.\n\n파일명: ${result.name}`);
      } else {
        const errorText = await response.text();
        console.error('Google Drive upload error:', errorText);
        throw new Error('업로드 실패');
      }
    } catch (error) {
      console.error('Google Drive backup error:', error);
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
                {!option.available && Platform.OS === 'android' && option.id === 'icloud' && (
                  <Text style={[styles.unavailableText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                    iOS 전용
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
