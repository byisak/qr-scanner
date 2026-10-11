import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/Colors';

// Android: Material 3 하단 내비게이션(네이티브). iOS의 NativeTabs와 같은 구조.
// 예전 JS 탭바는 화면 위에 반투명으로 떠 있어서, 탭 화면들이 탭바 높이만큼 아래를 비워 두고 있었다.
// 네이티브 탭바는 화면을 탭바 위까지만 그리므로 그 여백은 Android에서 0이다 (hooks/useTabBarOverlap).
// 아이콘: VectorIcon(폰트 글자를 실행 중 이미지로 변환)은 Android에서 그려지지 않아,
// Material Icons 글자를 미리 PNG로 만들어 쓴다 (assets/tab-icons, 흰색 → 탭바가 상태별 색을 입힘).
export default function TabLayout() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <NativeTabs
      backgroundColor={colors.tabBar}
      iconColor={{ default: colors.textTertiary, selected: colors.text }}
      labelStyle={{
        default: { color: colors.textTertiary, fontSize: 12 },
        selected: { color: colors.text, fontSize: 12, fontWeight: '600' },
      }}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primary + '22'}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="history">
        <Label>{t('history.title')}</Label>
        <Icon src={require('../../assets/tab-icons/history.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="generator">
        <Label>{t('generator.title')}</Label>
        <Icon src={require('../../assets/tab-icons/qr-code-2.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <Label>{t('scanner.title')}</Label>
        <Icon src={require('../../assets/tab-icons/qr-code-scanner.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>{t('settings.title')}</Label>
        <Icon src={require('../../assets/tab-icons/settings.png')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
