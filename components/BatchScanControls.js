// components/BatchScanControls.js - 배치 스캔 컨트롤 패널 컴포넌트
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';

export default function BatchScanControls({
  scannedCount,
  showScanCounter = true,
  onClear,
  onFinish,
  style,
}) {
  const { t } = useLanguage();

  return (
    <View style={[styles.container, style]}>
      {showScanCounter && (
        <View style={styles.countContainer}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.countText}>
            {t('scanner.scannedCount').replace('{count}', scannedCount.toString())}
          </Text>
        </View>
      )}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.buttonClear]}
          onPress={onClear}
          activeOpacity={0.8}
          accessibilityLabel={t('scanner.clearBatch')}
          accessibilityRole="button"
          accessibilityHint={t('scanner.clearBatchHint') || '스캔된 모든 항목을 삭제합니다'}
        >
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          <Text style={styles.buttonTextClear}>{t('scanner.clearBatch')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonFinish]}
          onPress={onFinish}
          activeOpacity={0.8}
          accessibilityLabel={t('scanner.finishBatch')}
          accessibilityRole="button"
          accessibilityHint={t('scanner.finishBatchHint') || '스캔을 완료하고 저장합니다'}
        >
          <Ionicons name="checkmark-done" size={18} color="#fff" />
          <Text style={styles.buttonTextFinish}>{t('scanner.finishBatch')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  countText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    gap: 6,
  },
  buttonClear: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  buttonFinish: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
  },
  buttonTextClear: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextFinish: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
