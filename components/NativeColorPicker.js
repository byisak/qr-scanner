// components/NativeColorPicker.js - 컬러 피커 (프리셋 + HEX 입력)
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 프리셋 색상 (더 많은 색상 추가)
const COLOR_PRESETS = [
  // 기본
  '#000000', '#FFFFFF', '#808080', '#C0C0C0',
  // 빨강/분홍
  '#FF3B30', '#FF2D55', '#FF6B6B', '#FF9999',
  // 주황/노랑
  '#FF9500', '#FFCC00', '#FFD60A', '#FFF3CD',
  // 초록
  '#34C759', '#00C853', '#4CAF50', '#8BC34A',
  // 파랑/청록
  '#007AFF', '#5856D6', '#00BCD4', '#03A9F4',
  // 보라/마젠타
  '#AF52DE', '#9C27B0', '#E91E63', '#FF4081',
];

export default function NativeColorPicker({ visible, onClose, color, onColorChange, colors }) {
  const [tempColor, setTempColor] = useState(color);
  const [hexInput, setHexInput] = useState(color);

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
