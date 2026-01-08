// screens/MultiCodeResultsScreen.js
// 여러 코드 인식 모드 결과 화면 - 감지된 코드 목록 표시 및 개별/전체 저장

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors } from '../constants/Colors';
import { parseQRContent, QR_CONTENT_TYPES } from '../utils/qrContentParser';

export default function MultiCodeResultsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { t, fonts } = useLanguage();
  const colors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams();

  const [codes, setCodes] = useState([]);
  const [savedCodes, setSavedCodes] = useState(new Set());
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState('');

  useEffect(() => {
    // params에서 바코드 데이터 파싱 및 빈값 필터링
    if (params.detectedBarcodes) {
      try {
        const parsed = JSON.parse(params.detectedBarcodes);
        // 빈값 필터링: value가 없거나 빈 문자열, "null", "undefined" 제외
        const filtered = (parsed || []).filter(code => {
          if (!code.value) return false;
          const value = String(code.value).trim();
          return value.length > 0 && value !== 'null' && value !== 'undefined';
        });
        setCodes(filtered);
      } catch (e) {
        console.error('Failed to parse barcodes:', e);
        setCodes([]);
      }
    }
  }, [params.detectedBarcodes]);

  // 토스트 표시
  const showToast = (message) => {
    setSaveToastMessage(message);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2000);
  };

  // 히스토리에 코드 저장
  const saveCodeToHistory = useCallback(async (codeValue, barcodeType = 'qr') => {
    try {
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };

      if (!historyByGroup.default) {
        historyByGroup.default = [];
      }

      const currentHistory = historyByGroup.default;
      const existingIndex = currentHistory.findIndex(item => item.code === codeValue);
      const now = Date.now();

      if (existingIndex !== -1) {
        // 중복 - 기존 항목 업데이트
        const existingItem = currentHistory[existingIndex];
        const scanTimes = existingItem.scanTimes || [existingItem.timestamp];
        scanTimes.push(now);

        const updatedItem = {
          ...existingItem,
          timestamp: now,
          count: (existingItem.count || 1) + 1,
          scanTimes: scanTimes,
          type: barcodeType,
        };

        currentHistory.splice(existingIndex, 1);
        historyByGroup.default = [updatedItem, ...currentHistory].slice(0, 1000);
      } else {
        // 새 항목 추가
        const record = {
          code: codeValue,
          timestamp: now,
          count: 1,
          scanTimes: [now],
          type: barcodeType,
        };
        historyByGroup.default = [record, ...currentHistory].slice(0, 1000);
      }

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
    } catch (error) {
      console.error('Failed to save to history:', error);
      throw error;
    }
  }, []);

  // 개별 코드 저장
  const handleSaveCode = useCallback(async (code, index) => {
    if (savedCodes.has(index)) return;

    try {
      await saveCodeToHistory(code.value, code.type);
      setSavedCodes(prev => new Set([...prev, index]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('multiCodeResults.codeSaved') || '저장됨');
    } catch (error) {
      console.error('Failed to save code:', error);
      Alert.alert('Error', 'Failed to save code');
    }
  }, [savedCodes, saveCodeToHistory, t]);

  // 모두 저장
  const handleSaveAll = useCallback(async () => {
    try {
      const unsavedIndices = codes
        .map((_, idx) => idx)
        .filter(idx => !savedCodes.has(idx));

      if (unsavedIndices.length === 0) return;

      for (const idx of unsavedIndices) {
        const code = codes[idx];
        await saveCodeToHistory(code.value, code.type);
      }

      setSavedCodes(new Set(codes.map((_, idx) => idx)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`${unsavedIndices.length}${t('multiCodeResults.codesSaved') || '개 코드 저장됨'}`);
    } catch (error) {
      console.error('Failed to save all codes:', error);
      Alert.alert('Error', 'Failed to save codes');
    }
  }, [codes, savedCodes, saveCodeToHistory, t]);

  // 클립보드에 복사
  const handleCopy = useCallback(async (value) => {
    await Clipboard.setStringAsync(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(t('common.copied') || '복사됨');
  }, [t]);

  // 바코드 타입 표시 이름
  const getTypeDisplayName = (type) => {
    const typeMap = {
      'qr': 'QR',
      'ean13': 'EAN-13',
      'ean8': 'EAN-8',
      'code128': 'CODE128',
      'code39': 'CODE39',
      'code93': 'CODE93',
      'upce': 'UPC-E',
      'upca': 'UPC-A',
      'itf14': 'ITF-14',
      'codabar': 'CODABAR',
      'pdf417': 'PDF417',
      'aztec': 'AZTEC',
      'datamatrix': 'DATAMATRIX',
    };
    return typeMap[type] || type?.toUpperCase() || 'QR';
  };

  // 콘텐츠 타입 레이블
  const getContentTypeLabel = (type) => {
    const labels = {
      [QR_CONTENT_TYPES.URL]: t('qrTypes.url') || 'URL',
      [QR_CONTENT_TYPES.PHONE]: t('qrTypes.phone') || '전화',
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

  const allSaved = codes.length > 0 && savedCodes.size === codes.length;

  const renderCodeItem = ({ item, index }) => {
    const isSaved = savedCodes.has(index);
    const isQRCode = !item.type || item.type === 'qr' || item.type === 'qrcode';
    const parsedContent = isQRCode ? parseQRContent(item.value) : null;

    return (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: colors.surface }]}
        onPress={() => handleCopy(item.value)}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemInfo}>
            {/* 1줄: 스캔값 */}
            <Text style={[styles.codeValue, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={2}>
              {item.value}
            </Text>

            {/* 2줄: 바코드타입, 콘텐츠타입 뱃지 */}
            <View style={styles.badgeRow}>
              {/* 바코드 타입 */}
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons
                  name={isQRCode ? 'qr-code' : 'barcode'}
                  size={11}
                  color={colors.primary}
                />
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {getTypeDisplayName(item.type)}
                </Text>
              </View>

              {/* 콘텐츠 타입 (QR 코드이고 TEXT가 아닌 경우만) */}
              {parsedContent && parsedContent.type !== QR_CONTENT_TYPES.TEXT && (
                <View style={[styles.badge, { backgroundColor: parsedContent.color + '15' }]}>
                  <Ionicons name={parsedContent.icon} size={11} color={parsedContent.color} />
                  <Text style={[styles.badgeText, { color: parsedContent.color }]}>
                    {getContentTypeLabel(parsedContent.type)}
                  </Text>
                </View>
              )}

              {/* 저장됨 표시 */}
              {isSaved && (
                <View style={[styles.badge, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                  <Text style={[styles.badgeText, { color: colors.success }]}>
                    {t('multiCodeResults.saved') || '저장됨'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 액션 버튼들 */}
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => handleCopy(item.value)}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isSaved ? colors.success : colors.primary }
              ]}
              onPress={() => handleSaveCode(item, index)}
              disabled={isSaved}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isSaved ? "checkmark" : "bookmark-outline"}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('multiCodeResults.title') || '감지된 코드'} ({codes.length})
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* 코드 목록 */}
      {codes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="qr-code-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary, fontFamily: fonts.medium }]}>
            {t('multiCodeResults.noResults') || '감지된 코드가 없습니다'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={codes}
          renderItem={renderCodeItem}
          keyExtractor={(item, index) => `${item.value}-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 하단 버튼 */}
      {codes.length > 0 && (
        <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.saveAllButton,
              { backgroundColor: allSaved ? colors.success : colors.primary }
            ]}
            onPress={handleSaveAll}
            disabled={allSaved}
            activeOpacity={0.7}
          >
            <Ionicons
              name={allSaved ? "checkmark-circle" : "bookmark"}
              size={22}
              color="#fff"
            />
            <Text style={[styles.saveAllButtonText, { fontFamily: fonts.semiBold }]}>
              {allSaved
                ? (t('multiCodeResults.allSaved') || '모두 저장됨')
                : (t('multiCodeResults.saveAll') || '모두 저장')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 토스트 메시지 */}
      {showSaveToast && (
        <View style={[styles.toast, { backgroundColor: colors.text }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.background} />
          <Text style={[styles.toastText, { color: colors.background, fontFamily: fonts.medium }]}>
            {saveToastMessage}
          </Text>
        </View>
      )}
    </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
  },
  placeholder: {
    width: 36,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  item: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  codeValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  saveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveAllButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastText: {
    fontSize: 14,
  },
});
