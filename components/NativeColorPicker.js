// components/NativeColorPicker.js - 네이티브 컬러 피커 (iOS 네이티브 + 프리셋)
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 프리셋 색상
const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#007AFF', '#34C759', '#FF3B30',
  '#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#00C7BE',
  '#32ADE6', '#FFD60A', '#8E8E93', '#1C1C1E', '#2C2C2E',
];

export default function NativeColorPicker({ visible, onClose, color, onColorChange, colors }) {
  const [tempColor, setTempColor] = useState(color);
  const [hexInput, setHexInput] = useState(color);
  const [useNativePicker, setUseNativePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTempColor(color);
      setHexInput(color);
    }
  }, [visible, color]);

  const handleColorChange = (newColor) => {
    setTempColor(newColor);
    setHexInput(newColor);
    onColorChange(newColor);
  };

  const handleHexChange = (text) => {
    setHexInput(text);
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      setTempColor(text);
      onColorChange(text);
    }
  };

  const handleHexSubmit = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      handleColorChange(hexInput);
    } else if (/^[0-9A-Fa-f]{6}$/.test(hexInput)) {
      handleColorChange('#' + hexInput);
      setHexInput('#' + hexInput);
    }
  };

  // iOS 네이티브 컬러 피커 열기
  const openNativeColorPicker = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('알림', 'iOS 네이티브 컬러 피커는 iOS에서만 사용 가능합니다.');
      return;
    }

    try {
      const ColorPickerIOS = await import('react-native-color-picker-ios');

      const result = await ColorPickerIOS.default.open({
        initialColor: tempColor || '#000000',
        supportsAlpha: false,
      });

      if (result) {
        // result는 "#RRGGBB" 형식
        handleColorChange(result);
      }
    } catch (error) {
      console.log('Native color picker error:', error);
      // 실제로 에러가 발생한 경우에만 메시지 표시
      if (error.message?.includes('not linked') || error.message?.includes('undefined')) {
        Alert.alert(
          '개발 빌드 필요',
          'iOS 네이티브 컬러 피커는 개발 빌드(EAS Build)에서만 사용할 수 있습니다.\n\n현재 프리셋 색상과 HEX 입력을 사용해 주세요.',
          [{ text: '확인' }]
        );
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors?.surface || '#fff' }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors?.text || '#000' }]}>색상 선택</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors?.text || '#000'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Color Preview */}
            <View style={styles.previewSection}>
              <View style={[styles.colorPreview, { backgroundColor: tempColor }]} />
              <TextInput
                style={[styles.hexInput, {
                  color: colors?.text || '#000',
                  borderColor: colors?.border || '#ddd',
                  backgroundColor: colors?.inputBackground || '#f5f5f5'
                }]}
                value={hexInput}
                onChangeText={handleHexChange}
                onBlur={handleHexSubmit}
                onSubmitEditing={handleHexSubmit}
                placeholder="#000000"
                placeholderTextColor={colors?.textTertiary || '#999'}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>

            {/* iOS Native Color Picker Button */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.nativePickerButton, { backgroundColor: colors?.primary || '#007AFF' }]}
                onPress={openNativeColorPicker}
                activeOpacity={0.8}
              >
                <Ionicons name="color-palette" size={20} color="#fff" />
                <Text style={styles.nativePickerText}>iOS 컬러 피커 열기</Text>
              </TouchableOpacity>
            )}

            {/* Preset Colors */}
            <Text style={[styles.sectionTitle, { color: colors?.text || '#000' }]}>프리셋 색상</Text>
            <View style={styles.presetGrid}>
              {COLOR_PRESETS.map((presetColor) => (
                <TouchableOpacity
                  key={presetColor}
                  style={[
                    styles.presetButton,
                    {
                      backgroundColor: presetColor,
                      borderColor: tempColor?.toUpperCase() === presetColor ? (colors?.primary || '#007AFF') : 'transparent',
                      borderWidth: tempColor?.toUpperCase() === presetColor ? 3 : 1,
                    },
                    presetColor === '#FFFFFF' && { borderColor: '#ddd', borderWidth: 1 }
                  ]}
                  onPress={() => handleColorChange(presetColor)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </ScrollView>

          {/* Done Button */}
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors?.primary || '#007AFF' }]}
            onPress={onClose}
          >
            <Text style={styles.doneText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 16,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  colorPreview: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  hexInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  nativePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  nativePickerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  presetButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  doneButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
