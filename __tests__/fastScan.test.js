import { shouldAcceptFastScan, applyFastEntries, createSendQueue, parseFastRepeat } from '../utils/fastScan';

const prepend = (byGroup, groupId, item) => {
  byGroup[groupId] = [item, ...(byGroup[groupId] || [])];
};

describe('shouldAcceptFastScan', () => {
  test('다른 코드는 바로 받는다', () => {
    expect(shouldAcceptFastScan('500', { code: 'A', at: 1000 }, 'B', 1010, 0)).toBe(true);
    expect(shouldAcceptFastScan('500', null, 'A', 1000, 0)).toBe(true);
  });

  test('같은 코드는 간격이 지나야 받는다', () => {
    const last = { code: 'A', at: 1000 };
    expect(shouldAcceptFastScan('500', last, 'A', 1400, 1370)).toBe(false);
    expect(shouldAcceptFastScan('500', last, 'A', 1500, 1470)).toBe(true);
    expect(shouldAcceptFastScan('300', last, 'A', 1300, 1270)).toBe(true);
  });

  test('once는 화면에서 사라졌다 다시 보일 때만 받는다', () => {
    const last = { code: 'A', at: 1000 };
    expect(shouldAcceptFastScan('once', last, 'A', 5000, 4970)).toBe(false);
    expect(shouldAcceptFastScan('once', last, 'A', 5000, 4500)).toBe(true);
  });

  test('알 수 없는 설정값은 기본값으로', () => {
    expect(parseFastRepeat('nope')).toBe('500');
    expect(parseFastRepeat('trigger')).toBe('trigger');
  });
});

describe('applyFastEntries', () => {
  test('새 코드는 만들고 같은 코드는 수량을 올린다', () => {
    const history = {};
    applyFastEntries(history, [
      { code: 'A', type: 'ean13', at: 1, delta: 1, scan: true, groupId: 'g' },
      { code: 'B', type: 'qr', at: 2, delta: 1, scan: true, groupId: 'g' },
      { code: 'A', type: 'ean13', at: 3, delta: 1, scan: true, groupId: 'g' },
    ], prepend);
    expect(history.g.map((i) => i.code)).toEqual(['A', 'B']);
    expect(history.g[0]).toMatchObject({ quantity: 2, count: 2, scanTimes: [1, 3], timestamp: 3, type: 'ean13' });
  });

  test('-1은 수량을 줄이고 0이 되면 지운다', () => {
    const history = { g: [{ code: 'A', quantity: 2, count: 2, timestamp: 3, scanTimes: [1, 3], photos: [] }] };
    applyFastEntries(history, [{ code: 'A', at: 4, delta: -1, scan: false, groupId: 'g' }], prepend);
    expect(history.g[0]).toMatchObject({ quantity: 1, count: 1, scanTimes: [1], timestamp: 3 });
    applyFastEntries(history, [{ code: 'A', at: 5, delta: -1, scan: false, groupId: 'g' }], prepend);
    expect(history.g).toEqual([]);
  });

  test('수량 직접 수정은 스캔 시각을 늘리지 않는다', () => {
    const history = { g: [{ code: 'A', count: 1, timestamp: 1, scanTimes: [1], photos: ['p'] }] };
    applyFastEntries(history, [{ code: 'A', at: 9, delta: 9, scan: false, groupId: 'g' }], prepend);
    expect(history.g[0]).toMatchObject({ quantity: 10, count: 10, scanTimes: [1], photos: ['p'] });
  });

  test('없는 코드를 줄이라는 요청은 무시한다', () => {
    const history = {};
    applyFastEntries(history, [{ code: 'A', at: 1, delta: -1, scan: false, groupId: 'g' }], prepend);
    expect(history.g).toBeUndefined();
  });
});

