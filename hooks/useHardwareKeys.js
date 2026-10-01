// hooks/useHardwareKeys.js - 화면이 포커스된 동안만 매핑된 볼륨 키를 가로채고, 눌리면 동작 이름을 넘긴다
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { isHardwareKeysAvailable, setCapturedKeys, addHardwareKeyListener } from '../modules/hardware-keys';

export default function useHardwareKeys({ keyMap, onAction }) {
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  // 동작이 지정된 키만 가로챈다 ('none'은 평소처럼 볼륨 조절)
  const capturedKeys = useMemo(
    () => Object.keys(keyMap || {}).filter(key => keyMap[key] && keyMap[key] !== 'none'),
    [keyMap]
  );
  const capturedKey = capturedKeys.join(',');

  useFocusEffect(
    useCallback(() => {
      if (!isHardwareKeysAvailable || capturedKeys.length === 0) {
        setCapturedKeys([]);
        return undefined;
      }
      setCapturedKeys(capturedKeys);
      const subscription = addHardwareKeyListener(({ key }) => {
        const action = keyMap && keyMap[key];
        if (action && action !== 'none' && onActionRef.current) onActionRef.current(action, key);
      });
      return () => {
        subscription.remove();
        setCapturedKeys([]);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capturedKey, keyMap])
  );
}
