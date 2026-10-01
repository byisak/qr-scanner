# 스캔 기능 4종 구현 계획

작성일: 2026-10-01
대상: 라벨 내용 자동 분리 · 스캔 영역 제한 · 볼륨 키로 스캔 확정 · 스캔 후 자동 동작 규칙

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
| `labelTemplates` | `LabelTemplate[]` JSON | 1 |
| `labelAutoSplit` | `'true' \| 'false'` (기본 true) | 1 |
| `scanRegionMode` | `'full' \| 'center' \| 'band'` (기본 full) | 2 |
| `scanConfirmMode` | `'auto' \| 'volume'` (기본 auto) | 3 |
| `scanRules` | `ScanRule[]` JSON | 4 |
| `scanRulesEnabled` | `'true' \| 'false'` (기본 true) | 4 |

iCloud 동기화 허용 키 목록(`services/iCloudService.js`의 `SYNC_ALLOWED_PREFIXES`)에도 `labelTemplates`, `scanRules`, `scanRegionMode`, `scanConfirmMode`를 추가한다.

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
// 라벨 형식 (사용자 등록)
LabelTemplate = {
  id: 'tpl_1696…',
  name: '입고 박스 라벨',
  delimiter: '|',            // '|' ';' ',' '\t' 또는 임의 1~3글자
  fields: ['품목코드', '수량', '비고', '순번'],
  keyField: 0,               // 대표로 보여줄 필드 인덱스 (목록·카드 한 줄 표시용)
  matchMode: 'count',        // 'count': 칸 수가 같으면 일치 / 'prefix': 첫 칸이 prefix로 시작
  prefix: '',                // matchMode==='prefix'일 때
  createdAt: 1696…,
}

// 기록 항목에 추가되는 필드 (saveHistory extra)
{ ...record, fields: { 품목코드: '180100048', 수량: '91163', 비고: '', 순번: '0014' }, templateId: 'tpl_1696…' }
```

- 기본 템플릿 1개를 미리 넣어 둔다: 사용자가 알려 준 박스 QR 형식(`|` 4칸). 필드 이름은 답을 받으면 확정, 그 전엔 `필드1~4`.
- 이전 기록(`fields` 없음)은 화면에 띄울 때 `parseLabel(code)`로 그 자리에서 분리한다(저장 안 함).

### 1-2. 파서 `utils/labelParser.js`

```js
splitLabel(code, delimiter) → string[]        // 구분자 분리, 앞뒤 공백 제거, 빈 칸 유지
detectDelimiter(code) → '|' | ';' | '\t' | null  // 2칸 이상으로 나뉘는 첫 구분자
matchTemplate(code, templates) → { template, values } | null
   // count: splitLabel(code, tpl.delimiter).length === tpl.fields.length
   // prefix: values[0].startsWith(tpl.prefix)
   // 여러 개 맞으면 등록 순서가 앞선 것
parseLabel(code, templates) → { templateId, delimiter, fields: {name: value}, values: [] } | null
   // 템플릿 일치 → 그 이름으로. 없으면 detectDelimiter로 '필드1..n'. 구분자 없으면 null
