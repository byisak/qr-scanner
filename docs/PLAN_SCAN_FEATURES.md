# 스캔 기능 4종 구현 계획

작성일: 2026-10-01
대상: 라벨 내용 자동 분리 · 스캔 영역 제한 · 볼륨 키로 스캔 확정 · 스캔 후 자동 동작 규칙

## 결정 사항 (2026-10-01 사용자 답변)

1. 라벨 필드 의미는 라벨마다 다르다 → **패턴(구분자+칸 수)별 "카테고리"를 자동으로 만들고**, 새 패턴이 처음 보이면 카테고리를 만들지 묻는다. 필드 이름은 카테고리마다 `필드1..n`에서 바꿀 수 있다.
2. 선반 QR 형식은 미정 → 위치 규칙 기본값은 넣지 않는다 (규칙 화면에서 사용자가 만든다).
3. 볼륨 키는 **키 매핑**으로: 볼륨 위/아래 각각에 동작을 지정. 네이티브에서 키를 가로채므로 볼륨은 바뀌지 않는다.
4. 새 기능은 모두 무료.
5. 위치 지정은 그룹 변경·스캐너 이탈 시 자동 해제.

## 0. 전제와 순서

- 네 기능은 모두 `screens/ScannerScreen.js`의 `handleBarCodeScanned`(약 1723행)와 `saveHistory`(841행)를 지나간다.
  이 함수는 3,600줄 파일 안의 700줄짜리 콜백이라, 기능마다 분기를 더 끼워 넣으면 손대기 어려워진다.
  → 1단계 시작 전에 **스캔 파이프라인을 작은 단계로 쪼개는 리팩터링**을 먼저 한다 (0단계).
- 순서: **0 파이프라인 정리 → 1 라벨 분리 → 2 스캔 영역 → 3 볼륨 키 → 4 자동 규칙**.
  규칙(4)이 라벨 필드(1)와 확정 방식(3)을 조건·동작으로 쓰기 때문이다.
- 단계마다: 컴파일 + `npm run check:i18n` → Mac 로컬 빌드(`eas build --local`, 약 30분) → 에뮬레이터로 설정 화면·오류 확인 → Tailscale로 APK 전달 → 실기기 확인.
  에뮬레이터 카메라로는 QR을 비출 수 없어서 인식 자체는 실기기에서만 확인된다.
- 데이터 저장은 지금처럼 AsyncStorage(`scanHistoryByGroup`, `scanGroups`)를 그대로 쓴다. 새 설정 키는 아래 표.

| 키 | 값 | 단계 |
|---|---|---|
| `labelCategories` | `LabelCategory[]` JSON | 1 |
| `labelIgnoredPatterns` | `string[]` ("묻지 않기"한 패턴 서명) | 1 |
| `labelAutoSplit` | `'true' \| 'false'` (기본 true) | 1 |
| `scanRegionMode` | `'full' \| 'center' \| 'band'` (기본 full) | 2 |
| `scanConfirmMode` | `'auto' \| 'manual'` (기본 auto) | 3 |
| `hardwareKeyMap` | `{ volumeUp: Action, volumeDown: Action }` (기본 둘 다 'none') | 3 |
| `scanRules` | `ScanRule[]` JSON | 4 |
| `scanRulesEnabled` | `'true' \| 'false'` (기본 true) | 4 |

iCloud 동기화 허용 키 목록(`services/iCloudService.js`의 `SYNC_ALLOWED_PREFIXES`)에도 `labelCategories`, `labelIgnoredPatterns`, `scanRules`, `scanRegionMode`, `scanConfirmMode`, `hardwareKeyMap`을 추가한다.

---

## 0단계. 스캔 파이프라인 정리 (리팩터링, 0.5일)

**목표**: 기능 추가 없이 `handleBarCodeScanned`를 "판정 → 결정 → 실행" 세 단계로 나눈다. 동작은 바뀌지 않는다.

