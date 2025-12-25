// screens/BackupImportScreen.js - 백업 가져오기 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';

export default function BackupImportScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const importOptions = [
    {
      id: 'local',
      title: '로컬 파일에서 가져오기',
      description: '기기에 저장된 백업 파일을 선택합니다',
      icon: 'document-outline',
      iconColor: '#007AFF',
      available: false,
    },
    {
      id: 'clipboard',
      title: '클립보드에서 가져오기',
      description: '복사한 백업 데이터를 붙여넣기합니다',
      icon: 'clipboard-outline',
      iconColor: '#34C759',
      available: true,
    },
    {
      id: 'paste',
      title: '직접 입력하기',
      description: '백업 JSON 데이터를 직접 붙여넣습니다',
      icon: 'create-outline',
      iconColor: '#FF9500',
      available: true,
    },
    {
      id: 'icloud',
      title: 'iCloud에서 가져오기',
      description: 'iCloud Drive에서 백업을 가져옵니다',
      icon: 'cloud-outline',
      iconColor: '#5AC8FA',
      available: false,
    },
    {
      id: 'google',
      title: 'Google Drive에서 가져오기',
      description: 'Google Drive에서 백업을 가져옵니다',
      icon: 'logo-google',
      iconColor: '#4285F4',
      available: false,
    },
  ];

  const restoreBackupData = async (backupData) => {
    try {
      // 버전 확인
      if (!backupData.version || !backupData.data) {
        throw new Error('유효하지 않은 백업 파일입니다.');
      }

      // 데이터 복원
      const entries = Object.entries(backupData.data);
      for (const [key, value] of entries) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        await AsyncStorage.setItem(key, stringValue);
      }

      return true;
    } catch (error) {
      console.error('Restore backup data error:', error);
      throw error;
    }
  };

  const processBackupText = async (text) => {
    try {
      const backupData = JSON.parse(text.trim());

      Alert.alert(
        '백업 복원',
        `백업 날짜: ${new Date(backupData.createdAt).toLocaleDateString()}\n\n기존 데이터를 덮어쓰시겠습니까?`,
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '복원',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreBackupData(backupData);
                Alert.alert('성공', '백업이 성공적으로 복원되었습니다. 앱을 다시 시작해주세요.');
                setShowPasteModal(false);
                setPasteText('');
              } catch (error) {
                Alert.alert('오류', error.message || '백업 복원 중 오류가 발생했습니다.');
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('오류', '유효한 JSON 형식이 아닙니다. 백업 파일 내용을 확인해주세요.');
    }
  };

  const handleLocalImport = async () => {
    setIsLoading(true);
    setLoadingType('local');

    try {
      // expo-document-picker 동적 로딩
      const DocumentPickerModule = await import('expo-document-picker');
      // default export 또는 named export 확인
      const getDocumentAsync = DocumentPickerModule.getDocumentAsync || DocumentPickerModule.default?.getDocumentAsync;

      if (!getDocumentAsync) {
        throw new Error('Cannot find native module ExpoDocumentPicker');
      }

      const result = await getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const file = new File(fileUri);
      const fileContent = await file.text();

      await processBackupText(fileContent);
    } catch (error) {
      console.error('Local import error:', error);

      // 네이티브 모듈 에러시 클립보드 방식 안내
      if (error.message?.includes('native module') || error.message?.includes('ExpoDocumentPicker')) {
        Alert.alert(
          '파일 선택 불가',
          'Development Build가 필요합니다.\n\n대신 "클립보드에서 가져오기"를 사용해주세요:\n\n1. 백업 파일을 텍스트 앱으로 엽니다\n2. 전체 내용을 복사합니다\n3. "클립보드에서 가져오기"를 탭합니다'
        );
      } else {
        Alert.alert('오류', '백업 파일을 읽는 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleClipboardImport = async () => {
    setIsLoading(true);
    setLoadingType('clipboard');

    try {
      const clipboardContent = await Clipboard.getStringAsync();

      if (!clipboardContent || clipboardContent.trim() === '') {
        Alert.alert('알림', '클립보드가 비어있습니다. 백업 파일 내용을 먼저 복사해주세요.');
        return;
      }

      await processBackupText(clipboardContent);
    } catch (error) {
      console.error('Clipboard import error:', error);
      Alert.alert('오류', '클립보드에서 데이터를 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handlePasteImport = () => {
    setShowPasteModal(true);
  };

  const handlePasteSubmit = async () => {
    if (!pasteText || pasteText.trim() === '') {
      Alert.alert('알림', '백업 데이터를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setLoadingType('paste');

    try {
      await processBackupText(pasteText);
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleLocalImportDisabled = () => {
    Alert.alert('준비 중', '로컬 파일 가져오기 기능은 준비 중입니다.\n\n클립보드에서 가져오기를 이용해주세요.');
  };

  const handleICloudImport = () => {
    Alert.alert('준비 중', 'iCloud 가져오기 기능은 준비 중입니다.');
  };

  const handleGoogleImport = () => {
    Alert.alert('준비 중', 'Google Drive 가져오기 기능은 준비 중입니다.');
  };

  const handleImport = (type) => {
    switch (type) {
      case 'local':
        handleLocalImportDisabled();
        break;
      case 'clipboard':
        handleClipboardImport();
        break;
      case 'paste':
        handlePasteImport();
        break;
      case 'icloud':
        handleICloudImport();
        break;
      case 'google':
        handleGoogleImport();
        break;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          백업 가져오기
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 경고 문구 */}
        <View style={[styles.warningCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="warning-outline" size={24} color="#D97706" />
          <Text style={[styles.warningText, { color: '#92400E', fontFamily: fonts.regular }]}>
            백업을 복원하면 현재 데이터가 덮어쓰기됩니다. 중요한 데이터는 미리 백업해주세요.
          </Text>
        </View>

        {/* 가져오기 옵션들 */}
        <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
          {importOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                !option.available && styles.optionDisabled,
              ]}
              onPress={() => handleImport(option.id)}
              disabled={isLoading || !option.available}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: `${option.iconColor}15` }]}>
                <Ionicons name={option.icon} size={28} color={option.available ? option.iconColor : colors.textTertiary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle,
                  { color: option.available ? colors.text : colors.textTertiary, fontFamily: fonts.semiBold }
                ]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {option.description}
                </Text>
                {!option.available && (
                  <Text style={[styles.unavailableText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                    준비 중
                  </Text>
                )}
              </View>
              {isLoading && loadingType === option.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={24} color={option.available ? colors.textTertiary : colors.border} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 복원 안내 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            복원 방법
          </Text>
          <View style={styles.guideList}>
            {[
              '• 로컬 파일: 파일 앱에서 백업 파일을 직접 선택',
              '• 클립보드: 백업 파일 내용 복사 후 붙여넣기',
              '• 복원 후 앱을 다시 시작해야 적용됩니다',
            ].map((text, index) => (
              <View key={index} style={styles.guideItem}>
                <Text style={[styles.guideText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Paste Modal */}
      <Modal
        visible={showPasteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                백업 데이터 입력
              </Text>
              <TouchableOpacity onPress={() => setShowPasteModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              백업 파일의 JSON 내용을 아래에 붙여넣으세요.
            </Text>

            <TextInput
              style={[
                styles.pasteInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                  fontFamily: fonts.regular,
                }
              ]}
              multiline
              placeholder='{"version": "1.0", "data": {...}}'
              placeholderTextColor={colors.textTertiary}
              value={pasteText}
              onChangeText={setPasteText}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handlePasteSubmit}
              disabled={isLoading}
            >
              {isLoading && loadingType === 'paste' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.submitButtonText, { fontFamily: fonts.semiBold }]}>
                  복원하기
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  optionsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  unavailableText: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  guideList: {
    gap: 12,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guideText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpace: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  pasteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
    fontSize: 13,
    marginBottom: 16,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
