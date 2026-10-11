// screens/ResultScreen.js - Expo Router 버전
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Share, Alert, Platform, Image, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { useFeedback, FeedbackToastHost } from '../contexts/FeedbackContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { RADIUS, MONO } from '../constants/Design';
import AdBanner from '../components/AdBanner';
import { parseQRContent, QR_CONTENT_TYPES, formatPhoneNumber } from '../utils/qrContentParser';
import QRActionButtons from '../components/QRActionButtons';
import QRContentInfoDisplay from '../components/QRContentInfoDisplay';
import MaterialPressable from '../components/MaterialPressable';
import NewLabelPatternModal from '../components/NewLabelPatternModal';
import { labelOfItem, signatureOf, fieldNameAt } from '../utils/labelParser';
import { parseGs1, gs1AiLabel, gs1DisplayValue } from '../utils/gs1';
import { findHistoryItem, updateHistoryItem } from '../utils/historyItem';
import { loadLabelSettings, createCategoryFromCode, ignorePattern } from '../utils/labelCategories';

// 바코드 타입 표시 이름 (다른 화면의 'EAN-13' 표기와 맞춘다)
const BARCODE_TYPE_LABELS = {
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  upca: 'UPC-A',
  upce: 'UPC-E',
  itf14: 'ITF-14',
  qr: 'QR',
  qrcode: 'QR',
  datamatrix: 'Data Matrix',
  pdf417: 'PDF417',
};

const formatBarcodeType = (type) => {
  if (!type) return '';
  return BARCODE_TYPE_LABELS[type.toLowerCase().replace(/_/g, '')] || type.toUpperCase();
};

