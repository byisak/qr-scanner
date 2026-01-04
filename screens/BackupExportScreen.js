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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import LockIcon from '../components/LockIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth 설정
const GOOGLE_WEB_CLIENT_ID = '585698187056-3tqjnjbcdidddn9ddvp2opp0mgj7tgd4.apps.googleusercontent.com';
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
  const { syncStatus, lastSyncTime, iCloudEnabled, autoSyncEnabled, syncNow, toggleAutoSync, SYNC_STATUS } = useSync();
  const { isLocked, showUnlockAlert } = useFeatureLock();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null);
  const [lastGoogleBackupTime, setLastGoogleBackupTime] = useState(null);

  // 마지막 Google Drive 백업 시간 로드
  useEffect(() => {
    const loadLastBackupTime = async () => {
      try {
        const saved = await AsyncStorage.getItem('lastGoogleDriveBackupTime');
        if (saved) {
          setLastGoogleBackupTime(new Date(saved));
        }
      } catch (error) {
        console.log('Load last backup time error:', error);
      }
    };
    loadLastBackupTime();
  }, []);

  // 리다이렉트 URI - iOS는 리버스 클라이언트 ID 사용
  const redirectUri = Platform.OS === 'ios'
    ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('.')[0]}:/oauthredirect`
    : AuthSession.makeRedirectUri({ scheme: 'qrscanner' });

  console.log('Google OAuth Redirect URI:', redirectUri);

  // Google OAuth - Authorization Code 플로우
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true, // PKCE 사용으로 보안 강화
    },
    discovery
  );

  const [pendingGoogleBackup, setPendingGoogleBackup] = useState(false);

  // Authorization Code를 Access Token으로 교환
  const exchangeCodeForToken = async (code, codeVerifier) => {
    try {
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID,
          code,
          redirectUri,
          extraParams: {
            code_verifier: codeVerifier,
          },
        },
        discovery
      );
      return tokenResponse.accessToken;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  };

  useEffect(() => {
    console.log('Google OAuth Response:', JSON.stringify(response, null, 2));

    const handleResponse = async () => {
      if (response?.type === 'success' && pendingGoogleBackup) {
        const { params } = response;

        if (params?.code && request?.codeVerifier) {
          try {
            const accessToken = await exchangeCodeForToken(params.code, request.codeVerifier);
            console.log('Access Token:', accessToken ? 'Found' : 'Not found');

            if (accessToken) {
              uploadToGoogleDrive(accessToken);
            } else {
              Alert.alert(t('settings.error'), t('errors.authTokenNotReceived'));
              setIsLoading(false);
              setLoadingType(null);
            }
          } catch (error) {
            Alert.alert(t('settings.error'), `${t('errors.tokenExchangeFailed')}: ${error.message}`);
            setIsLoading(false);
            setLoadingType(null);
          }
        }
        setPendingGoogleBackup(false);
      } else if (response?.type === 'error') {
        console.log('OAuth Error:', response.error);
        Alert.alert(t('settings.error'), `${t('errors.googleAuthFailed')}: ${response.error?.message || t('errors.unknownError')}`);
        setIsLoading(false);
        setLoadingType(null);
        setPendingGoogleBackup(false);
      } else if (response?.type === 'dismiss') {
        console.log('OAuth Dismissed');
        setIsLoading(false);
        setLoadingType(null);
        setPendingGoogleBackup(false);
      }
    };

    handleResponse();
  }, [response]);

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

  const handleSyncNow = async () => {
    setIsLoading(true);
    setLoadingType('icloud');

    try {
      await syncNow();
      Alert.alert(t('backupExport.syncComplete'), t('backupExport.syncedToIcloud'));
    } catch (error) {
      Alert.alert(t('settings.error'), error.message || t('errors.icloudSyncError'));
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
      Alert.alert(t('settings.error'), t('errors.googleLoginError'));
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
        const now = new Date();
        await AsyncStorage.setItem('lastGoogleDriveBackupTime', now.toISOString());
        setLastGoogleBackupTime(now);
        Alert.alert(t('settings.success'), `${t('backupExport.backupComplete')}\n\n${t('backupExport.fileName')}: ${result.name}`);
      } else {
        const errorText = await response.text();
        console.error('Google Drive upload error:', errorText);
        throw new Error(t('errors.uploadFailed'));
      }
    } catch (error) {
      console.error('Google Drive backup error:', error);
      Alert.alert(t('settings.error'), t('errors.googleDriveBackupError'));
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return t('backupExport.neverSynced');

    const now = new Date();
    const diff = now - lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('backupExport.justNow');
    if (minutes < 60) return t('backupExport.minutesAgo').replace('{{count}}', minutes);
    if (hours < 24) return t('backupExport.hoursAgo').replace('{{count}}', hours);
    if (days < 7) return t('backupExport.daysAgo').replace('{{count}}', days);

    return lastSyncTime.toLocaleDateString();
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case SYNC_STATUS.SYNCING:
        return t('backupExport.syncing');
      case SYNC_STATUS.SUCCESS:
        return t('backupExport.syncComplete');
      case SYNC_STATUS.ERROR:
        return t('backupExport.syncFailed');
      case SYNC_STATUS.DISABLED:
        return t('backupExport.icloudUnavailable');
      default:
        return formatLastSyncTime();
    }
  };

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case SYNC_STATUS.SYNCING:
        return colors.primary;
      case SYNC_STATUS.SUCCESS:
        return '#34C759';
      case SYNC_STATUS.ERROR:
        return '#FF3B30';
      case SYNC_STATUS.DISABLED:
        return colors.textTertiary;
      default:
        return colors.textSecondary;
    }
  };

  const backupItems = [
    { icon: 'scan-outline', key: 'scanHistory' },
    { icon: 'folder-outline', key: 'groupInfo' },
    { icon: 'settings-outline', key: 'appSettings' },
    { icon: 'star-outline', key: 'favorites' },
    { icon: 'barcode-outline', key: 'barcodeTypeSettings' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('backupExport.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* iCloud 자동 동기화 섹션 */}
        {Platform.OS === 'ios' && (
          <View style={[styles.icloudSection, { backgroundColor: colors.surface }]}>
            <View style={styles.icloudHeader}>
              <View style={{ position: 'relative' }}>
                <View style={[styles.icloudIconContainer, { backgroundColor: '#5AC8FA15' }]}>
                  <Ionicons name="cloud-outline" size={28} color="#5AC8FA" />
                </View>
                <View style={styles.iconLockBadge}>
                  <LockIcon featureId="icloudBackup" size={12} badge style={{ marginLeft: 0 }} />
                </View>
              </View>
              <View style={styles.icloudInfo}>
                <Text style={[styles.icloudTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {t('backupExport.icloudAutoSync')}
                </Text>
                <View style={styles.syncStatusRow}>
                  {syncStatus === SYNC_STATUS.SYNCING && (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.syncStatusText, { color: getSyncStatusColor(), fontFamily: fonts.regular }]}>
                    {getSyncStatusText()}
                  </Text>
                </View>
              </View>
              <Switch
                value={autoSyncEnabled && !isLocked('icloudBackup')}
                onValueChange={(value) => {
                  if (isLocked('icloudBackup')) {
                    showUnlockAlert('icloudBackup', () => toggleAutoSync(value));
                  } else {
                    toggleAutoSync(value);
                  }
                }}
                disabled={!iCloudEnabled}
                trackColor={{ false: colors.border, true: '#5AC8FA' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {iCloudEnabled && autoSyncEnabled && (
              <View style={[styles.icloudActions, { borderTopColor: colors.border }]}>
                <Text style={[styles.icloudDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('backupExport.icloudAutoSyncDesc')}
                </Text>
                <TouchableOpacity
                  style={[styles.syncNowButton, { backgroundColor: colors.background }]}
                  onPress={handleSyncNow}
                  disabled={isLoading || syncStatus === SYNC_STATUS.SYNCING}
                >
                  {isLoading && loadingType === 'icloud' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="sync-outline" size={18} color={colors.primary} />
                      <Text style={[styles.syncNowText, { color: colors.primary, fontFamily: fonts.medium }]}>
                        {t('backupExport.syncNow')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!iCloudEnabled && (
              <Text style={[styles.icloudDisabledText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('backupExport.enableIcloud')}
              </Text>
            )}
          </View>
        )}

        {/* Google Drive 백업 */}
        <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              if (isLocked('googleDriveBackup')) {
                showUnlockAlert('googleDriveBackup', handleGoogleBackup);
              } else {
                handleGoogleBackup();
              }
            }}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <View style={{ position: 'relative' }}>
              <View style={[styles.optionIconContainer, { backgroundColor: '#4285F415' }]}>
                <Ionicons name="logo-google" size={28} color="#4285F4" />
              </View>
              <View style={styles.iconLockBadge}>
                <LockIcon featureId="googleDriveBackup" size={12} badge style={{ marginLeft: 0 }} />
              </View>
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('backupExport.googleDriveBackup')}
              </Text>
              <Text style={[styles.optionDescription, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {lastGoogleBackupTime
                  ? `${t('backupExport.lastBackup')}: ${lastGoogleBackupTime.toLocaleDateString()} ${lastGoogleBackupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : t('backupExport.neverBackedUp')}
              </Text>
            </View>
            {isLoading && loadingType === 'google' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>

        {/* 백업 포함 항목 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('backupExport.backupIncludes')}
          </Text>
          <View style={styles.includeList}>
            {backupItems.map((item, index) => (
              <View key={index} style={styles.includeItem}>
                <Ionicons name={item.icon} size={20} color={colors.success} />
                <Text style={[styles.includeText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t(`backupExport.${item.key}`)}
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
  icloudSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  icloudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icloudIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLockBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    zIndex: 1,
  },
  icloudInfo: {
    flex: 1,
    marginLeft: 14,
  },
  icloudTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusText: {
    fontSize: 13,
  },
  icloudActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icloudDescription: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    gap: 6,
  },
  syncNowText: {
    fontSize: 14,
    fontWeight: '500',
  },
  icloudDisabledText: {
    fontSize: 13,
    marginTop: 12,
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