describe('createSendQueue', () => {
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

  test('순서대로 보내고, 실패하면 같은 항목을 다시 보낸다', async () => {
    const sent = [];
    let failOnce = true;
    const queue = createSendQueue({
      send: async (item) => {
        if (item === 2 && failOnce) { failOnce = false; throw new Error('network'); }
        sent.push(item);
      },
      wait: async () => {},
    });
    queue.push(1); queue.push(2); queue.push(3);
    await flush();
    expect(sent).toEqual([1, 2, 3]);
    expect(queue.stats()).toEqual({ pending: 0, failed: 0 });
  });

  test('다시 보내도 소용없는 오류는 버리고 실패로 센다', async () => {
    const sent = [];
    const queue = createSendQueue({
      send: async (item) => { if (item === 'bad') throw Object.assign(new Error('400'), { status: 400 }); sent.push(item); },
      isPermanent: (e) => e.status === 400,
      wait: async () => {},
    });
    queue.push('a'); queue.push('bad'); queue.push('b');
    await flush();
    expect(sent).toEqual(['a', 'b']);
    expect(queue.stats()).toEqual({ pending: 0, failed: 1 });
  });

  test('한도를 넘으면 오래된 것부터 버린다', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const sent = [];
    const queue = createSendQueue({ send: async (item) => { await gate; sent.push(item); }, maxItems: 2, wait: async () => {} });
    queue.push(1); queue.push(2); queue.push(3);
    expect(queue.stats()).toEqual({ pending: 2, failed: 1 });
    release();
    await flush();
    expect(sent).toEqual([1, 3]);
  });
});

describe('고속 모드 구성', () => {
  const { parseFastProfile, fastProfileBarcodes, fastStatsKey, summarizeFastSession, mergeFastStats, aggregateFastStats, DEFAULT_FAST_PROFILE } = require('../utils/fastScan');

  test('저장값이 없거나 깨졌으면 기본값', () => {
    expect(parseFastProfile(null)).toEqual(DEFAULT_FAST_PROFILE);
    expect(parseFastProfile('{bad')).toEqual(DEFAULT_FAST_PROFILE);
  });

  test('알 수 없는 값은 버리고 아는 값만 쓴다', () => {
    const p = parseFastProfile(JSON.stringify({ preset: 'nope', sound: false, custom: ['qr', 'xx'], extra: 1 }));
    expect(p.preset).toBe('logistics');
    expect(p.sound).toBe(false);
    expect(p.custom).toEqual(['qr']);
    expect(p.extra).toBeUndefined();
  });

  test('프리셋별 바코드 종류', () => {
    expect(fastProfileBarcodes({ ...DEFAULT_FAST_PROFILE, preset: 'qr' }, ['ean13'])).toEqual(['qr']);
    expect(fastProfileBarcodes({ ...DEFAULT_FAST_PROFILE, preset: 'current' }, ['ean13'])).toEqual(['ean13']);
    expect(fastProfileBarcodes({ ...DEFAULT_FAST_PROFILE, preset: 'custom', custom: ['aztec'] }, [])).toEqual(['aztec']);
  });

  test('측정 열쇠는 순서와 무관', () => {
    expect(fastStatsKey(['qr', 'code128'], false)).toBe(fastStatsKey(['code128', 'qr'], false));
    expect(fastStatsKey(['qr'], true)).not.toBe(fastStatsKey(['qr'], false));
  });

  test('짧은 세션은 버리고, 세션들을 합친다', () => {
    expect(summarizeFastSession({ samples: [{ fps: 30, avgMs: 20 }], gaps: [100] })).toBeNull();
    const a = summarizeFastSession({ samples: Array(10).fill({ fps: 30, avgMs: 20 }), gaps: [100, 200, 300] });
    const b = summarizeFastSession({ samples: Array(30).fill({ fps: 20, avgMs: 40 }), gaps: [] });
    expect(a).toMatchObject({ decodeMs: 20, fps: 30, gapMs: 200, seconds: 10 });
    let store = mergeFastStats({}, 'k', a, 1);
    store = mergeFastStats(store, 'k', b, 2);
    const agg = aggregateFastStats(store, 'k');
    expect(agg.decodeMs).toBeCloseTo(35);
    expect(agg.gapMs).toBe(200);
    expect(agg.sessions).toBe(2);
    expect(aggregateFastStats(store, 'none')).toBeNull();
  });
});
