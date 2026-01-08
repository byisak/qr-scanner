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
  TextInput,
  Switch,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect, G, Defs, ClipPath } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { FREE_QR_STYLE_INDEX } from '../config/lockedFeatures';
import StyledQRCode, { DOT_TYPES, CORNER_SQUARE_TYPES, CORNER_DOT_TYPES } from './StyledQRCode';
import NativeColorPicker from './NativeColorPicker';
import QRFrameRenderer, { FRAME_SVG_DATA } from './QRFrameRenderer';

// QR 프레임 프리셋
const QR_FRAMES = [
  {
    id: 'none',
    name: 'No Frame',
    nameKo: '프레임 없음',
    preview: null,
  },
  {
    id: 'scan-me',
    name: 'Scan Me',
    nameKo: 'Scan Me',
    // 프레임 파일 경로 (assets/qr-frames/ 폴더 기준)
    fileName: 'frame-scan-me.svg',
    // SVG viewBox 기준 QR코드 배치 위치 (700x700 viewBox 기준)
    viewBox: '0 0 700 700',
    qrPosition: { x: 247, y: 291, size: 206 },
    // 미리보기용 간단한 설명
    previewColor: '#020203',
  },
  {
    id: 'scan-me-label',
    name: 'Scan Me Label',
    nameKo: 'Scan Me 라벨',
    fileName: 'frame-scan-me-label.svg',
    viewBox: '0 0 700 700',
    qrPosition: { x: 198, y: 160, size: 305 },
    previewColor: '#020203',
  },
];


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

export { QR_STYLE_PRESETS, COLOR_PRESETS, GRADIENT_PRESETS, QR_FRAMES };

