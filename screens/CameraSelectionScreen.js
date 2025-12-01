// screens/CameraSelectionScreen.js - 카메라 선택 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

// 사용 가능한 카메라 타입 목록
const CAMERA_TYPES = [
  { key: 'back', name: '후면 카메라', desc: '기본 후면 카메라', icon: 'camera-outline' },
  { key: 'front', name: '전면 카메라', desc: '셀카 카메라', icon: 'camera-reverse-outline' },
];

export default function CameraSelectionScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
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
      }
    })();
  }, [selectedCamera]);

  const selectCamera = (key) => {
    setSelectedCamera(key);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>카메라 선택</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <Text style={[s.info, { color: colors.textSecondary }]}>
            QR 코드를 스캔할 때 사용할 카메라를 선택하세요
          </Text>

          {CAMERA_TYPES.map((camera) => {
            const isSelected = selectedCamera === camera.key;

            return (
              <TouchableOpacity
                key={camera.key}
                style={[
                  s.cameraItem,
                  { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                  isSelected && { backgroundColor: isDark ? 'rgba(0, 122, 255, 0.2)' : '#f0f8ff' }
                ]}
                onPress={() => selectCamera(camera.key)}
                activeOpacity={0.7}
              >
                <View style={[s.cameraIcon, { backgroundColor: colors.inputBackground }]}>
                  <Ionicons
                    name={camera.icon}
                    size={32}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={s.cameraInfo}>
                  <View style={s.cameraHeader}>
                    <Text style={[s.cameraName, { color: isSelected ? colors.primary : colors.text }]}>
                      {camera.name}
                    </Text>
                    {isSelected && (
                      <View style={[s.selectedBadge, { backgroundColor: colors.success }]}>
                        <Text style={s.selectedBadgeText}>선택됨</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.cameraDesc, { color: colors.textSecondary }]}>{camera.desc}</Text>
                </View>
                <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.borderLight }]}>
                  {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={[s.noteBox, { backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : '#fff9e6' }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.noteText, { color: colors.textSecondary }]}>
              일부 기기에서는 특정 카메라를 사용할 수 없을 수 있습니다.
            </Text>
          </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  info: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  cameraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  cameraIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cameraInfo: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cameraName: {
    fontSize: 17,
    fontWeight: '600',
  },
  selectedBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  selectedBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  cameraDesc: {
    fontSize: 14,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    lineHeight: 18,
  },
});
