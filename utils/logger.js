// utils/logger.js - 개발 모드에서만 로그 출력
const isDev = __DEV__;

export const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // 에러는 항상 출력 (프로덕션에서도 모니터링 필요)
    console.error(...args);
  },
  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  },
  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};

export default logger;
