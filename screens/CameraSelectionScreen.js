// screens/CameraSelectionScreen.js - 카메라 선택 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';

// 사용 가능한 카메라 타입 목록
const CAMERA_TYPES = [
  { key: 'back', nameKey: 'backCamera', descKey: 'backCameraDesc', icon: 'camera-outline' },
  { key: 'front', nameKey: 'frontCamera', descKey: 'frontCameraDesc', icon: 'camera-reverse-outline' },
];

export default function CameraSelectionScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  const [selectedCamera, setSelectedCamera] = useState('back');

  useEffect(() => {
    (async () => {
      try {
        const camera = await AsyncStorage.getItem('selectedCamera');
        if (camera) {
          setSelectedCamera(camera);
        }
      } catch (error) {
        console.error('Load camera settings error:', error);
      }
    })();
  }, []);

  // 카메라 선택 저장
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('selectedCamera', selectedCamera);
      } catch (error) {
        console.error('Save camera settings error:', error);
        // 저장이 state 변화에 묶인 effect라, 되돌리면 저장이 다시 돌아 실패가 반복될 수 있어 안내만
        feedback.error(t('settings.saveFailed'));
      }
    })();
  }, [selectedCamera]);

  const selectCamera = (key) => {
    setSelectedCamera(key);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            onPress={() => router.back()}
            style={s.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('cameraSelection.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('cameraSelection.description')}
        </Text>

        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {CAMERA_TYPES.map((camera, index) => {
            const isSelected = selectedCamera === camera.key;
            const isLast = index === CAMERA_TYPES.length - 1;

            return (
              <MaterialPressable
                key={camera.key}
                style={[s.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
                onPress={() => selectCamera(camera.key)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={[s.rowIcon, { backgroundColor: colors.raised }]}>
                  <Ionicons name={camera.icon} size={20} color={colors.textSecondary} />
                </View>
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t(`cameraSelection.${camera.nameKey}`)}
                  </Text>
                  <Text style={[s.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t(`cameraSelection.${camera.descKey}`)}
                  </Text>
                </View>
                <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.textTertiary }]}>
                  {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
              </MaterialPressable>
            );
          })}
        </View>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} style={s.noteIcon} />
          <Text style={[s.noteText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('cameraSelection.note')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flexShrink: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
  },
  info: {
    fontSize: 14,
    lineHeight: 21,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    ...TYPE.body,
  },
  rowDesc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: SPACE.section,
    marginHorizontal: 4,
  },
  noteIcon: {
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
