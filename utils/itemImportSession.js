// utils/itemImportSession.js - 파일에서 읽은 행을 불러오기 미리보기 화면으로 넘기는 임시 보관 (라우트 파라미터로 넘기기엔 큼)
let pending = null;

export function setPendingImport(value) {
  pending = value; // { rows, source: 'file' | 'paste', fileName }
}

export function takePendingImport() {
  const v = pending;
  pending = null;
  return v;
}
