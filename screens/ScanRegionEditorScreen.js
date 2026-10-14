// screens/ScanRegionEditorScreen.js - 스캔 영역 직접 지정
// 카메라 미리보기 위에서 사각형을 끌어 옮기고 모서리로 크기를 바꾸거나, 숫자(dp)로 크기·상하좌우 위치를 넣는다.
// 숫자는 스캔 화면 카메라 영역 기준 dp로 보여 주고, 저장은 비율(0~1)로 한다 (docs/PLAN_SCAN_REGION_CUSTOM.md)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import ScanRegionOverlay, {
  SCAN_REGION_CUSTOM_KEY,
  SCAN_AREA_SIZE_KEY,
  DEFAULT_CUSTOM_REGION,
  MIN_REGION,
  clampRegion,
  customToRect,
  rectToCustom,
  parseCustomRegion,
} from '../components/ScanRegionOverlay';
import { SCAN_REGION_MODE_KEY } from './ScanRegionSelectionScreen';

const SNAP = 8;        // 가운데선에 붙는 거리 (dp, 스캔 화면 기준)
const HANDLE = 28;     // 모서리 손잡이 (미리보기 화면 기준)
const REPEAT_DELAY = 400;
const REPEAT_EVERY = 60;

// 가운데선에 가까우면 붙인다
function snapToCenter(r, area) {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const out = { ...r };
  if (Math.abs(cx - area.width / 2) <= SNAP) out.x = Math.round(area.width / 2 - r.width / 2);
  if (Math.abs(cy - area.height / 2) <= SNAP) out.y = Math.round(area.height / 2 - r.height / 2);
  return out;
}

