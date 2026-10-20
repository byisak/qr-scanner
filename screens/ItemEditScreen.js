// screens/ItemEditScreen.js - 품목 하나 추가·수정. params: code(수정할 품목) 또는 prefill(스캔 결과에서 "품목으로 등록")
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { lookupItem, saveItem, deleteItem, codeKey } from '../utils/itemMaster';
import { trackEvent } from '../utils/analytics';

const TEXT_FIELDS = ['name', 'spec', 'unit', 'category', 'location', 'altCodes', 'memo'];

export default function ItemEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;

  const editingCode = typeof params.code === 'string' ? params.code : null;
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState({ code: typeof params.prefill === 'string' ? params.prefill : '', name: '', spec: '', unit: '', category: '', location: '', altCodes: '', memo: '' });

  useEffect(() => {
    if (!editingCode) return;
    lookupItem(editingCode).then(item => {
      if (!item) return;
      setOriginal(item);
      setForm({ ...item, altCodes: (item.altCodes || []).join(', ') });
    });
  }, [editingCode]);

  const set = (field) => (value) => setForm(prev => ({ ...prev, [field]: value }));

  const doSave = async () => {
    await saveItem({ ...form, altCodes: form.altCodes }, original?.code);
    trackEvent(original ? 'item_edited' : (params.prefill ? 'item_registered_from_scan' : 'item_added'));
    feedback.success(t('itemMaster.itemSaved'));
    router.back();
  };

  const save = async () => {
    const code = form.code.trim();
    if (!code) { feedback.error(t('itemMaster.codeRequired')); return; }
    if (!form.name.trim()) { feedback.error(t('itemMaster.nameRequired')); return; }
    // 코드를 다른 품목의 코드로 바꾸면 그 품목을 덮어쓴다 → 한 번 묻는다
    const other = await lookupItem(code);
    if (other && (!original || codeKey(other.code) !== codeKey(original.code))) {
      Alert.alert(t('itemMaster.duplicateTitle'), t('itemMaster.duplicateMessage', { name: other.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('itemMaster.policy.overwrite'), style: 'destructive', onPress: doSave },
      ]);
      return;
    }
    await doSave();
  };

  const remove = () => {
    Alert.alert(t('itemMaster.deleteTitle'), t('itemMaster.deleteMessage', { name: original?.name || '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteItem(original.code); feedback.success(t('itemMaster.itemDeleted')); router.back(); } },
    ]);
  };

  const inputStyle = [s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }];
  const field = (name, opts = {}) => (
    <View key={name} style={s.field}>
      <Text style={[s.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
        {t(`itemMaster.fields.${name}`)}{opts.required ? ' *' : ''}
      </Text>
      <TextInput
        value={form[name]}
        onChangeText={set(name)}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={!!opts.multiline}
        style={[...inputStyle, opts.mono && { fontFamily: MONO }, opts.multiline && s.multiline]}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {original ? t('itemMaster.editTitle') : t('itemMaster.addTitle')}
        </Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {field('code', { required: true, mono: true, placeholder: '8801234002028' })}
          {field('name', { required: true, placeholder: t('itemMaster.sample.name1') })}
          {TEXT_FIELDS.slice(1).map(f => field(f, {
            mono: f === 'altCodes',
            multiline: f === 'memo',
            placeholder: f === 'altCodes' ? t('itemMaster.altCodesPlaceholder') : undefined,
          }))}
        </View>

        <MaterialPressable style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={save} accessibilityRole="button">
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('common.save')}</Text>
        </MaterialPressable>

        {original && (
          <MaterialPressable style={s.deleteButton} onPress={remove} accessibilityRole="button">
            <Text style={[s.deleteText, { color: colors.error, fontFamily: fonts.semiBold }]}>{t('itemMaster.deleteItem')}</Text>
          </MaterialPressable>
        )}
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
  section: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, marginBottom: SPACE.section, gap: 14 },
  field: {},
  label: { ...TYPE.sectionHeader, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS.control, minHeight: SIZE.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: SIZE.primaryButton, borderRadius: RADIUS.button, overflow: 'hidden' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16 },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: SIZE.touch, marginTop: 12 },
  deleteText: { fontSize: 15 },
});
