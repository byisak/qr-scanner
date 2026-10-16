// screens/SoundSettingsScreen.js - 설정 > 소리·진동: 스캔 소리, 진동 켬/끔, 진동 세기·패턴
// 컨트롤은 예전 SettingsScreen.js "스캔 피드백" 섹션에서 그대로 옮겨 왔다 (같은 저장 키)
import React, { useState, useEffect } from 'react';
import { View, Text, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialPressable from '../components/MaterialPressable';
import haptics, { loadHapticSettings, saveHapticSettings, HAPTIC_INTENSITIES, HAPTIC_PATTERNS } from '../utils/haptics';
import { SettingsSubScreen, Group, SettingRow, settingsStyles as s, useSettingsUi } from '../components/SettingsKit';

export default function SoundSettingsScreen() {
  const { t, colors, fonts, switchColors, rowProps } = useSettingsUi();

  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true);
  // 진동 세기·패턴 (Android 기본 진동이 약하고 탁하다는 피드백)
  const [hapticIntensity, setHapticIntensity] = useState('medium');
  const [hapticPattern, setHapticPattern] = useState('tap');

  useEffect(() => {
    (async () => {
      try {
        const h = await AsyncStorage.getItem('hapticEnabled');
        const ss = await AsyncStorage.getItem('scanSoundEnabled');
        if (h !== null) setHapticEnabled(h === 'true');
        if (ss !== null) setScanSoundEnabled(ss === 'true');
      } catch (error) {
        console.error('Load sound settings error:', error);
      }
    })();
    loadHapticSettings().then(({ intensity, pattern }) => {
      setHapticIntensity(intensity);
      setHapticPattern(pattern);
    });
  }, []);

  // 스위치를 바꿀 때만 저장한다 (화면을 열 때 기본값을 덮어쓰지 않도록)
  const changeHapticEnabled = async (value) => {
    setHapticEnabled(value);
    try {
      await AsyncStorage.setItem('hapticEnabled', value.toString());
    } catch (error) {
      console.error('Save haptic settings error:', error);
    }
  };
  const changeScanSound = async (value) => {
    setScanSoundEnabled(value);
    try {
      await AsyncStorage.setItem('scanSoundEnabled', value.toString());
    } catch (error) {
      console.error('Save scan sound settings error:', error);
    }
  };

  // 고르면 바로 그 느낌으로 한 번 울린다
  const changeHaptic = async (next) => {
    const intensity = next.intensity || hapticIntensity;
    const pattern = next.pattern || hapticPattern;
    setHapticIntensity(intensity);
    setHapticPattern(pattern);
    await saveHapticSettings({ intensity, pattern });
    haptics.scan({ intensity, pattern });
  };

  return (
    <SettingsSubScreen title={t('settingsHub.sound')}>
      <Group colors={colors}>
        {/* 스캔 소리 */}
        <SettingRow {...rowProps}
          label={t('settings.scanSound')}
          desc={t('settingsHub.scanSoundDesc')}
        >
          <Switch
            value={scanSoundEnabled}
            onValueChange={changeScanSound}
            {...switchColors}
            accessibilityLabel={t('settings.scanSound')}
          />
        </SettingRow>

        {/* 햅틱 피드백 (+ 켜져 있을 때 세기·패턴) */}
        <View>
          <SettingRow {...rowProps}
            label={t('settingsHub.vibration')}
            desc={t('settingsHub.vibrationDesc')}
          >
            <Switch
              value={hapticEnabled}
              onValueChange={changeHapticEnabled}
              {...switchColors}
              accessibilityLabel={t('settingsHub.vibration')}
            />
          </SettingRow>

          {/* 진동 세기 · 패턴 (진동이 켜져 있을 때만) */}
          {hapticEnabled && (
            <View style={s.hapticOptions}>
              <Text style={[s.hapticOptionLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('settings.hapticIntensity')}</Text>
              <View style={[s.segment, { backgroundColor: colors.raised }]}>
                {HAPTIC_INTENSITIES.map(level => {
                  const selected = hapticIntensity === level;
                  return (
                    <MaterialPressable
                      key={level}
                      style={[s.segmentItem, selected && { backgroundColor: colors.primary }]}
                      onPress={() => changeHaptic({ intensity: level })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[s.segmentText, { color: selected ? '#fff' : colors.text, fontFamily: fonts.semiBold }]}>
                        {t(`settings.hapticIntensities.${level}`)}
                      </Text>
                    </MaterialPressable>
                  );
                })}
              </View>
              <Text style={[s.hapticOptionLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold, marginTop: 14 }]}>{t('settings.hapticPattern')}</Text>
              <View style={[s.segment, { backgroundColor: colors.raised }]}>
                {HAPTIC_PATTERNS.map(pattern => {
                  const selected = hapticPattern === pattern;
                  return (
                    <MaterialPressable
                      key={pattern}
                      style={[s.segmentItem, selected && { backgroundColor: colors.primary }]}
                      onPress={() => changeHaptic({ pattern })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[s.segmentText, { color: selected ? '#fff' : colors.text, fontFamily: fonts.semiBold }]}>
                        {t(`settings.hapticPatterns.${pattern}`)}
                      </Text>
                    </MaterialPressable>
                  );
                })}
              </View>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 8 }]}>{t('settings.hapticPatternDesc')}</Text>
            </View>
          )}
        </View>
      </Group>
    </SettingsSubScreen>
  );
}