// 색상 선택 컴포넌트
function ColorPickerSection({ label, color, onColorChange, useGradient, gradient, onGradientChange, onGradientToggle, colors, showGradientOption = true, t }) {
  const [showColorPicker, setShowColorPicker] = useState(false);

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
              {t('generator.qrStyle.solidColor')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.colorTypeButton, useGradient && styles.colorTypeButtonActive, { borderColor: colors.border }]}
            onPress={() => onGradientToggle(true)}
          >
            <Ionicons name="color-palette" size={16} color={useGradient ? colors.primary : colors.textSecondary} />
            <Text style={[styles.colorTypeText, { color: useGradient ? colors.primary : colors.textSecondary }]}>
              {t('generator.qrStyle.gradient')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(!showGradientOption || !useGradient) ? (
        <>
          {/* 색상 그리드 - 컬러피커 버튼 + 프리셋 색상 */}
          <View style={styles.colorGrid}>
            {/* 컬러피커 버튼 (맨 앞) - 컬러 휠 아이콘 */}
            <TouchableOpacity
              style={styles.rainbowPickerButton}
              onPress={() => setShowColorPicker(true)}
              activeOpacity={0.7}
            >
              <Svg width={44} height={44} viewBox="5 5 90 90">
                {/* 8개 색상 세그먼트 - 원형 파이 조각 */}
                <Path d="M50 50 L50 5 A45 45 0 0 1 81.82 18.18 Z" fill="#EC4899" />
                <Path d="M50 50 L81.82 18.18 A45 45 0 0 1 95 50 Z" fill="#EF4444" />
                <Path d="M50 50 L95 50 A45 45 0 0 1 81.82 81.82 Z" fill="#F97316" />
                <Path d="M50 50 L81.82 81.82 A45 45 0 0 1 50 95 Z" fill="#EAB308" />
                <Path d="M50 50 L50 95 A45 45 0 0 1 18.18 81.82 Z" fill="#22C55E" />
                <Path d="M50 50 L18.18 81.82 A45 45 0 0 1 5 50 Z" fill="#14B8A6" />
                <Path d="M50 50 L5 50 A45 45 0 0 1 18.18 18.18 Z" fill="#3B82F6" />
                <Path d="M50 50 L18.18 18.18 A45 45 0 0 1 50 5 Z" fill="#8B5CF6" />
                {/* 중앙 원 - 현재 선택된 색상 표시 */}
                <Circle cx="50" cy="50" r="18" fill={color} stroke="#fff" strokeWidth="3" />
              </Svg>
            </TouchableOpacity>

            {/* 프리셋 색상들 */}
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
                onPress={() => onColorChange(presetColor)}
                activeOpacity={0.7}
              />
            ))}
          </View>

          {/* 컬러 피커 모달 */}
          <NativeColorPicker
            visible={showColorPicker}
            onClose={() => setShowColorPicker(false)}
            color={color}
            onColorChange={(newColor) => onColorChange(newColor)}
            colors={colors}
          />
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
            <View style={styles.stepperContainer}>
              <Text style={[styles.stepperLabel, { color: colors.text }]}>{t('generator.qrStyle.rotation')}</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => onGradientChange({ ...gradient, rotation: Math.max(0, (gradient.rotation || 0) - 45) })}
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{gradient.rotation || 0}°</Text>
                <TouchableOpacity
                  style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => onGradientChange({ ...gradient, rotation: Math.min(360, (gradient.rotation || 0) + 45) })}
                >
                  <Ionicons name="add" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
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
  logoImage,
  onPickLogo,
  onRemoveLogo,
  selectedFrame = null,
  onFrameChange,
}) {
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const { isQrStyleLocked, showQrStyleUnlockAlert } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [activeTab, setActiveTab] = useState('presets');
  const [tempStyle, setTempStyle] = useState(currentStyle);
  const [tempFrame, setTempFrame] = useState(selectedFrame);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    setPreviewKey(prev => prev + 1);
  }, [tempStyle, tempFrame]);

  useEffect(() => {
    if (visible) {
      setTempStyle(currentStyle);
      setTempFrame(selectedFrame);
    }
  }, [visible, currentStyle, selectedFrame]);

  const handleApply = () => {
    onStyleChange(tempStyle);
    if (onFrameChange) {
      onFrameChange(tempFrame);
    }
    onClose();
  };

  const handlePresetSelect = (preset) => {
    // 기존 설정과 병합 (프리셋 값이 기존 설정을 덮어씀)
    setTempStyle((prev) => ({
      ...prev,
      ...preset.style,
    }));
  };

  const updateStyle = (key, value) => {
    setTempStyle((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderPresets = () => (
    <View style={styles.presetGrid}>
      {QR_STYLE_PRESETS.map((preset, index) => {
        const isStyleLocked = isQrStyleLocked(index);
        return (
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
            onPress={() => {
              if (isStyleLocked) {
                showQrStyleUnlockAlert(() => handlePresetSelect(preset));
              } else {
                handlePresetSelect(preset);
              }
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.presetPreview,
                { backgroundColor: preset.style.backgroundColor || '#fff' },
                isStyleLocked && { opacity: 0.5 },
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
              {isStyleLocked && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={20} color="#666" />
                </View>
              )}
            </View>
            <Text style={[styles.presetName, { color: isStyleLocked ? colors.textTertiary : colors.text }]}>
              {language === 'ko' ? preset.nameKo : preset.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFrames = () => (
    <View style={styles.frameGrid}>
      {QR_FRAMES.map((frame) => {
        const isSelected = tempFrame?.id === frame.id || (!tempFrame && frame.id === 'none');
        return (
          <TouchableOpacity
            key={frame.id}
            style={[
              styles.frameItem,
              {
                backgroundColor: colors.inputBackground,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => setTempFrame(frame.id === 'none' ? null : frame)}
            activeOpacity={0.7}
          >
            <View style={[styles.framePreview, { backgroundColor: '#fff' }]}>
              {frame.id === 'none' ? (
                <View style={styles.noFramePreview}>
                  <Ionicons name="close-circle-outline" size={40} color={colors.textTertiary} />
                </View>
              ) : (
                <View style={styles.framePreviewContent}>
                  {/* 프레임 미리보기 - 실제 SVG 사용 */}
                  {FRAME_SVG_DATA[frame.id] ? (
                    <SvgXml
                      xml={FRAME_SVG_DATA[frame.id]}
                      width={90}
                      height={90}
                    />
                  ) : (
                    <View style={[styles.frameThumbnail, { borderColor: frame.previewColor || '#000' }]}>
                      <View style={[styles.frameQrPlaceholder, { backgroundColor: frame.previewColor || '#000' }]} />
                      <Text style={[styles.frameLabel, { color: frame.previewColor || '#000' }]}>
                        {frame.name}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Text style={[styles.frameName, { color: colors.text }]}>
              {language === 'ko' ? frame.nameKo : frame.name}
            </Text>
            {isSelected && (
              <View style={[styles.frameSelectedBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderDotOptions = () => (
    <View style={styles.optionSection}>
      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.dotType')}
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
        label={t('generator.qrStyle.dotColor')}
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
        t={t}
      />
    </View>
  );

  const renderCornerOptions = () => (
    <View style={styles.optionSection}>
      {/* Corner Square */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.cornerSquare')}
      </Text>

      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.cornerSquareType')}
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
        label={t('generator.qrStyle.color')}
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
        t={t}
      />

      <View style={styles.sectionDivider} />

      {/* Corner Dot */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.cornerDot')}
      </Text>

      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {t('generator.qrStyle.cornerDotType')}
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
        label={t('generator.qrStyle.color')}
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
        t={t}
      />
    </View>
  );

  const renderBackgroundOptions = () => (
    <View style={styles.optionSection}>
      {/* Background Color */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.backgroundColor')}
      </Text>

      <ColorPickerSection
        label={t('generator.qrStyle.backgroundColor')}
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
        t={t}
      />
    </View>
  );

  const renderSettingsOptions = () => (
    <View style={styles.optionSection}>
      {/* QR Size */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.sizeSettings')}
      </Text>

      <View style={styles.stepperContainer}>
        <Text style={[styles.stepperLabel, { color: colors.text }]}>{t('generator.qrStyle.width')}</Text>
        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('width', Math.max(100, (tempStyle.width || 300) - 50))}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{tempStyle.width || 300}px</Text>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('width', Math.min(1000, (tempStyle.width || 300) + 50))}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.stepperContainer}>
        <Text style={[styles.stepperLabel, { color: colors.text }]}>{t('generator.qrStyle.height')}</Text>
        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('height', Math.max(100, (tempStyle.height || 300) - 50))}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{tempStyle.height || 300}px</Text>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('height', Math.min(1000, (tempStyle.height || 300) + 50))}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Margin */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.marginSettings')}
      </Text>

      <View style={styles.stepperContainer}>
        <Text style={[styles.stepperLabel, { color: colors.text }]}>{t('generator.qrStyle.margin')}</Text>
        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('margin', Math.max(0, (tempStyle.margin || 0) - 5))}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{tempStyle.margin || 0}px</Text>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('margin', Math.min(50, (tempStyle.margin || 0) + 5))}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionDivider} />

      {/* Error Correction Level */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.errorCorrection')}
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
        {t('generator.qrStyle.errorCorrectionHint')}
      </Text>
    </View>
  );

  const renderImageOptions = () => (
    <View style={styles.optionSection}>
      {/* 로고 이미지 업로드 */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.logoImage')}
      </Text>

      <View style={styles.logoSection}>
        {logoImage ? (
          <View style={styles.logoPreviewContainer}>
            <View style={[styles.logoPreview, { borderColor: colors.border }]}>
              <Image
                source={{ uri: logoImage }}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.logoButtonsRow}>
              <TouchableOpacity
                style={[styles.logoButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={onPickLogo}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.text} />
                <Text style={[styles.logoButtonText, { color: colors.text }]}>{t('generator.qrStyle.change')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoButton, { backgroundColor: '#FF3B30' }]}
                onPress={onRemoveLogo}
                activeOpacity={0.7}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={[styles.logoButtonText, { color: '#fff' }]}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.logoAddButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={onPickLogo}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
            <Text style={[styles.logoAddText, { color: colors.text }]}>{t('generator.qrStyle.addLogo')}</Text>
            <Text style={[styles.logoAddHint, { color: colors.textTertiary }]}>
              {t('generator.qrStyle.logoHint')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionDivider} />

      {/* 이미지 옵션 */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        {t('generator.qrStyle.imageOptions')}
      </Text>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>
          {t('generator.qrStyle.hideBackgroundDots')}
        </Text>
        <Switch
          value={tempStyle.imageOptions?.hideBackgroundDots ?? true}
          onValueChange={(value) => updateStyle('imageOptions', { ...tempStyle.imageOptions, hideBackgroundDots: value })}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.stepperContainer}>
        <Text style={[styles.stepperLabel, { color: colors.text }]}>{t('generator.qrStyle.imageSize')}</Text>
        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('imageOptions', { ...tempStyle.imageOptions, imageSize: Math.max(0.1, (tempStyle.imageOptions?.imageSize || 0.4) - 0.05) })}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{((tempStyle.imageOptions?.imageSize || 0.4) * 100).toFixed(0)}%</Text>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('imageOptions', { ...tempStyle.imageOptions, imageSize: Math.min(0.5, (tempStyle.imageOptions?.imageSize || 0.4) + 0.05) })}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.stepperContainer}>
        <Text style={[styles.stepperLabel, { color: colors.text }]}>{t('generator.qrStyle.imageMargin')}</Text>
        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('imageOptions', { ...tempStyle.imageOptions, margin: Math.max(0, (tempStyle.imageOptions?.margin ?? 5) - 1) })}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{tempStyle.imageOptions?.margin ?? 5}px</Text>
          <TouchableOpacity
            style={[styles.stepperButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => updateStyle('imageOptions', { ...tempStyle.imageOptions, margin: Math.min(20, (tempStyle.imageOptions?.margin ?? 5) + 1) })}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const tabs = [
    { id: 'frames', label: t('generator.qrStyle.frame'), icon: 'albums-outline' },
    { id: 'presets', label: t('generator.qrStyle.presets'), icon: 'color-palette-outline' },
    { id: 'dots', label: t('generator.qrStyle.dots'), icon: 'grid-outline' },
    { id: 'corners', label: t('generator.qrStyle.corners'), icon: 'scan-outline' },
    { id: 'background', label: t('generator.qrStyle.background'), icon: 'image-outline' },
    // { id: 'image', label: '이미지', icon: 'images-outline' }, // 추후 개발 예정
    { id: 'settings', label: t('generator.qrStyle.settings'), icon: 'settings-outline' },
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
            {t('generator.qrStyle.title')}
          </Text>
          <TouchableOpacity onPress={handleApply} style={styles.headerButton}>
            <Text style={[styles.applyText, { color: colors.primary }]}>
              {t('common.apply')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Preview */}
        <View style={[styles.previewContainer, { backgroundColor: colors.surface }]}>
          {tempFrame ? (
            // 프레임이 선택된 경우 - QRFrameRenderer 사용
            <QRFrameRenderer
              key={previewKey}
              frame={tempFrame}
              qrValue={previewValue}
              qrStyle={tempStyle}
              size={180}
            />
          ) : (
            // 프레임이 없는 경우 - 기존 방식
            <View style={[styles.previewWrapper, { backgroundColor: tempStyle.backgroundColor || '#ffffff' }]}>
              <StyledQRCode
                key={previewKey}
                value={previewValue}
                size={140}
                qrStyle={{ ...tempStyle, width: undefined, height: undefined }}
              />
            </View>
          )}
          {(tempStyle.width || tempStyle.height) && (
            <Text style={[styles.sizeIndicator, { color: colors.textSecondary }]}>
              {t('generator.qrStyle.actualSize')}: {tempStyle.width || 300} × {tempStyle.height || 300}px
            </Text>
          )}
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
          {activeTab === 'frames' && renderFrames()}
          {activeTab === 'presets' && renderPresets()}
          {activeTab === 'dots' && renderDotOptions()}
          {activeTab === 'corners' && renderCornerOptions()}
          {activeTab === 'background' && renderBackgroundOptions()}
          {/* {activeTab === 'image' && renderImageOptions()} */}{/* 추후 개발 예정 */}
          {activeTab === 'settings' && renderSettingsOptions()}
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
  sizeIndicator: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
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
  // Frame styles
  frameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  frameItem: {
    width: '47%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  framePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  noFramePreview: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  framePreviewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  frameThumbnail: {
    width: 80,
    height: 90,
    borderWidth: 2,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  frameQrPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  frameLabel: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  frameName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  frameSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
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
    justifyContent: 'center',
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  colorPickerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rainbowPickerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swiftUIColorPickerHost: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
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
  swiftUIPickerInline: {
    marginTop: 12,
    marginBottom: 8,
  },
  swiftUIHostInline: {
    width: '100%',
    height: 50,
  },
  // Logo Picker Styles
  logoSection: {
    marginBottom: 8,
  },
  logoPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoPreview: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoButtonsRow: {
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  logoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  logoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoAddButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  logoAddText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoAddHint: {
    fontSize: 12,
    marginTop: 4,
  },
});
