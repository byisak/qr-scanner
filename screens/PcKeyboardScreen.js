// screens/PcKeyboardScreen.js - PC 키보드 입력: 휴대폰을 블루투스 키보드로 PC에 연결해 스캔 값을 바로 입력 (Android 9+)
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, Alert, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SettingsSubScreen, SectionHeader, Group, SettingRow, SettingsHint, useSettingsUi } from '../components/SettingsKit';
import MaterialPressable from '../components/MaterialPressable';
import { useFeedback } from '../contexts/FeedbackContext';
import { RADIUS } from '../constants/Design';
import {
  Hid, isPcKeyboardAvailable, loadPcKeyboardSettings, setEnabled as saveEnabled, setSuffix as saveSuffix, rememberDevice,
} from '../utils/pcKeyboard';
import { trackEvent } from '../utils/analytics';

const SUFFIXES = ['enter', 'tab', 'none'];

export default function PcKeyboardScreen() {
  const { t, fonts, colors, switchColors, rowProps } = useSettingsUi();
  const feedback = useFeedback();
  const [enabled, setEnabled] = useState(false);
  const [suffix, setSuffix] = useState('enter');
  const [status, setStatus] = useState(Hid.getStatus());
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(null); // 'start' | address
  const [showOthers, setShowOthers] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [phoneName, setPhoneName] = useState(null);

  const refresh = useCallback(() => {
    setStatus(Hid.getStatus());
    setDevices(Hid.getPairedDevices());
    setPhoneName(Hid.getAdapterName());
  }, []);

  useFocusEffect(useCallback(() => {
    loadPcKeyboardSettings().then(s => { setEnabled(s.enabled); setSuffix(s.suffix); });
    refresh();
  }, [refresh]));

  useEffect(() => {
    const sub = Hid.addStateListener((e) => {
      setStatus(Hid.getStatus());
      if (e.state === 'connected' && e.device) {
        rememberDevice(e.device.address);
        feedback.success(t('pcKeyboard.connectedTo', { name: e.device.name }));
        trackEvent('hid_paired');
      }
    });
    return () => sub.remove();
  }, [feedback, t]);

  const turnOn = async () => {
    if (!(await Hid.requestBluetoothPermissions())) {
      Alert.alert(t('pcKeyboard.permissionTitle'), t('pcKeyboard.permissionMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('pcKeyboard.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return false;
    }
    if (!Hid.getStatus().bluetoothOn) {
      Alert.alert(t('pcKeyboard.bluetoothOffTitle'), t('pcKeyboard.bluetoothOffMessage'));
      return false;
    }
    setBusy('start');
    const ok = await Hid.start().catch(() => false);
    setBusy(null);
    refresh();
    if (!ok) {
      Alert.alert(t('pcKeyboard.unsupportedTitle'), t('pcKeyboard.registerFailed'));
      return false;
    }
    return true;
  };

  const toggle = async (value) => {
    if (value) {
      const ok = await turnOn();
      if (!ok) return;
    }
    setEnabled(value);
    await saveEnabled(value);
    refresh();
  };

  const connectTo = async (d) => {
    setBusy(d.address);
    const ok = await Hid.connect(d.address).catch(() => false);
    setBusy(null);
    if (!ok) {
      feedback.error(t('pcKeyboard.connectFailed'));
      setShowHelp(true);
    }
  };

  const makeDiscoverable = () => {
    Hid.requestDiscoverable(180);
    setShowHelp(true);
    trackEvent('hid_discoverable');
  };

  const sendTest = async () => {
    const r = await Hid.sendText('SCANVIEW-TEST-123\n').catch(() => null);
    if (r?.connected) feedback.success(t('pcKeyboard.testSent'));
    else feedback.error(t('pcKeyboard.notConnected'));
  };

  if (!isPcKeyboardAvailable) {
    return (
      <SettingsSubScreen title={t('pcKeyboard.title')}>
        <SettingsHint {...rowProps} text={t('pcKeyboard.notSupported')} />
      </SettingsSubScreen>
    );
  }

  const device = status.device;
  const stateText = !enabled ? t('settings.statusOff')
    : device ? t('pcKeyboard.stateConnected', { name: device.name })
    : status.registered ? t('pcKeyboard.stateWaiting')
    : t('pcKeyboard.stateNotRegistered');

  return (
    <SettingsSubScreen title={t('pcKeyboard.title')}>
      <SettingsHint {...rowProps} text={t('pcKeyboard.hint')} />

      <Group colors={colors}>
        <SettingRow {...rowProps} label={t('pcKeyboard.enable')} desc={stateText}>
          {busy === 'start' ? <ActivityIndicator color={colors.primary} /> : (
            <Switch value={enabled} onValueChange={toggle} {...switchColors} accessibilityLabel={t('pcKeyboard.enable')} />
          )}
        </SettingRow>
      </Group>

      {enabled && (
        <>
          {/* 새 PC: 휴대폰을 찾을 수 있게 → PC에서 장치 추가 */}
          <SectionHeader {...rowProps} title={t('pcKeyboard.sectionNew')} />
          <Group colors={colors}>
            <SettingRow {...rowProps} icon="add-circle-outline" iconColor={colors.primary}
              label={t('pcKeyboard.pairNew')}
              desc={t('pcKeyboard.pairNewDesc', { name: phoneName || t('pcKeyboard.thisPhone') })}
              onPress={makeDiscoverable} />
            <SettingRow {...rowProps} icon="help-circle-outline" label={t('pcKeyboard.notFoundTitle')} onPress={() => setShowHelp(v => !v)}>
              <Ionicons name={showHelp ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </SettingRow>
          </Group>
          {showHelp && (
            <View style={[styles.help, { backgroundColor: colors.raised }]}>
              {['notFound1', 'notFound2', 'notFound3'].map((k, i) => (
                <Text key={k} style={[styles.helpText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{`${i + 1}. ${t(`pcKeyboard.${k}`)}`}</Text>
              ))}
            </View>
          )}

          {/* 이미 페어링된 PC (다른 블루투스 기기는 접어 둔다) */}
          <SectionHeader {...rowProps} title={t('pcKeyboard.sectionPc')} />
          <Group colors={colors}>
            {devices.filter(d => d.isComputer || showOthers || device?.address === d.address).map(d => {
              const isConnected = device?.address === d.address;
              return (
                <SettingRow
                  key={d.address}
                  {...rowProps}
                  icon={d.isComputer ? 'desktop-outline' : 'bluetooth-outline'}
                  label={d.name}
                  desc={isConnected ? t('pcKeyboard.connected') : undefined}
                  onPress={isConnected ? () => Hid.disconnect().then(refresh) : () => connectTo(d)}
                >
                  {busy === d.address ? <ActivityIndicator color={colors.primary} /> : (
                    <Text style={[styles.action, { color: isConnected ? colors.error : colors.primaryText, fontFamily: fonts.semiBold }]}>
                      {isConnected ? t('pcKeyboard.disconnect') : t('pcKeyboard.connect')}
                    </Text>
                  )}
                </SettingRow>
              );
            })}
            {!devices.some(d => d.isComputer) && (
              <SettingRow {...rowProps} label={t('pcKeyboard.noPc')} />
            )}
            {devices.some(d => !d.isComputer) && (
              <SettingRow {...rowProps} label={showOthers ? t('pcKeyboard.hideOthers') : t('pcKeyboard.showOthers', { count: devices.filter(d => !d.isComputer).length })} onPress={() => setShowOthers(v => !v)}>
                <Ionicons name={showOthers ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
              </SettingRow>
            )}
          </Group>

          <SectionHeader {...rowProps} title={t('pcKeyboard.sectionSuffix')} />
          <View style={[styles.segment, { backgroundColor: colors.raised }]} accessibilityRole="radiogroup">
            {SUFFIXES.map(s => (
              <MaterialPressable
                key={s}
                style={[styles.segmentItem, suffix === s && { backgroundColor: colors.surface }]}
                onPress={() => { setSuffix(s); saveSuffix(s); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: suffix === s }}
              >
                <Text style={[styles.segmentText, { color: suffix === s ? colors.text : colors.textSecondary, fontFamily: fonts.semiBold }]}>{t(`pcKeyboard.suffix.${s}`)}</Text>
              </MaterialPressable>
            ))}
          </View>
          <Text style={[styles.note, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('pcKeyboard.suffixDesc')}</Text>

          <MaterialPressable
            style={[styles.testButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: device ? 1 : 0.5 }]}
            onPress={sendTest}
            disabled={!device}
            accessibilityRole="button"
          >
            <Ionicons name="keypad-outline" size={18} color={colors.primaryText} />
            <Text style={[styles.testText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('pcKeyboard.test')}</Text>
          </MaterialPressable>

          <Text style={[styles.note, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('pcKeyboard.limits')}</Text>
        </>
      )}
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  action: { fontSize: 14 },
  segment: { flexDirection: 'row', borderRadius: RADIUS.control, padding: 3, marginHorizontal: 0 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: RADIUS.control - 3, overflow: 'hidden' },
  segmentText: { fontSize: 14 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 8, marginHorizontal: 4 },
  testButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: RADIUS.control, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  testText: { fontSize: 15 },
  help: { borderRadius: RADIUS.control, padding: 14, marginTop: 8, gap: 8 },
  helpText: { fontSize: 13, lineHeight: 19 },
});
