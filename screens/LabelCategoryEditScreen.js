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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import MaterialPressable from '../components/MaterialPressable';
import { describeSignature, splitLabel, defaultFieldName } from '../utils/labelParser';
import { loadLabelSettings, updateCategory, deleteCategory } from '../utils/labelCategories';

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

  const cardStyle = [styles.card, { backgroundColor: colors.surface }];
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text, fontFamily: fonts.regular },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('labelCategories.edit')}
        </Text>
        <MaterialPressable
          onPress={handleSave}
          style={styles.saveButton}
          disabled={!category}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}
        >
          <Text style={[styles.saveText, { color: colors.primary, fontFamily: fonts.bold }]}>
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
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                  {t('labelCategories.name')}
                </Text>
                <TextInput
                  style={inputStyle}
                  value={name}
                  onChangeText={setName}
                  placeholder={category.name}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  accessibilityLabel={t('labelCategories.name')}
                />
                <View style={[styles.patternRow, { borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: fonts.medium, marginBottom: 0 }]}>
                    {t('labelCategories.pattern')}
                  </Text>
                  <Text style={[styles.patternValue, { color: colors.text, fontFamily: fonts.bold }]}>
                    {describeSignature(category.signature)}
                  </Text>
                </View>
              </View>

              {/* 필드 이름 + 대표 필드 */}
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                {t('labelCategories.fields')}
              </Text>
              <View style={cardStyle}>
                <Text style={[styles.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('labelCategories.fieldsDesc')}
                </Text>
                <Text style={[styles.desc, { color: colors.textTertiary, fontFamily: fonts.regular, marginTop: 4 }]}>
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
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={22}
                          color={selected ? colors.primary : colors.textTertiary}
                        />
                      </MaterialPressable>
                      <TextInput
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
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                {t('labelCategories.preview')}
              </Text>
              <View style={cardStyle}>
                <Text style={[styles.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('labelCategories.sample')}
                </Text>
                <Text
                  style={[styles.mono, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {category.sample || '—'}
                </Text>
                <View style={[styles.previewTable, { borderColor: colors.borderLight }]}>
                  {fields.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.previewRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight },
                      ]}
                    >
                      <View style={styles.previewNameCell}>
                        <Text
                          style={[styles.previewName, { color: keyField === index ? colors.primary : colors.textSecondary, fontFamily: fonts.medium }]}
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
                style={[styles.deleteButton, { borderColor: colors.error }]}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.deleteText, { color: colors.error, fontFamily: fonts.bold }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    ...(Platform.OS === 'android' ? { borderRadius: 16, overflow: 'hidden' } : {}),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...(Platform.OS === 'android' ? { borderRadius: 8, overflow: 'hidden' } : {}),
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'android' ? { elevation: 1 } : {}),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
  },
  inputFlex: {
    flex: 1,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  patternValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  radioButton: {
    padding: 6,
    borderRadius: 18,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' } : {}),
  },
  mono: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  previewTable: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  previewNameCell: {
    width: '38%',
    paddingRight: 8,
  },
  previewName: {
    fontSize: 14,
  },
  previewValue: {
    flex: 1,
    fontSize: 14,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' } : {}),
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