```
handleBarCodeScanned(scanResult)
  ├─ 1. gate      : isActive/canScan/처리 중/계속 비추는 중(stillInView) → 무시
  ├─ 2. classify  : 복권 QR, 복권 그룹 모달, 타입 정규화, 디바운스        (기존 1798~1912행)
  ├─ 3. decide    : ★ 여기에 4단계 규칙 엔진이 들어간다
  │                 입력: { code, type, fields(1단계), groupId, mode }
  │                 출력: { skip, targetGroupId, actions[] }  (지금은 기본값만 반환)
  └─ 4. execute   : 모드별 저장 (토스트 / 팝업 / 배치 / 여러 코드 / 자동열기 OFF)  (기존 1914~2380행)
```

**작업**
- `screens/ScannerScreen.js`
  - `decideScanAction(input)` 훅 함수를 추가하고 기본값(`{ skip:false, targetGroupId:null, actions:[] }`)만 돌려준다.
  - 모드별 저장 분기 4곳(토스트 1930행대, 팝업·배치 2043행대, 여러 코드 2209행대, 자동열기 OFF 2245행대)이 `saveHistory`를 부르기 직전에 `decision.targetGroupId`를 `targetGroupId` 인자로 넘기게 한다. 지금은 null이라 동작이 같다.
  - `saveHistory(code, url, photoUri, barcodeType, ecLevel, targetGroupId)` 시그니처는 유지하되, 7번째 인자로 `extra`(객체, 1단계에서 `fields`·4단계에서 `location`을 넣음)를 받게 한다.
- 검증: 기존 동작 그대로인지 실기기에서 일반·연속·배치·여러 코드 모드 각 1회 스캔.

---

## 1단계. 라벨 내용 자동 분리 (1일)

### 1-1. 데이터 모델

```js
// 라벨 카테고리: 같은 패턴(구분자 + 칸 수)의 코드를 묶는다. 패턴이 처음 보이면 자동 생성(사용자 확인 후)
LabelCategory = {
  id: 'cat_1696…',
  signature: '|:4',          // 구분자 + ':' + 칸 수. 패턴 매칭 키
  delimiter: '|',
  fieldCount: 4,
  name: '라벨 A',            // 기본 "라벨 A, B, C…" 순서로 자동 이름. 사용자가 바꿀 수 있음
  fields: ['필드1','필드2','필드3','필드4'],  // 사용자가 이름을 바꿀 수 있음
  keyField: 0,               // 대표 필드 (목록·카드 한 줄 표시)
  sample: '180100048|91163||0014',  // 처음 만든 코드 (설정 화면 미리보기용)
  createdAt, count: 0,       // count: 이 카테고리로 저장된 횟수
}

// 기록 항목에 추가되는 필드 (saveHistory extra)
{ ...record, categoryId: 'cat_1696…', values: ['180100048','91163','','0014'] }
// 필드 이름은 저장하지 않고 카테고리에서 가져온다 → 나중에 이름을 바꿔도 모든 기록에 반영된다
```

**패턴 감지와 카테고리 생성 흐름**
1. 스캔 값에서 구분자(`|` `;` `\t` `,` 순으로 2칸 이상 나뉘는 것)를 찾는다 → 서명 `구분자:칸수`.
2. 서명이 기존 카테고리와 같으면 그 카테고리로 저장(`categoryId`, `values`).
3. 처음 보는 서명이면 **스캔 직후 모달**: "새 라벨 형식을 찾았어요 · `|`로 나뉜 4칸 · 180100048 | 91163 | (빈칸) | 0014 → [카테고리 만들기] [이번만 건너뛰기] [이 형식은 묻지 않기]".
   - 만들기: 이름 입력(기본 "라벨 A") → 생성 후 이 스캔부터 적용. 필드 이름은 나중에 설정에서.
   - 건너뛰기: 이번 스캔은 분리 없이 저장.
   - 묻지 않기: `labelIgnoredPatterns`에 서명 추가 → 이후 같은 패턴은 분리 없이 저장(설정에서 되돌릴 수 있음).
   - 연속·배치 모드에서는 스캔을 막지 않도록 모달 대신 스낵바 "새 라벨 형식 발견 · 설정에서 추가"로 알리고, 설정 → 라벨 카테고리 상단에 "발견된 형식" 목록으로 쌓아 둔다.
4. 기존 기록(`categoryId` 없음)은 화면에 띄울 때 서명으로 카테고리를 찾아 그 자리에서 분리한다.

### 1-2. 파서 `utils/labelParser.js`

