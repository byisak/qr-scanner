import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>\uC2A4\uCE94</Label>
        {Platform.select({
          ios: <Icon sf="qrcode.viewfinder" />,
          default: <Icon drawable="ic_menu_camera" />,
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Label>\uAE30\uB85D</Label>
        {Platform.select({
          ios: <Icon sf="clock" />,
          default: <Icon drawable="ic_menu_recent_history" />,
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>\uC124\uC815</Label>
        {Platform.select({
          ios: <Icon sf="gear" />,
          default: <Icon drawable="ic_menu_settings" />,
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
