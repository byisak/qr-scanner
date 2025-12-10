import { Stack } from 'expo-router';
import PremiumScreen from '../screens/PremiumScreen';

export default function PremiumRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <PremiumScreen />
    </>
  );
}