// −/+ 버튼: 누르면 1, 길게 누르고 있으면 10씩 빠르게
function Stepper({ label, value, onChange, colors, fonts, t }) {
  const [text, setText] = useState(String(value));
  const timer = useRef(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; setText(String(value)); }, [value]);
  useEffect(() => () => clearInterval(timer.current), []);

  const startRepeat = (delta) => {
    clearInterval(timer.current);
    timer.current = setTimeout(() => {
      timer.current = setInterval(() => onChange(valueRef.current + delta * 10), REPEAT_EVERY);
    }, REPEAT_DELAY);
  };
  const stopRepeat = () => { clearTimeout(timer.current); clearInterval(timer.current); };

  const button = (delta, icon, a11y) => (
    <MaterialPressable
      onPress={() => onChange(valueRef.current + delta)}
      onPressIn={() => startRepeat(delta)}
      onPressOut={stopRepeat}
      style={[s.stepButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${a11y}`}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </MaterialPressable>
  );

  return (
    <View style={s.stepper}>
      <Text style={[s.stepLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{label}</Text>
      <View style={s.stepRow}>
        {button(-1, 'remove', t('scanRegion.decrease'))}
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={() => {
            const n = parseInt(text, 10);
            if (Number.isFinite(n)) onChange(n);
            else setText(String(value));
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel={label}
          style={[s.stepInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
        />
        {button(1, 'add', t('scanRegion.increase'))}
      </View>
    </View>
  );
}

export default function ScanRegionEditorScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const isFocused = useIsFocused();
  const colors = isDark ? Colors.dark : Colors.light;

  const device = useCameraDevice('back');
  const { hasPermission } = useCameraPermission();

  // 스캔 화면 카메라 영역 크기(dp). 아직 스캔 화면을 연 적이 없으면 창 크기로 짐작
  const [area, setArea] = useState(null);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    (async () => {
      let a = { width: window.width, height: Math.round(window.height * 0.85) };
      let custom = { ...DEFAULT_CUSTOM_REGION };
      try {
        const [[, sizeJson], [, customJson]] = await AsyncStorage.multiGet([SCAN_AREA_SIZE_KEY, SCAN_REGION_CUSTOM_KEY]);
        const saved = sizeJson ? JSON.parse(sizeJson) : null;
        if (saved && saved.width > 0 && saved.height > 0) a = saved;
        if (customJson) custom = parseCustomRegion(customJson);
      } catch (e) {}
      setArea(a);
      setRect(customToRect(custom, a.width, a.height));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 미리보기는 스캔 화면을 비율 그대로 줄인 것
  const scale = useMemo(() => {
    if (!area) return 1;
    const maxW = window.width - SPACE.screen * 2;
    const maxH = window.height * 0.42;
    return Math.min(maxW / area.width, maxH / area.height);
  }, [area, window.width, window.height]);

  // 바꿀 때마다 화면 안으로 자르고, 잘렸으면 한 번 알린다
  const apply = useCallback((next, { snap = false, notify = true } = {}) => {
    if (!area) return;
    const wanted = snap ? snapToCenter(next, area) : next;
    const clamped = clampRegion(wanted, area.width, area.height);
    if (notify && (clamped.width !== Math.round(wanted.width) || clamped.height !== Math.round(wanted.height)
      || clamped.x !== Math.round(wanted.x) || clamped.y !== Math.round(wanted.y))) {
      feedback.info(t('scanRegion.clamped'));
    }
    setRect(clamped);
  }, [area, feedback, t]);

  // 끌기: 시작 시점 사각형 + 이동량(미리보기 px → dp)
  const startRef = useRef(null);
  const moveGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => { startRef.current = rect; })
    .onUpdate((e) => {
      const r = startRef.current;
      if (!r) return;
      apply({ ...r, x: r.x + e.translationX / scale, y: r.y + e.translationY / scale }, { snap: true, notify: false });
    });
  const cornerGesture = (corner) => Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => { startRef.current = rect; })
    .onUpdate((e) => {
      const r = startRef.current;
      if (!r) return;
      const dx = e.translationX / scale;
      const dy = e.translationY / scale;
      let { x, y, width, height } = r;
      if (corner.includes('l')) { x = Math.min(r.x + dx, r.x + r.width - MIN_REGION.width); width = r.width - (x - r.x); }
      if (corner.includes('r')) { width = r.width + dx; }
      if (corner.includes('t')) { y = Math.min(r.y + dy, r.y + r.height - MIN_REGION.height); height = r.height - (y - r.y); }
      if (corner.includes('b')) { height = r.height + dy; }
      apply({ x, y, width, height }, { notify: false });
    });

  if (!area || !rect) {
    return <View style={[s.container, { backgroundColor: colors.background }]} />;
  }

  const right = area.width - rect.x - rect.width;
  const bottom = area.height - rect.y - rect.height;
  const pw = Math.round(area.width * scale);
  const ph = Math.round(area.height * scale);
  const previewCustom = rectToCustom(rect, area.width, area.height);
  const handleStyle = (corner) => ({
    left: (rect.x + (corner.includes('r') ? rect.width : 0)) * scale - HANDLE / 2,
    top: (rect.y + (corner.includes('b') ? rect.height : 0)) * scale - HANDLE / 2,
  });

  const save = async () => {
    try {
      await AsyncStorage.multiSet([
        [SCAN_REGION_CUSTOM_KEY, JSON.stringify(rectToCustom(rect, area.width, area.height))],
        [SCAN_REGION_MODE_KEY, 'custom'],
      ]);
      router.back();
    } catch (error) {
      console.error('Save custom scan region error:', error);
      feedback.error(t('settings.saveFailed'));
    }
  };

  const quick = [
    { key: 'center', icon: 'locate-outline', onPress: () => apply({ ...rect, x: (area.width - rect.width) / 2, y: (area.height - rect.height) / 2 }) },
    { key: 'fullWidth', icon: 'swap-horizontal-outline', onPress: () => apply({ ...rect, x: 0, width: area.width }) },
    { key: 'square', icon: 'square-outline', onPress: () => {
      const side = Math.min(rect.width, rect.height, area.width, area.height);
      apply({ x: rect.x + (rect.width - side) / 2, y: rect.y + (rect.height - side) / 2, width: side, height: side });
    } },
    { key: 'reset', icon: 'refresh-outline', onPress: () => apply(customToRect(DEFAULT_CUSTOM_REGION, area.width, area.height), { notify: false }) },
  ];

  const stepProps = { colors, fonts, t };

  return (
    <GestureHandlerRootView style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('scanRegion.custom')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* 미리보기: 스캔 화면을 같은 비율로 줄인 것. 카메라 위에 영역 */}
        <View style={[s.previewWrap, { width: pw, height: ph, borderColor: colors.border }]}>
          {hasPermission && device ? (
            <Camera style={StyleSheet.absoluteFill} device={device} isActive={isFocused} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2A2F36' }]} />
          )}
          <ScanRegionOverlay mode="custom" custom={previewCustom} />
          <GestureDetector gesture={moveGesture}>
            <View
              style={[s.dragArea, { left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }]}
              accessible
              accessibilityLabel={t('scanRegion.dragHint')}
            />
          </GestureDetector>
          {['tl', 'tr', 'bl', 'br'].map((corner) => (
            <GestureDetector key={corner} gesture={cornerGesture(corner)}>
              <View style={[s.handle, handleStyle(corner)]}>
                <View style={[s.handleDot, { backgroundColor: colors.primary }]} />
              </View>
            </GestureDetector>
          ))}
        </View>
        <Text style={[s.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('scanRegion.editorHint', { width: Math.round(area.width), height: Math.round(area.height) })}
        </Text>

        {/* 빠른 버튼 */}
        <View style={s.quickRow}>
          {quick.map((q) => (
            <MaterialPressable
              key={q.key}
              onPress={q.onPress}
              style={[s.quickButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Ionicons name={q.icon} size={18} color={colors.text} />
              <Text style={[s.quickText, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                {t(`scanRegion.quick.${q.key}`)}
              </Text>
            </MaterialPressable>
          ))}
        </View>

        {/* 크기 */}
        <Text style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('scanRegion.size')}</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.stepGrid}>
            <Stepper {...stepProps} label={t('scanRegion.width')} value={rect.width}
              onChange={(v) => apply({ ...rect, x: rect.x + (rect.width - v) / 2, width: v })} />
            <Stepper {...stepProps} label={t('scanRegion.height')} value={rect.height}
              onChange={(v) => apply({ ...rect, y: rect.y + (rect.height - v) / 2, height: v })} />
          </View>
        </View>

        {/* 위치: 한쪽을 바꾸면 크기는 그대로 두고 옮긴다 */}
        <Text style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('scanRegion.position')}</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.stepGrid}>
            <Stepper {...stepProps} label={t('scanRegion.left')} value={rect.x} onChange={(v) => apply({ ...rect, x: v })} />
            <Stepper {...stepProps} label={t('scanRegion.right')} value={right} onChange={(v) => apply({ ...rect, x: area.width - v - rect.width })} />
            <Stepper {...stepProps} label={t('scanRegion.top')} value={rect.y} onChange={(v) => apply({ ...rect, y: v })} />
            <Stepper {...stepProps} label={t('scanRegion.bottom')} value={bottom} onChange={(v) => apply({ ...rect, y: area.height - v - rect.height })} />
          </View>
          <Text style={[s.unit, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRegion.unitHint')}</Text>
        </View>

        <MaterialPressable onPress={save} style={[s.saveButton, { backgroundColor: colors.primary }]} accessibilityRole="button">
          <Text style={[s.saveText, { fontFamily: fonts.semiBold }]}>{t('common.save')}</Text>
        </MaterialPressable>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  headerSide: { flex: 1, alignItems: 'flex-start' },
  iconButton: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { ...TYPE.screenTitle, flexShrink: 1, textAlign: 'center' },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACE.screen, paddingTop: 4, gap: 12 },
  previewWrap: {
    alignSelf: 'center', borderRadius: RADIUS.control, borderWidth: 1, overflow: 'hidden', backgroundColor: '#000',
  },
  dragArea: { position: 'absolute' },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  hint: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginHorizontal: 4 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickButton: {
    flexGrow: 1, flexBasis: '45%', height: SIZE.touch, borderRadius: RADIUS.control, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, overflow: 'hidden',
  },
  quickText: { fontSize: 13 },
  sectionHeader: { ...TYPE.sectionHeader, marginTop: 4, marginHorizontal: 4, marginBottom: -4 },
  card: { borderRadius: RADIUS.group, borderWidth: 1, padding: 16, gap: 8 },
  stepGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 12 },
  stepper: { flexBasis: '46%', flexGrow: 1, gap: 6 },
  stepLabel: { fontSize: 13 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: RADIUS.control, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  stepInput: {
    flex: 1, minWidth: 0, height: SIZE.touch, borderRadius: RADIUS.control, borderWidth: 1,
    textAlign: 'center', fontSize: 15, fontFamily: MONO, paddingHorizontal: 4,
  },
  unit: { fontSize: 12, marginTop: 2 },
  saveButton: {
    height: SIZE.primaryButton, borderRadius: RADIUS.button, alignItems: 'center', justifyContent: 'center',
    marginTop: 8, overflow: 'hidden',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
