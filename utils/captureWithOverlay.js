// utils/captureWithOverlay.js
// Skia를 사용하여 사진 위에 바코드 오버레이를 합성하는 유틸리티

import { Skia, ImageFormat } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { LABEL_COLORS } from '../constants/Colors';

/**
 * 이미지 위에 바코드 오버레이를 합성하여 새 이미지 생성
 * @param {string} imageUri - 원본 이미지 URI
 * @param {Array} barcodes - 바코드 데이터 배열 [{bounds, value, colorIndex, screenSize}]
 * @param {number} screenWidth - 화면 너비
 * @param {number} screenHeight - 화면 높이
 * @returns {Promise<string>} - 합성된 이미지 파일 경로
 */
export async function captureWithOverlay(imageUri, barcodes, screenWidth, screenHeight) {
  try {
    console.log('[captureWithOverlay] Starting...');
    const startTime = Date.now();

    // 이미지 로드
    const imageData = await Skia.Data.fromURI(imageUri);
    const image = Skia.Image.MakeImageFromEncoded(imageData);

    if (!image) {
      console.error('[captureWithOverlay] Failed to load image');
      return imageUri;
    }

    const imgWidth = image.width();
    const imgHeight = image.height();
    console.log(`[captureWithOverlay] Image loaded: ${imgWidth}x${imgHeight} (${Date.now() - startTime}ms)`);

    // 오프스크린 캔버스 생성
    const surface = Skia.Surface.Make(imgWidth, imgHeight);
    if (!surface) {
      console.error('[captureWithOverlay] Failed to create surface');
      return imageUri;
    }

    const canvas = surface.getCanvas();

    // 배경 이미지 그리기
    canvas.drawImage(image, 0, 0);

    // 좌표 스케일 계산 (화면 좌표 -> 이미지 좌표)
    const scaleX = imgWidth / screenWidth;
    const scaleY = imgHeight / screenHeight;

    // 바코드 오버레이 그리기
    for (let i = 0; i < barcodes.length; i++) {
      const barcode = barcodes[i];
      if (!barcode.bounds) continue;

      const colorIndex = barcode.colorIndex !== undefined ? barcode.colorIndex : i;
      const color = LABEL_COLORS[colorIndex % LABEL_COLORS.length];

      // 좌표 변환
      const x = barcode.bounds.x * scaleX;
      const y = barcode.bounds.y * scaleY;
      const width = barcode.bounds.width * scaleX;
      const height = barcode.bounds.height * scaleY;

      // 바운더리 박스 (채우기)
      const fillPaint = Skia.Paint();
      fillPaint.setColor(Skia.Color(hexToRgba(color, 0.25)));
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(x, y, width, height), 12 * scaleX, 12 * scaleY),
        fillPaint
      );

      // 바운더리 박스 (테두리)
      const strokePaint = Skia.Paint();
      strokePaint.setColor(Skia.Color(color));
      strokePaint.setStyle(1); // Stroke
      strokePaint.setStrokeWidth(Math.max(6, width / 40));
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(x, y, width, height), 12 * scaleX, 12 * scaleY),
        strokePaint
      );

      // 라벨 배경 (색상 인디케이터)
      if (barcode.value) {
        const labelHeight = Math.max(40, height / 6);
        const labelY = y + height + 12 * scaleY;

        const labelBgPaint = Skia.Paint();
        labelBgPaint.setColor(Skia.Color(color));
        canvas.drawRRect(
          Skia.RRectXY(Skia.XYWHRect(x, labelY, width, labelHeight), 8 * scaleX, 8 * scaleY),
          labelBgPaint
        );
      }
    }

    console.log(`[captureWithOverlay] Drawing done (${Date.now() - startTime}ms)`);

    // 이미지로 변환 - encodeToBase64 직접 사용 (훨씬 빠름)
    const snapshot = surface.makeImageSnapshot();
    if (!snapshot) {
      console.error('[captureWithOverlay] Failed to create snapshot');
      return imageUri;
    }

    // JPEG 80% 품질로 Base64 인코딩 (빠르고 작은 파일)
    const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 80);
    if (!base64) {
      console.error('[captureWithOverlay] Failed to encode image');
      return imageUri;
    }

    console.log(`[captureWithOverlay] Encoded (${Date.now() - startTime}ms)`);

    // 파일로 저장
    const fileName = `composite_${Date.now()}.jpg`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: 'base64',
    });

    console.log(`[captureWithOverlay] Complete! (${Date.now() - startTime}ms) -> ${filePath}`);
    return filePath;

  } catch (error) {
    console.error('[captureWithOverlay] Error:', error);
    return imageUri;
  }
}

// hex 색상을 rgba 문자열로 변환
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
