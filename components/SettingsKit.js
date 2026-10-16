// components/SettingsKit.js - 설정 화면과 설정 하위 화면이 같이 쓰는 목록 부품 (섹션 머리글 · 묶음 카드 · 행 · 하위 화면 틀)
// SettingsScreen.js 에 있던 SectionHeader / Group / SettingRow / NavRight 를 그대로 옮겨 왔다
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from './MaterialPressable';
import LockIcon from './LockIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';

// 현재 테마 색 + 글꼴 + 공통 스위치 색 + 켬/끔 값 표시
export function useSettingsUi() {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };
  const rowProps = { colors, fonts };
  const statusProps = (enabled) => ({
    value: enabled ? t('settings.statusOn') : t('settings.statusOff'),
    valueColor: enabled ? colors.success : colors.textSecondary,
  });
  return { t, fonts, colors, isDark, switchColors, rowProps, statusProps };
}

// 섹션 머리글: 카드 밖, 보조 글자색
export function SectionHeader({ title, colors, fonts }) {
  return (
    <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
      {title}
    </Text>
  );
}

// 묶음 카드: 행 사이에 얇은 구분선
export function Group({ colors, style, children }) {
  const items = React.Children.toArray(children);
  return (
    <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {items.map((child, i) => (
        <React.Fragment key={child.key ?? i}>
          {i > 0 && <View style={[s.separator, { backgroundColor: colors.borderLight }]} />}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

// 목록 행: 왼쪽 라벨(+설명), 오른쪽 값·스위치·화살표. onPress가 있으면 누를 수 있는 행
// iconBox: 아이콘을 둥근 네모 안에 넣는다 (설정 첫 화면의 묶음 행)
export function SettingRow({ colors, fonts, label, desc, onPress, icon, iconColor, iconBox, labelColor, children }) {
  const hasRight = React.Children.toArray(children).length > 0;
  const iconEl = icon ? <Ionicons name={icon} size={iconBox ? 18 : 20} color={iconColor || colors.textSecondary} /> : null;
  const content = (
    <>
      {iconEl && iconBox ? <View style={[s.iconBox, { backgroundColor: colors.raised }]}>{iconEl}</View> : iconEl}
      <View style={s.rowText}>
        <Text style={[s.label, { color: labelColor || colors.text, fontFamily: fonts.medium }]}>{label}</Text>
        {!!desc && <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={iconBox ? 1 : undefined}>{desc}</Text>}
      </View>
      {hasRight ? <View style={s.rowRight}>{children}</View> : null}
    </>
  );
  const rowStyle = [s.row, desc ? s.rowWithDesc : null];
  if (onPress) {
    return (
      <MaterialPressable accessibilityRole="button" style={rowStyle} onPress={onPress} activeOpacity={0.7}>
        {content}
      </MaterialPressable>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

// 이동 행 오른쪽: (잠금 배지) 값 글자 + 화살표
export function NavRight({ colors, fonts, value, valueColor, lockFeature }) {
  return (
    <>
      {lockFeature ? (
        <LockIcon featureId={lockFeature} size={12} badge style={[s.softBadge, s.lockBadge, { backgroundColor: colors.errorSoft }]} />
      ) : null}
      {value ? (
        <Text style={[s.value, { color: valueColor || colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </>
  );
}

// 하위 화면 틀: 뒤로 · 가운데 제목 헤더 + 스크롤 본문 (다른 설정 하위 화면과 같은 모양)
export function SettingsSubScreen({ title, children }) {
  const router = useRouter();
  const { t, fonts, colors } = useSettingsUi();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            style={s.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text accessibilityRole="header" style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.headerSide} />
      </View>
      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

// 하위 화면 맨 위 안내 한 줄
export function SettingsHint({ text, colors, fonts }) {
  return (
    <View style={[s.hintBox, { backgroundColor: colors.raised }]}>
      <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
      <Text style={[s.hintText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{text}</Text>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  // 진동 세기 · 패턴
  hapticOptions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  hapticOptionLabel: {
    ...TYPE.sectionHeader,
    marginBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: SIZE.touch,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 14,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  value: {
    fontSize: 13,
    flexShrink: 1,
  },
  softBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
  },
  softBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // URL 목록
  urlListWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  urlListContainer: {
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
  },
  urlListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  urlStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  urlListItemText: {
    flex: 1,
  },
  urlListItemName: {
    fontSize: 14,
    marginBottom: 2,
  },
  urlListItemUrl: {
    fontSize: 12,
  },
});

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
    gap: SPACE.gap,
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
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
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    maxWidth: '50%',
  },
  label: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  value: {
    fontSize: 13,
    flexShrink: 1,
  },
  softBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
  },
  lockBadge: {
    marginLeft: 0,
    paddingHorizontal: 6,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.control,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
