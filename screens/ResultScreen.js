// screens/ResultScreen.js - Expo Router 버전
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, Platform, Image, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function ResultScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams();
  const { code, url, isDuplicate, scanCount, timestamp, scanTimes, photoUri, groupId, fromHistory, type } = params;
  const displayText = code || url || '';
  const isUrl = displayText.startsWith('http://') || displayText.startsWith('https://');
  const showDuplicate = isDuplicate === 'true';
  const count = parseInt(scanCount || '1', 10);
  const scanTimestamp = timestamp ? parseInt(timestamp, 10) : null;
  const hasPhoto = photoUri && photoUri.length > 0;
  const isFromHistory = fromHistory === 'true';
  const barcodeType = type || 'qr';

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(displayText);
  const [urlOpenMode, setUrlOpenMode] = useState('inApp');

  // URL 열기 방식 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem('urlOpenMode');
        if (savedMode) {
          setUrlOpenMode(savedMode);
        }
      } catch (error) {
        console.error('Load URL open mode error:', error);
      }
    })();
  }, []);

  // 모든 스캔 시간 파싱
  let allScanTimes = [];
  try {
    allScanTimes = scanTimes ? JSON.parse(scanTimes) : (scanTimestamp ? [scanTimestamp] : []);
  } catch (e) {
    allScanTimes = scanTimestamp ? [scanTimestamp] : [];
  }

  // 시간 포맷팅 함수
  const formatDateTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}.${month}.${day}  ${hours}:${minutes}:${seconds}`;
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(isEditing ? editedText : displayText);
    Alert.alert(t('result.copySuccess'), t('result.copySuccessMessage'));
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: isEditing ? editedText : displayText });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleOpenUrl = async () => {
    const urlToOpen = isEditing ? editedText : displayText;
    if (urlToOpen.startsWith('http://') || urlToOpen.startsWith('https://')) {
      if (urlOpenMode === 'safari') {
        // Safari로 열기
        try {
          const supported = await Linking.canOpenURL(urlToOpen);
          if (supported) {
            await Linking.openURL(urlToOpen);
          } else {
            Alert.alert(t('result.error'), 'Cannot open this URL');
          }
        } catch (error) {
          console.error('Open URL error:', error);
          Alert.alert(t('result.error'), 'Failed to open URL');
        }
      } else if (urlOpenMode === 'chrome') {
        // Chrome으로 열기
        try {
          let chromeUrl = urlToOpen;
          if (Platform.OS === 'ios') {
            // iOS에서는 Chrome URL scheme 사용
            if (urlToOpen.startsWith('https://')) {
              chromeUrl = urlToOpen.replace('https://', 'googlechromes://');
            } else {
              chromeUrl = urlToOpen.replace('http://', 'googlechrome://');
            }
            // Chrome으로 직접 열기 시도
            try {
              await Linking.openURL(chromeUrl);
            } catch {
              // Chrome이 설치되어 있지 않으면 기본 브라우저로 열기
              await Linking.openURL(urlToOpen);
            }
          } else {
            // Android에서는 Chrome intent 사용
            const intentUrl = `intent://${urlToOpen.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
            try {
              await Linking.openURL(intentUrl);
            } catch {
              // Chrome이 없으면 기본 브라우저로
              await Linking.openURL(urlToOpen);
            }
          }
        } catch (error) {
          console.error('Open URL error:', error);
          Alert.alert(t('result.error'), 'Failed to open URL');
        }
      } else {
        // 앱 내 웹뷰로 열기
        router.push({ pathname: '/webview', params: { url: urlToOpen } });
      }
    }
  };

  // 사진 앨범에 저장
  const handleSavePhoto = async () => {
    if (!hasPhoto || !photoUri) {
      Alert.alert(t('result.error'), t('result.errorNoPhoto'));
      return;
    }

    try {
      // 권한 요청
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          t('result.permissionDenied'),
          t('result.permissionDeniedMessage')
        );
        return;
      }

      // 사진 저장
      const asset = await MediaLibrary.createAssetAsync(photoUri);

      // 앨범에 추가 (QR Scanner 앨범 생성 또는 기존 앨범 사용)
      const album = await MediaLibrary.getAlbumAsync('QR Scanner');
      if (album == null) {
        await MediaLibrary.createAlbumAsync('QR Scanner', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      Alert.alert(
        t('result.savePhotoSuccess'),
        t('result.savePhotoSuccessMessage')
      );
    } catch (error) {
      console.error('Save photo error:', error);
      Alert.alert(t('result.error'), t('result.errorSavePhoto'));
    }
  };

  // 사진 공유
  const handleSharePhoto = async () => {
    if (!hasPhoto || !photoUri) {
      Alert.alert(t('result.error'), t('result.errorNoPhoto'));
      return;
    }

    try {
      await Share.share({
        url: photoUri,
        message: t('result.scanPhoto'),
      });
    } catch (error) {
      console.error('Share photo error:', error);
    }
  };

  // 수정 저장
  const handleSaveEdit = async () => {
    if (!isFromHistory || !groupId) {
      Alert.alert(t('result.error'), t('result.errorHistoryOnly'));
      return;
    }

    if (!editedText.trim()) {
      Alert.alert(t('result.error'), t('result.errorEmptyValue'));
      return;
    }

    try {
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      if (!historyData) {
        Alert.alert(t('result.error'), t('result.errorNotFound'));
        return;
      }

      const historyByGroup = JSON.parse(historyData);
      const groupHistory = historyByGroup[groupId] || [];

      // 원래 코드와 일치하는 항목 찾기
      const itemIndex = groupHistory.findIndex(item =>
        item.code === displayText && item.timestamp === scanTimestamp
      );

      if (itemIndex === -1) {
        Alert.alert(t('result.error'), t('result.errorItemNotFound'));
        return;
      }

      // 수정된 값으로 업데이트
      groupHistory[itemIndex] = {
        ...groupHistory[itemIndex],
        code: editedText,
      };

      historyByGroup[groupId] = groupHistory;
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      Alert.alert(t('result.editSuccess'), t('result.editSuccessMessage'), [
        {
          text: t('common.confirm'),
          onPress: () => {
            setIsEditing(false);
            router.back();
          }
        }
      ]);
    } catch (error) {
      console.error('Edit error:', error);
      Alert.alert(t('result.error'), t('result.errorOccurred'));
    }
  };

  // 삭제
  const handleDelete = () => {
    if (!isFromHistory || !groupId) {
      Alert.alert(t('result.error'), t('result.errorHistoryDeleteOnly'));
      return;
    }

    Alert.alert(
      t('result.deleteConfirmTitle'),
      t('result.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
              if (!historyData) {
                Alert.alert(t('result.error'), t('result.errorNotFound'));
                return;
              }

              const historyByGroup = JSON.parse(historyData);
              const groupHistory = historyByGroup[groupId] || [];

              // 원래 코드와 일치하는 항목 찾기
              const filteredHistory = groupHistory.filter(item =>
                !(item.code === displayText && item.timestamp === scanTimestamp)
              );

              historyByGroup[groupId] = filteredHistory;
              await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

              Alert.alert(t('result.deleteSuccess'), t('result.deleteSuccessMessage'), [
                {
                  text: t('common.confirm'),
                  onPress: () => router.back()
                }
              ]);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert(t('result.error'), t('result.errorDeleteOccurred'));
            }
          }
        }
      ]
    );
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 취소
      setEditedText(displayText);
      setIsEditing(false);
    } else {
      // 편집 시작
      setIsEditing(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('result.title')}</Text>
        {isFromHistory && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            accessibilityLabel={t('common.delete')}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
        {!isFromHistory && <View style={{ width: 28 }} />}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 스캔 사진 */}
        {hasPhoto && (
          <View style={styles.photoContainer}>
            <View style={styles.photoHeader}>
              <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>{t('result.scanPhoto')}</Text>
              <View style={styles.photoButtonGroup}>
                <TouchableOpacity
                  style={[styles.savePhotoButton, { backgroundColor: colors.primary }]}
                  onPress={handleSavePhoto}
                  accessibilityLabel={t('result.savePhoto')}
                  accessibilityRole="button"
                >
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.savePhotoButtonText}>{t('result.savePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sharePhotoButton, { backgroundColor: colors.primary }]}
                  onPress={handleSharePhoto}
                  accessibilityLabel={t('result.share')}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <Image
              source={{ uri: photoUri }}
              style={[styles.scanPhoto, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              resizeMode="contain"
            />
          </View>
        )}

        {/* 중복 스캔 알림 */}
        {showDuplicate && (
          <View style={[styles.duplicateBanner, {
            backgroundColor: isDark ? 'rgba(255, 149, 0, 0.25)' : 'rgba(255, 149, 0, 0.15)',
            borderColor: '#FF9500'
          }]}>
            <View style={styles.duplicateHeader}>
              <Ionicons name="repeat" size={20} color="#FF9500" />
              <Text style={styles.duplicateText}>
                {t('result.duplicateScan')} ({count}{t('result.duplicateCount')})
              </Text>
            </View>
            {allScanTimes.length > 0 && (
              <View style={styles.scanTimesContainer}>
                <Text style={styles.scanTimesTitle}>{t('result.scanHistory')}</Text>
                {allScanTimes.slice().reverse().map((time, index) => (
                  <Text key={index} style={styles.scanTimeItem}>
                    {allScanTimes.length - index}. {formatDateTime(time)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.labelRow}>
          <View style={styles.labelWithType}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('result.scannedData')}</Text>
            {barcodeType && barcodeType !== 'qr' && (
              <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{barcodeType.toUpperCase()}</Text>
              </View>
            )}
          </View>
          {isFromHistory && (
            <TouchableOpacity
              style={[styles.editToggleButton, { backgroundColor: colors.inputBackground }]}
              onPress={handleEditToggle}
            >
              <Ionicons
                name={isEditing ? "close-circle" : "pencil"}
                size={20}
                color={isEditing ? colors.error : colors.primary}
              />
              <Text style={[styles.editToggleText, { color: isEditing ? colors.error : colors.primary }]}>
                {isEditing ? t('common.cancel') : t('common.edit')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={[styles.dataBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.dataInput, { color: colors.text }]}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              autoFocus
              placeholder={t('result.dataPlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        ) : (
          <View style={[styles.dataBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView style={styles.dataScrollView}>
              <Text style={[styles.dataText, { color: colors.text }]} selectable>
                {displayText}
              </Text>
            </ScrollView>
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.success }]}
            onPress={handleSaveEdit}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          </TouchableOpacity>
        )}

        {!isEditing && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleCopy}
              accessibilityLabel={t('result.copy')}
              accessibilityRole="button"
            >
              <Ionicons name="copy-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>{t('result.copy')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleShare}
              accessibilityLabel={t('result.share')}
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>{t('result.share')}</Text>
            </TouchableOpacity>

            {(isUrl || editedText.startsWith('http://') || editedText.startsWith('https://')) && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface }]}
                onPress={handleOpenUrl}
                accessibilityLabel={t('result.open')}
                accessibilityRole="button"
              >
                <Ionicons name="open-outline" size={24} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>{t('result.open')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {!isEditing && (
        <TouchableOpacity
          style={[styles.scanAgainButton, { backgroundColor: colors.success }]}
          onPress={() => router.back()}
          accessibilityLabel={t('result.scanAgain')}
          accessibilityRole="button"
        >
          <Ionicons name="scan" size={24} color="#fff" />
          <Text style={styles.scanAgainText}>{t('result.scanAgain')}</Text>
        </TouchableOpacity>
      )}
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  photoContainer: {
    marginVertical: 20,
    width: '100%',
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  photoButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  savePhotoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sharePhotoButton: {
    width: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  scanPhoto: {
    width: '70%',
    aspectRatio: 1, // 정사각형 유지
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 2,
  },
  duplicateBanner: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 20,
    alignItems: 'center',
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9500',
    marginLeft: 8,
  },
  scanTimesContainer: {
    marginTop: 12,
    width: '100%',
    alignItems: 'flex-start',
  },
  scanTimesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9500',
    marginBottom: 6,
  },
  scanTimeItem: {
    fontSize: 12,
    color: '#FF9500',
    marginVertical: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelWithType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  editToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editToggleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  dataBox: {
    borderRadius: 16,
    padding: 20,
    minHeight: 120,
    maxHeight: 300,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dataScrollView: {
    flex: 1,
  },
  dataText: {
    fontSize: 16,
    lineHeight: 24,
  },
  dataInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 30,
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    minWidth: 90,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 100,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
