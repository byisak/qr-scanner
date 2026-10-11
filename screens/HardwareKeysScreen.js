// screens/HardwareKeysScreen.js - 하드웨어 키 매핑 + 수동 스캔 확정
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { isHardwareKeysAvailable } from '../modules/hardware-keys';
import { KEY_ACTIONS, loadHardwareKeySettings, saveKeyMap, saveScanConfirmMode } from '../utils/hardwareKeys';

const KEYS = [
  { id: 'volumeUp', icon: 'volume-high-outline' },
  { id: 'volumeDown', icon: 'volume-low-outline' },
];

const ACTION_ICONS = {
  none: 'remove-circle-outline',
  confirm: 'checkmark-circle-outline',
  torch: 'flashlight-outline',
  result: 'open-outline',
  group: 'folder-open-outline',
  multiResults: 'albums-outline',
  dumpFrame: 'bug-outline',
};

export default function HardwareKeysScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const [keyMap, setKeyMap] = useState({ volumeUp: 'none', volumeDown: 'none' });
  const [manualConfirm, setManualConfirm] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    loadHardwareKeySettings()
      .then(({ keyMap: map, scanConfirmMode }) => {
        setKeyMap(map);
        setManualConfirm(scanConfirmMode === 'manual');
      })
      .catch((error) => console.error('Load hardware keys error:', error));
  }, []);

  const assign = useCallback(async (key, action) => {
    // 같은 동작을 두 키에 걸지 않는다 (다른 키에서 지운다)
    const next = { ...keyMap, [key]: action };
    if (action !== 'none') {
      for (const other of Object.keys(next)) if (other !== key && next[other] === action) next[other] = 'none';
    }
    try {
      await saveKeyMap(next);
      setKeyMap(next);
      if (action === 'confirm') setManualConfirm(true);
      setExpandedKey(null);
    } catch (error) {
      console.error('Save key map error:', error);
    }
  }, [keyMap]);

  const toggleManualConfirm = useCallback(async (value) => {
    setManualConfirm(value);
    try {
      const next = await saveScanConfirmMode(value ? 'manual' : 'auto', keyMap);
      if (next) setKeyMap(next);
    } catch (error) {
      console.error('Save scan confirm mode error:', error);
    }
  }, [keyMap]);

  const keysSupported = Platform.OS === 'android' && isHardwareKeysAvailable;

  const switchColors = {
    trackColor: { true: colors.primary, false: isDark ? '#343A44' : colors.border },
    thumbColor: '#fff',
    ios_backgroundColor: isDark ? '#343A44' : colors.border,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={s.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('hardwareKeys.title')}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        {/* 수동 확정 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>{t('hardwareKeys.manualConfirm')}</Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('hardwareKeys.manualConfirmDesc')}</Text>
            </View>
            <Switch
              value={manualConfirm}
              onValueChange={toggleManualConfirm}
              {...switchColors}
            />
          </View>
        </View>

        {/* 키 매핑 */}
        <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {keysSupported ? t('hardwareKeys.description') : t('hardwareKeys.iosNote')}
        </Text>
        {keysSupported && (
          <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {KEYS.map((key, index) => {
              const current = keyMap[key.id] || 'none';
              const expanded = expandedKey === key.id;
              return (
                <View key={key.id} style={index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                  <MaterialPressable
                    style={[s.row, s.rowWithDesc]}
                    onPress={() => setExpandedKey(expanded ? null : key.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <Ionicons name={key.icon} size={20} color={colors.textSecondary} />
                    <View style={s.rowText}>
                      <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>{t(`hardwareKeys.${key.id}`)}</Text>
                      <Text style={[s.desc, { color: current === 'none' ? colors.textSecondary : colors.primaryText, fontFamily: fonts.regular }]}>
                        {t(`hardwareKeys.actions.${current}`)}
                      </Text>
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
                  </MaterialPressable>
                  {expanded && (
                    <View style={[s.options, { borderTopColor: colors.borderLight }]}>
                      {KEY_ACTIONS.map((action) => {
                        const selected = current === action;
                        return (
                          <MaterialPressable
                            key={action}
                            style={s.option}
                            onPress={() => assign(key.id, action)}
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                          >
                            <Ionicons name={ACTION_ICONS[action]} size={20} color={selected ? colors.primaryText : colors.textSecondary} />
                            <Text style={[s.optionText, { color: colors.text, fontFamily: selected ? fonts.semiBold : fonts.regular }]}>
                              {t(`hardwareKeys.actions.${action}`)}
                            </Text>
                            <View style={[s.radio, { borderColor: selected ? colors.primary : colors.textTertiary }]}>
                              {selected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                            </View>
                          </MaterialPressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
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
    paddingHorizontal: 8,
    paddingBottom: 8,
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: SIZE.touch,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 8,
  },
  info: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowWithDesc: {
    minHeight: SIZE.rowWithDesc,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  options: {
    borderTopWidth: 1,
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 48,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
