// screens/ResultScreen.js - Expo Router 버전
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { code, url, isDuplicate, scanCount, timestamp } = params;
  const displayText = code || url || '';
  const isUrl = displayText.startsWith('http://') || displayText.startsWith('https://');
  const showDuplicate = isDuplicate === 'true';
  const count = parseInt(scanCount || '1', 10);
  const scanTimestamp = timestamp ? parseInt(timestamp, 10) : null;

  // 시간 포맷팅 함수
  const formatDateTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}.${month}.${day}  ${hours}:${minutes}:${seconds}`;
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(displayText);
    Alert.alert('복사 완료', '클립보드에 복사되었습니다.');
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: displayText });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleOpenUrl = () => {
    if (isUrl) {
      router.push({ pathname: '/webview', params: { url: displayText } });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityLabel="닫기"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스캔 결과</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="qr-code" size={64} color="#00FF00" />
          </View>
        </View>

        {/* 중복 스캔 알림 */}
        {showDuplicate && (
          <View style={styles.duplicateBanner}>
            <View style={styles.duplicateHeader}>
              <Ionicons name="repeat" size={20} color="#FF9500" />
              <Text style={styles.duplicateText}>
                중복 스캔 ({count}번째)
              </Text>
            </View>
            {scanTimestamp && (
              <Text style={styles.duplicateTime}>
                마지막 스캔: {formatDateTime(scanTimestamp)}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.label}>스캔된 데이터</Text>
        <View style={styles.dataBox}>
          <ScrollView style={styles.dataScrollView}>
            <Text style={styles.dataText} selectable>
              {displayText}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopy}
            accessibilityLabel="복사하기"
            accessibilityRole="button"
          >
            <Ionicons name="copy-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>복사</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
            accessibilityLabel="공유하기"
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>공유</Text>
          </TouchableOpacity>

          {isUrl && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenUrl}
              accessibilityLabel="링크 열기"
              accessibilityRole="button"
            >
              <Ionicons name="open-outline" size={24} color="#007AFF" />
              <Text style={styles.actionButtonText}>열기</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.scanAgainButton}
        onPress={() => router.back()}
        accessibilityLabel="다시 스캔하기"
        accessibilityRole="button"
      >
        <Ionicons name="scan" size={24} color="#fff" />
        <Text style={styles.scanAgainText}>다시 스캔하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00FF00',
  },
  duplicateBanner: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 20,
    alignItems: 'center',
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9500',
    marginLeft: 8,
  },
  duplicateTime: {
    fontSize: 13,
    color: '#FF9500',
    marginTop: 6,
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  dataBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    minHeight: 120,
    maxHeight: 300,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dataScrollView: {
    flex: 1,
  },
  dataText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 30,
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    minWidth: 90,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00FF00',
    marginHorizontal: 20,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#00FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
