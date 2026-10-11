// screens/BarcodeSelectionScreen.js - 바코드 종류 선택 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';

// ✅ 지원되는 바코드 타입 목록
const BARCODE_TYPES = [
  { key: 'qr', name: 'QR 코드', desc: '일반 QR 코드' },
  { key: 'ean13', name: 'EAN-13', desc: '국제 상품 바코드 (13자리)' },
  { key: 'ean8', name: 'EAN-8', desc: '국제 상품 바코드 (8자리)' },
  { key: 'code128', name: 'Code 128', desc: '물류/재고 관리용' },
  { key: 'code39', name: 'Code 39', desc: '산업용 바코드' },
  { key: 'code93', name: 'Code 93', desc: 'Code 39 개선형' },
  { key: 'upce', name: 'UPC-E', desc: '미국 상품 바코드 (축약형)' },
  { key: 'upca', name: 'UPC-A', desc: '미국 상품 바코드 (표준형)' },
  { key: 'pdf417', name: 'PDF417', desc: '2D 바코드 (ID/문서)' },
  { key: 'aztec', name: 'Aztec', desc: '2D 바코드 (교통카드)' },
  { key: 'datamatrix', name: 'Data Matrix', desc: '2D 바코드 (소형 제품)' },
  { key: 'itf14', name: 'ITF-14', desc: '물류 박스 바코드' },
  { key: 'codabar', name: 'Codabar', desc: '도서관/의료용' },
];

export default function BarcodeSelectionScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  // ✅ 기본값: 모든 바코드 타입 활성화
  const [selectedBarcodes, setSelectedBarcodes] = useState(
    BARCODE_TYPES.map((b) => b.key)
  );

  useEffect(() => {
    (async () => {
      try {
        const b = await AsyncStorage.getItem('selectedBarcodes');
        if (b) {
          const parsed = JSON.parse(b);
          setSelectedBarcodes(
            parsed.length > 0
              ? parsed
              : BARCODE_TYPES.map((bt) => bt.key)
          );
        }
      } catch (error) {
        console.error('Load barcode settings error:', error);
      }
    })();
  }, []);

  // ✅ 바코드 선택 저장
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('selectedBarcodes', JSON.stringify(selectedBarcodes));
      } catch (error) {
        console.error('Save barcode settings error:', error);
        // 저장이 state 변화에 묶인 effect라, 되돌리면 저장이 다시 돌아 실패가 반복될 수 있어 안내만
        feedback.error(t('settings.saveFailed'));
      }
    })();
  }, [selectedBarcodes]);

  // ✅ 바코드 타입 토글
  const toggleBarcode = (key) => {
    setSelectedBarcodes((prev) => {
      if (prev.includes(key)) {
        // QR 코드는 최소 1개는 선택되어야 함
        if (key === 'qr' && prev.length === 1) {
          return prev;
        }
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // ✅ 전체 선택/해제
  const toggleAll = () => {
    if (selectedBarcodes.length === BARCODE_TYPES.length) {
      setSelectedBarcodes(['qr']); // 최소 QR 코드는 유지
    } else {
      setSelectedBarcodes(BARCODE_TYPES.map((b) => b.key));
    }
  };

  const allSelected = selectedBarcodes.length === BARCODE_TYPES.length;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 · 전체 선택/해제 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            onPress={() => router.back()}
            style={s.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          인식할 바코드 선택
        </Text>
        <View style={[s.headerSide, s.headerSideRight]}>
          <MaterialPressable onPress={toggleAll} style={s.headerAction} accessibilityRole="button">
            <Text style={[s.headerActionText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>
              {allSelected ? '전체 해제' : '전체 선택'}
            </Text>
          </MaterialPressable>
        </View>
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          선택한 바코드 타입만 인식됩니다{' '}
          <Text style={[s.infoCount, { color: colors.text, fontFamily: fonts.semiBold }]}>
            ({selectedBarcodes.length}개 선택)
          </Text>
        </Text>

        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {BARCODE_TYPES.map((barcode, index) => {
            const isSelected = selectedBarcodes.includes(barcode.key);
            const isQROnly = barcode.key === 'qr' && selectedBarcodes.length === 1;
            const isLast = index === BARCODE_TYPES.length - 1;

            return (
              <MaterialPressable
                key={barcode.key}
                style={[s.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
                onPress={() => toggleBarcode(barcode.key)}
                disabled={isQROnly}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: isQROnly }}
              >
                <View
                  style={[
                    s.checkbox,
                    isSelected
                      ? { backgroundColor: colors.primary }
                      : { borderWidth: 2, borderColor: isDark ? '#4A5260' : colors.textTertiary },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <View style={s.rowText}>
                  <View style={s.rowLabelLine}>
                    <Text style={[s.rowLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                      {barcode.name}
                    </Text>
                    {barcode.key === 'qr' && (
                      <View style={[s.defaultBadge, { backgroundColor: colors.successSoft }]}>
                        <Text style={[s.defaultBadgeText, { color: colors.success, fontFamily: fonts.semiBold }]}>기본</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{barcode.desc}</Text>
                </View>
              </MaterialPressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
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
    flexShrink: 1,
    textAlign: 'center',
  },
  headerAction: {
    minHeight: SIZE.touch,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
  },
  info: {
    fontSize: 14,
    lineHeight: 21,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  infoCount: {
    fontWeight: '600',
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: {
    ...TYPE.body,
  },
  rowDesc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.badge,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
