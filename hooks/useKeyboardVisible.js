// hooks/useKeyboardVisible.js - 키보드가 떠 있는지 (KeyboardAvoidingView 안드로이드 보정용)
//
// 안드로이드 RN은 키보드가 내려갈 때(keyboardDidHide) screenY에 '보이는 영역의 높이'를 넣어 보낸다.
// edge-to-edge에선 이 값이 상태바+내비게이션바만큼 작아서, KeyboardAvoidingView가 키보드가 닫힌 뒤에도
// 그만큼 겹친다고 계산해 여백(또는 'height' 모드에선 줄어든 높이)을 남긴다 → 화면 아래 띠.
// 키보드가 내려가 있을 땐 KeyboardAvoidingView를 꺼서(enabled=false) 남은 값을 무시한다.
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export default function useKeyboardVisible() {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
