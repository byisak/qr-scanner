// components/NativeColorPicker.js - 컬러 피커 모달 (컬러 휠 + HEX 입력)
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Text, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ColorPicker, { Panel1, HueSlider, Preview } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from './MaterialPressable';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';

// Material 3 (Android 전용) 스타일 조정에 쓰는 플랫폼 플래그
const IS_ANDROID = Platform.OS === 'android';

export default function NativeColorPicker({ visible, onClose, color, onColorChange, colors }) {
  const insets = useSafeAreaInsets();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  // 넘겨받은 colors가 없으면 현재 테마 토큰을 쓴다
  const c = colors || (isDark ? Colors.dark : Colors.light);
  const [hexFocused, setHexFocused] = useState(false);
  const [tempColor, setTempColor] = useState(color || '#ffffff');

  useEffect(() => {
    if (visible && color) {
      setTempColor(color);
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: c.surface, paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 6, 20) : insets.bottom + 20 }]}>
          {IS_ANDROID && <View style={[styles.sheetHandle, { backgroundColor: c.textTertiary }]} />}
          {/* Header: 왼쪽 여백(닫기 버튼 폭) · 가운데 제목 · 오른쪽 닫기 */}
          <View style={styles.header}>
            <View style={styles.headerSide} />
            <Text style={[styles.title, { color: c.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>색상 선택</Text>
            <MaterialPressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={22} color={c.text} />
            </MaterialPressable>
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
              <Text style={[styles.hexLabel, { color: c.textSecondary, fontFamily: fonts.semiBold }]}>HEX</Text>
              <TextInput
                style={[styles.hexInput, {
                  color: c.text,
                  borderColor: hexFocused ? c.primary : c.border,
                  backgroundColor: c.inputBackground,
                }]}
                value={tempColor}
                onChangeText={handleHexChange}
                onFocus={() => setHexFocused(true)}
                onBlur={() => {
                  setHexFocused(false);
                  handleHexSubmit();
                }}
                onSubmitEditing={handleHexSubmit}
                placeholder="#000000"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>
          </View>

          {/* Done Button */}
          <MaterialPressable
            style={[styles.doneButton, { backgroundColor: c.primary }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={[styles.doneText, { fontFamily: fonts.semiBold }]}>확인</Text>
          </MaterialPressable>
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
  sheetHandle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    marginTop: 12,
  },
  container: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerSide: {
    width: SIZE.touch,
  },
  title: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: SPACE.card,
    paddingVertical: 12,
  },
  colorPicker: {
    width: '100%',
    gap: 16,
  },
  preview: {
    height: 48,
    borderRadius: RADIUS.control,
  },
  panel: {
    height: 200,
    borderRadius: RADIUS.control,
  },
  hueSlider: {
    height: 32,
    borderRadius: 16,
  },
  hexInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  hexLabel: {
    ...TYPE.sectionHeader,
  },
  hexInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: MONO,
    fontWeight: '600',
  },
  doneButton: {
    marginHorizontal: SPACE.card,
    marginTop: 8,
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