```js
detectDelimiter(code) → '|' | ';' | '\t' | ',' | null   // 2칸 이상으로 나뉘는 첫 구분자 (URL·WiFi·vCard 등 특수 QR은 null)
signatureOf(code) → '|:4' | null
splitLabel(code, delimiter) → string[]                  // 앞뒤 공백 제거, 빈 칸 유지
resolveCategory(code, categories) → { category, values } | null
parseLabel(code, categories) → { categoryId, values, fields: {이름: 값} } | null
formatLabelSummary(parsed, category, max = 3) → '필드1 180100048 · 필드2 91163'
nextCategoryName(categories) → '라벨 A' … '라벨 Z', '라벨 AA'
```

- 한 칸 값 안에 구분자가 들어가는 경우(따옴표)는 1차 미지원.
- 같은 구분자라도 칸 수가 다르면 다른 카테고리다 (`|:4`와 `|:5`).

### 1-3. 화면

| 위치 | 변경 | 파일 |
|---|---|---|
| 설정 → 스캔 → **라벨 카테고리** | 새 화면. 상단 "발견된 형식"(연속 모드에서 쌓인 것, 만들기/묻지 않기), 카테고리 목록(이름·서명·저장 횟수·대표 필드), 삭제(기록은 남고 분리만 안 됨). 편집 화면: 이름, 필드 이름 목록(각 줄 바로 편집), 대표 필드 선택, 샘플 값으로 미리보기 표. 하단 "묻지 않기한 형식" 목록(되돌리기). "자동 분리" 토글(`labelAutoSplit`) | `screens/LabelCategoriesScreen.js`, `screens/LabelCategoryEditScreen.js`, `app/label-categories.tsx`, `app/label-category-edit.tsx`, `SettingsScreen` 스캔 섹션에 행 추가 |
| 스캐너 하단 결과 카드 (자동열기 OFF) | 값 아래 한 줄: `formatLabelSummary` (최대 3필드). 길면 가운데 말줄임 | `ScannerScreen` 결과 카드 |
| 스캔 토스트 (연속 모드) | 값 대신 대표 필드 + 두 번째 필드 ("180100048 · 수량 91163") | `components/ScanToast.js` |
| 결과 화면 | 값 카드 아래 "라벨 내용" 카드: 필드명 / 값 표, 줄마다 복사 버튼, 카테고리 이름 배지(탭하면 편집 화면). 카테고리가 없는데 패턴이 있으면 "이 형식으로 카테고리 만들기" 버튼 | `screens/ResultScreen.js` |
| 기록 목록 | 코드 값 아래 보조 줄에 요약 한 줄(`textSecondary`, 1줄 말줄임) | `screens/HistoryScreen.js` |
| 여러 코드 결과 | 각 행에 요약 한 줄 | `screens/MultiCodeResultsScreen.js` |
| 내보내기 | CSV: 기존 4열 + "라벨 카테고리" 열 + 필드 열. 선택 그룹에 등장하는 카테고리의 필드 이름을 합쳐 헤더로(같은 이름은 한 열로). 카테고리 없는 항목은 빈칸. TXT는 "코드값 (필드1=…, 필드2=…)" | `screens/ExportHistoryScreen.js` |

### 1-4. 저장 연결
- `ScannerScreen`: 스캔 직후 `resolveCategory(data, categoriesRef.current)` → 있으면 `saveHistory(..., { categoryId, values })`, 없고 패턴이 있으면 새 패턴 흐름(모달 또는 스낵바). 카테고리는 화면 포커스 시 AsyncStorage에서 읽어 ref로 보관.
- `ImageAnalysisScreen`(갤러리 이미지 분석)과 `MultiCodeResultsScreen` 저장 경로에도 같은 호출 추가.
- 기록 수정(결과 화면에서 값 편집) 시 `fields`를 다시 계산.

### 1-5. 번역 키 (ko/en/ja/zh/es)
`labelCategories.*` 약 25개: title, discovered, newPatternTitle, newPatternMessage(`{{delimiter}}로 나뉜 {{count}}칸`), create, skipOnce, neverAsk, defaultName(`라벨 {{letter}}`), fields, keyField, preview, sample, savedCount, ignoredPatterns, restore, deleteConfirm, autoSplit, autoSplitDesc, fieldN(`필드{{n}}`), noCategories, discoveredSnackbar, `result.labelFields`, `result.createCategory`, `settings.labelCategories`, `exportHistory.categoryColumn`.

