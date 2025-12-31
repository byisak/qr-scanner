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
import { useSync } from '../contexts/SyncContext';
import { Colors } from '../constants/Colors';
import AdBanner from '../components/AdBanner';

export default function ResultScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { triggerSync } = useSync();
  const colors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams();
  const { code, url, isDuplicate, scanCount, timestamp, scanTimes, photoUri, groupId, fromHistory, type, errorCorrectionLevel, ecLevelAnalysisFailed } = params;
  const displayText = code || url || '';
  const isUrl = displayText.startsWith('http://') || displayText.startsWith('https://');
  const showDuplicate = isDuplicate === 'true';
  const count = parseInt(scanCount || '1', 10);
  const scanTimestamp = timestamp ? parseInt(timestamp, 10) : null;
  const hasPhoto = photoUri && photoUri.length > 0;
  const isFromHistory = fromHistory === 'true';
  const barcodeType = type || 'qr';
  const ecLevel = errorCorrectionLevel || null;
  const ecAnalysisFailed = ecLevelAnalysisFailed === 'true';
  const isQRCode = barcodeType === 'qr' || barcodeType === 'qrcode';

  // 오류 검증 레벨 설명 함수
  const getECLevelDescription = (level) => {
    if (!level) return null;
    const levelUpper = level.toUpperCase();
    switch (levelUpper) {
      case 'L':
        return { level: 'L', desc: t('result.ecLevelL'), percent: '~7%' };
      case 'M':
        return { level: 'M', desc: t('result.ecLevelM'), percent: '~15%' };
      case 'Q':
        return { level: 'Q', desc: t('result.ecLevelQ'), percent: '~25%' };
      case 'H':
        return { level: 'H', desc: t('result.ecLevelH'), percent: '~30%' };
      default:
        return { level: levelUpper, desc: '', percent: '' };
    }
  };

  const ecLevelInfo = getECLevelDescription(ecLevel);

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(displayText);
  const [urlOpenMode, setUrlOpenMode] = useState('inApp');
  const [ecLevelExpanded, setEcLevelExpanded] = useState(false);
  const [photoError, setPhotoError] = useState(false);

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
        try {
          let chromeUrl = urlToOpen;
          if (Platform.OS === 'ios') {
            if (urlToOpen.startsWith('https://')) {
              chromeUrl = urlToOpen.replace('https://', 'googlechromes://');
            } else {
              chromeUrl = urlToOpen.replace('http://', 'googlechrome://');
            }
            try {
              await Linking.openURL(chromeUrl);
            } catch {
              await Linking.openURL(urlToOpen);
            }
          } else {
            const intentUrl = `intent://${urlToOpen.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
            try {
              await Linking.openURL(intentUrl);
            } catch {
              await Linking.openURL(urlToOpen);
            }
          }
        } catch (error) {
          console.error('Open URL error:', error);
          Alert.alert(t('result.error'), 'Failed to open URL');
        }
      } else {
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
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          t('result.permissionDenied'),
          t('result.permissionDeniedMessage')
        );
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(photoUri);
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

      const itemIndex = groupHistory.findIndex(item =>
        item.code === displayText && item.timestamp === scanTimestamp
      );

      if (itemIndex === -1) {
        Alert.alert(t('result.error'), t('result.errorItemNotFound'));
        return;
      }

      groupHistory[itemIndex] = {
        ...groupHistory[itemIndex],
        code: editedText,
      };

      historyByGroup[groupId] = groupHistory;
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
      triggerSync();

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

              const filteredHistory = groupHistory.filter(item =>
                !(item.code === displayText && item.timestamp === scanTimestamp)
              );

              historyByGroup[groupId] = filteredHistory;
              await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
              triggerSync();

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
      setEditedText(displayText);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  // 스캔 데이터 타입 감지 및 파싱
  const detectDataType = (data) => {
    if (!data) return { type: 'text', parsedData: { text: '' } };

    const trimmedData = data.trim();

    // URL
    if (trimmedData.startsWith('http://') || trimmedData.startsWith('https://')) {
      return { type: 'website', parsedData: { url: trimmedData } };
    }

    // vCard (연락처)
    if (trimmedData.startsWith('BEGIN:VCARD')) {
      const parsedData = {
        name: '',
        phone: '',
        email: '',
        company: '',
        title: '',
        address: '',
      };

      const lines = trimmedData.split('\n');
      for (const line of lines) {
        if (line.startsWith('FN:')) {
          parsedData.name = line.replace('FN:', '').trim();
        } else if (line.startsWith('TEL:') || line.startsWith('TEL;')) {
          parsedData.phone = line.replace(/^TEL[^:]*:/, '').trim();
        } else if (line.startsWith('EMAIL:') || line.startsWith('EMAIL;')) {
          parsedData.email = line.replace(/^EMAIL[^:]*:/, '').trim();
        } else if (line.startsWith('ORG:')) {
          parsedData.company = line.replace('ORG:', '').trim();
        } else if (line.startsWith('TITLE:')) {
          parsedData.title = line.replace('TITLE:', '').trim();
        } else if (line.startsWith('ADR:') || line.startsWith('ADR;')) {
          const addrParts = line.replace(/^ADR[^:]*:/, '').split(';');
          parsedData.address = addrParts.filter(p => p.trim()).join(' ').trim();
        }
      }

      return { type: 'contact', parsedData };
    }

    // WiFi
    if (trimmedData.startsWith('WIFI:')) {
      const parsedData = { ssid: '', password: '', security: 'WPA' };
      const wifiMatch = trimmedData.match(/WIFI:(.+)/);
      if (wifiMatch) {
        const params = wifiMatch[1];
        const ssidMatch = params.match(/S:([^;]*)/);
        const passMatch = params.match(/P:([^;]*)/);
        const typeMatch = params.match(/T:([^;]*)/);

        if (ssidMatch) parsedData.ssid = ssidMatch[1];
        if (passMatch) parsedData.password = passMatch[1];
        if (typeMatch) parsedData.security = typeMatch[1] || 'WPA';
      }
      return { type: 'wifi', parsedData };
    }

    // Email
    if (trimmedData.startsWith('mailto:')) {
      const parsedData = { recipient: '', subject: '', message: '' };
      const emailUrl = trimmedData.replace('mailto:', '');
      const [recipient, queryString] = emailUrl.split('?');
      parsedData.recipient = recipient;

      if (queryString) {
        const params = new URLSearchParams(queryString);
        parsedData.subject = decodeURIComponent(params.get('subject') || '');
        parsedData.message = decodeURIComponent(params.get('body') || '');
      }
      return { type: 'email', parsedData };
    }

    // SMS
    if (trimmedData.startsWith('sms:') || trimmedData.startsWith('SMS:')) {
      const parsedData = { phone: '', message: '' };
      const smsData = trimmedData.replace(/^sms:/i, '');
      const [phone, queryString] = smsData.split('?');
      parsedData.phone = phone;

      if (queryString) {
        const params = new URLSearchParams(queryString);
        parsedData.message = decodeURIComponent(params.get('body') || '');
      }
      return { type: 'sms', parsedData };
    }

    // Phone
    if (trimmedData.startsWith('tel:') || trimmedData.startsWith('TEL:')) {
      const phone = trimmedData.replace(/^tel:/i, '');
      return { type: 'phone', parsedData: { phone } };
    }

    // Event (vEvent)
    if (trimmedData.startsWith('BEGIN:VEVENT') || trimmedData.includes('BEGIN:VEVENT')) {
      const parsedData = {
        title: '',
        location: '',
        startDate: '',
        endDate: '',
        description: '',
      };

      const lines = trimmedData.split('\n');
      for (const line of lines) {
        if (line.startsWith('SUMMARY:')) {
          parsedData.title = line.replace('SUMMARY:', '').trim();
        } else if (line.startsWith('LOCATION:')) {
          parsedData.location = line.replace('LOCATION:', '').trim();
        } else if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
          parsedData.startDate = line.replace(/^DTSTART[^:]*:/, '').trim();
        } else if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
          parsedData.endDate = line.replace(/^DTEND[^:]*:/, '').trim();
        } else if (line.startsWith('DESCRIPTION:')) {
          parsedData.description = line.replace('DESCRIPTION:', '').trim();
        }
      }

      return { type: 'event', parsedData };
    }

    // Geo location
    if (trimmedData.startsWith('geo:') || trimmedData.startsWith('GEO:')) {
      const geoData = trimmedData.replace(/^geo:/i, '');
      const [latitude, longitude] = geoData.split(',').map(v => v.trim());
      return { type: 'location', parsedData: { latitude: latitude || '', longitude: longitude || '' } };
    }

    // Default: text
    return { type: 'text', parsedData: { text: trimmedData } };
  };

  // 코드 재생성 - generator 페이지로 이동
  const handleRegenerateCode = () => {
    // QR 코드인 경우 데이터 타입 감지
    if (isQRCode) {
      const { type, parsedData } = detectDataType(displayText);
      router.push({
        pathname: '/(tabs)/generator',
        params: {
          initialMode: 'qr',
          initialType: type,
          initialData: JSON.stringify(parsedData),
        },
      });
    } else {
      // 바코드인 경우 바코드 모드로 전달
      // barcodeType을 적절한 형식으로 매핑
      const formatMap = {
        'code_128': 'CODE128',
        'code128': 'CODE128',
        'ean_13': 'EAN13',
        'ean13': 'EAN13',
        'ean_8': 'EAN8',
        'ean8': 'EAN8',
        'upc_a': 'UPC',
        'upca': 'UPC',
        'upc_e': 'UPCE',
        'upce': 'UPCE',
        'code_39': 'CODE39',
        'code39': 'CODE39',
        'itf': 'ITF',
        'itf_14': 'ITF14',
        'itf14': 'ITF14',
        'codabar': 'codabar',
        'qr': 'CODE128', // fallback
        'qrcode': 'CODE128',
      };
      const mappedFormat = formatMap[barcodeType.toLowerCase()] || 'CODE128';

      router.push({
        pathname: '/(tabs)/generator',
        params: {
          initialMode: 'barcode',
          initialBarcodeFormat: mappedFormat,
          initialBarcodeValue: displayText,
        },
      });
    }
  };

  // EC 레벨 색상
  const getECLevelColor = (level) => {
    if (!level) return colors.textSecondary;
    switch (level.toUpperCase()) {
      case 'L': return '#FF9500';
      case 'M': return '#34C759';
      case 'Q': return '#007AFF';
      case 'H': return '#5856D6';
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 컴팩트 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('result.title')}</Text>
        {isFromHistory ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDelete}
            accessibilityLabel={t('common.delete')}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 메인 데이터 카드 */}
        <View style={[styles.mainCard, { backgroundColor: colors.surface }]}>
          {/* 바코드 타입 & EC 레벨 뱃지 */}
          <View style={styles.badgeRow}>
            {barcodeType && (
              <View style={[styles.typeBadge, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons
                  name={isQRCode ? "qr-code" : "barcode"}
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                  {isQRCode ? 'QR Code' : barcodeType.toUpperCase()}
                </Text>
              </View>
            )}
            {ecLevelInfo && isQRCode && (
              <View style={[styles.ecBadge, { backgroundColor: getECLevelColor(ecLevel) + '15' }]}>
                <Ionicons name="shield-checkmark" size={14} color={getECLevelColor(ecLevel)} />
                <Text style={[styles.ecBadgeText, { color: getECLevelColor(ecLevel) }]}>
                  EC: {ecLevelInfo.level} ({ecLevelInfo.percent})
                </Text>
              </View>
            )}
          </View>

          {/* 스캔 데이터 */}
          <View style={styles.dataSection}>
            {isEditing ? (
              <TextInput
                style={[styles.dataInput, { color: colors.text, backgroundColor: colors.inputBackground }]}
                value={editedText}
                onChangeText={setEditedText}
                multiline
                autoFocus
                placeholder={t('result.dataPlaceholder')}
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <ScrollView style={styles.dataScrollView} nestedScrollEnabled>
                <Text style={[styles.dataText, { color: colors.text }]} selectable>
                  {displayText}
                </Text>
              </ScrollView>
            )}
          </View>

          {/* 액션 버튼들 */}
          {!isEditing ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.primary + '12' }]}
                onPress={handleCopy}
              >
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionChipText, { color: colors.primary }]}>{t('result.copy')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.primary + '12' }]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionChipText, { color: colors.primary }]}>{t('result.share')}</Text>
              </TouchableOpacity>

              {(isUrl || editedText.startsWith('http://') || editedText.startsWith('https://')) && (
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: colors.success + '12' }]}
                  onPress={handleOpenUrl}
                >
                  <Ionicons name="open-outline" size={18} color={colors.success} />
                  <Text style={[styles.actionChipText, { color: colors.success }]}>{t('result.open')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.primary + '12' }]}
                onPress={handleRegenerateCode}
              >
                <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionChipText, { color: colors.primary }]}>{t('result.regenerateCode')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={handleEditToggle}
              >
                <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveEditButton, { backgroundColor: colors.success }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveEditButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 배너 광고 - 액션 버튼과 중복 스캔 사이 */}
          <AdBanner
            wrapperStyle={{
              marginTop: 16,
              paddingHorizontal: 0,
            }}
          />
        </View>

        {/* 중복 스캔 알림 */}
        {showDuplicate && (
          <View style={[styles.infoCard, { backgroundColor: '#FF950010', borderColor: '#FF9500' }]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="repeat" size={18} color="#FF9500" />
              <Text style={styles.infoCardTitle}>
                {t('result.duplicateScan')} ({count}{t('result.duplicateCount')})
              </Text>
            </View>
            {allScanTimes.length > 1 && (
              <View style={styles.scanTimesList}>
                {allScanTimes.slice().reverse().slice(0, 5).map((time, index) => (
                  <Text key={index} style={styles.scanTimeItem}>
                    {allScanTimes.length - index}. {formatDateTime(time)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 스캔 사진 */}
        {hasPhoto && (
          <View style={[styles.photoCard, { backgroundColor: colors.surface }]}>
            <View style={styles.photoHeader}>
              <Text style={[styles.photoLabel, { color: colors.text }]}>{t('result.scanPhoto')}</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={[styles.photoActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSavePhoto}
                >
                  <Ionicons name="download-outline" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSharePhoto}
                >
                  <Ionicons name="share-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => !photoError && router.push({
                pathname: '/image-analysis',
                params: { imageUri: photoUri }
              })}
              activeOpacity={photoError ? 1 : 0.8}
            >
              {photoError ? (
                <View style={[styles.scanPhoto, styles.photoPlaceholder, { backgroundColor: colors.inputBackground }]}>
                  <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.photoPlaceholderText, { color: colors.textSecondary }]}>
                    {t('result.imageNotFound') || '이미지를 찾을 수 없습니다'}
                  </Text>
                </View>
              ) : (
                <>
                  <Image
                    source={{ uri: photoUri }}
                    style={[styles.scanPhoto, { backgroundColor: colors.inputBackground }]}
                    resizeMode="contain"
                    onError={() => setPhotoError(true)}
                  />
                  <View style={[styles.analyzeOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <Ionicons name="scan" size={24} color="#fff" />
                    <Text style={styles.analyzeOverlayText}>{t('imageAnalysis.title')}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* QR 코드 오류 검증 레벨 표시 */}
        {ecLevelInfo && isQRCode && (
          <View style={[styles.ecLevelContainer, {
            backgroundColor: isDark ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
            borderColor: colors.primary
          }]}>
            <View style={styles.ecLevelHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              <Text style={[styles.ecLevelTitle, { color: colors.primary }]}>
                {t('result.errorCorrectionLevel')}
              </Text>
            </View>
            <View style={styles.ecLevelContent}>
              <View style={[styles.ecLevelBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.ecLevelBadgeText}>{ecLevelInfo.level}</Text>
              </View>
              <View style={styles.ecLevelInfo}>
                <Text style={[styles.ecLevelDesc, { color: colors.text }]}>{ecLevelInfo.desc}</Text>
                <Text style={[styles.ecLevelPercent, { color: colors.textSecondary }]}>
                  {t('result.recoveryRate')}: {ecLevelInfo.percent}
                </Text>
              </View>
            </View>

            {/* 펼침 버튼 */}
            <TouchableOpacity
              style={styles.ecLevelExpandButton}
              onPress={() => setEcLevelExpanded(!ecLevelExpanded)}
            >
              <Text style={[styles.ecLevelExpandText, { color: colors.textSecondary }]}>
                {ecLevelExpanded ? t('result.hideEcLevelInfo') : t('result.showEcLevelInfo')}
              </Text>
              <Ionicons
                name={ecLevelExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {/* 펼쳐진 EC 레벨 설명 */}
            {ecLevelExpanded && (
              <View style={[styles.ecLevelExpandedContent, { borderTopColor: colors.border }]}>
                <Text style={[styles.ecLevelExpandedTitle, { color: colors.text }]}>
                  {t('result.ecLevelTypes')}
                </Text>
                <View style={styles.ecLevelList}>
                  {['L', 'M', 'Q', 'H'].map((level) => {
                    const isActive = ecLevel?.toUpperCase() === level;
                    const levelName = { L: 'Low', M: 'Medium', Q: 'Quartile', H: 'High' }[level];
                    const levelPercent = { L: '~7%', M: '~15%', Q: '~25%', H: '~30%' }[level];
                    return (
                      <View key={level} style={[styles.ecLevelListItem, isActive && styles.ecLevelListItemActive, isActive && { backgroundColor: colors.primary + '20' }]}>
                        <View style={[styles.ecLevelListBadge, { backgroundColor: isActive ? colors.primary : colors.textSecondary }]}>
                          <Text style={styles.ecLevelListBadgeText}>{level}</Text>
                        </View>
                        <View style={styles.ecLevelListInfo}>
                          <Text style={[styles.ecLevelListName, { color: colors.text }]}>{levelName}</Text>
                          <Text style={[styles.ecLevelListPercent, { color: colors.textSecondary }]}>{levelPercent} {t('result.recoverable')}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
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
    paddingHorizontal: 8,
    paddingTop: 50,
    paddingBottom: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  mainCard: {
    borderRadius: 16,
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  ecBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dataSection: {
    minHeight: 80,
    maxHeight: 200,
    marginBottom: 16,
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
    padding: 12,
    borderRadius: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveEditButton: {},
  saveEditButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  scanTimesList: {
    marginTop: 10,
  },
  scanTimeItem: {
    fontSize: 12,
    color: '#FF9500',
    marginVertical: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  photoCard: {
    borderRadius: 16,
    padding: 16,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoActionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  photoPlaceholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
  analyzeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    gap: 8,
  },
  analyzeOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ecLevelContainer: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
  },
  ecLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ecLevelTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  ecLevelContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ecLevelBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ecLevelBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  ecLevelInfo: {
    marginLeft: 12,
    flex: 1,
  },
  ecLevelDesc: {
    fontSize: 15,
    fontWeight: '600',
  },
  ecLevelPercent: {
    fontSize: 12,
    marginTop: 2,
  },
  ecLevelExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 10,
  },
  ecLevelExpandText: {
    fontSize: 13,
    marginRight: 4,
  },
  ecLevelExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ecLevelExpandedTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  ecLevelList: {
    gap: 8,
  },
  ecLevelListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  ecLevelListItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  ecLevelListBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ecLevelListBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  ecLevelListInfo: {
    marginLeft: 10,
    flex: 1,
  },
  ecLevelListName: {
    fontSize: 14,
    fontWeight: '600',
  },
  ecLevelListPercent: {
    fontSize: 12,
    marginTop: 1,
  },
});
