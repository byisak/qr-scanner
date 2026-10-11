// screens/StocktakeNewScreen.js - 새 재고 실사: 이름 + 예상 목록 붙여넣기 (한 줄에 "코드,이름,수량")
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { parseExpectedList, createStocktake, upsertStocktake, setActiveStocktake } from '../utils/stocktake';

export default function StocktakeNewScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  const items = useMemo(() => parseExpectedList(text), [text]);
  const totalQty = items.reduce((sum, i) => sum + i.expected, 0);

  const paste = async () => {
    const value = await Clipboard.getStringAsync();
    if (value) setText(prev => (prev.trim() ? `${prev.trim()}\n${value}` : value));
  };

  const create = async () => {
    if (items.length === 0) {
      feedback.error(t('stocktake.errorEmpty'));
      return;
    }
    const stocktake = createStocktake(name, items);
    await upsertStocktake(stocktake);
    await setActiveStocktake(stocktake.id);
    feedback.success(t('stocktake.started', { name: stocktake.name }));
    router.replace({ pathname: '/stocktake-detail', params: { id: stocktake.id } });
  };

  const inputStyle = [s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('stocktake.new')}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('stocktake.name')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t('stocktake.namePlaceholder')} placeholderTextColor={colors.textTertiary} style={inputStyle} />
        </View>

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.row}>
            <Text style={[s.label, s.labelInRow, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('stocktake.expectedList')}</Text>
            <MaterialPressable onPress={paste} style={[s.smallButton, { backgroundColor: colors.raised, borderColor: colors.border }]} accessibilityRole="button">
              <Ionicons name="clipboard-outline" size={16} color={colors.primaryText} />
              <Text style={[s.smallButtonText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('stocktake.paste')}</Text>
            </MaterialPressable>
          </View>
          <Text style={[s.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('stocktake.listHint')}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={'8801234567890,생수 500ml,24\n180100048,박스 A,3\nO-02-A1'}
            placeholderTextColor={colors.textTertiary}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={[inputStyle, s.textarea]}
          />
          <Text style={[s.count, { color: items.length ? colors.primaryText : colors.textTertiary, fontFamily: fonts.medium }]}>
            {t('stocktake.parsedCount', { items: items.length, qty: totalQty })}
          </Text>
        </View>

        <MaterialPressable style={[s.primaryButton, { backgroundColor: items.length ? colors.primary : colors.textTertiary }]} onPress={create} accessibilityRole="button">
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('stocktake.createAndStart')}</Text>
        </MaterialPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerSpacer: { width: SIZE.touch },
  content: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  section: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, marginBottom: SPACE.section },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { ...TYPE.sectionHeader, marginBottom: 8 },
  labelInRow: { flex: 1, marginBottom: 0 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: RADIUS.control, minHeight: SIZE.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textarea: { minHeight: 180, textAlignVertical: 'top' },
  count: { fontSize: 13, marginTop: 8 },
  smallButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: SIZE.touch, borderRadius: RADIUS.control, borderWidth: 1, overflow: 'hidden' },
  smallButtonText: { fontSize: 13, fontWeight: '600' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: SIZE.primaryButton, borderRadius: RADIUS.button, overflow: 'hidden' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
