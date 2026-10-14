// utils/scanRegionGeometry.js - 스캔 영역(화면 dp)을 카메라 센서 좌표 비율로 바꾼다.
// @mgcrea/vision-camera-barcode-scanner의 computeHighlights(센서 → 화면, cover)의 역변환.
// 네이티브 보조 판독(반전 재시도·데이터 매트릭스 확대)이 화면 가운데가 아니라 영역 가운데를 보게 하려고 쓴다.
// 결과 [x, y, w, h]는 0~1 비율:
//   Android: 센서 이미지 픽셀 기준(왼쪽 위 원점, 회전 전)
//   iOS: Vision 정규화 좌표(픽셀 버퍼 기준, 왼쪽 아래 원점) — 라이브러리가 Vision 좌표에 프레임 크기를 곱해 쓰는 것과 같은 축

// 화면 점 v → 확대·이동 전 "adjusted layout" 점 q (applyTransformation의 역)
function inverseOrient(v, target, orientation, isIOS) {
  'worklet';
  if (isIOS) return { x: v.y, y: v.x };
  switch (orientation) {
    case 'landscape-right': // 정: { x: H - q.y, y: q.x }
      return { x: v.y, y: target.height - v.x };
    case 'landscape-left': // 정: { x: q.y, y: W - q.x }
      return { x: target.width - v.y, y: v.x };
    case 'portrait-upside-down':
      return { x: target.width - v.x, y: target.height - v.y };
    case 'portrait':
    default:
      return { x: v.x, y: v.y };
  }
}

/**
 * @param region { x, y, width, height } 화면 dp (카메라 뷰 기준)
 * @param layout { width, height } 카메라 뷰 크기 dp
 * @param frame { width, height, orientation } 프레임
 * @returns [x, y, w, h] 0~1, 또는 null
 */
export function viewRegionToSensor(region, layout, frame, isIOS) {
  'worklet';
  if (!region || !layout || !layout.width || !layout.height || !frame || !frame.width || !frame.height) return null;
  // computeHighlights는 layout의 가로·세로를 바꿔(adjusted) 쓴다
  const target = { width: layout.height, height: layout.width };
  const rw = target.width / frame.width;
  const rh = target.height / frame.height;
  const s = Math.max(rw, rh); // cover
  let offX = 0;
  let offY = 0;
  if (rw > rh) offY = (target.height - frame.height * s) / 2;
  else offX = (target.width - frame.width * s) / 2;

  const corners = [
    { x: region.x, y: region.y },
    { x: region.x + region.width, y: region.y },
    { x: region.x, y: region.y + region.height },
    { x: region.x + region.width, y: region.y + region.height },
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const q = inverseOrient(corners[i], target, frame.orientation, isIOS);
    const px = (q.x - offX) / s;
    const py = (q.y - offY) / s;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  const clamp = (n) => Math.min(1, Math.max(0, n));
  const x0 = clamp(minX / frame.width);
  const y0 = clamp(minY / frame.height);
  const x1 = clamp(maxX / frame.width);
  const y1 = clamp(maxY / frame.height);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return [x0, y0, x1 - x0, y1 - y0];
}
