// screens/MultiCodeResultsScreen.js
// 여러 코드 인식 모드 결과 화면 - 감지된 코드 목록 표시 및 개별/전체 저장

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { parseQRContent, QR_CONTENT_TYPES } from '../utils/qrContentParser';

export default function MultiCodeResultsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams();
  // 스캐너에서 선택돼 있던 그룹. 예전엔 무조건 'default'에 저장했다
  const groupId = params.groupId || 'default';
  const groupName = params.groupName || t('groupEdit.defaultGroup');

  const [codes, setCodes] = useState([]);
  const [savedCodes, setSavedCodes] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const allowLeaveRef = useRef(false);

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

  // 히스토리에 코드 저장 (스캐너에서 선택한 그룹으로)
  const saveCodeToHistory = useCallback(async (codeValue, barcodeType = 'qr') => {
    try {
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };

      if (!historyByGroup[groupId]) {
        historyByGroup[groupId] = [];
      }

      const currentHistory = historyByGroup[groupId];
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
        historyByGroup[groupId] = [updatedItem, ...currentHistory].slice(0, 1000);
      } else {
        // 새 항목 추가
        const record = {
          code: codeValue,
          timestamp: now,
          count: 1,
          scanTimes: [now],
          type: barcodeType,
        };
        historyByGroup[groupId] = [record, ...currentHistory].slice(0, 1000);
      }

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
    } catch (error) {
      console.error('Failed to save to history:', error);
      throw error;
    }
  }, [groupId]);

  // 개별 코드 저장
  const handleSaveCode = useCallback(async (code, index) => {
    if (savedCodes.has(index) || isSaving) return;

    try {
      await saveCodeToHistory(code.value, code.type);
      setSavedCodes(prev => new Set([...prev, index]));
      feedback.success(t('multiCodeResults.codeSaved'));
    } catch (error) {
      console.error('Failed to save code:', error);
      feedback.error(t('multiCodeResults.saveFailed'));
    }
  }, [savedCodes, isSaving, saveCodeToHistory, t, feedback]);

  // 모두 저장. 저장 중 다시 누르면 같은 코드가 두 번 들어가므로 막는다
  const handleSaveAll = useCallback(async () => {
    if (isSaving) return false;
    const unsavedIndices = codes
      .map((_, idx) => idx)
      .filter(idx => !savedCodes.has(idx));

    if (unsavedIndices.length === 0) return true;

    setIsSaving(true);
    const done = new Set(savedCodes);
    try {
      for (const idx of unsavedIndices) {
        const code = codes[idx];
        await saveCodeToHistory(code.value, code.type);
        done.add(idx);
      }
      feedback.success(t('multiCodeResults.savedToGroup', { count: unsavedIndices.length, group: groupName }));
      return true;
    } catch (error) {
      console.error('Failed to save all codes:', error);
      feedback.error(t('multiCodeResults.saveFailed'));
      return false;
    } finally {
      setSavedCodes(done);
      setIsSaving(false);
    }
  }, [codes, savedCodes, isSaving, saveCodeToHistory, t, feedback, groupName]);

  // 클립보드에 복사
  const handleCopy = useCallback(async (value) => {
    await Clipboard.setStringAsync(value);
    feedback.success(t('common.copied'));
  }, [t, feedback]);

  // 저장 안 한 코드가 있으면 나가기 전에 묻는다 (닫기 버튼·하드웨어 뒤로가기·제스처 모두)
  const unsavedCount = codes.length - savedCodes.size;
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current || unsavedCount <= 0 || isSaving) return;
      e.preventDefault();
      Alert.alert(
        t('multiCodeResults.unsavedTitle'),
        t('multiCodeResults.unsavedMessage', { count: unsavedCount }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('multiCodeResults.discard'),
            style: 'destructive',
            onPress: () => {
              allowLeaveRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: t('multiCodeResults.saveAll'),
            onPress: async () => {
              const ok = await handleSaveAll();
              if (ok) {
                allowLeaveRef.current = true;
                navigation.dispatch(e.data.action);
              }
            },
          },
        ]
      );
    });
    return sub;
  }, [navigation, unsavedCount, isSaving, handleSaveAll, t]);

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
              accessibilityRole="button"
              accessibilityLabel={t('common.copy')}
            >
              <Ionicons name="copy-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isSaved ? colors.success : colors.primary }
              ]}
              onPress={() => handleSaveCode(item, index)}
              disabled={isSaved || isSaving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? t('multiCodeResults.saved') : t('common.save')}
              accessibilityState={{ disabled: isSaved || isSaving }}
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('multiCodeResults.title')} ({codes.length})
          </Text>
          {/* 어느 그룹에 저장되는지 보여준다 */}
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
            {t('multiCodeResults.saveTo', { group: groupName })}
          </Text>
        </View>
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
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 하단 버튼 */}
      {codes.length > 0 && (
        <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity
            style={[
              styles.saveAllButton,
              { backgroundColor: allSaved ? colors.success : colors.primary }
            ]}
            onPress={handleSaveAll}
            disabled={allSaved || isSaving}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: allSaved || isSaving, busy: isSaving }}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name={allSaved ? "checkmark-circle" : "bookmark"}
                size={22}
                color="#fff"
              />
            )}
            <Text style={[styles.saveAllButtonText, { fontFamily: fonts.semiBold }]}>
              {allSaved
                ? t('multiCodeResults.allSaved')
                : isSaving
                  ? t('common.saving')
                  : `${t('multiCodeResults.saveAll')} (${unsavedCount})`}
            </Text>
          </TouchableOpacity>
        </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 11,
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
