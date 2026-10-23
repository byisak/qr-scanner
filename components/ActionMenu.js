// components/ActionMenu.js - 아래에서 올라오는 메뉴 (Android 알림 창은 버튼이 3개까지라 항목이 많은 더보기 메뉴에 쓴다)
import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MaterialPressable from './MaterialPressable';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SIZE } from '../constants/Design';

/** actions: [{ label, desc?, icon?, badge?, run, destructive? }] */
export default function ActionMenu({ visible, title, actions, onClose }) {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const pick = (a) => { onClose(); setTimeout(a.run, 150); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.cancel')} />
      <View style={[s.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 8 }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />
        {!!title && <Text accessibilityRole="header" style={[s.title, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{title}</Text>}
        {actions.map((a) => (
          <MaterialPressable key={a.label} style={s.row} onPress={() => pick(a)} accessibilityRole="button">
            {a.icon ? <Ionicons name={a.icon} size={20} color={a.destructive ? colors.error : colors.textSecondary} /> : null}
            <View style={s.text}>
              <Text style={[s.label, { color: a.destructive ? colors.error : colors.text, fontFamily: fonts.medium }]}>{a.label}</Text>
              {!!a.desc && <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={2}>{a.desc}</Text>}
            </View>
            {!!a.badge && <Text style={[s.badge, { color: colors.primaryText, backgroundColor: colors.raised, fontFamily: fonts.semiBold }]}>{a.badge}</Text>}
          </MaterialPressable>
        ))}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: RADIUS.group, borderTopRightRadius: RADIUS.group, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  title: { fontSize: 13, paddingHorizontal: 20, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: SIZE.row, paddingHorizontal: 20, overflow: 'hidden' },
  text: { flex: 1, paddingVertical: 10 },
  label: { fontSize: 16 },
  desc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  badge: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
});
