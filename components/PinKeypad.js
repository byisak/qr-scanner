// components/PinKeypad.js - 섞인 숫자 키패드 컴포넌트
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const KEYPAD_WIDTH = Math.min(width - 40, 320);
const KEY_SIZE = KEYPAD_WIDTH / 3;
const KEY_HEIGHT = Math.min(KEY_SIZE * 0.8, 70);

export default function PinKeypad({
  onPinChange,
  onComplete,
  pinLength = 6,
  shuffleKeys = true,
  disabled = false,
  colors,
  fonts,
  showBiometric = false,
  onBiometricPress,
  bottomLink,
  onBottomLinkPress,
}) {
  const [pin, setPin] = useState('');
  const [shuffledNumbers, setShuffledNumbers] = useState(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  const completedRef = useRef(false);

  // 숫자 셔플
  const shuffleNumbers = useCallback(() => {
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  }, []);

  useEffect(() => {
    if (shuffleKeys) {
      setShuffledNumbers(shuffleNumbers());
    }
  }, [shuffleKeys, shuffleNumbers]);

  // PIN 변경 시 콜백 - onComplete는 한 번만 호출
  useEffect(() => {
    onPinChange?.(pin);
    if (pin.length === pinLength && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(pin);
    }
  }, [pin, pinLength]);

  // 키 입력
  const handleKeyPress = async (key) => {
    if (disabled || completedRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (pin.length < pinLength) {
      setPin((prev) => prev + key);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completedRef.current = false; // 삭제 시 다시 입력 가능
    setPin((prev) => prev.slice(0, -1));
  };

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
                  backgroundColor: index < pin.length
                    ? (colors?.primary || '#0066FF')
                    : (colors?.border || '#D1D1D6'),
                },
              ]}
            />
          ))}
      </View>
    );
  };

  // 숫자 키 렌더링
  const renderNumberKey = (number) => (
    <TouchableOpacity
      key={`num-${number}`}
      style={styles.key}
      onPress={() => handleKeyPress(number)}
      activeOpacity={0.6}
      disabled={disabled || completedRef.current}
    >
      <Text style={[styles.keyText, { fontFamily: fonts?.semiBold }]}>{number}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderPinDots()}
      <View style={styles.keypadWrapper}>
        <View style={styles.keypadContainer}>
          {/* Row 1 */}
          <View style={styles.row}>
            {renderNumberKey(shuffledNumbers[0])}
            {renderNumberKey(shuffledNumbers[1])}
            {renderNumberKey(shuffledNumbers[2])}
          </View>

          {/* Row 2 */}
          <View style={styles.row}>
            {renderNumberKey(shuffledNumbers[3])}
            {renderNumberKey(shuffledNumbers[4])}
            {renderNumberKey(shuffledNumbers[5])}
          </View>

          {/* Row 3 */}
          <View style={styles.row}>
            {renderNumberKey(shuffledNumbers[6])}
            {renderNumberKey(shuffledNumbers[7])}
            {renderNumberKey(shuffledNumbers[8])}
          </View>

          {/* Row 4: 생체인증, 마지막 숫자, 삭제 */}
          <View style={styles.row}>
            {showBiometric ? (
              <TouchableOpacity
                style={styles.key}
                onPress={onBiometricPress}
                activeOpacity={0.6}
                disabled={disabled}
              >
                <Ionicons name="scan-outline" size={30} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.key} />
            )}
            {renderNumberKey(shuffledNumbers[9])}
            <TouchableOpacity
              style={styles.key}
              onPress={handleDelete}
              activeOpacity={0.6}
              disabled={disabled}
            >
              <Ionicons name="backspace-outline" size={30} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* 하단 링크 */}
          {bottomLink && (
            <TouchableOpacity style={styles.bottomLinkContainer} onPress={onBottomLinkPress}>
              <Text style={[styles.bottomLinkText, { fontFamily: fonts?.medium }]}>
                {bottomLink}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// PIN 초기화를 위한 forwardRef 버전
export const PinKeypadWithRef = React.forwardRef(({
  onPinChange,
  onComplete,
  pinLength = 6,
  shuffleKeys = true,
  disabled = false,
  colors,
  fonts,
  showBiometric = false,
  onBiometricPress,
  bottomLink,
  onBottomLinkPress,
}, ref) => {
  const [pin, setPin] = useState('');
  const [shuffledNumbers, setShuffledNumbers] = useState(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  const completedRef = useRef(false);

  const shuffleNumbers = useCallback(() => {
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  }, []);

  useEffect(() => {
    if (shuffleKeys) {
      setShuffledNumbers(shuffleNumbers());
    }
  }, [shuffleKeys, shuffleNumbers]);

  // PIN 변경 시 콜백 - onComplete는 한 번만 호출
  useEffect(() => {
    onPinChange?.(pin);
    if (pin.length === pinLength && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(pin);
    }
  }, [pin, pinLength]);

  const handleKeyPress = async (key) => {
    if (disabled || completedRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pin.length < pinLength) {
      setPin((prev) => prev + key);
    }
  };

  const handleDelete = async () => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completedRef.current = false;
    setPin((prev) => prev.slice(0, -1));
  };

  const resetPin = useCallback(() => {
    setPin('');
    completedRef.current = false;
    if (shuffleKeys) {
      setShuffledNumbers(shuffleNumbers());
    }
  }, [shuffleKeys, shuffleNumbers]);

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
                backgroundColor: index < pin.length
                  ? (colors?.primary || '#0066FF')
                  : (colors?.border || '#D1D1D6'),
              },
            ]}
          />
        ))}
    </View>
  );

  const renderNumberKey = (number) => (
    <TouchableOpacity
      key={`num-${number}`}
      style={styles.key}
      onPress={() => handleKeyPress(number)}
      activeOpacity={0.6}
      disabled={disabled || completedRef.current}
    >
      <Text style={[styles.keyText, { fontFamily: fonts?.semiBold }]}>{number}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderPinDots()}
      <View style={styles.keypadWrapper}>
        <View style={styles.keypadContainer}>
          <View style={styles.row}>
            {renderNumberKey(shuffledNumbers[0])}
            {renderNumberKey(shuffledNumbers[1])}
            {renderNumberKey(shuffledNumbers[2])}
          </View>
          <View style={styles.row}>
            {renderNumberKey(shuffledNumbers[3])}
            {renderNumberKey(shuffledNumbers[4])}
            {renderNumberKey(shuffledNumbers[5])}
          </View>
          <View style={styles.row}>
            {renderNumberKey(shuffledNumbers[6])}
            {renderNumberKey(shuffledNumbers[7])}
            {renderNumberKey(shuffledNumbers[8])}
          </View>
          <View style={styles.row}>
            {showBiometric ? (
              <TouchableOpacity
                style={styles.key}
                onPress={onBiometricPress}
                activeOpacity={0.6}
                disabled={disabled}
              >
                <Ionicons name="scan-outline" size={30} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.key} />
            )}
            {renderNumberKey(shuffledNumbers[9])}
            <TouchableOpacity
              style={styles.key}
              onPress={handleDelete}
              activeOpacity={0.6}
              disabled={disabled}
            >
              <Ionicons name="backspace-outline" size={30} color="#fff" />
            </TouchableOpacity>
          </View>

          {bottomLink && (
            <TouchableOpacity style={styles.bottomLinkContainer} onPress={onBottomLinkPress}>
              <Text style={[styles.bottomLinkText, { fontFamily: fonts?.medium }]}>
                {bottomLink}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 30,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  keypadWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keypadContainer: {
    backgroundColor: '#0A2A5E',
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  key: {
    width: KEY_SIZE,
    height: KEY_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  bottomLinkContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 10,
  },
  bottomLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    color: '#fff',
  },
});
