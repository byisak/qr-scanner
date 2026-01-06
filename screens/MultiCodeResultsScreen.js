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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { saveToHistory } from '../utils/history';

export default function MultiCodeResultsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, fonts } = useLanguage();
  const params = useLocalSearchParams();

  const [codes, setCodes] = useState([]);
  const [savedCodes, setSavedCodes] = useState(new Set());

  useEffect(() => {
    // params에서 바코드 데이터 파싱
    if (params.detectedBarcodes) {
      try {
        const parsed = JSON.parse(params.detectedBarcodes);
        setCodes(parsed || []);
      } catch (e) {
        console.error('Failed to parse barcodes:', e);
        setCodes([]);
      }
    }
  }, [params.detectedBarcodes]);

  // 개별 코드 저장
  const handleSaveCode = useCallback(async (code, index) => {
    if (savedCodes.has(index)) return;

    try {
      await saveToHistory(code.value, null, null, code.type);
      setSavedCodes(prev => new Set([...prev, index]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save code:', error);
      Alert.alert('Error', 'Failed to save code');
    }
  }, [savedCodes]);

  // 모두 저장
  const handleSaveAll = useCallback(async () => {
    try {
      const unsavedIndices = codes
        .map((_, idx) => idx)
        .filter(idx => !savedCodes.has(idx));

      for (const idx of unsavedIndices) {
        const code = codes[idx];
        await saveToHistory(code.value, null, null, code.type);
      }

      setSavedCodes(new Set(codes.map((_, idx) => idx)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save all codes:', error);
      Alert.alert('Error', 'Failed to save codes');
    }
  }, [codes, savedCodes]);

  // 클립보드에 복사
  const handleCopy = useCallback(async (value) => {
    await Clipboard.setStringAsync(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // 바코드 타입 표시 이름
  const getTypeDisplayName = (type) => {
    const typeMap = {
      'qr': 'QR Code',
      'ean13': 'EAN-13',
      'ean8': 'EAN-8',
      'code128': 'Code 128',
      'code39': 'Code 39',
      'code93': 'Code 93',
      'upce': 'UPC-E',
      'upca': 'UPC-A',
      'itf14': 'ITF-14',
      'codabar': 'Codabar',
      'pdf417': 'PDF417',
      'aztec': 'Aztec',
      'datamatrix': 'Data Matrix',
    };
    return typeMap[type] || type || 'Unknown';
  };

  const allSaved = codes.length > 0 && savedCodes.size === codes.length;

  const renderCodeItem = ({ item, index }) => {
    const isSaved = savedCodes.has(index);

    return (
      <View style={[styles.codeItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.codeContent}>
          <Text style={[styles.codeValue, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={3}>
            {item.value}
          </Text>
          <Text style={[styles.codeType, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
            {getTypeDisplayName(item.type)}
          </Text>
        </View>
        <View style={styles.codeActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => handleCopy(item.value)}
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: isSaved ? colors.success : colors.primary }
            ]}
            onPress={() => handleSaveCode(item, index)}
            disabled={isSaved}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSaved ? "checkmark" : "bookmark-outline"}
              size={18}
              color="#fff"
            />
            <Text style={[styles.saveButtonText, { fontFamily: fonts.medium }]}>
              {isSaved ? t('multiCodeResults.saved') : t('multiCodeResults.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
          {t('multiCodeResults.title')} ({codes.length})
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* 코드 목록 */}
      {codes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="qr-code-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary, fontFamily: fonts.medium }]}>
            {t('multiCodeResults.noResults')}
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
              {allSaved ? t('multiCodeResults.allSaved') : t('multiCodeResults.saveAll')}
            </Text>
          </TouchableOpacity>
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
  codeItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  codeContent: {
    marginBottom: 12,
  },
  codeValue: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  codeType: {
    fontSize: 12,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
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
    paddingBottom: 32,
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
});
