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

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('hardwareKeys.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        {/* 수동 확정 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('hardwareKeys.manualConfirm')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('hardwareKeys.manualConfirmDesc')}</Text>
            </View>
            <Switch
              value={manualConfirm}
              onValueChange={toggleManualConfirm}
              trackColor={{ true: Platform.OS === 'android' ? colors.primary + '99' : colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 키 매핑 */}
        <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {keysSupported ? t('hardwareKeys.description') : t('hardwareKeys.iosNote')}
        </Text>
        {keysSupported && KEYS.map((key) => {
          const current = keyMap[key.id] || 'none';
          const expanded = expandedKey === key.id;
          return (
            <View key={key.id} style={[s.section, { backgroundColor: colors.surface }]}>
              <MaterialPressable style={s.row} onPress={() => setExpandedKey(expanded ? null : key.id)} activeOpacity={0.7}>
                <View style={[s.keyIcon, { backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5' }]}>
                  <Ionicons name={key.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t(`hardwareKeys.${key.id}`)}</Text>
                  <Text style={[s.desc, { color: current === 'none' ? colors.textTertiary : colors.primary, fontFamily: fonts.regular }]}>
                    {t(`hardwareKeys.actions.${current}`)}
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textTertiary} />
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
                        <Ionicons name={ACTION_ICONS[action]} size={20} color={selected ? colors.primary : colors.textSecondary} />
                        <Text style={[s.optionText, { color: selected ? colors.primary : colors.text, fontFamily: selected ? fonts.semiBold : fonts.regular }]}>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'android' ? { borderRadius: 20, overflow: 'hidden' } : {}),
  },
  headerTitle: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  info: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  section: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 56,
  },
  keyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 16,
  },
  desc: {
    fontSize: 13,
    marginTop: 2,
  },
  options: {
    borderTopWidth: 1,
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    width: 11,
    height: 11,
    borderRadius: 6,
  },
});
