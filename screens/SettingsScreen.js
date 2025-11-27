// screens/SettingsScreen.js - 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function SettingsScreen() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [url, setUrl] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(6);

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const u = await SecureStore.getItemAsync('baseUrl');
        const h = await AsyncStorage.getItem('hapticEnabled');
        const b = await AsyncStorage.getItem('selectedBarcodes');

        if (e === 'true') {
          setOn(true);
          setUrl(u || '');
        }

        if (h !== null) {
          setHapticEnabled(h === 'true');
        }

        if (b) {
          const parsed = JSON.parse(b);
          setSelectedBarcodesCount(parsed.length || 6);
        }
      } catch (error) {
        console.error('Load settings error:', error);
      }
    })();
  }, []);

  // 화면이 포커스될 때마다 바코드 개수 업데이트
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const b = await AsyncStorage.getItem('selectedBarcodes');
          if (b) {
            const parsed = JSON.parse(b);
            setSelectedBarcodesCount(parsed.length || 6);
          }
        } catch (error) {
          console.error('Load barcode count error:', error);
        }
      })();
    }, [])
  );

  useEffect(() => {
    SecureStore.setItemAsync('scanLinkEnabled', on.toString());
    if (!on) {
      SecureStore.deleteItemAsync('baseUrl');
      setUrl('');
    }
  }, [on]);

  useEffect(() => {
    if (on && url.trim()) {
      const t = setTimeout(() => SecureStore.setItemAsync('baseUrl', url.trim()), 500);
      return () => clearTimeout(t);
    }
  }, [url, on]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('hapticEnabled', hapticEnabled.toString());
      } catch (error) {
        console.error('Save haptic settings error:', error);
      }
    })();
  }, [hapticEnabled]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={s.c} contentContainerStyle={s.content}>
        <Text style={s.title}>설정</Text>

        {/* 바코드 인식 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>바코드 설정</Text>

          {/* 햅틱 피드백 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>햅틱 피드백</Text>
              <Text style={s.desc}>스캔 시 진동으로 알림</Text>
              {hapticEnabled && <Text style={s.ok}>활성화됨</Text>}
            </View>
            <Switch
              value={hapticEnabled}
              onValueChange={setHapticEnabled}
              trackColor={{ true: '#34C759', false: '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel="햅틱 피드백 활성화"
            />
          </View>

          {/* 바코드 선택 (클릭하면 새 페이지로) */}
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/barcode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>인식할 바코드 선택</Text>
              <Text style={s.desc}>{selectedBarcodesCount}개 바코드 타입 선택됨</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* URL 연동 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>자동 이동</Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>스캔 연동 URL 사용하기</Text>
              <Text style={s.desc}>스캔 즉시 설정한 URL로 이동합니다</Text>
              {on && <Text style={s.ok}>활성화됨</Text>}
            </View>
            <Switch
              value={on}
              onValueChange={setOn}
              trackColor={{ true: '#34C759', false: '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel="자동 URL 이동 활성화"
            />
          </View>

          {on && (
            <>
              <Text style={s.urlInfo}>
                스캔한 코드가 자동으로 아래 주소로 이동합니다
                {'\n'}URL에 {'{code}'}를 넣으면 스캔 값으로 대체됩니다
              </Text>
              <TextInput
                style={s.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com/search?q={code}"
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="url"
                accessibilityLabel="연동 URL 입력"
              />
              <Text style={s.save}>입력 즉시 자동 저장됨</Text>

              <View style={s.exampleBox}>
                <Text style={s.exampleTitle}>예시:</Text>
                <Text style={s.exampleText}>https://example.com/product/{'{code}'}</Text>
                <Text style={s.exampleDesc}>
                  → 스캔 값이 "ABC123"이면{'\n'}
                  https://example.com/product/ABC123 로 이동
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  c: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 30,
    color: '#000',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 10,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 18,
  },
  ok: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 6,
    fontWeight: '600',
  },
  urlInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 20,
    lineHeight: 20,
  },
  input: {
    marginTop: 15,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    color: '#000',
  },
  save: {
    marginTop: 10,
    textAlign: 'center',
    color: '#34C759',
    fontWeight: '600',
    fontSize: 12,
  },
  exampleBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  exampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#007AFF',
    marginBottom: 8,
  },
  exampleDesc: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
  },
});
