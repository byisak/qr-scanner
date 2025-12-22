// components/QRStylePicker.js - QR 코드 스타일 선택 모달
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import StyledQRCode, { DOT_TYPES, CORNER_SQUARE_TYPES, CORNER_DOT_TYPES } from './StyledQRCode';
import ColorPicker, { Panel1, Swatches, Preview, HueSlider, OpacitySlider } from 'reanimated-color-picker';

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
      margin: 10,
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
      margin: 10,
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
      margin: 10,
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
      margin: 10,
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
      margin: 10,
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
      margin: 10,
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
      margin: 10,
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
      margin: 10,
    },
  },
];

export { QR_STYLE_PRESETS, COLOR_PRESETS, GRADIENT_PRESETS };

// 색상 선택 컴포넌트
function ColorPickerSection({ label, color, onColorChange, useGradient, gradient, onGradientChange, onGradientToggle, colors, showGradientOption = true }) {
  const [hexInput, setHexInput] = useState(color || '#000000');
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    setHexInput(color || '#000000');
  }, [color]);

  const handleHexChange = (text) => {
    setHexInput(text);
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      onColorChange(text);
    }
  };

  const handleHexSubmit = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      onColorChange(hexInput);
    } else if (/^[0-9A-Fa-f]{6}$/.test(hexInput)) {
      onColorChange('#' + hexInput);
      setHexInput('#' + hexInput);
    }
  };

  const onSelectColor = useCallback(({ hex }) => {
    onColorChange(hex);
    setHexInput(hex);
  }, [onColorChange]);

  return (
    <View style={styles.colorPickerContainer}>
      <Text style={[styles.optionTitle, { color: colors.text }]}>{label}</Text>

      {showGradientOption && (
        <View style={styles.colorTypeRow}>
          <TouchableOpacity
            style={[styles.colorTypeButton, !useGradient && styles.colorTypeButtonActive, { borderColor: colors.border }]}
            onPress={() => onGradientToggle(false)}
          >
            <Ionicons name="color-fill" size={16} color={!useGradient ? colors.primary : colors.textSecondary} />
            <Text style={[styles.colorTypeText, { color: !useGradient ? colors.primary : colors.textSecondary }]}>
              단색
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.colorTypeButton, useGradient && styles.colorTypeButtonActive, { borderColor: colors.border }]}
            onPress={() => onGradientToggle(true)}
          >
            <Ionicons name="color-palette" size={16} color={useGradient ? colors.primary : colors.textSecondary} />
            <Text style={[styles.colorTypeText, { color: useGradient ? colors.primary : colors.textSecondary }]}>
              그라데이션
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(!showGradientOption || !useGradient) ? (
        <>
          {/* 색상 선택 버튼 */}
          <View style={styles.hexInputRow}>
            <TouchableOpacity
              style={[styles.colorPreviewSmall, { backgroundColor: color }]}
              onPress={() => setShowColorPicker(true)}
            />
            <TextInput
              style={[styles.hexInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              value={hexInput}
              onChangeText={handleHexChange}
              onBlur={handleHexSubmit}
              placeholder="#000000"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              maxLength={7}
            />
            <TouchableOpacity
              style={[styles.colorPickerButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowColorPicker(true)}
            >
              <Ionicons name="color-palette" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* 프리셋 색상 */}
          <View style={styles.colorGrid}>
            {COLOR_PRESETS.map((presetColor) => (
              <TouchableOpacity
                key={presetColor}
                style={[
                  styles.colorButton,
                  {
                    backgroundColor: presetColor,
                    borderColor: color === presetColor ? colors.primary : colors.border,
                    borderWidth: color === presetColor ? 3 : 1,
                  },
                ]}
                onPress={() => {
                  onColorChange(presetColor);
                  setHexInput(presetColor);
                }}
                activeOpacity={0.7}
              />
            ))}
          </View>

          {/* 컬러 피커 모달 */}
          <Modal visible={showColorPicker} animationType="slide" transparent>
            <View style={styles.colorPickerModalOverlay}>
              <View style={[styles.colorPickerModal, { backgroundColor: colors.surface }]}>
                <View style={styles.colorPickerModalHeader}>
                  <Text style={[styles.colorPickerModalTitle, { color: colors.text }]}>색상 선택</Text>
                  <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ColorPicker style={styles.colorPickerWrapper} value={color} onComplete={onSelectColor}>
                  <Preview />
                  <Panel1 style={styles.colorPanel} />
                  <HueSlider style={styles.hueSlider} />
                  <Swatches colors={COLOR_PRESETS} style={styles.swatches} />
                </ColorPicker>

                <TouchableOpacity
                  style={[styles.colorPickerDoneButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowColorPicker(false)}
                >
                  <Text style={styles.colorPickerDoneText}>확인</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        <>
          {/* 그라데이션 프리셋 */}
          <View style={styles.gradientRow}>
            {GRADIENT_PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.gradientButton,
                  {
                    borderColor: JSON.stringify(gradient?.colorStops) === JSON.stringify(preset.colorStops)
                      ? colors.primary
                      : colors.border,
                    borderWidth: JSON.stringify(gradient?.colorStops) === JSON.stringify(preset.colorStops) ? 2 : 1,
                  },
                ]}
                onPress={() => onGradientChange({ type: 'linear', rotation: gradient?.rotation || 0, colorStops: preset.colorStops })}
                activeOpacity={0.7}
              >
                <View style={[styles.gradientPreview, { backgroundColor: preset.colorStops[0].color }]}>
                  <View style={[styles.gradientPreviewHalf, { backgroundColor: preset.colorStops[1].color }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 그라데이션 회전 */}
          {gradient && (
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, { color: colors.text }]}>
                회전: {gradient.rotation || 0}°
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={360}
                step={15}
                value={gradient.rotation || 0}
                onValueChange={(value) => onGradientChange({ ...gradient, rotation: value })}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function QRStylePicker({
  visible,
  onClose,
  currentStyle,
  onStyleChange,
  previewValue = 'QR PREVIEW',
}) {
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [activeTab, setActiveTab] = useState('presets');
  const [tempStyle, setTempStyle] = useState(currentStyle);
  const [previewKey, setPreviewKey] = useState(0);

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
        {t('generator.qrStyle.dotType') || '도트 스타일'}
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

      <View style={styles.sectionDivider} />

      <ColorPickerSection
        label={t('generator.qrStyle.dotColor') || '도트 색상'}
        color={tempStyle.dotColor}
        onColorChange={(color) => updateStyle('dotColor', color)}
        useGradient={!!tempStyle.dotGradient}
        gradient={tempStyle.dotGradient}
        onGradientChange={(gradient) => updateStyle('dotGradient', gradient)}
        onGradientToggle={(useGradient) => {
          if (!useGradient) {
            updateStyle('dotGradient', null);
          } else {
            updateStyle('dotGradient', { type: 'linear', rotation: 0, colorStops: GRADIENT_PRESETS[0].colorStops });
          }
        }}
        colors={colors}
      />
    </View>
  );

  const renderCornerOptions = () => (
    <View style={styles.optionSection}>
      {/* Corner Square */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        코너 사각형 (Corners Square)
      </Text>

      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.cornerSquareType') || '스타일'}
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

      <ColorPickerSection
        label="색상"
        color={tempStyle.cornerSquareColor}
        onColorChange={(color) => updateStyle('cornerSquareColor', color)}
        useGradient={!!tempStyle.cornerSquareGradient}
        gradient={tempStyle.cornerSquareGradient}
        onGradientChange={(gradient) => updateStyle('cornerSquareGradient', gradient)}
        onGradientToggle={(useGradient) => {
          if (!useGradient) {
            updateStyle('cornerSquareGradient', null);
          } else {
            updateStyle('cornerSquareGradient', { type: 'linear', rotation: 0, colorStops: GRADIENT_PRESETS[0].colorStops });
          }
        }}
        colors={colors}
      />

      <View style={styles.sectionDivider} />

      {/* Corner Dot */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        코너 도트 (Corners Dot)
      </Text>

      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.cornerDotType') || '스타일'}
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

      <ColorPickerSection
        label="색상"
        color={tempStyle.cornerDotColor}
        onColorChange={(color) => updateStyle('cornerDotColor', color)}
        useGradient={!!tempStyle.cornerDotGradient}
        gradient={tempStyle.cornerDotGradient}
        onGradientChange={(gradient) => updateStyle('cornerDotGradient', gradient)}
        onGradientToggle={(useGradient) => {
          if (!useGradient) {
            updateStyle('cornerDotGradient', null);
          } else {
            updateStyle('cornerDotGradient', { type: 'linear', rotation: 0, colorStops: GRADIENT_PRESETS[0].colorStops });
          }
        }}
        colors={colors}
      />
    </View>
  );

  const renderBackgroundOptions = () => (
    <View style={styles.optionSection}>
      {/* Background Color */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        배경 설정 (Background)
      </Text>

      <ColorPickerSection
        label="배경 색상"
        color={tempStyle.backgroundColor}
        onColorChange={(color) => updateStyle('backgroundColor', color)}
        useGradient={!!tempStyle.backgroundGradient}
        gradient={tempStyle.backgroundGradient}
        onGradientChange={(gradient) => updateStyle('backgroundGradient', gradient)}
        onGradientToggle={(useGradient) => {
          if (!useGradient) {
            updateStyle('backgroundGradient', null);
          } else {
            updateStyle('backgroundGradient', { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#f0f0f0' }] });
          }
        }}
        colors={colors}
      />

      <View style={styles.sectionDivider} />

      {/* Margin */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        여백 설정
      </Text>

      <View style={styles.sliderContainer}>
        <Text style={[styles.sliderLabel, { color: colors.text }]}>
          여백 (Margin): {tempStyle.margin || 0}px
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={50}
          step={5}
          value={tempStyle.margin || 0}
          onValueChange={(value) => updateStyle('margin', value)}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      </View>

      <View style={styles.sectionDivider} />

      {/* QR Options */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        QR 옵션
      </Text>

      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.errorCorrection') || '오류 보정 레벨'}
      </Text>
      <View style={styles.optionRow}>
        {['L', 'M', 'Q', 'H'].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.optionButton,
              {
                backgroundColor: (tempStyle.errorCorrectionLevel || 'M') === level ? colors.primary : colors.inputBackground,
                borderColor: (tempStyle.errorCorrectionLevel || 'M') === level ? colors.primary : colors.border,
                flex: 1,
              },
            ]}
            onPress={() => updateStyle('errorCorrectionLevel', level)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionButtonText,
                { color: (tempStyle.errorCorrectionLevel || 'M') === level ? '#fff' : colors.text },
              ]}
            >
              {level}
            </Text>
            <Text
              style={[
                styles.optionButtonSubtext,
                { color: (tempStyle.errorCorrectionLevel || 'M') === level ? 'rgba(255,255,255,0.7)' : colors.textTertiary },
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

  const renderImageOptions = () => (
    <View style={styles.optionSection}>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        이미지/로고 설정 (Image Options)
      </Text>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>
          배경 도트 숨기기
        </Text>
        <Switch
          value={tempStyle.imageOptions?.hideBackgroundDots ?? true}
          onValueChange={(value) => updateStyle('imageOptions', { ...tempStyle.imageOptions, hideBackgroundDots: value })}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.sliderContainer}>
        <Text style={[styles.sliderLabel, { color: colors.text }]}>
          이미지 크기: {((tempStyle.imageOptions?.imageSize || 0.4) * 100).toFixed(0)}%
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={0.5}
          step={0.05}
          value={tempStyle.imageOptions?.imageSize || 0.4}
          onValueChange={(value) => updateStyle('imageOptions', { ...tempStyle.imageOptions, imageSize: value })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      </View>

      <View style={styles.sliderContainer}>
        <Text style={[styles.sliderLabel, { color: colors.text }]}>
          이미지 여백: {tempStyle.imageOptions?.margin ?? 5}px
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={20}
          step={1}
          value={tempStyle.imageOptions?.margin ?? 5}
          onValueChange={(value) => updateStyle('imageOptions', { ...tempStyle.imageOptions, margin: value })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      </View>

      <Text style={[styles.optionHint, { color: colors.textTertiary, marginTop: 10 }]}>
        ※ 로고 이미지는 QR 생성 화면에서 추가할 수 있습니다.
      </Text>
    </View>
  );

  const tabs = [
    { id: 'presets', label: t('generator.qrStyle.presets') || '프리셋', icon: 'color-palette-outline' },
    { id: 'dots', label: t('generator.qrStyle.dots') || '도트', icon: 'grid-outline' },
    { id: 'corners', label: t('generator.qrStyle.corners') || '코너', icon: 'scan-outline' },
    { id: 'background', label: '배경', icon: 'image-outline' },
    { id: 'image', label: '이미지', icon: 'images-outline' },
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabScrollContainer, { backgroundColor: colors.surface }]}
          contentContainerStyle={styles.tabScrollContent}
        >
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
        </ScrollView>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'presets' && renderPresets()}
          {activeTab === 'dots' && renderDotOptions()}
          {activeTab === 'corners' && renderCornerOptions()}
          {activeTab === 'background' && renderBackgroundOptions()}
          {activeTab === 'image' && renderImageOptions()}
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
  tabScrollContainer: {
    maxHeight: 50,
  },
  tabScrollContent: {
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    gap: 16,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginVertical: 16,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
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
  colorPickerContainer: {
    gap: 12,
  },
  colorTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  colorTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorTypeButtonActive: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  colorTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  colorPreviewSmall: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  hexInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  gradientPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  gradientPreviewHalf: {
    width: '100%',
    height: '50%',
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  colorPickerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  colorPickerModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  colorPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  colorPickerWrapper: {
    gap: 16,
  },
  colorPanel: {
    height: 200,
    borderRadius: 12,
  },
  hueSlider: {
    height: 30,
    borderRadius: 8,
  },
  swatches: {
    marginTop: 8,
  },
  colorPickerDoneButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  colorPickerDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
