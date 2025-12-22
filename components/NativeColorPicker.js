// components/NativeColorPicker.js - SwiftUI 네이티브 컬러 피커
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// iOS에서만 SwiftUI 컴포넌트 사용
let Host, ColorPicker;
if (Platform.OS === 'ios') {
  try {
    const SwiftUI = require('@expo/ui/swift-ui');
    Host = SwiftUI.Host;
    ColorPicker = SwiftUI.ColorPicker;
  } catch (e) {
    console.log('SwiftUI not available:', e);
  }
}

// 프리셋 색상
const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#007AFF', '#34C759', '#FF3B30',
  '#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#00C7BE',
  '#32ADE6', '#FFD60A', '#8E8E93', '#1C1C1E', '#2C2C2E',
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

  // iOS SwiftUI ColorPicker 사용 가능한 경우
  const renderSwiftUIColorPicker = () => {
    if (Platform.OS === 'ios' && Host && ColorPicker) {
      return (
        <View style={styles.swiftUIContainer}>
          <Host style={styles.hostContainer} matchContents>
            <ColorPicker
              color={tempColor}
              label="색상 선택"
              onValueChanged={(event) => {
                const newColor = event.nativeEvent.color;
                if (newColor) {
                  handleColorChange(newColor);
                }
              }}
            />
          </Host>
        </View>
      );
    }
    return null;
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
              placeholder="#000000"
              placeholderTextColor={colors?.textTertiary || '#999'}
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>

          {/* SwiftUI ColorPicker (iOS only) */}
          {renderSwiftUIColorPicker()}

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
    maxHeight: '80%',
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
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  swiftUIContainer: {
    padding: 16,
    alignItems: 'center',
  },
  hostContainer: {
    width: '100%',
    minHeight: 50,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 16,
  },
  presetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  doneButton: {
    marginHorizontal: 16,
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
