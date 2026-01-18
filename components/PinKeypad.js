// components/PinKeypad.js - 섞인 숫자 키패드 컴포넌트
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const KEYPAD_WIDTH = Math.min(width, 400);
const KEY_SIZE = (KEYPAD_WIDTH - 80) / 3;

export default function PinKeypad({
  onPinChange,
  onComplete,
  pinLength = 6,
  shuffleKeys = true,
  disabled = false,
  colors,
  fonts,
}) {
  const [pin, setPin] = useState('');
  const [shuffledKeys, setShuffledKeys] = useState(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']);

  // 키 셔플
  const shuffleArray = useCallback((array) => {
    const numbers = array.filter((item) => item !== '' && item !== 'delete');
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    // 셔플된 숫자를 3x4 그리드에 배치
    return [
      numbers[0], numbers[1], numbers[2],
      numbers[3], numbers[4], numbers[5],
      numbers[6], numbers[7], numbers[8],
      '', numbers[9], 'delete'
    ];
  }, []);

  useEffect(() => {
    if (shuffleKeys) {
      setShuffledKeys(shuffleArray(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']));
    }
  }, [shuffleKeys, shuffleArray]);

  // PIN 변경 시 콜백
  useEffect(() => {
    onPinChange?.(pin);
    if (pin.length === pinLength) {
      onComplete?.(pin);
    }
  }, [pin, pinLength, onPinChange, onComplete]);

  // 키 입력
  const handleKeyPress = async (key) => {
    if (disabled) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
    } else if (key !== '' && pin.length < pinLength) {
      setPin((prev) => prev + key);
    }
  };

  // PIN 초기화
  const resetPin = () => {
    setPin('');
    if (shuffleKeys) {
      setShuffledKeys(shuffleArray(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']));
    }
  };

  // 외부에서 리셋 호출 가능하도록
  React.useImperativeHandle(
    React.useRef(null),
    () => ({
      resetPin,
    }),
    []
  );

  // PIN 입력 상태 표시 (점)
  const renderPinDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {Array(pinLength)
          .fill(0)
          .map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index < pin.length ? colors?.primary || '#0066FF' : (colors?.border || '#E5E5E5'),
                },
              ]}
            />
          ))}
      </View>
    );
  };

  // 키 렌더링
  const renderKey = (key, index) => {
    if (key === '') {
      return <View key={index} style={styles.keyEmpty} />;
    }

    if (key === 'delete') {
      return (
        <TouchableOpacity
          key={index}
          style={styles.key}
          onPress={() => handleKeyPress(key)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Ionicons
            name="backspace-outline"
            size={28}
            color="#fff"
          />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={styles.key}
        onPress={() => handleKeyPress(key)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={[styles.keyText, { fontFamily: fonts?.semiBold }]}>{key}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderPinDots()}
      <View style={styles.keypadContainer}>
        <View style={styles.keypad}>
          {shuffledKeys.map((key, index) => renderKey(key, index))}
        </View>
      </View>
    </View>
  );
}

// PIN 초기화를 위한 forwardRef 버전
export const PinKeypadWithRef = React.forwardRef(({ onPinChange, onComplete, pinLength = 6, shuffleKeys = true, disabled = false, colors, fonts }, ref) => {
  const [pin, setPin] = useState('');
  const [shuffledKeys, setShuffledKeys] = useState(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']);

  const shuffleArray = useCallback((array) => {
    const numbers = array.filter((item) => item !== '' && item !== 'delete');
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return [
      numbers[0], numbers[1], numbers[2],
      numbers[3], numbers[4], numbers[5],
      numbers[6], numbers[7], numbers[8],
      '', numbers[9], 'delete'
    ];
  }, []);

  useEffect(() => {
    if (shuffleKeys) {
      setShuffledKeys(shuffleArray(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']));
    }
  }, [shuffleKeys, shuffleArray]);

  useEffect(() => {
    onPinChange?.(pin);
    if (pin.length === pinLength) {
      onComplete?.(pin);
    }
  }, [pin, pinLength, onPinChange, onComplete]);

  const handleKeyPress = async (key) => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
    } else if (key !== '' && pin.length < pinLength) {
      setPin((prev) => prev + key);
    }
  };

  const resetPin = useCallback(() => {
    setPin('');
    if (shuffleKeys) {
      setShuffledKeys(shuffleArray(['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']));
    }
  }, [shuffleKeys, shuffleArray]);

  React.useImperativeHandle(ref, () => ({
    resetPin,
  }), [resetPin]);

  const renderPinDots = () => (
    <View style={styles.dotsContainer}>
      {Array(pinLength)
        .fill(0)
        .map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index < pin.length ? (colors?.primary || '#0066FF') : (colors?.border || '#E5E5E5'),
              },
            ]}
          />
        ))}
    </View>
  );

  const renderKey = (key, index) => {
    if (key === '') {
      return <View key={index} style={styles.keyEmpty} />;
    }

    if (key === 'delete') {
      return (
        <TouchableOpacity
          key={index}
          style={styles.key}
          onPress={() => handleKeyPress(key)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Ionicons name="backspace-outline" size={28} color="#fff" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={styles.key}
        onPress={() => handleKeyPress(key)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={[styles.keyText, { fontFamily: fonts?.semiBold }]}>{key}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderPinDots()}
      <View style={styles.keypadContainer}>
        <View style={styles.keypad}>
          {shuffledKeys.map((key, index) => renderKey(key, index))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  keypadContainer: {
    backgroundColor: '#0A2A5E',
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    maxWidth: KEYPAD_WIDTH,
    alignSelf: 'center',
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    width: KEY_SIZE,
    height: KEY_SIZE * 0.7,
  },
  keyText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
});
