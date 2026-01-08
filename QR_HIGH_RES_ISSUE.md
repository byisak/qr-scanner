# React Native QR코드 + 프레임 고해상도 저장 문제

## 현재 구조
- **QRFrameRenderer 컴포넌트**: SVG 프레임(SvgXml) + QR코드(StyledQRCode)를 합성
- **StyledQRCode**: SVG 기반 QR코드 컴포넌트
- **react-native-view-shot**의 `captureRef`로 이미지 캡처

## 목표
저장 품질 설정에 따라 다른 해상도로 저장:
- 빠름: 340px
- 보통: 600px
- 고급: 900px
- 최고: 1200px
- 인쇄: 1800px

---

## 시도한 방법들과 실패 원인

### 1. pixelRatio 옵션 사용
```javascript
captureRef(qrRef, { pixelRatio: 6 })
```
**결과**: iOS에서 pixelRatio가 적용되지 않음. 캔버스 크기만 커지고 QR코드 해상도는 그대로

---

### 2. width 옵션 사용
```javascript
captureRef(qrRef, { width: 1800 })
```
**결과**: 캔버스만 커지고 내부 QR코드 콘텐츠는 확대되지 않음

---

### 3. useRenderInContext 옵션
```javascript
captureRef(qrRef, { pixelRatio: 6, useRenderInContext: true })
```
**결과**: 동일하게 작동하지 않음

---

### 4. 동적 크기 변경 방식
```javascript
setQrCaptureSize(1800); // 컴포넌트 크기 변경
await new Promise(r => setTimeout(r, 300)); // 대기
captureRef(qrRef);
setQrCaptureSize(340); // 원복
```
**결과**: QR코드가 렌더링되기 전에 캡처되어 프레임만 저장되고 QR코드가 누락됨

---

### 5. onLayout 콜백 + Promise
```javascript
const layoutPromise = new Promise(resolve => {
  qrLayoutResolveRef.current = resolve;
});
setQrCaptureSize(1800);
await layoutPromise; // onLayout 대기
await new Promise(r => setTimeout(r, 100));
captureRef(qrRef);
```
**결과**: onLayout은 View의 레이아웃만 감지, 내부 SVG 렌더링 완료는 감지 못함. 여전히 QR코드 누락

---

### 6. 다단계 렌더링 대기
```javascript
setQrCaptureSize(1800);
await layoutPromise; // onLayout
await InteractionManager.runAfterInteractions();
await requestAnimationFrame();
await requestAnimationFrame();
await new Promise(r => setTimeout(r, 500));
captureRef(qrRef);
```
**결과**: 500ms 대기해도 여전히 QR코드가 렌더링되지 않고 프레임만 캡처됨

---

## 핵심 문제
1. React Native에서 SVG 기반 컴포넌트(SvgXml, StyledQRCode)의 렌더링 완료 시점을 정확히 감지할 방법이 없음
2. 동적으로 크기를 변경하면 SVG가 새로 렌더링되는데, 이 완료 시점을 알 수 없음
3. iOS에서 captureRef의 pixelRatio가 SVG 콘텐츠에 제대로 적용되지 않음

---

## 환경
- React Native (Expo)
- react-native-svg (SvgXml)
- react-native-view-shot (captureRef)
- iOS

---

## 컴포넌트 구조

### QRFrameRenderer.js
```javascript
export default function QRFrameRenderer({
  frame,
  qrValue,
  qrStyle,
  size = 280,
  onCapture,
  onLayout,
}) {
  const frameSvg = FRAME_SVG_DATA[frame.id];
  const qrPosition = FRAME_QR_POSITIONS[frame.id];

  const scale = size / 700;
  const qrAreaWidth = qrPosition.width * scale;
  const qrAreaHeight = qrPosition.height * scale;
  const qrSize = Math.floor(Math.min(qrAreaWidth, qrAreaHeight) * 0.92);
  const qrX = Math.floor(qrPosition.x * scale + (qrAreaWidth - qrSize) / 2);
  const qrY = Math.floor(qrPosition.y * scale + (qrAreaHeight - qrSize) / 2);

  return (
    <View style={[styles.container, { width: size, height: size }]} onLayout={onLayout}>
      {/* 프레임 SVG */}
      <SvgXml
        xml={frameSvg}
        width={size}
        height={size}
        style={styles.frameSvg}
      />
      {/* QR 코드 (프레임 위에 배치) */}
      <View
        style={[
          styles.qrOverlay,
          { left: qrX, top: qrY, width: qrSize, height: qrSize },
        ]}
      >
        <StyledQRCode
          value={qrValue}
          size={qrSize}
          qrStyle={qrStyle}
          onCapture={onCapture}
        />
      </View>
    </View>
  );
}
```

---

## 질문
프레임(SVG) + QR코드(SVG)를 고해상도(예: 1800px)로 저장할 수 있는 방법이 있을까요?

가능한 해결책:
1. SVG를 직접 고해상도 PNG로 변환하는 방법?
2. 숨겨진 오프스크린 뷰를 사용하는 방법?
3. SVG 렌더링 완료를 감지하는 다른 방법?
4. 다른 캡처 라이브러리 사용?
