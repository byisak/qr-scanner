// utils/presetStorage.js - 커스텀 프리셋 저장 유틸리티
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRESETS_KEY = 'customQRPresets';

/**
 * 저장된 모든 프리셋 가져오기
 * @returns {Promise<Array>} 프리셋 배열
 */
export const getPresets = async () => {
  try {
    const presetsJson = await AsyncStorage.getItem(PRESETS_KEY);
    if (presetsJson) {
      return JSON.parse(presetsJson);
    }
    return [];
  } catch (error) {
    console.error('Failed to load presets:', error);
    return [];
  }
};

/**
 * 새 프리셋 저장
 * @param {Object} preset - 프리셋 객체
 * @param {string} preset.name - 프리셋 이름
 * @param {Object} preset.style - QR 스타일 설정
 * @param {number} preset.frameIndex - 프레임 인덱스
 * @param {string|null} preset.logoImage - 로고 이미지 (base64)
 * @returns {Promise<Object>} 저장된 프리셋 (id 포함)
 */
export const savePreset = async (preset) => {
  try {
    const presets = await getPresets();

    const newPreset = {
      id: Date.now().toString(),
      name: preset.name,
      style: preset.style,
      frameIndex: preset.frameIndex || 0,
      logoImage: preset.logoImage || null,
      createdAt: new Date().toISOString(),
    };

    presets.unshift(newPreset); // 최신 프리셋을 앞에 추가

    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));

    return newPreset;
  } catch (error) {
    console.error('Failed to save preset:', error);
    throw error;
  }
};

/**
 * 프리셋 삭제
 * @param {string} presetId - 삭제할 프리셋 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export const deletePreset = async (presetId) => {
  try {
    const presets = await getPresets();
    const filteredPresets = presets.filter(p => p.id !== presetId);

    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(filteredPresets));

    return true;
  } catch (error) {
    console.error('Failed to delete preset:', error);
    return false;
  }
};

/**
 * 프리셋 이름 수정
 * @param {string} presetId - 수정할 프리셋 ID
 * @param {string} newName - 새 이름
 * @returns {Promise<boolean>} 성공 여부
 */
export const updatePresetName = async (presetId, newName) => {
  try {
    const presets = await getPresets();
    const presetIndex = presets.findIndex(p => p.id === presetId);

    if (presetIndex === -1) return false;

    presets[presetIndex].name = newName;

    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));

    return true;
  } catch (error) {
    console.error('Failed to update preset:', error);
    return false;
  }
};

/**
 * 모든 프리셋 삭제
 * @returns {Promise<boolean>} 성공 여부
 */
export const clearAllPresets = async () => {
  try {
    await AsyncStorage.removeItem(PRESETS_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear presets:', error);
    return false;
  }
};