### 1-6. 검증
- 단위: `scripts/test-label-parser.js`로 입력 10개(기본 형식, 빈 칸, 구분자 없음, URL, WIFI, 탭, 공백, 칸 수 다른 같은 구분자) 결과 확인.
- 실기기: 박스 QR 첫 스캔 → 새 형식 모달 → 만들기 → 카드 요약 / 결과 화면 표 / 기록 보조 줄 / CSV 열. 설정에서 필드 이름을 바꾸면 기존 기록에도 반영되는지. 같은 패턴 두 번째 스캔은 묻지 않는지.

---

## 2단계. 스캔 영역 제한 (0.5일)

### 2-1. 동작
- 설정 → 스캔 → **스캔 영역**: 전체 / 가운데 사각형(화면 너비 70%, 정사각) / 가로 띠(너비 85% × 높이 22%, 1D 바코드용).
- 스캐너 화면: 영역 테두리(둥근 모서리, 흰 선)와 바깥 반투명 어둡게(`rgba(0,0,0,0.35)`), 중앙 십자는 유지.
- 영역 **안**에 바코드 중심이 들어온 것만 인식·하이라이트·저장. 밖은 테두리도 안 그린다.
- 여러 코드 모드에서도 적용(영역 안의 코드만 누적). 꺼져 있으면(전체) 지금과 동일.

### 2-2. 구현 포인트
- 좌표: 바코드 좌표는 센서 기준, 화면은 프리뷰가 잘린(cover) 상태. 라이브러리의 `computeHighlights(barcodes, frame, layout, 'cover')`(`@mgcrea/.../utils/highlights`)가 센서→화면 좌표 변환을 이미 하고 있고, 오늘 고친 Android 좌표(센서 원본 반환)와 맞는다. **이 함수를 워크릿 안에서 호출해 화면 좌표를 얻은 뒤 영역 판정**한다.
- `components/NativeQRScanner/index.js`
  - 새 prop `scanRegion` = `{ x, y, width, height }` (화면 좌표, dp) 또는 null.
  - 워크릿(`onBarcodeScanned`)에서 `const hl = computeHighlights(barcodes, frame, layoutRef.value, 'cover')`로 각 코드의 화면 사각형을 구하고, 중심이 `scanRegion` 안인 것만 남긴 뒤 기존 단일/다중 분기로 넘긴다. `scanRegion`은 `useSharedValue`로 워크릿에 전달.
  - `layoutRef`는 `useBarcodeScanner`가 내부에서 들고 있어 접근이 안 되므로, `onLayout`을 한 번 더 감싸 우리 쪽 `useSharedValue`에도 저장한다(cameraProps.onLayout 체이닝).
  - `CustomHighlights`에도 같은 영역 필터를 넣어 밖의 테두리를 숨긴다.
- `screens/ScannerScreen.js`
  - `scanRegionMode` 로드 → 화면 크기(`winWidth/winHeight`)와 카메라 뷰 위치로 사각형 계산(`topOffset`·탭바 겹침 고려, 중앙 십자 기준 중앙 정렬).
  - 오버레이 컴포넌트 `components/ScanRegionOverlay.js`(마스크 4조각 + 테두리). `pointerEvents="none"`.
- 설정: `SettingsScreen` 스캔 섹션에 행 + 선택 화면 `screens/ScanRegionSelectionScreen.js`(3개 라디오, 미니 미리보기 그림).

### 2-3. 주의
- 좌표 변환이 어긋나면 "보이는 영역 안인데 인식 안 됨"이 생긴다. 1차 빌드에서는 개발자 옵션에 "영역 디버그" 토글을 넣어 판정된 화면 사각형을 빨간 테두리로 그려 실기기에서 맞는지 확인한다. 확인 후 토글은 남겨 둬도 된다(개발자 옵션 안).
- iOS는 라이브러리의 `regionOfInterest`(센서 비율 좌표)도 쓸 수 있지만, 플랫폼 간 동작을 같게 하려고 JS 필터만 쓴다.

