// components/NativeColorPicker.js - 컬러 피커 모달 (컬러 휠 + HEX 입력)
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ColorPicker, { Panel1, HueSlider, Preview } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';

export default function NativeColorPicker({ visible, onClose, color, onColorChange, colors }) {
  const [tempColor, setTempColor] = useState(color || '#000000');

  useEffect(() => {
    if (visible) {
      setTempColor(color || '#000000');
    }
  }, [visible, color]);

  const updateColor = useCallback((hex) => {
    setTempColor(hex);
    onColorChange(hex);
  }, [onColorChange]);

  const handleColorSelect = useCallback((selectedColor) => {
    'worklet';
    const hex = selectedColor.hex;
    runOnJS(updateColor)(hex);
  }, [updateColor]);

  const handleHexChange = (text) => {
    const formatted = text.startsWith('#') ? text : '#' + text;
    setTempColor(formatted);
    if (/^#[0-9A-Fa-f]{6}$/.test(formatted)) {
      onColorChange(formatted.toUpperCase());
    }
  };

  const handleHexSubmit = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(tempColor)) {
      onColorChange(tempColor.toUpperCase());
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

          <View style={styles.content}>
            {/* Color Picker */}
            <ColorPicker
              value={tempColor}
              onComplete={handleColorSelect}
              style={styles.colorPicker}
            >
              <Preview style={styles.preview} />
              <Panel1 style={styles.panel} />
              <HueSlider style={styles.hueSlider} />
            </ColorPicker>

            {/* HEX Input */}
            <View style={styles.hexInputContainer}>
              <Text style={[styles.hexLabel, { color: colors?.text || '#000' }]}>HEX</Text>
              <TextInput
                style={[styles.hexInput, {
                  color: colors?.text || '#000',
                  borderColor: colors?.border || '#ddd',
                  backgroundColor: colors?.inputBackground || '#f5f5f5'
                }]}
                value={tempColor}
                onChangeText={handleHexChange}
                onBlur={handleHexSubmit}
                onSubmitEditing={handleHexSubmit}
                placeholder="#000000"
                placeholderTextColor={colors?.textTertiary || '#999'}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>
          </View>

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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  colorPicker: {
    width: '100%',
    gap: 16,
  },
  preview: {
    height: 50,
    borderRadius: 12,
  },
  panel: {
    height: 200,
    borderRadius: 12,
  },
  hueSlider: {
    height: 36,
    borderRadius: 18,
  },
  hexInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  hexLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  hexInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  doneButton: {
    marginHorizontal: 20,
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