export default function ResultScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { triggerSync } = useSync();
  const { isBarcodeTypeLocked, getBarcodeFeatureId, showUnlockAlert } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams();
  const { code, url, isDuplicate, scanCount, timestamp, scanTimes, photoUri, groupId, fromHistory, type, errorCorrectionLevel, ecLevelAnalysisFailed, isGenerated, generatorData, thumbnail, location } = params;

  // 코드 값 안전하게 처리 (빈 문자열 또는 undefined 체크)
  const safeCode = typeof code === 'string' && code.trim() ? code.trim() : '';
  const safeUrl = typeof url === 'string' && url.trim() ? url.trim() : '';
  const displayText = safeCode || safeUrl || '';

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
  const isGeneratedCode = isGenerated === 'true';
  const parsedGeneratorData = useMemo(() => {
    if (!generatorData) return null;
    try {
      return JSON.parse(generatorData);
    } catch (error) {
      console.error('generatorData 파싱 실패:', error);
      return null;
    }
  }, [generatorData]);

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
  const [photoError, setPhotoError] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [labelCategories, setLabelCategories] = useState([]);
  const [newPatternPrompt, setNewPatternPrompt] = useState(null); // 스캔 직후 처음 보는 라벨 패턴이면 카테고리 생성 묻기

  // QR 콘텐츠 파싱 (타입 감지)
  const parsedContent = useMemo(() => {
    return parseQRContent(displayText);
  }, [displayText]);

  // QR 콘텐츠 타입 레이블
  const getContentTypeLabel = (type) => {
    const labels = {
      [QR_CONTENT_TYPES.URL]: t('qrTypes.url') || 'URL',
      [QR_CONTENT_TYPES.PHONE]: t('qrTypes.phone') || '전화번호',
      [QR_CONTENT_TYPES.SMS]: t('qrTypes.sms') || 'SMS',
      [QR_CONTENT_TYPES.EMAIL]: t('qrTypes.email') || '이메일',
      [QR_CONTENT_TYPES.WIFI]: t('qrTypes.wifi') || 'WiFi',
      [QR_CONTENT_TYPES.GEO]: t('qrTypes.location') || '위치',
      [QR_CONTENT_TYPES.CONTACT]: t('qrTypes.contact') || '연락처',
      [QR_CONTENT_TYPES.EVENT]: t('qrTypes.event') || '일정',
      [QR_CONTENT_TYPES.TEXT]: t('qrTypes.text') || '텍스트',
    };
    return labels[type] || type;
  };

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

  // 라벨 카테고리 로드. 스캔 직후(기록에서 연 게 아니면) 처음 보는 패턴이면 카테고리를 만들지 묻는다
  useEffect(() => {
    (async () => {
      try {
        const { categories, ignored, autoSplit } = await loadLabelSettings();
        setLabelCategories(categories);
        if (!autoSplit || isFromHistory || !displayText) return;
        const signature = signatureOf(displayText);
        if (signature && !ignored.includes(signature) && !categories.some(c => c.signature === signature)) {
          setNewPatternPrompt({ signature, sample: displayText });
        }
      } catch (error) {
        console.error('Load label categories error:', error);
      }
    })();
  }, [displayText, isFromHistory]);

  const handleCreateCategory = async (name) => {
    const pattern = newPatternPrompt;
    setNewPatternPrompt(null);
    if (!pattern) return;
    try {
      const category = await createCategoryFromCode(pattern.sample, t, name);
      const { categories } = await loadLabelSettings();
      setLabelCategories(categories);
      if (category) feedback.success(t('labelCategories.created', { name: category.name }));
    } catch (error) {
      console.error('Create category error:', error);
    }
  };

  const handleNeverAskPattern = async () => {
    const pattern = newPatternPrompt;
    setNewPatternPrompt(null);
    if (pattern) await ignorePattern(pattern.signature);
  };

  const labelInfo = useMemo(() => labelOfItem({ code: displayText }, labelCategories), [displayText, labelCategories]);
  const gs1Info = useMemo(() => parseGs1(displayText), [displayText]);

  // 기록 항목의 메모·수량 (스캔 직후엔 저장이 조금 늦을 수 있어 한 번 더 읽는다)
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState('');
  const [quantity, setQuantity] = useState(null);
  const [historyItemFound, setHistoryItemFound] = useState(false);
  useEffect(() => {
    if (!displayText || isGeneratedCode) return undefined;
    let cancelled = false;
    const load = async (retry) => {
      const item = await findHistoryItem(groupId, displayText);
      if (cancelled) return;
      if (item) {
        setHistoryItemFound(true);
        setMemo(item.memo || '');
        setMemoSaved(item.memo || '');
        setQuantity(typeof item.quantity === 'number' ? item.quantity : null);
      } else if (retry) {
        setTimeout(() => load(false), 800);
      }
    };
    load(true);
    return () => { cancelled = true; };
  }, [displayText, groupId, isGeneratedCode]);

  const saveMemo = useCallback(async () => {
    const value = memo.trim();
    if (value === memoSaved) return;
    try {
      const ok = await updateHistoryItem(groupId, displayText, { memo: value || undefined });
      if (ok) {
        setMemoSaved(value);
        feedback.success(t('memo.saved'));
      }
    } catch (error) {
      console.error('Save memo error:', error);
    }
  }, [memo, memoSaved, groupId, displayText, feedback, t]);

  const changeQuantity = useCallback(async (delta) => {
    const next = Math.max(0, (quantity ?? 1) + delta);
    setQuantity(next);
    try {
      await updateHistoryItem(groupId, displayText, { quantity: next });
    } catch (error) {
      console.error('Save quantity error:', error);
    }
  }, [quantity, groupId, displayText]);

  // 저장된 그룹 이름 로드 (메타 줄 표시용)
  useEffect(() => {
    if (!groupId) {
      setGroupName('');
      return;
    }
    if (groupId === 'default') {
      setGroupName(t('groupEdit.defaultGroup'));
      return;
    }
    if (groupId === 'generated') {
      setGroupName(t('history.generatedGroup'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const groupsData = await AsyncStorage.getItem('scanGroups');
        const groups = groupsData ? JSON.parse(groupsData) : [];
        const group = Array.isArray(groups) ? groups.find(g => g.id === groupId) : null;
        if (!cancelled) setGroupName(group?.name || '');
      } catch (error) {
        console.error('Load group name error:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, t]);

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
    // 확인 버튼이 있는 Alert는 흐름을 막는다. 가벼운 성공은 토스트 + 햅틱
    feedback.success(t('result.copySuccessMessage'));
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
      if (urlOpenMode === 'safari' || urlOpenMode === 'default') {
        // 'default' 모드는 설정 화면에 있었지만 처리 분기가 없어 인앱 웹뷰로 열리고 있었다
        try {
          await Linking.openURL(urlToOpen);
        } catch (error) {
          console.error('Open URL error:', error);
          Alert.alert(t('result.error'), t('result.openUrlFailed') || 'Failed to open URL');
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
            // RN Linking은 intent:// URI를 해석하지 못한다. Android Chrome의 navigate 스킴을 쓰고 안 되면 기본 브라우저
            const chromeNavigateUrl = `googlechrome://navigate?url=${encodeURIComponent(urlToOpen)}`;
            try {
              await Linking.openURL(chromeNavigateUrl);
            } catch {
              await Linking.openURL(urlToOpen);
            }
          }
        } catch (error) {
          console.error('Open URL error:', error);
          Alert.alert(t('result.error'), t('result.openUrlFailed') || 'Failed to open URL');
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
      const { status } = await MediaLibrary.requestPermissionsAsync(true);

      if (status !== 'granted') {
        Alert.alert(
          t('result.permissionDenied'),
          t('result.permissionDeniedMessage')
        );
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(photoUri);
      // 앨범 정리는 읽기 권한이 필요하다. 쓰기 전용 권한(Android 사진 정책)에서는 실패하므로
      // 사진은 이미 저장된 것으로 보고 앨범 정리 실패는 무시한다
      try {
        const album = await MediaLibrary.getAlbumAsync('QR Scanner');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('QR Scanner', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch (albumError) {
        console.warn('Album organize skipped:', albumError?.message);
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
      // RN Share는 Android에서 url(파일)을 무시하고 글자만 보낸다 → 파일을 실제로 넘기는 expo-sharing
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(photoUri, { mimeType: 'image/jpeg', dialogTitle: t('result.scanPhoto') });
      } else {
        await Share.share({ url: photoUri, message: t('result.scanPhoto') });
      }
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

      feedback.success(t('result.editSuccessMessage'));
      setIsEditing(false);
      router.back();
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

              feedback.success(t('result.deleteSuccessMessage'));
              router.back();
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
    // 생성된 코드인 경우 저장된 스타일 데이터로 편집
    if (isGeneratedCode && parsedGeneratorData) {
      const { codeMode, qrStyle, barcodeSettings, frameId, barcodeFormat } = parsedGeneratorData;

      if (codeMode === 'qr') {
        const { type, parsedData } = detectDataType(displayText);
        router.push({
          pathname: '/(tabs)/generator',
          params: {
            initialMode: 'qr',
            initialType: type,
            initialData: JSON.stringify(parsedData),
            // 저장된 QR 스타일 전달
            initialQrStyle: qrStyle ? JSON.stringify(qrStyle) : '',
            initialFrameId: frameId || '',
          },
        });
      } else {
        router.push({
          pathname: '/(tabs)/generator',
          params: {
            initialMode: 'barcode',
            initialBarcodeFormat: barcodeFormat || 'code128',
            initialBarcodeValue: displayText,
            // 저장된 바코드 설정 전달
            initialBarcodeSettings: barcodeSettings ? JSON.stringify(barcodeSettings) : '',
          },
        });
      }
      return;
    }

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
      // barcodeType을 bcid 형식으로 매핑 (GeneratorScreen에서 사용하는 형식)
      const formatMap = {
        'code_128': 'code128',
        'code128': 'code128',
        'ean_13': 'ean13',
        'ean13': 'ean13',
        'ean_8': 'ean8',
        'ean8': 'ean8',
        'upc_a': 'upca',
        'upca': 'upca',
        'upc_e': 'upce',
        'upce': 'upce',
        'code_39': 'code39',
        'code39': 'code39',
        'itf': 'interleaved2of5',
        'itf_14': 'itf14',
        'itf14': 'itf14',
        'codabar': 'rationalizedCodabar',
        'datamatrix': 'datamatrix',
        'qr': 'code128', // fallback
        'qrcode': 'code128',
      };
      const mappedFormat = formatMap[barcodeType.toLowerCase()] || 'code128';

      // 바코드 타입이 잠겨있는지 확인
      const navigateToGenerator = () => {
        router.push({
          pathname: '/(tabs)/generator',
          params: {
            initialMode: 'barcode',
            initialBarcodeFormat: mappedFormat,
            initialBarcodeValue: displayText,
          },
        });
      };

      if (isBarcodeTypeLocked(mappedFormat)) {
        const featureId = getBarcodeFeatureId(mappedFormat);
        if (featureId) {
          showUnlockAlert(featureId, navigateToGenerator);
        } else {
          // featureId가 없으면 바로 이동
          navigateToGenerator();
        }
      } else {
        navigateToGenerator();
      }
    }
  };

  // 메타 한 줄: 타입 · 스캔 시각 · 그룹 · (N회 스캔) — 값이 없는 항목은 생략
  const metaItems = [
    formatBarcodeType(barcodeType),
    scanTimestamp ? formatDateTime(scanTimestamp) : '',
    groupName,
    count > 1 ? t('result.scanCountTimes', { count }) : '',
    typeof location === 'string' && location ? `${t('result.location')} ${location}` : '',
  ].filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 컴팩트 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 50 : insets.top + 12 }]}>
        <MaterialPressable
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isGeneratedCode ? (t('result.generatedTitle') || '생성 결과') : t('result.title')}
        </Text>
        {isFromHistory ? (
          <MaterialPressable
            style={styles.headerButton}
            onPress={handleDelete}
            accessibilityLabel={t('common.delete')}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </MaterialPressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <NewLabelPatternModal

        visible={!!newPatternPrompt}

        pattern={newPatternPrompt}

        categories={labelCategories}

        onCreate={handleCreateCategory}

        onSkip={() => setNewPatternPrompt(null)}

        onNeverAsk={handleNeverAskPattern}

      />

      <FeedbackToastHost />
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* 메인 데이터 카드 */}
        <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* 배지 줄: 콘텐츠 종류(왼쪽) · 중복 스캔(오른쪽). 바코드 타입은 메타 줄, EC 레벨은 하단 카드로 */}
          {((isQRCode && parsedContent.type !== QR_CONTENT_TYPES.TEXT) || showDuplicate) && (
            <View style={styles.badgeRow}>
              {isQRCode && parsedContent.type !== QR_CONTENT_TYPES.TEXT ? (
                <View style={[styles.typeBadge, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={parsedContent.icon} size={14} color={colors.primaryText} />
                  <Text style={[styles.typeBadgeText, { color: colors.primaryText }]}>
                    {getContentTypeLabel(parsedContent.type)}
                  </Text>
                </View>
              ) : <View />}
              {showDuplicate && (
                <View style={[styles.duplicateBadge, { backgroundColor: colors.warningSoft }]}>
                  <Ionicons name="repeat" size={13} color={colors.warning} />
                  <Text style={[styles.typeBadgeText, { color: colors.warning }]}>
                    {t('result.duplicateScan')} · {count}{t('result.duplicateCount')}
                  </Text>
                </View>
              )}
            </View>
          )}

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
                {displayText ? (
                  <Text style={[styles.dataText, displayText.length <= 80 && styles.dataTextLarge, { color: colors.text }]} selectable>
                    {displayText}
                  </Text>
                ) : (
                  <Text style={[styles.dataText, { color: colors.textSecondary, fontStyle: 'italic' }]}>
                    {t('result.noData') || '데이터 없음'}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>

          {/* QR 콘텐츠 정보 표시 (WiFi, 위치, 연락처, 일정 등) */}
          {isQRCode && parsedContent.type !== QR_CONTENT_TYPES.TEXT && parsedContent.type !== QR_CONTENT_TYPES.URL && (
            <QRContentInfoDisplay
              parsedContent={parsedContent}
              colors={colors}
              fonts={fonts}
              t={t}
            />
          )}

          {/* GS1 (GTIN·로트·유통기한·수량) */}
          {!isEditing && gs1Info && (
            <View style={[styles.labelCard, { backgroundColor: colors.inputBackground }]}>
              <View style={styles.labelHeader}>
                <Ionicons name="barcode-outline" size={14} color={colors.primary} />
                <Text style={[styles.labelTitle, { color: colors.primary, fontFamily: fonts.semiBold }]}>GS1</Text>
              </View>
              {gs1Info.ais.map(({ ai, value }, index) => {
                const shown = gs1DisplayValue(ai, value);
                return (
                  <MaterialPressable
                    key={`${ai}-${index}`}
                    style={styles.labelRow}
                    onPress={async () => {
                      await Clipboard.setStringAsync(shown);
                      feedback.success(t('result.copySuccessMessage'));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${gs1AiLabel(ai, t)}: ${shown}`}
                  >
                    <Text style={[styles.labelName, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
                      {gs1AiLabel(ai, t)}
                    </Text>
                    <Text style={[styles.labelValue, { color: colors.text, fontFamily: fonts.regular }]} selectable numberOfLines={2}>
                      {shown}
                    </Text>
                  </MaterialPressable>
                );
              })}
            </View>
          )}

          {/* 수량 (수량 누적으로 저장된 항목) */}
          {!isEditing && historyItemFound && quantity !== null && (
            <View style={[styles.labelCard, styles.quantityRow, { backgroundColor: colors.inputBackground }]}>
              <Text style={[styles.labelName, { color: colors.textSecondary, fontFamily: fonts.medium, flex: 1 }]}>{t('quantity.title')}</Text>
              <MaterialPressable style={[styles.qtyButton, { borderColor: colors.border }]} onPress={() => changeQuantity(-1)} accessibilityLabel={t('quantity.decrease')}>
                <Ionicons name="remove" size={20} color={colors.text} />
              </MaterialPressable>
              <Text style={[styles.qtyValue, { color: colors.text, fontFamily: fonts.bold }]}>{quantity}</Text>
              <MaterialPressable style={[styles.qtyButton, { borderColor: colors.border }]} onPress={() => changeQuantity(1)} accessibilityLabel={t('quantity.increase')}>
                <Ionicons name="add" size={20} color={colors.text} />
              </MaterialPressable>
            </View>
          )}

          {/* 라벨 필드 (구분자로 나뉜 값을 카테고리의 필드 이름으로) */}
          {!isEditing && labelInfo && (
            <View style={[styles.labelCard, { backgroundColor: colors.inputBackground }]}>
              <MaterialPressable
                style={styles.labelHeader}
                onPress={() => router.push({ pathname: '/label-category-edit', params: { id: labelInfo.category.id } })}
                accessibilityRole="button"
              >
                <Ionicons name="pricetags-outline" size={14} color={colors.primary} />
                <Text style={[styles.labelTitle, { color: colors.primary, fontFamily: fonts.semiBold }]}>{labelInfo.category.name}</Text>
                <Text style={[styles.labelHint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('labelCategories.edit')}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </MaterialPressable>
              {labelInfo.values.map((value, index) => (
                <MaterialPressable
                  key={index}
                  style={styles.labelRow}
                  onPress={async () => {
                    if (!value) return;
                    await Clipboard.setStringAsync(value);
                    feedback.success(t('result.copySuccessMessage'));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${fieldNameAt(labelInfo.category, index, t)}: ${value || '—'}`}
                >
                  <Text style={[styles.labelName, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
                    {fieldNameAt(labelInfo.category, index, t)}
                  </Text>
                  <Text style={[styles.labelValue, { color: value ? colors.text : colors.textTertiary, fontFamily: fonts.regular }]} selectable numberOfLines={2}>
                    {value || '—'}
                  </Text>
                </MaterialPressable>
              ))}
            </View>
          )}

          {/* 액션 버튼들 */}
          {!isEditing ? (
            <View style={styles.actionSection}>
              {/* QR 타입별 액션 버튼 */}
              <QRActionButtons
                parsedContent={parsedContent}
                colors={colors}
                fonts={fonts}
                t={t}
                onCopy={handleCopy}
                onShare={handleShare}
                onOpenUrl={handleOpenUrl}
                extraActions={[{
                  icon: isGeneratedCode ? 'create-outline' : 'qr-code-outline',
                  label: isGeneratedCode ? (t('result.editCode') || '편집') : (t('result.regenerateCode') || '코드 재생성'),
                  onPress: handleRegenerateCode,
                }]}
              />
            </View>
          ) : (
            <View style={styles.editActions}>
              <MaterialPressable
                style={[styles.editButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={handleEditToggle}
              >
                <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
              </MaterialPressable>
              <MaterialPressable
                style={[styles.editButton, styles.saveEditButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveEditButtonText}>{t('common.save')}</Text>
              </MaterialPressable>
            </View>
          )}

          {/* 메타 정보: 타입 · 스캔 시각 · 그룹 · 스캔 횟수 */}
          {metaItems.length > 0 && (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Ionicons name={isQRCode ? "qr-code-outline" : "barcode-outline"} size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {metaItems.join(' · ')}
              </Text>
            </View>
          )}
        </View>

        {/* 메모 (기록에 저장된 항목만) */}
        {!isEditing && historyItemFound && (
          <View style={[styles.sideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.labelHeader}>
              <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.labelTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('memo.title')}</Text>
              {memo.trim() !== memoSaved && (
                <MaterialPressable onPress={saveMemo} style={styles.memoSaveButton} accessibilityRole="button">
                  <Text style={[styles.labelHint, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('memo.save')}</Text>
                </MaterialPressable>
              )}
            </View>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              onBlur={saveMemo}
              placeholder={t('memo.placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
              style={[styles.memoInput, { color: colors.text, fontFamily: fonts.regular }]}
            />
          </View>
        )}

        {/* 중복 스캔: 배지는 메인 카드에, 여기는 스캔 시각 목록(두 번 이상일 때만) */}
        {showDuplicate && allScanTimes.length > 1 && (
          <View style={[styles.sideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.labelHeader}>
              <Ionicons name="repeat" size={15} color={colors.textSecondary} />
              <Text style={[styles.labelTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                {t('result.duplicateScan')} ({count}{t('result.duplicateCount')})
              </Text>
            </View>
            {allScanTimes.slice().reverse().slice(0, 5).map((time, index) => (
              <Text key={index} style={[styles.scanTimeItem, { color: colors.textSecondary }]}>
                {allScanTimes.length - index}. {formatDateTime(time)}
              </Text>
            ))}
          </View>
        )}

        {/* 생성 코드 미리보기 */}
        {isGeneratedCode && (
          <View style={[styles.photoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.photoHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.photoLabel, { color: colors.text }]}>
                  {t('result.generatedPreview') || '생성 미리보기'}
                </Text>
              </View>
            </View>
            {thumbnail ? (
              <Image
                source={{ uri: thumbnail }}
                style={[styles.scanPhoto, { backgroundColor: 'white' }]}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.scanPhoto, styles.barcodePreviewContainer, { backgroundColor: colors.raised }]}>
                <Ionicons name="barcode-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.barcodePreviewType, { color: colors.textSecondary }]}>
                  {formatBarcodeType(barcodeType) || 'BARCODE'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 스캔 사진 */}
        {hasPhoto && (
          <View style={[styles.photoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.photoHeader}>
              <Text style={[styles.photoLabel, { color: colors.text }]}>{t('result.scanPhoto')}</Text>
              <View style={styles.photoActions}>
                <MaterialPressable
                  style={[styles.photoActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSavePhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t('result.savePhoto')}
                >
                  <Ionicons name="download-outline" size={18} color="#fff" />
                </MaterialPressable>
                <MaterialPressable
                  style={[styles.photoActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSharePhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t('result.share')}
                >
                  <Ionicons name="share-outline" size={18} color="#fff" />
                </MaterialPressable>
              </View>
            </View>
            <MaterialPressable
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
            </MaterialPressable>
          </View>
        )}

        {/* QR 코드 오류 검증 레벨: L·M·Q·H 막대 중 현재 단계만 채운다 */}
        {ecLevelInfo && isQRCode && (
          <View style={[styles.sideCard, styles.ecCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.ecHeader}>
              <Text style={[styles.labelTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                {t('result.errorCorrectionLevel')}
              </Text>
              <Text style={[styles.labelHint, { color: colors.textSecondary }]}>
                {t('result.recoveryRate')}: {ecLevelInfo.percent}
              </Text>
            </View>
            <View style={styles.ecTitleRow}>
              <Text style={[styles.ecLevelName, { color: colors.text, fontFamily: fonts.bold }]}>{ecLevelInfo.desc}</Text>
              <Text style={[styles.ecLevelCode, { color: colors.primaryText }]}>{ecLevelInfo.level}</Text>
            </View>
            <View
              style={styles.ecBars}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${t('result.errorCorrectionLevel')}: ${ecLevelInfo.level}`}
            >
              {['L', 'M', 'Q', 'H'].map((level) => {
                const isActive = ecLevel?.toUpperCase() === level;
                const levelPercent = { L: '7%', M: '15%', Q: '25%', H: '30%' }[level];
                return (
                  <View key={level} style={styles.ecBarCell}>
                    <View style={[styles.ecBar, { backgroundColor: isActive ? colors.primary : colors.border }]} />
                    <Text style={[styles.ecBarLabel, { color: isActive ? colors.text : colors.textTertiary, fontWeight: isActive ? '600' : '400' }]}>
                      {level} · {levelPercent}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 배너 광고 - 스크롤 맨 아래 */}
        <AdBanner wrapperStyle={{ paddingHorizontal: 0 }} />
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
    paddingBottom: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ android: { borderRadius: 22, overflow: 'hidden' }, default: {} }),
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
    gap: 12,
  },
  mainCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: RADIUS.badge,
    gap: 6,
  },
  duplicateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyValue: {
    fontSize: 20,
    minWidth: 36,
    textAlign: 'center',
  },
  memoSaveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  memoInput: {
    fontSize: 15,
    minHeight: 44,
    textAlignVertical: 'top',
    paddingVertical: 4,
  },
  labelCard: {
    borderRadius: RADIUS.control,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  sideCard: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  labelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  labelTitle: {
    flex: 1,
    fontSize: 13,
  },
  labelHint: {
    fontSize: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
  },
  labelName: {
    width: 88,
    fontSize: 13,
    paddingTop: 1,
  },
  labelValue: {
    flex: 1,
    fontSize: 15,
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
    fontFamily: MONO,
    fontSize: 15,
    lineHeight: 22,
  },
  dataTextLarge: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
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
    ...Platform.select({ android: { borderRadius: 20, minHeight: 48, justifyContent: 'center', overflow: 'hidden' }, default: {} }),
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
  scanTimeItem: {
    fontSize: 12,
    marginVertical: 2,
    fontFamily: MONO,
  },
  photoCard: {
    borderRadius: RADIUS.group,
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
    ...Platform.select({ android: { borderRadius: 18, overflow: 'hidden' }, default: {} }),
  },
  scanPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  barcodePreviewContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  barcodePreviewType: {
    fontSize: 18,
    fontWeight: '700',
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
  actionSection: {
    gap: 12,
  },
  ecCard: {
    paddingVertical: 16,
    gap: 12,
  },
  ecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ecTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  ecLevelName: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  ecLevelCode: {
    fontFamily: MONO,
    fontSize: 14,
  },
  ecBars: {
    flexDirection: 'row',
    gap: 6,
  },
  ecBarCell: {
    flex: 1,
    gap: 6,
  },
  ecBar: {
    height: 8,
    borderRadius: 4,
  },
  ecBarLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
});
