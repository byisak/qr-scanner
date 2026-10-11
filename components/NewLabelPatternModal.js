// components/NewLabelPatternModal.js - 처음 보는 라벨 패턴(구분자+칸 수)을 찍었을 때 카테고리를 만들지 묻는 모달
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from './MaterialPressable';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { splitLabel, parseSignature, DELIMITER_LABELS, nextCategoryName, defaultFieldName } from '../utils/labelParser';

export default function NewLabelPatternModal({ visible, pattern, categories = [], onCreate, onSkip, onNeverAsk }) {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);

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
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="pricetags-outline" size={22} color={colors.primaryText} />
          </View>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('labelCategories.newPatternTitle')}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('labelCategories.newPatternMessage', { delimiter: DELIMITER_LABELS[delimiter] || delimiter, count: values.length })}
          </Text>

          {/* 샘플 값을 칸으로 나눠 보여준다 */}
          <View style={[styles.preview, { backgroundColor: colors.raised }]}>
            {values.map((value, index) => (
              <View key={index} style={styles.previewRow}>
                <Text style={[styles.previewName, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
                  {defaultFieldName(index, t)}
                </Text>
                <Text style={[styles.previewValue, { color: value === '' ? colors.textTertiary : colors.text, fontFamily: fonts.regular }]} numberOfLines={1} ellipsizeMode="middle">
                  {value === '' ? '—' : value}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('labelCategories.name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, { color: colors.text, borderColor: focused ? colors.primary : colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }]}
            placeholderTextColor={colors.textTertiary}
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
            <MaterialPressable style={[styles.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]} onPress={onSkip} accessibilityRole="button">
              <Text style={[styles.secondaryText, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{t('labelCategories.skipOnce')}</Text>
            </MaterialPressable>
            <MaterialPressable style={styles.textButton} onPress={onNeverAsk} accessibilityRole="button">
              <Text style={[styles.secondaryText, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>{t('labelCategories.neverAsk')}</Text>
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
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    padding: SPACE.card,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    ...TYPE.screenTitle,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  preview: {
    borderRadius: RADIUS.control,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  previewName: {
    width: 88,
    fontSize: 13,
  },
  previewValue: {
    flex: 1,
    fontSize: 15,
  },
  label: {
    ...TYPE.sectionHeader,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  primaryButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.gap,
    marginTop: SPACE.gap,
  },
  secondaryButton: {
    flex: 1,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textButton: {
    flex: 1,
    height: SIZE.button,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
    overflow: 'hidden',
  },
  secondaryText: {
    fontSize: 15,
  },
});
