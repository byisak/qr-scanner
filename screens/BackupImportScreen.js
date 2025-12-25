// screens/BackupImportScreen.js - 백업 가져오기 화면
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
  Modal,
  FlatList,
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
import { loadFromICloud, restoreFromBackup, getICloudBackupInfo } from '../services/iCloudService';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth 설정
const GOOGLE_WEB_CLIENT_ID = '585698187056-3tqjnjbcdidddn9ddvp2opp0mgj7tgd4.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '585698187056-rfr4k7k4vkb9rjhngb0tdnh5afqgogot.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
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
  const [showFileListModal, setShowFileListModal] = useState(false);
  const [googleFiles, setGoogleFiles] = useState([]);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);

  // 리다이렉트 URI - iOS는 리버스 클라이언트 ID 사용
  const redirectUri = Platform.OS === 'ios'
    ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('.')[0]}:/oauthredirect`
    : AuthSession.makeRedirectUri({ scheme: 'qrscanner' });

  // Google OAuth - iOS는 iOS 클라이언트 ID 사용
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'],
      redirectUri,
    },
    discovery
  );

  const [pendingGoogleImport, setPendingGoogleImport] = useState(false);

  useEffect(() => {
    if (response?.type === 'success' && pendingGoogleImport) {
      const { authentication } = response;
      if (authentication?.accessToken) {
        setGoogleAccessToken(authentication.accessToken);
        listGoogleDriveFiles(authentication.accessToken);
      }
      setPendingGoogleImport(false);
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setIsLoading(false);
      setLoadingType(null);
      setPendingGoogleImport(false);
    }
  }, [response]);

  const importOptions = [
    {
      id: 'icloud',
      title: 'iCloud에서 복원',
      description: 'iCloud에 동기화된 백업을 복원합니다',
      icon: 'cloud-outline',
      iconColor: '#5AC8FA',
      available: Platform.OS === 'ios',
    },
    {
      id: 'google',
      title: 'Google Drive에서 가져오기',
      description: 'Google Drive의 백업 파일을 선택합니다',
      icon: 'logo-google',
      iconColor: '#4285F4',
      available: true,
    },
  ];

  const restoreBackupData = async (backupData) => {
    try {
      if (!backupData.version || !backupData.data) {
        throw new Error('유효하지 않은 백업 파일입니다.');
      }

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

  const processGoogleBackupData = async (backupData) => {
    Alert.alert(
      '백업 복원',
      `백업 날짜: ${new Date(backupData.createdAt).toLocaleDateString()}\n\n기존 데이터를 덮어쓰시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          style: 'destructive',
          onPress: async () => {
            try {
              await restoreBackupData(backupData);
              Alert.alert('성공', '백업이 성공적으로 복원되었습니다.\n\n앱을 다시 시작해주세요.');
              setShowFileListModal(false);
            } catch (error) {
              Alert.alert('오류', error.message || '백업 복원 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleICloudImport = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('알림', 'iCloud는 iOS에서만 사용 가능합니다.');
      return;
    }

    setIsLoading(true);
    setLoadingType('icloud');

    try {
      const backupData = await loadFromICloud();

      if (!backupData) {
        Alert.alert('알림', 'iCloud에 저장된 백업이 없습니다.\n\n먼저 "백업 내보내기"에서 iCloud 백업을 생성해주세요.');
        return;
      }

      Alert.alert(
        '백업 복원',
        `백업 날짜: ${new Date(backupData.createdAt).toLocaleString()}\n\n기존 데이터를 덮어쓰시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '복원',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreFromBackup(backupData);
                Alert.alert('성공', '백업이 성공적으로 복원되었습니다.\n\n앱을 다시 시작해주세요.');
              } catch (error) {
                Alert.alert('오류', error.message || '백업 복원 중 오류가 발생했습니다.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('iCloud import error:', error);
      Alert.alert('오류', error.message || 'iCloud에서 백업을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleGoogleImport = async () => {
    setIsLoading(true);
    setLoadingType('google');
    setPendingGoogleImport(true);

    try {
      await promptAsync();
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('오류', 'Google 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingType(null);
      setPendingGoogleImport(false);
    }
  };

  const listGoogleDriveFiles = async (accessToken) => {
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name contains 'QR_Scanner_Backup' and mimeType='application/json'&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.files && data.files.length > 0) {
          setGoogleFiles(data.files);
          setShowFileListModal(true);
        } else {
          Alert.alert('알림', 'Google Drive에 백업 파일이 없습니다.');
        }
      } else {
        throw new Error('파일 목록 조회 실패');
      }
    } catch (error) {
      console.error('Google Drive list error:', error);
      Alert.alert('오류', 'Google Drive에서 파일 목록을 가져오지 못했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const downloadGoogleDriveFile = async (fileId) => {
    setIsLoading(true);
    setLoadingType('google');

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        }
      );

      if (response.ok) {
        const fileContent = await response.text();
        try {
          const backupData = JSON.parse(fileContent.trim());
          await processGoogleBackupData(backupData);
        } catch (parseError) {
          Alert.alert('오류', '유효한 백업 파일이 아닙니다.');
        }
      } else {
        throw new Error('파일 다운로드 실패');
      }
    } catch (error) {
      console.error('Google Drive download error:', error);
      Alert.alert('오류', 'Google Drive에서 파일을 다운로드하지 못했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleImport = (type) => {
    switch (type) {
      case 'icloud':
        handleICloudImport();
        break;
      case 'google':
        handleGoogleImport();
        break;
    }
  };

  const renderGoogleFileItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.fileItem, { borderBottomColor: colors.border }]}
      onPress={() => downloadGoogleDriveFile(item.id)}
    >
      <Ionicons name="document-text-outline" size={24} color={colors.primary} />
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {item.name}
        </Text>
        <Text style={[styles.fileDate, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
          {new Date(item.modifiedTime).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="download-outline" size={24} color={colors.textTertiary} />
    </TouchableOpacity>
  );

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

        {/* 복원 안내 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            복원 방법
          </Text>
          <View style={styles.guideList}>
            {[
              '• iCloud: 자동 동기화된 백업을 바로 복원',
              '• Google Drive: 로그인 후 백업 파일 선택',
              '• 복원 후 앱을 다시 시작해야 적용됩니다',
            ].map((text, index) => (
              <View key={index} style={styles.guideItem}>
                <Text style={[styles.guideText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Google Drive File List Modal */}
      <Modal
        visible={showFileListModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFileListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                Google Drive 백업 파일
              </Text>
              <TouchableOpacity onPress={() => setShowFileListModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              복원할 백업 파일을 선택하세요.
            </Text>

            <FlatList
              data={googleFiles}
              renderItem={renderGoogleFileItem}
              keyExtractor={(item) => item.id}
              style={styles.fileList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
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
  guideText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpace: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  fileList: {
    maxHeight: 300,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    marginBottom: 4,
  },
  fileDate: {
    fontSize: 13,
  },
});
