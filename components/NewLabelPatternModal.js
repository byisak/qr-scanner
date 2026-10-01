// components/NewLabelPatternModal.js - 처음 보는 라벨 패턴(구분자+칸 수)을 찍었을 때 카테고리를 만들지 묻는 모달
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from './MaterialPressable';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { splitLabel, parseSignature, DELIMITER_LABELS, nextCategoryName, defaultFieldName } from '../utils/labelParser';

export default function NewLabelPatternModal({ visible, pattern, categories = [], onCreate, onSkip, onNeverAsk }) {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const [name, setName] = useState('');

  // 열릴 때마다 "라벨 A" 같은 다음 이름을 기본값으로
  useEffect(() => {
    if (visible) setName(nextCategoryName(categories, t));
  }, [visible, categories, t]);

  if (!pattern) return null;
  const parsed = parseSignature(pattern.signature);
  const delimiter = parsed ? parsed.delimiter : '';
  const values = parsed ? splitLabel(pattern.sample, delimiter) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="pricetags-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('labelCategories.newPatternTitle')}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('labelCategories.newPatternMessage', { delimiter: DELIMITER_LABELS[delimiter] || delimiter, count: values.length })}
          </Text>

          {/* 샘플 값을 칸으로 나눠 보여준다 */}
          <View style={[styles.preview, { backgroundColor: colors.inputBackground }]}>
            {values.map((value, index) => (
              <View key={index} style={styles.previewRow}>
                <Text style={[styles.previewName, { color: colors.textTertiary, fontFamily: fonts.medium }]}>
                  {defaultFieldName(index, t)}
                </Text>
                <Text style={[styles.previewValue, { color: colors.text, fontFamily: fonts.regular }]} numberOfLines={1} ellipsizeMode="middle">
                  {value === '' ? '—' : value}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>{t('labelCategories.name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }]}
            returnKeyType="done"
            onSubmitEditing={() => onCreate(name)}
            accessibilityLabel={t('labelCategories.name')}
          />

          <MaterialPressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => onCreate(name)}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('labelCategories.create')}</Text>
          </MaterialPressable>
          <View style={styles.secondaryRow}>
            <MaterialPressable style={styles.secondaryButton} onPress={onSkip} accessibilityRole="button">
              <Text style={[styles.secondaryText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>{t('labelCategories.skipOnce')}</Text>
            </MaterialPressable>
            <MaterialPressable style={styles.secondaryButton} onPress={onNeverAsk} accessibilityRole="button">
              <Text style={[styles.secondaryText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>{t('labelCategories.neverAsk')}</Text>
            </MaterialPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  preview: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  previewName: {
    width: 72,
    fontSize: 12,
  },
  previewValue: {
    flex: 1,
    fontSize: 15,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  secondaryText: {
    fontSize: 14,
  },
});
