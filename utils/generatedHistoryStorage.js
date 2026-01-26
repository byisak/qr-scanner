// utils/generatedHistoryStorage.js - 생성된 코드 히스토리 저장 유틸리티
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// 생성 그룹 ID (고정)
export const GENERATED_GROUP_ID = 'generated';
export const GENERATED_GROUP_NAME = '생성';

// 썸네일 저장 디렉토리
const THUMBNAIL_DIR = FileSystem.documentDirectory + 'generated_thumbnails/';

// 썸네일 디렉토리 초기화
const ensureThumbnailDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, { intermediates: true });
  }
};

// 생성 그룹이 없으면 생성
export const ensureGeneratedGroup = async () => {
  try {
    const groupsData = await AsyncStorage.getItem('scanGroups');
    let groups = groupsData ? JSON.parse(groupsData) : [];

    // 생성 그룹이 있는지 확인
    const existingGroup = groups.find(g => g.id === GENERATED_GROUP_ID);

    if (!existingGroup) {
      // 생성 그룹 추가 (맨 앞에)
      const generatedGroup = {
        id: GENERATED_GROUP_ID,
        name: GENERATED_GROUP_NAME,
        createdAt: Date.now(),
        isGenerated: true, // 생성 그룹 표시
      };
      groups = [generatedGroup, ...groups];
      await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));
    } else if (existingGroup.isDeleted) {
      // 삭제된 상태면 복원
      const updatedGroups = groups.map(g =>
        g.id === GENERATED_GROUP_ID ? { ...g, isDeleted: false } : g
      );
      await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
    }

    return true;
  } catch (error) {
    console.error('Failed to ensure generated group:', error);
    return false;
  }
};

// 썸네일 저장 (base64 또는 file URI에서)
export const saveThumbnail = async (imageSource, timestamp) => {
  try {
    await ensureThumbnailDir();

    const thumbnailPath = THUMBNAIL_DIR + `thumb_${timestamp}.png`;

    if (imageSource.startsWith('data:')) {
      // Base64 이미지
      const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
      await FileSystem.writeAsStringAsync(thumbnailPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else if (imageSource.startsWith('file:')) {
      // 파일 URI - 복사
      await FileSystem.copyAsync({
        from: imageSource,
        to: thumbnailPath,
      });
    } else {
      console.warn('Unknown image source format');
      return null;
    }

    return thumbnailPath;
  } catch (error) {
    console.error('Failed to save thumbnail:', error);
    return null;
  }
};

// 생성된 코드를 히스토리에 저장
export const saveGeneratedCodeToHistory = async ({
  code,           // 생성된 코드 값
  type,           // 'qr' 또는 바코드 타입 (예: 'code128')
  imageUri,       // 저장된 이미지 URI (썸네일용)
  qrStyle,        // QR 스타일 설정 (편집용)
  barcodeSettings, // 바코드 설정 (편집용)
  frameId,        // 프레임 ID (QR용)
}) => {
  try {
    // 코드 값 검증 - 반드시 문자열이어야 함
    const codeValue = String(code || '').trim();
    if (!codeValue) {
      console.warn('saveGeneratedCodeToHistory: code is empty, skipping save');
      return { success: false, error: 'Code value is empty' };
    }

    // 1. 생성 그룹 확인/생성
    await ensureGeneratedGroup();

    const now = Date.now();

    // 2. 썸네일 저장
    const thumbnailUri = imageUri ? await saveThumbnail(imageUri, now) : null;

    // 3. 히스토리 데이터 로드
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    const historyByGroup = historyData ? JSON.parse(historyData) : {};

    // 4. 생성 그룹 히스토리 가져오기
    const generatedHistory = historyByGroup[GENERATED_GROUP_ID] || [];

    // 5. 동일한 코드가 있는지 확인
    const existingIndex = generatedHistory.findIndex(item => item.code === codeValue);

    // 6. 새 레코드 생성
    const record = {
      code: codeValue,
      timestamp: now,
      type: type === 'qr' ? 'qr' : type,
      isGenerated: true, // 생성된 코드 표시
      thumbnail: thumbnailUri, // 썸네일 경로
      // 편집용 데이터
      generatorData: {
        qrStyle: type === 'qr' ? qrStyle : null,
        barcodeSettings: type !== 'qr' ? barcodeSettings : null,
        frameId: type === 'qr' ? frameId : null,
        codeMode: type === 'qr' ? 'qr' : 'barcode',
        barcodeFormat: type !== 'qr' ? type : null,
      },
    };

    if (existingIndex !== -1) {
      // 기존 항목 업데이트 (맨 앞으로 이동)
      const existingItem = generatedHistory[existingIndex];
      record.count = (existingItem.count || 1) + 1;
      record.firstCreated = existingItem.firstCreated || existingItem.timestamp;
      generatedHistory.splice(existingIndex, 1);
    } else {
      record.count = 1;
      record.firstCreated = now;
    }

    // 7. 맨 앞에 추가 (최대 500개)
    historyByGroup[GENERATED_GROUP_ID] = [record, ...generatedHistory].slice(0, 500);

    // 8. 저장
    await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

    return { success: true, record };
  } catch (error) {
    console.error('Failed to save generated code to history:', error);
    return { success: false, error };
  }
};

// 생성 히스토리 항목 삭제
export const deleteGeneratedHistoryItem = async (timestamp) => {
  try {
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    const historyByGroup = historyData ? JSON.parse(historyData) : {};

    const generatedHistory = historyByGroup[GENERATED_GROUP_ID] || [];
    const itemIndex = generatedHistory.findIndex(item => item.timestamp === timestamp);

    if (itemIndex !== -1) {
      const item = generatedHistory[itemIndex];

      // 썸네일 파일 삭제
      if (item.thumbnail) {
        try {
          await FileSystem.deleteAsync(item.thumbnail, { idempotent: true });
        } catch (e) {
          console.warn('Failed to delete thumbnail:', e);
        }
      }

      // 히스토리에서 제거
      generatedHistory.splice(itemIndex, 1);
      historyByGroup[GENERATED_GROUP_ID] = generatedHistory;

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
    }

    return true;
  } catch (error) {
    console.error('Failed to delete generated history item:', error);
    return false;
  }
};

// 생성 히스토리 전체 조회
export const getGeneratedHistory = async () => {
  try {
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    const historyByGroup = historyData ? JSON.parse(historyData) : {};

    return historyByGroup[GENERATED_GROUP_ID] || [];
  } catch (error) {
    console.error('Failed to get generated history:', error);
    return [];
  }
};
