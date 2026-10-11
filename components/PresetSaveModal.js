// components/PresetSaveModal.js - 프리셋 저장 모달
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from './MaterialPressable';

export default function PresetSaveModal({
  visible,
  onClose,
  onSave,
  qrStyle,
  frameIndex,
  logoImage,
}) {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [presetName, setPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const canSave = !!presetName.trim() && !isSaving;

  const handleSave = async () => {
    if (!presetName.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: presetName.trim(),
        style: qrStyle,
        frameIndex,
        logoImage,
      });
      setPresetName('');
      onClose();
    } catch (error) {
      console.error('Save preset error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setPresetName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.overlay}
      >
        <MaterialPressable
          style={s.backdrop}
          activeOpacity={1}
          rippleColor="transparent"
          onPress={handleClose}
        />

        <View style={[s.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* 헤더 */}
          <View style={s.header}>
            <Text style={[s.title, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {t('generator.savePreset') || '프리셋 저장'}
            </Text>
            <MaterialPressable
              onPress={handleClose}
              style={s.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </MaterialPressable>
          </View>

          {/* 프리셋 이름 입력 */}
          <View style={s.inputContainer}>
            <Text style={[s.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('generator.presetName') || '프리셋 이름'}
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: focused ? colors.primary : colors.border,
                  color: colors.text,
                  fontFamily: fonts.regular,
                },
              ]}
              value={presetName}
              onChangeText={setPresetName}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t('generator.presetNamePlaceholder') || '프리셋 이름을 입력하세요'}
              placeholderTextColor={colors.textTertiary}
              maxLength={20}
              autoFocus
            />
          </View>

          {/* 버튼 */}
          <View style={s.buttonContainer}>
            <MaterialPressable
              style={[
                s.primaryButton,
                { backgroundColor: canSave ? colors.primary : colors.raised },
              ]}
              onPress={handleSave}
              disabled={!presetName.trim() || isSaving}
            >
              <Text style={[s.primaryButtonText, { color: canSave ? '#fff' : colors.textTertiary, fontFamily: fonts.semiBold }]}>
                {isSaving ? (t('common.saving') || '저장 중...') : (t('common.save') || '저장')}
              </Text>
            </MaterialPressable>

            <MaterialPressable
              style={[s.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
              onPress={handleClose}
            >
              <Text style={[s.secondaryButtonText, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('common.cancel') || '취소'}
              </Text>
            </MaterialPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACE.screen,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACE.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
    marginRight: -10,
    marginBottom: 12,
  },
  title: {
    ...TYPE.screenTitle,
    flex: 1,
  },
  closeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inputContainer: {
    marginBottom: 20,
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
  },
  buttonContainer: {
    gap: SPACE.gap,
  },
  primaryButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: SIZE.button,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  secondaryButtonText: {
    fontSize: 15,
  },
});
