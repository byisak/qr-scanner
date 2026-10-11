// screens/MultiCodeResultsScreen.js
// 여러 코드 인식 모드 결과 화면 - 감지된 코드 목록 표시 및 개별/전체 저장

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { parseQRContent, QR_CONTENT_TYPES } from '../utils/qrContentParser';
import { parseLabel, labelOfItem, formatLabelSummary } from '../utils/labelParser';
import { loadLabelSettings, addDiscovered } from '../utils/labelCategories';

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
  const [labelSettings, setLabelSettings] = useState({ categories: [], autoSplit: true });
  useEffect(() => { loadLabelSettings().then(setLabelSettings).catch(() => {}); }, []);
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
        // 라벨 카테고리에 맞으면 필드 값도 같이 저장. 처음 보는 패턴은 설정의 "발견된 형식"에 쌓는다
        const label = labelSettings.autoSplit ? parseLabel(codeValue, labelSettings.categories) : null;
        if (labelSettings.autoSplit && !label) addDiscovered(codeValue).catch(() => {});
        const record = {
          code: codeValue,
          timestamp: now,
          count: 1,
          scanTimes: [now],
          type: barcodeType,
          ...(label ? { categoryId: label.categoryId, values: label.values } : {}),
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

  // 왼쪽 40x40 종류 배지 (기록 화면과 같은 규칙): URL은 강조, 2D는 성공, 1D 바코드는 주의, 그 밖의 QR은 중립
  const getKindBadge = (item, isQRCode, parsedContent) => {
    if (isQRCode) {
      if (parsedContent && parsedContent.type === QR_CONTENT_TYPES.URL) {
        return { label: 'URL', bg: colors.primarySoft, fg: colors.primaryText };
      }
      return { label: 'QR', bg: colors.raised, fg: colors.textSecondary };
    }
    const twoD = { datamatrix: 'DM', pdf417: 'PDF', aztec: 'AZ' };
    const type = String(item.type || '').toLowerCase();
    if (twoD[type]) return { label: twoD[type], bg: colors.successSoft, fg: colors.success };
    return { label: '1D', bg: colors.warningSoft, fg: colors.warning };
  };

  const renderCodeItem = ({ item, index }) => {
    const isSaved = savedCodes.has(index);
    const isQRCode = !item.type || item.type === 'qr' || item.type === 'qrcode';
    const parsedContent = isQRCode ? parseQRContent(item.value) : null;
    const kind = getKindBadge(item, isQRCode, parsedContent);
    const first = index === 0;
    const last = index === codes.length - 1;

    return (
      <MaterialPressable
        style={[
          styles.item,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderTopWidth: first ? 1 : 0,
            borderBottomWidth: last ? 1 : StyleSheet.hairlineWidth,
            borderBottomColor: last ? colors.border : colors.borderLight,
          },
          first && styles.itemFirst,
          last && styles.itemLast,
        ]}
        onPress={() => handleCopy(item.value)}
        activeOpacity={0.7}
      >
        <View style={[styles.lead, { backgroundColor: kind.bg }]}>
          <Text style={[styles.leadText, { color: kind.fg }]}>{kind.label}</Text>
        </View>

        <View style={styles.itemInfo}>
          {/* 1줄: 스캔값 */}
          <Text style={[styles.codeValue, { color: colors.text }]} numberOfLines={2}>
            {item.value}
          </Text>
          {(() => {
            const summary = formatLabelSummary(labelOfItem({ code: item.value }, labelSettings.categories), 3, t);
            return summary ? (
              <Text style={[styles.labelSummary, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1} ellipsizeMode="middle">
                {summary}
              </Text>
            ) : null;
          })()}

          {/* 2줄: 바코드타입, 콘텐츠타입 뱃지 */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.raised }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                {getTypeDisplayName(item.type)}
              </Text>
            </View>

            {/* 콘텐츠 타입 (QR 코드이고 TEXT가 아닌 경우만) */}
            {parsedContent && parsedContent.type !== QR_CONTENT_TYPES.TEXT && (
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={parsedContent.icon} size={11} color={colors.primaryText} />
                <Text style={[styles.badgeText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>
                  {getContentTypeLabel(parsedContent.type)}
                </Text>
              </View>
            )}

            {/* 저장됨 표시 */}
            {isSaved && (
              <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success, fontFamily: fonts.semiBold }]}>
                  {t('multiCodeResults.saved') || '저장됨'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 액션 버튼들 */}
        <View style={styles.itemActions}>
          <MaterialPressable
            style={styles.actionButton}
            onPress={() => handleCopy(item.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.copy')}
          >
            <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
          </MaterialPressable>
          <MaterialPressable
            style={[
              styles.actionButton,
              { backgroundColor: isSaved ? colors.successSoft : colors.primarySoft }
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
              color={isSaved ? colors.success : colors.primaryText}
            />
          </MaterialPressable>
        </View>
      </MaterialPressable>
    );
  };

  const saveAllDisabled = allSaved || isSaving;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* 하위 화면 헤더: 뒤로 · 제목(저장 그룹) */}
      <View style={styles.header}>
        <MaterialPressable
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {t('multiCodeResults.title')} ({codes.length})
          </Text>
          {/* 어느 그룹에 저장되는지 보여준다 */}
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
            {t('multiCodeResults.saveTo', { group: groupName })}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* 코드 목록 */}
      {codes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.raised }]}>
            <Ionicons name="qr-code-outline" size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
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

      {/* 하단 버튼: 보조(닫기) + 주(모두 저장) */}
      {codes.length > 0 && (
        <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderTopColor: colors.borderLight, paddingBottom: 12 + insets.bottom }]}>
          <MaterialPressable
            style={[styles.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {t('common.close')}
            </Text>
          </MaterialPressable>
          <MaterialPressable
            style={[
              styles.saveAllButton,
              { backgroundColor: allSaved ? colors.successSoft : isSaving ? colors.raised : colors.primary }
            ]}
            onPress={handleSaveAll}
            disabled={saveAllDisabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: saveAllDisabled, busy: isSaving }}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.textTertiary} />
            ) : (
              <Ionicons
                name={allSaved ? "checkmark-circle" : "bookmark"}
                size={20}
                color={allSaved ? colors.success : '#FFFFFF'}
              />
            )}
            <Text
              style={[
                styles.saveAllButtonText,
                { color: allSaved ? colors.success : isSaving ? colors.textTertiary : '#FFFFFF', fontFamily: fonts.semiBold },
              ]}
              numberOfLines={1}
            >
              {allSaved
                ? t('multiCodeResults.allSaved')
                : isSaving
                  ? t('common.saving')
                  : `${t('multiCodeResults.saveAll')} (${unsavedCount})`}
            </Text>
          </MaterialPressable>
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    ...TYPE.screenTitle,
  },
  headerSubtitle: {
    ...TYPE.caption,
    marginTop: 1,
  },
  placeholder: {
    width: SIZE.touch,
  },
  listContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  itemFirst: {
    borderTopLeftRadius: RADIUS.group,
    borderTopRightRadius: RADIUS.group,
  },
  itemLast: {
    borderBottomLeftRadius: RADIUS.group,
    borderBottomRightRadius: RADIUS.group,
  },
  lead: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '500',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  codeValue: {
    fontFamily: MONO,
    fontSize: 14,
    lineHeight: 20,
  },
  labelSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: SPACE.gap,
    paddingHorizontal: SPACE.screen,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flex: 1,
    height: SIZE.primaryButton,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveAllButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    gap: 8,
    overflow: 'hidden',
  },
  saveAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
});