### 2-4. 번역 키
`scanRegion.title/full/center/band/fullDesc/centerDesc/bandDesc`, `settings.scanRegion`, `developer.scanRegionDebug`.

---

## 3단계. 하드웨어 키 매핑 + 수동 스캔 확정 (1일, 네이티브 모듈)

### 3-1. 동작
- 설정 → 스캔 → **하드웨어 키**: 볼륨 위 / 볼륨 아래 각각에 동작 지정.
  - 동작: 없음(기본, 볼륨 조절) / 스캔 확정 / 플래시 켜기·끄기 / 결과 보기(마지막 스캔 결과 화면) / 그룹 선택 열기 / 여러 코드 결과 보기
  - "스캔 확정"을 어느 키에든 지정하면 `scanConfirmMode`가 자동으로 `manual`이 되고, 둘 다 해제하면 `auto`로 돌아간다. 설정 화면에 "스캔 확정 방식: 수동(볼륨 위)"으로 상태를 보여준다.
- 수동 확정 모드(`manual`):
  - 코드가 영역(2단계) 안에 들어오면 테두리만 그리고 저장하지 않는다. 하단 안내 바 "볼륨 위를 눌러 확정 · 180100048"(대표 필드) + 화면 **확정 버튼**.
  - 지정한 키를 누르면 그 순간 테두리가 있는 코드(여러 개면 중앙에 가장 가까운 것)를 저장하고 기존 피드백 그대로. 코드가 없을 때 누르면 짧은 경고 진동.
  - 여러 코드 모드에서는 영역 안의 코드를 모두 한 번에 추가.
  - 코드가 1.2초 이상 안 보이면 안내 바를 내린다(`lastSeenAtRef` 재사용).
- Pro 목록의 `manualScanConfirm`(구현 없음)은 이 기능으로 연결. 무료.

### 3-2. 네이티브: 키 가로채기 (볼륨이 바뀌지 않는 방식)
- `react-native-volume-manager`는 볼륨 변화를 듣는 방식이라 볼륨이 순간 바뀐다 → 쓰지 않는다.
- 대신 **로컬 Expo 모듈** `modules/hardware-keys`(`expo-modules-core`)를 만든다.
  - `setCapturedKeys(keys: string[])`: 가로챌 키 목록(`'volumeUp'`, `'volumeDown'`). 빈 배열이면 가로채지 않음.
  - 이벤트 `onHardwareKey({ key: 'volumeUp' | 'volumeDown' })` (keyDown 1회, 길게 누름 반복 무시).
  - Android: 모듈이 정적 플래그를 들고, `MainActivity.onKeyDown/onKeyUp`에서 `HardwareKeysModule.handleKeyEvent(keyCode, action)`를 호출해 `true`(소비)면 시스템 볼륨 처리를 막는다. `MainActivity`는 prebuild로 생성되므로 **config plugin**(`plugins/withHardwareKeys.js`, `withMainActivity`)으로 override 코드를 끼워 넣는다.
  - iOS: 볼륨 키를 앱이 가로채는 공식 방법이 없어 모듈은 no-op. iOS에서는 화면 확정 버튼만 쓰고 설정 화면에 "iOS는 화면 버튼으로 확정"을 안내한다.
- JS: `hooks/useHardwareKeys.js` — 스캐너 화면 포커스 중이고 매핑이 하나라도 있을 때만 `setCapturedKeys` 호출, 벗어나면 `[]`. 이벤트 → 매핑된 동작 실행(확정/플래시/결과/그룹/여러 코드).
- 동작 핸들러는 `ScannerScreen`에 이미 있는 함수들을 그대로 쓴다(`toggleTorch`, `handleOpenResultWindow`, `setGroupModalVisible`, `handleViewMultiResults`). 확정은 3-1의 `commitPendingScan()`.

### 3-3. 번역 키
`hardwareKeys.title/volumeUp/volumeDown/actions.none/confirm/torch/result/group/multiResults/iosNote`, `scanConfirm.manualStatus(`수동 ({{key}})`)/pressToConfirm(`{{key}}을(를) 눌러 확정`)/confirmButton/nothingToConfirm`, `settings.hardwareKeys`.

