// screens/BackupExportScreen.js - 백업 내보내기 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import LockIcon from '../components/LockIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import MaterialPressable from '../components/MaterialPressable';
import { exportItemsForBackup } from '../utils/itemMaster';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth 설정
const GOOGLE_WEB_CLIENT_ID = '585698187056-3tqjnjbcdidddn9ddvp2opp0mgj7tgd4.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '585698187056-rfr4k7k4vkb9rjhngb0tdnh5afqgogot.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '585698187056-c245sfancbg2e2djpjn6q0j945f0muff.apps.googleusercontent.com';

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
      clientId: Platform.select({ ios: GOOGLE_IOS_CLIENT_ID, android: GOOGLE_ANDROID_CLIENT_ID, default: GOOGLE_WEB_CLIENT_ID }),
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
          clientId: Platform.select({ ios: GOOGLE_IOS_CLIENT_ID, android: GOOGLE_ANDROID_CLIENT_ID, default: GOOGLE_WEB_CLIENT_ID }),
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

      // 품목 마스터는 AsyncStorage가 아니라 파일에 있어 따로 담는다
      const itemMaster = await exportItemsForBackup();
      if (itemMaster) backupData.itemMaster = itemMaster;

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
        return colors.primaryText;
      case SYNC_STATUS.SUCCESS:
        return colors.success;
      case SYNC_STATUS.ERROR:
        return colors.error;
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

  const switchOff = colors.switchOff;
  const separator = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('backupExport.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* iCloud 자동 동기화 섹션 */}
        {Platform.OS === 'ios' && (
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.row, styles.rowWithDesc]}>
              <View>
                <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="cloud-outline" size={20} color={colors.primaryText} />
                </View>
                <View style={styles.iconLockBadge}>
                  <LockIcon featureId="icloudBackup" size={12} badge style={{ marginLeft: 0 }} />
                </View>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('backupExport.icloudAutoSync')}
                </Text>
                <View style={styles.syncStatusRow}>
                  {syncStatus === SYNC_STATUS.SYNCING && (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.rowDesc, { color: getSyncStatusColor(), fontFamily: fonts.regular }]}>
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
                trackColor={{ false: switchOff, true: colors.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={switchOff}
                accessibilityLabel={t('backupExport.icloudAutoSync')}
              />
            </View>

            {iCloudEnabled && autoSyncEnabled && (
              <View style={[styles.icloudActions, separator]}>
                <Text style={[styles.hintText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('backupExport.icloudAutoSyncDesc')}
                </Text>
                <MaterialPressable
                  style={[styles.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
                  onPress={handleSyncNow}
                  disabled={isLoading || syncStatus === SYNC_STATUS.SYNCING}
                  accessibilityRole="button"
                >
                  {isLoading && loadingType === 'icloud' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="sync-outline" size={18} color={colors.text} />
                      <Text style={[styles.secondaryButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                        {t('backupExport.syncNow')}
                      </Text>
                    </>
                  )}
                </MaterialPressable>
              </View>
            )}

            {!iCloudEnabled && (
              <View style={[styles.icloudActions, separator]}>
                <View style={[styles.infoBox, { backgroundColor: colors.raised }]}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.hintText, styles.rowText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('backupExport.enableIcloud')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Google Drive 백업 */}
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialPressable
            style={[styles.row, styles.rowWithDesc]}
            onPress={() => {
              if (isLocked('googleDriveBackup')) {
                showUnlockAlert('googleDriveBackup', handleGoogleBackup);
              } else {
                handleGoogleBackup();
              }
            }}
            disabled={isLoading}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View>
              <View style={[styles.tile, { backgroundColor: colors.raised }]}>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
              </View>
              <View style={styles.iconLockBadge}>
                <LockIcon featureId="googleDriveBackup" size={12} badge style={{ marginLeft: 0 }} />
              </View>
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('backupExport.googleDriveBackup')}
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {lastGoogleBackupTime
                  ? `${t('backupExport.lastBackup')}: ${lastGoogleBackupTime.toLocaleDateString()} ${lastGoogleBackupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : t('backupExport.neverBackedUp')}
              </Text>
            </View>
            {isLoading && loadingType === 'google' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            )}
          </MaterialPressable>
        </View>

        {/* 백업 포함 항목 */}
        <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {t('backupExport.backupIncludes')}
        </Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {backupItems.map((item, index) => (
            <View key={index} style={[styles.row, index > 0 && separator]}>
              <View style={[styles.tileSmall, { backgroundColor: colors.successSoft }]}>
                <Ionicons name={item.icon} size={18} color={colors.success} />
              </View>
              <Text style={[styles.rowLabel, styles.rowText, { color: colors.text, fontFamily: fonts.medium }]}>
                {t(`backupExport.${item.key}`)}
              </Text>
              <Ionicons name="checkmark" size={18} color={colors.success} />
            </View>
          ))}
        </View>
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
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: SIZE.touch,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
    gap: SPACE.gap,
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowWithDesc: {
    minHeight: SIZE.rowWithDesc,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    ...TYPE.body,
  },
  rowDesc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLockBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    zIndex: 1,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icloudActions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: RADIUS.control,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
