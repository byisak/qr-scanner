// screens/ResultScreen.js - Expo Router 버전
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, Platform, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { code, url, isDuplicate, scanCount, timestamp, scanTimes, photoUri, groupId, fromHistory } = params;
  const displayText = code || url || '';
  const isUrl = displayText.startsWith('http://') || displayText.startsWith('https://');
  const showDuplicate = isDuplicate === 'true';
  const count = parseInt(scanCount || '1', 10);
  const scanTimestamp = timestamp ? parseInt(timestamp, 10) : null;
  const hasPhoto = photoUri && photoUri.length > 0;
  const isFromHistory = fromHistory === 'true';

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(displayText);

  // 모든 스캔 시간 파싱
  let allScanTimes = [];
  try {
    allScanTimes = scanTimes ? JSON.parse(scanTimes) : (scanTimestamp ? [scanTimestamp] : []);
  } catch (e) {
    allScanTimes = scanTimestamp ? [scanTimestamp] : [];
  }

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
    await Clipboard.setStringAsync(isEditing ? editedText : displayText);
    Alert.alert('복사 완료', '클립보드에 복사되었습니다.');
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: isEditing ? editedText : displayText });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleOpenUrl = () => {
    const urlToOpen = isEditing ? editedText : displayText;
    if (urlToOpen.startsWith('http://') || urlToOpen.startsWith('https://')) {
      router.push({ pathname: '/webview', params: { url: urlToOpen } });
    }
  };

  // 수정 저장
  const handleSaveEdit = async () => {
    if (!isFromHistory || !groupId) {
      Alert.alert('오류', '히스토리에서만 수정할 수 있습니다.');
      return;
    }

    if (!editedText.trim()) {
      Alert.alert('오류', '값을 입력해주세요.');
      return;
    }

    try {
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      if (!historyData) {
        Alert.alert('오류', '히스토리를 찾을 수 없습니다.');
        return;
      }

      const historyByGroup = JSON.parse(historyData);
      const groupHistory = historyByGroup[groupId] || [];

      // 원래 코드와 일치하는 항목 찾기
      const itemIndex = groupHistory.findIndex(item =>
        item.code === displayText && item.timestamp === scanTimestamp
      );

      if (itemIndex === -1) {
        Alert.alert('오류', '항목을 찾을 수 없습니다.');
        return;
      }

      // 수정된 값으로 업데이트
      groupHistory[itemIndex] = {
        ...groupHistory[itemIndex],
        code: editedText,
      };

      historyByGroup[groupId] = groupHistory;
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      Alert.alert('수정 완료', '스캔 결과가 수정되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            setIsEditing(false);
            router.back();
          }
        }
      ]);
    } catch (error) {
      console.error('Edit error:', error);
      Alert.alert('오류', '수정 중 문제가 발생했습니다.');
    }
  };

  // 삭제
  const handleDelete = () => {
    if (!isFromHistory || !groupId) {
      Alert.alert('오류', '히스토리에서만 삭제할 수 있습니다.');
      return;
    }

    Alert.alert(
      '삭제 확인',
      '이 스캔 기록을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
              if (!historyData) {
                Alert.alert('오류', '히스토리를 찾을 수 없습니다.');
                return;
              }

              const historyByGroup = JSON.parse(historyData);
              const groupHistory = historyByGroup[groupId] || [];

              // 원래 코드와 일치하는 항목 찾기
              const filteredHistory = groupHistory.filter(item =>
                !(item.code === displayText && item.timestamp === scanTimestamp)
              );

              historyByGroup[groupId] = filteredHistory;
              await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

              Alert.alert('삭제 완료', '스캔 기록이 삭제되었습니다.', [
                {
                  text: '확인',
                  onPress: () => router.back()
                }
              ]);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 취소
      setEditedText(displayText);
      setIsEditing(false);
    } else {
      // 편집 시작
      setIsEditing(true);
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
        {isFromHistory && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            accessibilityLabel="삭제"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}
        {!isFromHistory && <View style={{ width: 28 }} />}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 스캔 사진 */}
        {hasPhoto && (
          <View style={styles.photoContainer}>
            <Text style={styles.photoLabel}>스캔 당시 사진</Text>
            <Image
              source={{ uri: photoUri }}
              style={styles.scanPhoto}
              resizeMode="cover"
            />
          </View>
        )}

        {/* 중복 스캔 알림 */}
        {showDuplicate && (
          <View style={styles.duplicateBanner}>
            <View style={styles.duplicateHeader}>
              <Ionicons name="repeat" size={20} color="#FF9500" />
              <Text style={styles.duplicateText}>
                중복 스캔 ({count}번째)
              </Text>
            </View>
            {allScanTimes.length > 0 && (
              <View style={styles.scanTimesContainer}>
                <Text style={styles.scanTimesTitle}>스캔 기록:</Text>
                {allScanTimes.slice().reverse().map((time, index) => (
                  <Text key={index} style={styles.scanTimeItem}>
                    {allScanTimes.length - index}. {formatDateTime(time)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>스캔된 데이터</Text>
          {isFromHistory && (
            <TouchableOpacity
              style={styles.editToggleButton}
              onPress={handleEditToggle}
            >
              <Ionicons
                name={isEditing ? "close-circle" : "pencil"}
                size={20}
                color={isEditing ? "#FF3B30" : "#007AFF"}
              />
              <Text style={[styles.editToggleText, isEditing && styles.editToggleTextCancel]}>
                {isEditing ? '취소' : '수정'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={styles.dataBox}>
            <TextInput
              style={styles.dataInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              autoFocus
              placeholder="데이터를 입력하세요"
            />
          </View>
        ) : (
          <View style={styles.dataBox}>
            <ScrollView style={styles.dataScrollView}>
              <Text style={styles.dataText} selectable>
                {displayText}
              </Text>
            </ScrollView>
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveEdit}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>저장</Text>
          </TouchableOpacity>
        )}

        {!isEditing && (
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

            {(isUrl || editedText.startsWith('http://') || editedText.startsWith('https://')) && (
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
        )}
      </ScrollView>

      {!isEditing && (
        <TouchableOpacity
          style={styles.scanAgainButton}
          onPress={() => router.back()}
          accessibilityLabel="다시 스캔하기"
          accessibilityRole="button"
        >
          <Ionicons name="scan" size={24} color="#fff" />
          <Text style={styles.scanAgainText}>다시 스캔하기</Text>
        </TouchableOpacity>
      )}
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
  deleteButton: {
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
  photoContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  scanPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#e0e0e0',
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
  scanTimesContainer: {
    marginTop: 12,
    width: '100%',
    alignItems: 'flex-start',
  },
  scanTimesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9500',
    marginBottom: 6,
  },
  scanTimeItem: {
    fontSize: 12,
    color: '#FF9500',
    marginVertical: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  editToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  editToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  editToggleTextCancel: {
    color: '#FF3B30',
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
  dataInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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