### 3-4. 검증
- 실기기: 볼륨 위 → 확정 지정 → 코드 비추기(저장 안 됨) → 볼륨 위 → 저장. **볼륨 숫자가 바뀌지 않는지.** 볼륨 아래 → 플래시 지정 → 켜짐/꺼짐. 다른 화면(설정)에서는 볼륨이 정상 조절되는지. 화면 확정 버튼.
- 에뮬레이터: `adb shell input keyevent KEYCODE_VOLUME_UP`으로 키 이벤트가 JS까지 오는지 로그로 확인(카메라 없이도 가능).

## 4단계. 스캔 후 자동 동작 규칙 (1.5일)

### 4-1. 데이터 모델

```js
ScanRule = {
  id, name, enabled: true, order: 0,
  stopAfterMatch: true,                         // 걸리면 아래 규칙은 건너뜀
  conditions: [                                 // 모두 만족(AND)
    { type: 'startsWith' | 'contains' | 'endsWith' | 'regex'
          | 'barcodeType'      // value: 'qr' | 'ean13' | ...
          | 'category'         // value: categoryId (1단계 라벨 카테고리)
          | 'field',           // categoryId + fieldIndex, op: 'eq'|'ne'|'gt'|'lt'|'contains'|'empty'|'notEmpty', value
      value, field?, op? }
  ],
  actions: [                                    // 순서대로 실행
    { type: 'saveToGroup', groupId }            // 저장 그룹 지정 (없으면 현재 그룹)
    { type: 'skip' }                            // 저장하지 않음 (피드백은 '건너뜀' 토스트)
    { type: 'copy' }                            // 클립보드
    { type: 'openUrl', url, mode: 'open'|'send' } // {code} {field:품목코드} 치환, send는 백그라운드 GET
    { type: 'setLocation' }                     // 이 코드를 '현재 위치'로 지정 (이후 스캔에 location 부여)
    { type: 'feedback', haptic: 'success'|'warning'|'error', sound: true|false }
  ],
}
```

- 평가는 `utils/scanRules.js`의 순수 함수: `evaluateRules(rules, input) → { matched: ScanRule|null, decision: { skip, targetGroupId, actions } }`. `input = { code, type, values, categoryId, groupId, mode }`.
- 정규식은 `new RegExp(value)` 실패 시 조건을 불일치로 보고 설정 화면에서 저장 전에 검증한다.
- `setLocation`: `currentLocationRef = { code, values, at }`를 두고, 이후 `saveHistory` extra에 `location: code`를 넣는다. **그룹을 바꾸거나 스캐너 탭을 벗어나면 자동 해제**(결정 5). 상단 배지를 탭해 수동 해제도 가능. 기록 목록·결과 화면·CSV에 "위치" 표시/열 추가(1단계 CSV 확장과 같은 방식). 이것이 "위치-품목 연결"의 간단판.

### 4-2. 파이프라인 연결
- 0단계에서 만든 `decideScanAction`이 여기서 실체를 갖는다: `labelParser` 결과를 넣어 `evaluateRules` 호출.
- 적용 위치: 중복 판정·복권 처리 **뒤**, 모드별 저장 **앞**. 모든 모드(일반·연속·배치·여러 코드·자동열기 OFF)에 동일 적용. 3단계 확정 모드에서는 "확정된 순간"에 적용.
- `skip`이면 `scanner.ruleSkipped` 토스트(연속 모드) 또는 카드 제목으로 표시하고 저장 안 함. 중복 처리보다 우선(건너뛸 코드는 중복 검사도 안 함).
- 규칙은 화면 포커스 시 로드해 ref로 보관(`scanRulesRef`).

