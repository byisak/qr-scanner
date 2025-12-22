// components/QRStylePicker.js - QR 코드 스타일 선택 모달
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import StyledQRCode, { DOT_TYPES, CORNER_SQUARE_TYPES, CORNER_DOT_TYPES } from './StyledQRCode';

// 프리셋 색상 팔레트
const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#007AFF', '#34C759', '#FF3B30',
  '#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#00C7BE',
  '#32ADE6', '#FFD60A', '#8E8E93', '#1C1C1E', '#2C2C2E',
];

// 그라데이션 프리셋
const GRADIENT_PRESETS = [
  { name: 'Blue Ocean', colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#764ba2' }] },
  { name: 'Sunset', colorStops: [{ offset: 0, color: '#fa709a' }, { offset: 1, color: '#fee140' }] },
  { name: 'Forest', colorStops: [{ offset: 0, color: '#43e97b' }, { offset: 1, color: '#38f9d7' }] },
  { name: 'Ocean', colorStops: [{ offset: 0, color: '#4facfe' }, { offset: 1, color: '#00f2fe' }] },
  { name: 'Fire', colorStops: [{ offset: 0, color: '#f093fb' }, { offset: 1, color: '#f5576c' }] },
  { name: 'Night', colorStops: [{ offset: 0, color: '#30cfd0' }, { offset: 1, color: '#330867' }] },
];

// QR 스타일 프리셋
const QR_STYLE_PRESETS = [
  {
    id: 'classic',
    name: 'Classic',
    nameKo: '클래식',
    style: {
      dotType: 'square',
      dotColor: '#000000',
      cornerSquareType: 'square',
      cornerSquareColor: '#000000',
      cornerDotType: 'square',
      cornerDotColor: '#000000',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'rounded',
    name: 'Rounded',
    nameKo: '둥근',
    style: {
      dotType: 'rounded',
      dotColor: '#000000',
      cornerSquareType: 'extra-rounded',
      cornerSquareColor: '#000000',
      cornerDotType: 'dot',
      cornerDotColor: '#000000',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'dots',
    name: 'Dots',
    nameKo: '점',
    style: {
      dotType: 'dots',
      dotColor: '#007AFF',
      cornerSquareType: 'dot',
      cornerSquareColor: '#007AFF',
      cornerDotType: 'dot',
      cornerDotColor: '#007AFF',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'classy',
    name: 'Classy',
    nameKo: '세련된',
    style: {
      dotType: 'classy',
      dotColor: '#1C1C1E',
      cornerSquareType: 'extra-rounded',
      cornerSquareColor: '#1C1C1E',
      cornerDotType: 'dot',
      cornerDotColor: '#1C1C1E',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'gradient-blue',
    name: 'Blue Gradient',
    nameKo: '블루 그라데이션',
    style: {
      dotType: 'rounded',
      dotGradient: { type: 'linear', rotation: 45, colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#764ba2' }] },
      cornerSquareType: 'extra-rounded',
      cornerSquareColor: '#667eea',
      cornerDotType: 'dot',
      cornerDotColor: '#764ba2',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'gradient-sunset',
    name: 'Sunset',
    nameKo: '선셋',
    style: {
      dotType: 'dots',
      dotGradient: { type: 'linear', rotation: 135, colorStops: [{ offset: 0, color: '#fa709a' }, { offset: 1, color: '#fee140' }] },
      cornerSquareType: 'dot',
      cornerSquareColor: '#fa709a',
      cornerDotType: 'dot',
      cornerDotColor: '#fee140',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    nameKo: '다크 모드',
    style: {
      dotType: 'rounded',
      dotColor: '#ffffff',
      cornerSquareType: 'extra-rounded',
      cornerSquareColor: '#ffffff',
      cornerDotType: 'dot',
      cornerDotColor: '#ffffff',
      backgroundColor: '#1C1C1E',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    nameKo: '네온',
    style: {
      dotType: 'dots',
      dotGradient: { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#00ff87' }, { offset: 1, color: '#60efff' }] },
      cornerSquareType: 'dot',
      cornerSquareColor: '#00ff87',
      cornerDotType: 'dot',
      cornerDotColor: '#60efff',
      backgroundColor: '#0d0d0d',
    },
  },
];

export { QR_STYLE_PRESETS, COLOR_PRESETS, GRADIENT_PRESETS };

export default function QRStylePicker({
  visible,
  onClose,
  currentStyle,
  onStyleChange,
  previewValue = 'QR PREVIEW', // 미리보기용 QR 데이터
}) {
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [activeTab, setActiveTab] = useState('presets'); // presets, dots, corners, colors
  const [tempStyle, setTempStyle] = useState(currentStyle);
  const [previewKey, setPreviewKey] = useState(0); // 미리보기 강제 리렌더링용

  // 스타일 변경 시 미리보기 업데이트
  useEffect(() => {
    setPreviewKey(prev => prev + 1);
  }, [tempStyle]);

  useEffect(() => {
    if (visible) {
      setTempStyle(currentStyle);
    }
  }, [visible, currentStyle]);

  const handleApply = () => {
    onStyleChange(tempStyle);
    onClose();
  };

  const handlePresetSelect = (preset) => {
    setTempStyle(preset.style);
  };

  const updateStyle = (key, value) => {
    setTempStyle((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderPresets = () => (
    <View style={styles.presetGrid}>
      {QR_STYLE_PRESETS.map((preset) => (
        <TouchableOpacity
          key={preset.id}
          style={[
            styles.presetItem,
            {
              backgroundColor: colors.inputBackground,
              borderColor: JSON.stringify(tempStyle) === JSON.stringify(preset.style)
                ? colors.primary
                : colors.border,
              borderWidth: JSON.stringify(tempStyle) === JSON.stringify(preset.style) ? 2 : 1,
            },
          ]}
          onPress={() => handlePresetSelect(preset)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.presetPreview,
              { backgroundColor: preset.style.backgroundColor || '#fff' },
            ]}
          >
            <View style={styles.presetDots}>
              {[...Array(9)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.presetDot,
                    {
                      backgroundColor: preset.style.dotGradient
                        ? preset.style.dotGradient.colorStops[0].color
                        : preset.style.dotColor,
                      borderRadius: preset.style.dotType === 'dots' || preset.style.dotType === 'rounded'
                        ? 3 : 0,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
          <Text style={[styles.presetName, { color: colors.text }]}>
            {language === 'ko' ? preset.nameKo : preset.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDotOptions = () => (
    <View style={styles.optionSection}>
      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.dotType') || '도트 타입'}
      </Text>
      <View style={styles.optionRow}>
        {DOT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.optionButton,
              {
                backgroundColor: tempStyle.dotType === type ? colors.primary : colors.inputBackground,
                borderColor: tempStyle.dotType === type ? colors.primary : colors.border,
              },
            ]}
            onPress={() => updateStyle('dotType', type)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionButtonText,
                { color: tempStyle.dotType === type ? '#fff' : colors.text },
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.optionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('generator.qrStyle.dotColor') || '도트 색상'}
      </Text>
      <View style={styles.colorGrid}>
        {COLOR_PRESETS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              {
                backgroundColor: color,
                borderColor: tempStyle.dotColor === color ? colors.primary : colors.border,
                borderWidth: tempStyle.dotColor === color ? 3 : 1,
              },
            ]}
            onPress={() => {
              updateStyle('dotColor', color);
              updateStyle('dotGradient', null);
            }}
            activeOpacity={0.7}
          />
        ))}
      </View>

      <Text style={[styles.optionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('generator.qrStyle.gradients') || '그라데이션'}
      </Text>
      <View style={styles.gradientRow}>
        <TouchableOpacity
          style={[
            styles.gradientButton,
            {
              backgroundColor: colors.inputBackground,
              borderColor: !tempStyle.dotGradient ? colors.primary : colors.border,
              borderWidth: !tempStyle.dotGradient ? 2 : 1,
            },
          ]}
          onPress={() => updateStyle('dotGradient', null)}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.gradientButtonText, { color: colors.textSecondary }]}>None</Text>
        </TouchableOpacity>
        {GRADIENT_PRESETS.map((gradient, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.gradientButton,
              {
                borderColor: JSON.stringify(tempStyle.dotGradient?.colorStops) === JSON.stringify(gradient.colorStops)
                  ? colors.primary
                  : colors.border,
                borderWidth: JSON.stringify(tempStyle.dotGradient?.colorStops) === JSON.stringify(gradient.colorStops) ? 2 : 1,
              },
            ]}
            onPress={() => updateStyle('dotGradient', { type: 'linear', rotation: 45, colorStops: gradient.colorStops })}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.gradientPreview,
                {
                  backgroundColor: gradient.colorStops[0].color,
                },
              ]}
            >
              <View
                style={[
                  styles.gradientPreviewHalf,
                  { backgroundColor: gradient.colorStops[1].color },
                ]}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCornerOptions = () => (
    <View style={styles.optionSection}>
      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.cornerSquareType') || '코너 사각형 타입'}
      </Text>
      <View style={styles.optionRow}>
        {CORNER_SQUARE_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.optionButton,
              {
                backgroundColor: tempStyle.cornerSquareType === type ? colors.primary : colors.inputBackground,
                borderColor: tempStyle.cornerSquareType === type ? colors.primary : colors.border,
              },
            ]}
            onPress={() => updateStyle('cornerSquareType', type)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionButtonText,
                { color: tempStyle.cornerSquareType === type ? '#fff' : colors.text },
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.optionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('generator.qrStyle.cornerSquareColor') || '코너 사각형 색상'}
      </Text>
      <View style={styles.colorGrid}>
        {COLOR_PRESETS.slice(0, 10).map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              {
                backgroundColor: color,
                borderColor: tempStyle.cornerSquareColor === color ? colors.primary : colors.border,
                borderWidth: tempStyle.cornerSquareColor === color ? 3 : 1,
              },
            ]}
            onPress={() => updateStyle('cornerSquareColor', color)}
            activeOpacity={0.7}
          />
        ))}
      </View>

      <Text style={[styles.optionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('generator.qrStyle.cornerDotType') || '코너 도트 타입'}
      </Text>
      <View style={styles.optionRow}>
        {CORNER_DOT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.optionButton,
              {
                backgroundColor: tempStyle.cornerDotType === type ? colors.primary : colors.inputBackground,
                borderColor: tempStyle.cornerDotType === type ? colors.primary : colors.border,
              },
            ]}
            onPress={() => updateStyle('cornerDotType', type)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionButtonText,
                { color: tempStyle.cornerDotType === type ? '#fff' : colors.text },
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.optionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('generator.qrStyle.cornerDotColor') || '코너 도트 색상'}
      </Text>
      <View style={styles.colorGrid}>
        {COLOR_PRESETS.slice(0, 10).map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              {
                backgroundColor: color,
                borderColor: tempStyle.cornerDotColor === color ? colors.primary : colors.border,
                borderWidth: tempStyle.cornerDotColor === color ? 3 : 1,
              },
            ]}
            onPress={() => updateStyle('cornerDotColor', color)}
            activeOpacity={0.7}
          />
        ))}
      </View>
    </View>
  );

  const renderColorOptions = () => (
    <View style={styles.optionSection}>
      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.backgroundColor') || '배경 색상'}
      </Text>
      <View style={styles.colorGrid}>
        {COLOR_PRESETS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              {
                backgroundColor: color,
                borderColor: tempStyle.backgroundColor === color ? colors.primary : colors.border,
                borderWidth: tempStyle.backgroundColor === color ? 3 : 1,
              },
            ]}
            onPress={() => updateStyle('backgroundColor', color)}
            activeOpacity={0.7}
          />
        ))}
      </View>

      <Text style={[styles.optionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('generator.qrStyle.errorCorrection') || '오류 보정 레벨'}
      </Text>
      <View style={styles.optionRow}>
        {['L', 'M', 'Q', 'H'].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.optionButton,
              {
                backgroundColor: tempStyle.errorCorrectionLevel === level ? colors.primary : colors.inputBackground,
                borderColor: tempStyle.errorCorrectionLevel === level ? colors.primary : colors.border,
                flex: 1,
              },
            ]}
            onPress={() => updateStyle('errorCorrectionLevel', level)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionButtonText,
                { color: tempStyle.errorCorrectionLevel === level ? '#fff' : colors.text },
              ]}
            >
              {level}
            </Text>
            <Text
              style={[
                styles.optionButtonSubtext,
                { color: tempStyle.errorCorrectionLevel === level ? 'rgba(255,255,255,0.7)' : colors.textTertiary },
              ]}
            >
              {level === 'L' ? '7%' : level === 'M' ? '15%' : level === 'Q' ? '25%' : '30%'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.optionHint, { color: colors.textTertiary }]}>
        {t('generator.qrStyle.errorCorrectionHint') || '높을수록 손상된 QR코드도 인식 가능'}
      </Text>
    </View>
  );

  const tabs = [
    { id: 'presets', label: t('generator.qrStyle.presets') || '프리셋', icon: 'color-palette-outline' },
    { id: 'dots', label: t('generator.qrStyle.dots') || '도트', icon: 'grid-outline' },
    { id: 'corners', label: t('generator.qrStyle.corners') || '코너', icon: 'scan-outline' },
    { id: 'colors', label: t('generator.qrStyle.colors') || '색상', icon: 'color-fill-outline' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('generator.qrStyle.title') || 'QR 스타일'}
          </Text>
          <TouchableOpacity onPress={handleApply} style={styles.headerButton}>
            <Text style={[styles.applyText, { color: colors.primary }]}>
              {t('common.apply') || '적용'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Preview */}
        <View style={[styles.previewContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.previewWrapper, { backgroundColor: tempStyle.backgroundColor || '#ffffff' }]}>
            <StyledQRCode
              key={previewKey}
              value={previewValue}
              size={140}
              qrStyle={tempStyle}
            />
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.id ? colors.primary : colors.textTertiary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.id ? colors.primary : colors.textTertiary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'presets' && renderPresets()}
          {activeTab === 'dots' && renderDotOptions()}
          {activeTab === 'corners' && renderCornerOptions()}
          {activeTab === 'colors' && renderColorOptions()}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  applyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  previewWrapper: {
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetItem: {
    width: '47%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  presetPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  presetDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  presetDot: {
    width: 10,
    height: 10,
  },
  presetName: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionSection: {
    gap: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  optionButtonSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  optionHint: {
    fontSize: 12,
    marginTop: 4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  gradientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gradientButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gradientButtonText: {
    fontSize: 10,
    marginTop: 2,
  },
  gradientPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  gradientPreviewHalf: {
    width: '100%',
    height: '50%',
  },
});
