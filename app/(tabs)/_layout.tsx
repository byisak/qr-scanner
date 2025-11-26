import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>스캔</Label>
        {Platform.select({
          ios: <Icon sf="qrcode.viewfinder" />,
          default: <Icon drawable="ic_menu_camera" />,
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Label>기록</Label>
        {Platform.select({
          ios: <Icon sf="clock" />,
          default: <Icon drawable="ic_menu_recent_history" />,
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>설정</Label>
        {Platform.select({
          ios: <Icon sf="gear" />,
          default: <Icon drawable="ic_menu_settings" />,
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
