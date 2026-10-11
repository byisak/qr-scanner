// screens/LabelCategoryEditScreen.js - 라벨 카테고리 편집 (이름 · 필드 이름 · 대표 필드 · 샘플 미리보기)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { describeSignature, splitLabel, defaultFieldName } from '../utils/labelParser';
import { loadLabelSettings, updateCategory, deleteCategory } from '../utils/labelCategories';

// 입력칸: 포커스되면 테두리를 강조색으로
function Field({ style, colors, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, focused && { borderColor: colors.primary }]}
    />
  );
}

export default function LabelCategoryEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;

  const [category, setCategory] = useState(null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState([]);
  const [keyField, setKeyField] = useState(0);
  const [routeToGroup, setRouteToGroup] = useState(null); // null 아직 안 물어봄 / true / false
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { categories } = await loadLabelSettings();
        const found = categories.find(c => c.id === id);
        if (!found) {
          router.back();
          return;
        }
        setCategory(found);
        setName(found.name || '');
        // 기본 이름("필드1"…)은 입력창에 채우지 않고 placeholder로만 보여 준다
        setFields(
          Array.from({ length: found.fieldCount }, (_, i) => {
            const value = found.fields?.[i] || '';
            return value === defaultFieldName(i, t) ? '' : value;
          })
        );
        setKeyField(Number.isInteger(found.keyField) ? found.keyField : 0);
        setRouteToGroup(found.routeToGroup == null ? null : !!found.routeToGroup);
        if (found.groupId) {
          try {
            const raw = await AsyncStorage.getItem('scanGroups');
            const groups = raw ? JSON.parse(raw) : [];
            const g = Array.isArray(groups) ? groups.find(x => x.id === found.groupId) : null;
            setGroupName(g ? g.name : '');
          } catch {
            setGroupName('');
          }
        }
      } catch (error) {
        console.error('[LabelCategoryEdit] load error:', error);
      }
    })();
  }, [id]);

  const values = category ? splitLabel(category.sample || '', category.delimiter) : [];

  const fieldLabel = (index) => {
    const value = fields[index];
    return value && value.trim() ? value.trim() : defaultFieldName(index, t);
  };

  const setFieldAt = (index, text) => {
    setFields(prev => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleSave = async () => {
    if (!category) return;
    try {
      await updateCategory(category.id, {
        name: name.trim() || category.name,
        fields: fields.map(f => (f || '').trim()),
        keyField,
        routeToGroup,
      });
      feedback.success(t('common.save'));
      router.back();
    } catch (error) {
      console.error('[LabelCategoryEdit] save error:', error);
    }
  };

  const handleDelete = () => {
    if (!category) return;
    Alert.alert(
      t('labelCategories.deleteConfirmTitle'),
      t('labelCategories.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              router.back();
            } catch (error) {
              console.error('[LabelCategoryEdit] delete error:', error);
            }
          },
        },
      ]
    );
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text, fontFamily: fonts.regular },
  ];
  const sectionHeaderStyle = [styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('labelCategories.edit')}
        </Text>
        <MaterialPressable
          onPress={handleSave}
          style={styles.saveButton}
          disabled={!category}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}
        >
          <Text style={[styles.saveText, { color: category ? colors.primaryText : colors.textTertiary, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {t('common.save')}
          </Text>
        </MaterialPressable>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {category && (
            <>
              {/* 이름 · 패턴 */}
              <View style={cardStyle}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('labelCategories.name')}
                </Text>
                <Field
                  colors={colors}
                  style={inputStyle}
                  value={name}
                  onChangeText={setName}
                  placeholder={category.name}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  accessibilityLabel={t('labelCategories.name')}
                />
                <View style={[styles.patternRow, { borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.fieldLabel, styles.fieldLabelInRow, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('labelCategories.pattern')}
                  </Text>
                  <View style={[styles.patternBadge, { backgroundColor: colors.raised }]}>
                    <Text style={[styles.patternValue, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {describeSignature(category.signature)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 연결된 그룹 + 자동 저장 */}
              {category.groupId ? (
                <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.routeRow}>
                    <View style={styles.rowText}>
                      <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                        {t('labelCategories.autoRoute', { group: groupName || category.name })}
                      </Text>
                      <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                        {routeToGroup == null ? t('labelCategories.autoRouteAsk') : t('labelCategories.autoRouteDesc')}
                      </Text>
                    </View>
                    <Switch
                      value={routeToGroup === true}
                      onValueChange={(v) => setRouteToGroup(v)}
                      {...switchColors}
                    />
                  </View>
                </View>
              ) : null}

              {/* 필드 이름 + 대표 필드 */}
              <Text accessibilityRole="header" style={sectionHeaderStyle}>
                {t('labelCategories.fields')}
              </Text>
              <View style={cardStyle}>
                <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('labelCategories.fieldsDesc')}
                </Text>
                <Text style={[styles.desc, styles.descGap, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('labelCategories.keyField')} · {t('labelCategories.keyFieldDesc')}
                </Text>
                {fields.map((value, index) => {
                  const selected = keyField === index;
                  return (
                    <View key={index} style={styles.fieldRow}>
                      <MaterialPressable
                        onPress={() => setKeyField(index)}
                        style={styles.radioButton}
                        borderless
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${t('labelCategories.keyField')}: ${fieldLabel(index)}`}
                      >
                        <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.textTertiary }]}>
                          {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                        </View>
                      </MaterialPressable>
                      <Field
                        colors={colors}
                        style={[inputStyle, styles.inputFlex]}
                        value={value}
                        onChangeText={(text) => setFieldAt(index, text)}
                        placeholder={defaultFieldName(index, t)}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="done"
                        accessibilityLabel={defaultFieldName(index, t)}
                      />
                    </View>
                  );
                })}
              </View>

              {/* 미리보기 */}
              <Text accessibilityRole="header" style={sectionHeaderStyle}>
                {t('labelCategories.preview')}
              </Text>
              <View style={cardStyle}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('labelCategories.sample')}
                </Text>
                <View style={[styles.sampleBox, { backgroundColor: colors.raised }]}>
                  <Text
                    style={[styles.mono, { color: colors.text }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {category.sample || '—'}
                  </Text>
                </View>
                <View style={[styles.previewTable, { borderColor: colors.border }]}>
                  {fields.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.previewRow,
                        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
                      ]}
                    >
                      <View style={styles.previewNameCell}>
                        <Text
                          style={[styles.previewName, { color: keyField === index ? colors.primaryText : colors.textSecondary, fontFamily: keyField === index ? fonts.semiBold : fonts.medium }]}
                          numberOfLines={1}
                        >
                          {fieldLabel(index)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.previewValue, { color: colors.text, fontFamily: fonts.regular }]}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {values[index] ? values[index] : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 삭제 */}
              <MaterialPressable
                onPress={handleDelete}
                style={[styles.deleteButton, { backgroundColor: colors.errorSoft }]}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.deleteText, { color: colors.error, fontFamily: fonts.semiBold }]}>
                  {t('common.delete')}
                </Text>
              </MaterialPressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  saveButton: { minWidth: SIZE.touch, height: SIZE.touch, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  saveText: { fontSize: 16, fontWeight: '600' },
  container: { flex: 1 },
  content: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  card: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, marginBottom: SPACE.section },
  group: { borderRadius: RADIUS.group, borderWidth: 1, overflow: 'hidden', marginBottom: SPACE.section },
  sectionHeader: { ...TYPE.sectionHeader, marginTop: 2, marginHorizontal: 4, marginBottom: 8 },
  fieldLabel: { ...TYPE.sectionHeader, marginBottom: 8 },
  fieldLabelInRow: { marginBottom: 0 },
  label: { ...TYPE.body },
  desc: { ...TYPE.caption, lineHeight: 17 },
  descGap: { marginTop: 4 },
  input: { height: 48, paddingHorizontal: 14, borderRadius: RADIUS.control, borderWidth: 1, fontSize: 15 },
  inputFlex: { flex: 1 },
  patternRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  patternBadge: { borderRadius: RADIUS.badge, paddingHorizontal: 10, paddingVertical: 4 },
  patternValue: { fontSize: 13, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: SIZE.rowWithDesc, paddingVertical: 10, paddingHorizontal: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  radioButton: { width: SIZE.touch, height: SIZE.touch, marginLeft: -11, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  sampleBox: { borderRadius: RADIUS.control, paddingHorizontal: 12, paddingVertical: 10 },
  mono: { fontSize: 13, fontFamily: MONO },
  previewTable: { marginTop: 12, borderWidth: 1, borderRadius: RADIUS.control, overflow: 'hidden' },
  previewRow: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.touch, paddingVertical: 10, paddingHorizontal: 12 },
  previewNameCell: { width: '38%', paddingRight: 8 },
  previewName: { fontSize: 13 },
  previewValue: { flex: 1, fontSize: 14 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.button, borderRadius: RADIUS.control, marginTop: 4, overflow: 'hidden' },
  deleteText: { fontSize: 15, fontWeight: '600' },
});
