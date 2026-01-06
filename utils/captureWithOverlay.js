// utils/captureWithOverlay.js
// 사진 캡쳐 유틸리티 (Skia 없이 동작하는 버전)
// 오버레이는 결과 화면에서 SVG로 렌더링

import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 이미지 캡쳐 및 메타데이터 반환
 * 오버레이는 포함하지 않고 결과 화면에서 SVG로 렌더링
 * @param {string} imageUri - 원본 이미지 URI
 * @param {Array} barcodes - 바코드 데이터 배열
 * @param {number} screenWidth - 화면 너비
 * @param {number} screenHeight - 화면 높이
 * @returns {Promise<Object>} - 이미지 URI와 메타데이터
 */
export async function captureWithOverlay(imageUri, barcodes, screenWidth, screenHeight) {
  try {
    // 이미지 정보 가져오기 (EXIF 회전 정규화 포함)
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // 변환 없음
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );

    console.log('[captureWithOverlay] Image processed:', manipResult.uri);
    console.log('[captureWithOverlay] Dimensions:', manipResult.width, 'x', manipResult.height);

    return {
      uri: manipResult.uri,
      width: manipResult.width,
      height: manipResult.height,
      screenWidth,
      screenHeight,
    };

  } catch (error) {
    console.error('[captureWithOverlay] Error:', error);
    return {
      uri: imageUri,
      width: 0,
      height: 0,
      screenWidth,
      screenHeight,
    };
  }
}

/**
 * 간단한 이미지 URI만 반환하는 버전
 * @param {string} imageUri - 원본 이미지 URI
 * @returns {Promise<string>} - 처리된 이미지 URI
 */
export async function captureSimple(imageUri) {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    console.error('[captureSimple] Error:', error);
    return imageUri;
  }
}