### 4-3. 화면
| 화면 | 내용 | 파일 |
|---|---|---|
| 설정 → **자동 규칙** (고급 스캔 기능 섹션) | 목록: 이름, 조건 요약("O-로 시작"), 동작 요약 아이콘(그룹/건너뜀/복사/URL/위치), 켜기 스위치, 드래그 정렬, 스와이프 삭제(실행 취소). 상단에 "전체 켜기" 스위치. 하단 "값으로 시험하기" 입력창 → 어느 규칙에 걸리고 어떤 동작이 나오는지 즉시 표시. 기본 규칙은 넣지 않는다(결정 2). 빈 상태 화면에 예시 2개를 글로 안내("O-로 시작하면 위치로 지정", "180으로 시작하면 입고 그룹") | `screens/ScanRulesScreen.js`, `app/scan-rules.tsx` |
| 규칙 편집 | 이름 / 조건 목록(종류 칩 + 값 입력, 필드 조건은 카테고리 선택 → 필드 선택 → 연산자) / 동작 목록(종류 칩 + 그룹 선택·URL 입력) / "걸리면 아래 규칙 중단" 토글 / 미리보기 입력 | `screens/ScanRuleEditScreen.js`, `app/scan-rule-edit.tsx` |
| 스캐너 | 위치가 지정돼 있으면 상단 배지 스택에 "📍 O-02-A1" 배지(탭하면 해제). 규칙으로 그룹이 바뀌어 저장되면 토스트에 "→ 입고 그룹" 표시 | `ScannerScreen` 상태 배지 스택 |
| 결과·기록·CSV | `location` 표시/열 | `ResultScreen`, `HistoryScreen`, `ExportHistoryScreen` |

### 4-4. 번역 키
`scanRules.*` 약 40개(조건·동작 이름, 연산자, 안내문, 시험하기, 위치 배지 등).

### 4-5. 검증
- 단위: `scripts/test-scan-rules.js`로 규칙 10개 × 입력 10개 표 확인(startsWith/regex/field gt/skip/stopAfterMatch 순서).
- 실기기: "O-로 시작 → 위치 지정" + "180으로 시작 → 입고 그룹" 두 규칙으로 선반 1개 + 박스 3개 스캔 → 기록에 그룹·위치가 맞게 들어가는지, CSV 위치 열.

---

## 일정·산출물

| 단계 | 작업량 | 빌드 | 사용자 확인 포인트 |
|---|---|---|---|
| 0 파이프라인 정리 | 0.5일 | 1회 | 기존 4개 모드 스캔이 그대로 되는지 |
| 1 라벨 분리 | 1일 | 1회 | 박스 QR → 요약·표·CSV 열 |
| 2 스캔 영역 | 0.5일 | (1과 묶어 1회) | 영역 밖 코드가 안 잡히는지, 디버그 사각형이 보이는 영역과 맞는지 |
| 3 키 매핑·수동 확정 | 1일 | 1회 (네이티브 모듈) | 볼륨 숫자가 안 바뀌는지, 매핑된 동작, 다른 화면에서 볼륨 정상 |
| 4 자동 규칙 | 1.5일 | 1회 | 두 규칙 시나리오 |

빌드는 Mac 로컬(`eas build --local`, 약 30분). EAS 클라우드는 11월 1일 초기화.

## 남은 확인 사항

- 선반 QR 값 형식(위치 규칙을 만들 때 필요). 지금은 규칙 화면에서 사용자가 직접 조건을 넣는다.
- 하드웨어 키 동작 목록에 더 넣을 것이 있는지(예: 사진 촬영, 그룹 다음으로 넘기기).

---

## 구현 현황 (2026-10-01)

| 단계 | 커밋 | 상태 |
|---|---|---|
| 0 파이프라인 정리 | `ec6fa48` | 완료 |
| 1 라벨 카테고리 | `cb371cf` | 완료 — 파서 테스트 `node scripts/test-label-parser.js` |
| 2 스캔 영역 제한 | `e89cc1e` | 완료 — 개발자 옵션 "스캔 영역 판정 표시"로 실기기 좌표 확인 필요 |
| 3 하드웨어 키·수동 확정 | `720f995` | 완료 — Android 전용 네이티브 모듈 `modules/hardware-keys` + `plugins/withHardwareKeys.js` |
| 4 자동 규칙 | `720f995` | 완료 — 엔진 테스트 `node scripts/test-scan-rules.js` |

실기기에서 확인할 것: 영역 밖 코드가 안 잡히는지, 볼륨 키 매핑 시 볼륨 숫자가 안 바뀌는지(다른 화면에서는 정상), 수동 확정 바, "O-로 시작 → 위치" + "180으로 시작 → 입고 그룹" 두 규칙 시나리오와 CSV 위치 열.