formatLabelSummary(parsed, maxFields = 3) → '품목코드 180100048 · 수량 91163'
```

- 규칙: URL(`http`로 시작)·vCard·WiFi 등 `parseQRContent`가 TEXT 외로 분류하는 값은 분리하지 않는다(`|`가 들어가는 WIFI 문법 오탐 방지).
- 한 칸 값에 구분자가 들어가는 경우(따옴표 감싸기)는 1차에서 지원하지 않는다. 필요해지면 CSV 규칙 추가.

### 1-3. 화면

| 위치 | 변경 | 파일 |
|---|---|---|
| 설정 → 스캔 → **라벨 형식** | 새 화면. 템플릿 목록(이름·구분자·필드 수·대표 필드), 추가/편집/삭제/순서. 편집 화면: 이름, 구분자(칩: `\|` `;` `,` 탭 + 직접 입력), 필드 이름 목록(추가·삭제·드래그 정렬), 대표 필드 선택, "최근 스캔 값으로 미리보기"(히스토리 최근 20개 중 선택 → 분리 결과 표). "자동 분리" 토글(`labelAutoSplit`) | `screens/LabelTemplatesScreen.js`, `screens/LabelTemplateEditScreen.js`, `app/label-templates.tsx`, `app/label-template-edit.tsx`, `SettingsScreen` 스캔 섹션에 행 추가 |
| 스캐너 하단 결과 카드 (자동열기 OFF) | 값 아래 한 줄: `formatLabelSummary` (최대 3필드). 길면 가운데 말줄임 | `ScannerScreen` 결과 카드 |
| 스캔 토스트 (연속 모드) | 값 대신 대표 필드 + 두 번째 필드 ("180100048 · 수량 91163") | `components/ScanToast.js` |
| 결과 화면 | 값 카드 아래 "라벨 내용" 카드: 필드명 / 값 표, 줄마다 복사 버튼, 템플릿 이름 배지. 템플릿 미일치면 "필드1…" + "라벨 형식 등록" 링크 | `screens/ResultScreen.js` |
| 기록 목록 | 코드 값 아래 보조 줄에 요약 한 줄(`textSecondary`, 1줄 말줄임) | `screens/HistoryScreen.js` |
| 여러 코드 결과 | 각 행에 요약 한 줄 | `screens/MultiCodeResultsScreen.js` |
| 내보내기 | CSV 열 추가: 기존 4열 + 템플릿 필드 열. 선택 그룹들에 등장하는 템플릿의 필드 이름을 합쳐 헤더로(중복 이름은 한 번). 템플릿 미일치 항목은 빈칸. TXT는 "코드값 (품목코드=…, 수량=…)" | `screens/ExportHistoryScreen.js` |

### 1-4. 저장 연결
- `ScannerScreen`: 스캔 직후 `parseLabel(data, templatesRef.current)` → `saveHistory(..., { fields, templateId })`. 템플릿은 화면 포커스 시 AsyncStorage에서 읽어 ref로 보관.
- `ImageAnalysisScreen`(갤러리 이미지 분석)과 `MultiCodeResultsScreen` 저장 경로에도 같은 호출 추가.
- 기록 수정(결과 화면에서 값 편집) 시 `fields`를 다시 계산.

### 1-5. 번역 키 (ko/en/ja/zh/es)
`labelTemplates.*` 약 20개: title, add, edit, name, delimiter, delimiterCustom, fields, addField, keyField, matchMode, matchByCount, matchByPrefix, prefix, preview, pickRecent, noTemplates, autoSplit, autoSplitDesc, deleteConfirm, fieldPlaceholder, summaryFallback(`필드{{n}}`), `result.labelFields`, `settings.labelTemplates`.

### 1-6. 검증
- 단위: `node`로 `labelParser` 입력 10개(기본 형식, 빈 칸, 구분자 없음, URL, WIFI, 탭, 공백) 결과 확인 스크립트를 `scripts/test-label-parser.js`로 둔다.
- 실기기: 박스 QR 스캔 → 카드 요약 / 결과 화면 표 / 기록 보조 줄 / CSV 열 확인. 템플릿 없이도 `필드1~4`로 보이는지.

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

## 3단계. 볼륨 키로 스캔 확정 (0.5일 + 네이티브 라이브러리)

### 3-1. 동작
- 설정 → 스캔 → **스캔 확정 방식**: 자동(현재) / 볼륨 키로 확정.
- 확정 모드:
  - 코드가 영역(2단계) 안에 들어오면 테두리만 그리고 저장하지 않는다. 하단에 안내 바 "볼륨 키를 눌러 확정 · 180100048"(대표 필드) + 화면 **확정 버튼**(볼륨 키 못 쓸 때).
  - 볼륨 위/아래 어느 쪽이든 누르면 **그 순간 테두리가 그려진 코드**(여러 개면 중앙에 가장 가까운 것)를 저장. 저장 후 기존 피드백(진동·소리·카드/토스트) 그대로.
  - 코드가 화면에서 사라지면 안내 바도 사라진다. 아무것도 없을 때 볼륨 키를 누르면 짧은 경고 진동만.
  - 여러 코드 모드에서는 "현재 영역 안의 코드 전부"를 한 번에 추가.
- Pro 목록의 `manualScanConfirm` 항목(지금 구현 없음)을 이 기능으로 연결: `config/lockedFeatures.js`에 잠금 항목 추가 여부는 사용자 결정(기본은 무료).

### 3-2. 구현 포인트
- 라이브러리 `react-native-volume-manager@2.2.0` 추가(네이티브 → 로컬 빌드 필요).
  - `VolumeManager.addVolumeListener(cb)`: 볼륨 변화 이벤트. 스캐너 화면 포커스 중 + 확정 모드일 때만 등록.
  - `VolumeManager.showNativeVolumeUI({ enabled: false })`로 시스템 볼륨 창 숨김, 화면 벗어날 때 복구.
  - 키 누름 자체를 가로채는 공식 API는 없다. 이벤트를 받으면 `VolumeManager.setVolume(이전값)`으로 되돌린다 → 순간적으로 볼륨이 바뀌었다 돌아온다. 음악 재생 중이면 미세하게 들릴 수 있음. **이 제약을 사용자가 수용해야 한다.**
  - 볼륨이 최대/최소일 때 한쪽 키는 이벤트가 안 온다 → 확정 모드로 들어갈 때 볼륨이 0 또는 최대면 1단계 안쪽(예: 0.05/0.95)으로 옮겨 두고 나갈 때 복구.
  - 이벤트 디바운스 150ms(한 번 누름이 두 번 들어오는 기기 대응).
- `screens/ScannerScreen.js`
  - `scanConfirmMode` 로드. 확정 모드면 `handleBarCodeScanned`의 **execute** 단계 대신 `pendingConfirmRef.current = {code, type, ec, fields}`에 보관하고 안내 바 표시. 볼륨 이벤트/확정 버튼 → `commitPendingScan()` → 기존 execute 호출.
  - 계속 비추는 동안 `pendingConfirmRef`가 최신 코드로 갱신되고, 1.2초 이상 안 보이면 비워서 안내 바를 내린다(기존 `lastSeenAtRef` 재사용).
- `useVolumeConfirm(enabled, onPress)` 훅으로 분리 (`hooks/useVolumeConfirm.js`).

### 3-3. 번역 키
`scanConfirm.title/auto/volume/autoDesc/volumeDesc/pressToConfirm/confirmButton/nothingToConfirm`, `settings.scanConfirmMode`.

### 3-4. 검증
- 실기기: 확정 모드 ON → 코드 비추기(저장 안 됨) → 볼륨 키 → 저장·피드백. 볼륨 0/최대 상태에서 시작. 음악 재생 중 소리 변화 정도. 화면 벗어났을 때 볼륨 키가 정상 동작하는지.

---

## 4단계. 스캔 후 자동 동작 규칙 (1.5일)

### 4-1. 데이터 모델

```js
ScanRule = {
  id, name, enabled: true, order: 0,
  stopAfterMatch: true,                         // 걸리면 아래 규칙은 건너뜀
  conditions: [                                 // 모두 만족(AND)
    { type: 'startsWith' | 'contains' | 'endsWith' | 'regex'
          | 'barcodeType'      // value: 'qr' | 'ean13' | ...
          | 'template'         // value: templateId (1단계)
          | 'field',           // field: '수량', op: 'eq'|'ne'|'gt'|'lt'|'contains'|'empty'|'notEmpty', value
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

- 평가는 `utils/scanRules.js`의 순수 함수: `evaluateRules(rules, input) → { matched: ScanRule|null, decision: { skip, targetGroupId, actions } }`. `input = { code, type, fields, templateId, groupId, mode }`.
- 정규식은 `new RegExp(value)` 실패 시 조건을 불일치로 보고 설정 화면에서 저장 전에 검증한다.
- `setLocation`: `currentLocationRef = { code, fields, at }`를 두고, 이후 `saveHistory` extra에 `location: code`를 넣는다. 그룹 바꾸거나 스캐너를 벗어나면 초기화. 기록 목록·결과 화면·CSV에 "위치" 표시/열 추가(1단계 CSV 확장과 같은 방식). 이것이 "위치-품목 연결"의 간단판.

### 4-2. 파이프라인 연결
- 0단계에서 만든 `decideScanAction`이 여기서 실체를 갖는다: `labelParser` 결과를 넣어 `evaluateRules` 호출.
- 적용 위치: 중복 판정·복권 처리 **뒤**, 모드별 저장 **앞**. 모든 모드(일반·연속·배치·여러 코드·자동열기 OFF)에 동일 적용. 3단계 확정 모드에서는 "확정된 순간"에 적용.
- `skip`이면 `scanner.ruleSkipped` 토스트(연속 모드) 또는 카드 제목으로 표시하고 저장 안 함. 중복 처리보다 우선(건너뛸 코드는 중복 검사도 안 함).
- 규칙은 화면 포커스 시 로드해 ref로 보관(`scanRulesRef`).

### 4-3. 화면
| 화면 | 내용 | 파일 |
|---|---|---|
| 설정 → **자동 규칙** (고급 스캔 기능 섹션) | 목록: 이름, 조건 요약("O-로 시작"), 동작 요약 아이콘(그룹/건너뜀/복사/URL/위치), 켜기 스위치, 드래그 정렬, 스와이프 삭제(실행 취소). 상단에 "전체 켜기" 스위치. 하단 "값으로 시험하기" 입력창 → 어느 규칙에 걸리고 어떤 동작이 나오는지 즉시 표시. 템플릿 1개 제안: "선반 라벨이면 위치로 지정" | `screens/ScanRulesScreen.js`, `app/scan-rules.tsx` |
| 규칙 편집 | 이름 / 조건 목록(종류 칩 + 값 입력, 필드 조건은 템플릿 선택 → 필드 선택 → 연산자) / 동작 목록(종류 칩 + 그룹 선택·URL 입력) / "걸리면 아래 규칙 중단" 토글 / 미리보기 입력 | `screens/ScanRuleEditScreen.js`, `app/scan-rule-edit.tsx` |
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
| 3 볼륨 키 | 0.5일 | 1회 (네이티브 추가) | 볼륨 변화 체감, 0/최대에서 동작 |
| 4 자동 규칙 | 1.5일 | 1회 | 두 규칙 시나리오 |

빌드는 Mac 로컬(`eas build --local`, 약 30분). EAS 클라우드는 11월 1일 초기화.

## 결정이 필요한 것

1. **박스 QR 필드 이름**: `180100048|91163||0014`의 각 칸이 무엇인지 → 기본 템플릿 필드 이름.
2. **선반 QR 값**: `O-02-A1`을 찍으면 나오는 값 그대로인지 → 기본 규칙 "선반 라벨이면 위치로 지정"의 조건(예: 정규식 `^[A-Z]-\d{2}-[A-Z]\d$`).
3. **볼륨 키 제약 수용**: 누를 때 볼륨이 순간 바뀌었다 돌아오는 방식이어도 되는지. 안 되면 3단계는 "화면 확정 버튼"만으로 축소.
4. **잠금 여부**: 자동 규칙·볼륨 확정을 Pro(광고 시청 해제) 항목으로 둘지, 무료로 둘지.
5. **위치 배지 해제 시점**: 그룹 변경·화면 이탈 시 자동 해제(제안) vs 수동 해제만.
