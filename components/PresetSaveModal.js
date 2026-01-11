// components/PresetSaveModal.js - 프리셋 저장 모달
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

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
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={[s.container, { backgroundColor: colors.surface }]}>
          {/* 헤더 */}
          <View style={s.header}>
            <Text style={[s.title, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('generator.savePreset') || '프리셋 저장'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={s.closeButton}>
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* 프리셋 이름 입력 */}
          <View style={s.inputContainer}>
            <Text style={[s.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('generator.presetName') || '프리셋 이름'}
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                  fontFamily: fonts.regular,
                },
              ]}
              value={presetName}
              onChangeText={setPresetName}
              placeholder={t('generator.presetNamePlaceholder') || '프리셋 이름을 입력하세요'}
              placeholderTextColor={colors.textTertiary}
              maxLength={20}
              autoFocus
            />
          </View>

          {/* 버튼 */}
          <View style={s.buttonContainer}>
            <TouchableOpacity
              style={[s.button, s.cancelButton, { borderColor: colors.border }]}
              onPress={handleClose}
            >
              <Text style={[s.buttonText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                {t('common.cancel') || '취소'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.button,
                s.saveButton,
                { backgroundColor: presetName.trim() ? colors.primary : colors.border },
              ]}
              onPress={handleSave}
              disabled={!presetName.trim() || isSaving}
            >
              <Text style={[s.buttonText, { color: '#fff', fontFamily: fonts.semiBold }]}>
                {isSaving ? (t('common.saving') || '저장 중...') : (t('common.save') || '저장')}
              </Text>
            </TouchableOpacity>
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
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: 16,
  },
});
