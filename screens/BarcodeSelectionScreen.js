// screens/BarcodeSelectionScreen.js - 바코드 종류 선택 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// ✅ 지원되는 바코드 타입 목록
const BARCODE_TYPES = [
  { key: 'qr', name: 'QR 코드', desc: '일반 QR 코드' },
  { key: 'ean13', name: 'EAN-13', desc: '국제 상품 바코드 (13자리)' },
  { key: 'ean8', name: 'EAN-8', desc: '국제 상품 바코드 (8자리)' },
  { key: 'code128', name: 'Code 128', desc: '물류/재고 관리용' },
  { key: 'code39', name: 'Code 39', desc: '산업용 바코드' },
  { key: 'code93', name: 'Code 93', desc: 'Code 39 개선형' },
  { key: 'upce', name: 'UPC-E', desc: '미국 상품 바코드 (축약형)' },
  { key: 'upca', name: 'UPC-A', desc: '미국 상품 바코드 (표준형)' },
  { key: 'pdf417', name: 'PDF417', desc: '2D 바코드 (ID/문서)' },
  { key: 'aztec', name: 'Aztec', desc: '2D 바코드 (교통카드)' },
  { key: 'datamatrix', name: 'Data Matrix', desc: '2D 바코드 (소형 제품)' },
  { key: 'itf14', name: 'ITF-14', desc: '물류 박스 바코드' },
  { key: 'codabar', name: 'Codabar', desc: '도서관/의료용' },
];

export default function BarcodeSelectionScreen() {
  const router = useRouter();
  // ✅ 기본값: 자주 사용되는 바코드 타입들을 기본 활성화
  const [selectedBarcodes, setSelectedBarcodes] = useState([
    'qr',
    'ean13',
    'ean8',
    'code128',
    'upce',
    'upca',
  ]);

  useEffect(() => {
    (async () => {
      try {
        const b = await AsyncStorage.getItem('selectedBarcodes');
        if (b) {
          const parsed = JSON.parse(b);
          setSelectedBarcodes(
            parsed.length > 0
              ? parsed
              : ['qr', 'ean13', 'ean8', 'code128', 'upce', 'upca']
          );
        }
      } catch (error) {
        console.error('Load barcode settings error:', error);
      }
    })();
  }, []);

  // ✅ 바코드 선택 저장
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('selectedBarcodes', JSON.stringify(selectedBarcodes));
      } catch (error) {
        console.error('Save barcode settings error:', error);
      }
    })();
  }, [selectedBarcodes]);

  // ✅ 바코드 타입 토글
  const toggleBarcode = (key) => {
    setSelectedBarcodes((prev) => {
      if (prev.includes(key)) {
        // QR 코드는 최소 1개는 선택되어야 함
        if (key === 'qr' && prev.length === 1) {
          return prev;
        }
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // ✅ 전체 선택/해제
  const toggleAll = () => {
    if (selectedBarcodes.length === BARCODE_TYPES.length) {
      setSelectedBarcodes(['qr']); // 최소 QR 코드는 유지
    } else {
      setSelectedBarcodes(BARCODE_TYPES.map((b) => b.key));
    }
  };

  const allSelected = selectedBarcodes.length === BARCODE_TYPES.length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>인식할 바코드 선택</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.info}>
              선택한 바코드 타입만 인식됩니다 ({selectedBarcodes.length}개 선택)
            </Text>
            <TouchableOpacity onPress={toggleAll} style={s.toggleAllBtn}>
              <Text style={s.toggleAllText}>{allSelected ? '전체 해제' : '전체 선택'}</Text>
            </TouchableOpacity>
          </View>

          {BARCODE_TYPES.map((barcode) => {
            const isSelected = selectedBarcodes.includes(barcode.key);
            const isQROnly = barcode.key === 'qr' && selectedBarcodes.length === 1;

            return (
              <TouchableOpacity
                key={barcode.key}
                style={[s.barcodeItem, isSelected && s.barcodeItemSelected]}
                onPress={() => toggleBarcode(barcode.key)}
                disabled={isQROnly}
                activeOpacity={0.7}
              >
                <View style={s.barcodeInfo}>
                  <View style={s.barcodeHeader}>
                    <Text style={[s.barcodeName, isSelected && s.barcodeNameSelected]}>
                      {barcode.name}
                    </Text>
                    {barcode.key === 'qr' && (
                      <View style={s.defaultBadge}>
                        <Text style={s.defaultBadgeText}>기본</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.barcodeDesc}>{barcode.desc}</Text>
                </View>
                <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  info: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    marginRight: 10,
  },
  toggleAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  toggleAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  barcodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  barcodeItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  barcodeInfo: {
    flex: 1,
    marginRight: 12,
  },
  barcodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  barcodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  barcodeNameSelected: {
    color: '#007AFF',
  },
  defaultBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#34C759',
    borderRadius: 6,
  },
  defaultBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  barcodeDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
});
