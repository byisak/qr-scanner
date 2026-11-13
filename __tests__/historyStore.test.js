// 기록 저장소: AsyncStorage와 파일 삭제를 가짜로 바꿔, 겹치는 변경이 사라지지 않는지 본다
import {
  HISTORY_KEY, HISTORY_LIMIT, hasStoredHistory, readHistory, updateHistory, replaceHistory,
  invalidateHistory, flushHistory, prependCapped, deletePhotosOf, capItems, trimGroup,
} from '../utils/historyStore';

const mockData = new Map();
const mockWrites = [];
const mockDeleted = [];

jest.mock('@react-native-async-storage/async-storage', () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  return {
    __esModule: true,
    default: {
      // 진짜처럼 느리게: 읽기보다 쓰기가 오래 걸린다
      async getItem(k) { await wait(3); return mockData.has(k) ? mockData.get(k) : null; },
      async setItem(k, v) { await wait(8); mockData.set(k, v); mockWrites.push(k); },
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  deleteAsync: jest.fn(async (uri) => { mockDeleted.push(uri); }),
}));

const stored = () => JSON.parse(mockData.get(HISTORY_KEY));
const seed = async (value) => {
  await flushHistory();
  if (value === undefined) mockData.delete(HISTORY_KEY);
  else mockData.set(HISTORY_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  await invalidateHistory();
  mockWrites.length = 0;
  mockDeleted.length = 0;
};

describe('historyStore', () => {
  test('겹친 변경(메모 편집 + 늦게 끝난 사진 + 새 스캔)이 모두 남는다', async () => {
    await seed({ default: [{ code: 'A', timestamp: 1, photos: [] }] });
    await Promise.all([
      updateHistory(h => { h.default[0] = { ...h.default[0], memo: 'hello' }; }),
      updateHistory(h => { h.default[0] = { ...h.default[0], photos: ['file:///doc/scan_photos/p1.jpg'] }; }),
      updateHistory(h => { prependCapped(h, 'default', { code: 'B', timestamp: 2, photos: [] }); }),
    ]);
    const d = stored();
    expect(d.default.map(i => i.code)).toEqual(['B', 'A']);
    expect(d.default[1]).toMatchObject({ memo: 'hello', photos: ['file:///doc/scan_photos/p1.jpg'] });
  });

  test('readHistory의 복사본을 고쳐도 저장소는 그대로', async () => {
    await seed({ default: [{ code: 'A' }] });
    const snap = await readHistory();
    snap.default.push({ code: 'X' });
    snap.other = [];
    expect(await readHistory()).toEqual({ default: [{ code: 'A' }] });
  });

  test('replaceHistory: 읽기 → 고치기 → 통째로 쓰기', async () => {
    await seed({ default: [{ code: 'A' }] });
    const snap = await readHistory();
    snap.default.unshift({ code: 'B' });
    snap.g2 = [];
    await replaceHistory(snap);
    expect(stored()).toEqual({ default: [{ code: 'B' }, { code: 'A' }], g2: [] });
    // 넘긴 객체를 나중에 고쳐도 저장소에 영향이 없다
    snap.default.length = 0;
    expect((await readHistory()).default).toHaveLength(2);
  });

  test('아직 읽기 전에 부른 replaceHistory도 저장된다', async () => {
    await seed({ default: [{ code: 'old' }] });
    await replaceHistory({ default: [{ code: 'new' }] });
    expect(stored()).toEqual({ default: [{ code: 'new' }] });
  });

  test('mutator가 false를 돌려주면 저장하지 않는다', async () => {
    await seed({ default: [] });
    expect(await updateHistory(() => false)).toBe(false);
    expect(mockWrites).toHaveLength(0);
  });

  test('updateHistory는 mutator의 반환값을 돌려준다', async () => {
    await seed({ default: [{ code: 'A' }] });
    expect(await updateHistory(h => h.default.length)).toBe(1);
  });

  test('밀린 저장은 합쳐서 쓰고, 마지막 상태가 남는다', async () => {
    await seed({ g: [] });
    await Promise.all(Array.from({ length: 20 }, (_, i) => updateHistory(h => { h.g.push({ code: `n${i}` }); })));
    expect(stored().g).toHaveLength(20);
    expect(mockWrites.length).toBeLessThan(20);
  });

  test('직접 쓴 뒤 invalidateHistory를 부르면 다시 읽는다', async () => {
    await seed({ default: [{ code: 'A' }] });
    await readHistory();
    mockData.set(HISTORY_KEY, JSON.stringify({ default: [{ code: 'restored' }] }));
    await invalidateHistory();
    expect((await readHistory()).default[0].code).toBe('restored');
  });

  test('빈 저장소', async () => {
    await seed(undefined);
    expect(await hasStoredHistory()).toBe(false);
    expect(await readHistory()).toEqual({});
  });

  test('깨진 JSON은 빈 기록으로 읽고 원본을 따로 남긴다', async () => {
    await seed('{broken');
    expect(await readHistory()).toEqual({});
    await new Promise(r => setTimeout(r, 30));
    expect(mockData.get(`${HISTORY_KEY}_corrupt`)).toBe('{broken');
  });

  test('객체가 아닌 값(배열 등)도 빈 기록으로', async () => {
    await seed([1, 2, 3]);
    expect(await readHistory()).toEqual({});
  });

  test(`그룹당 ${HISTORY_LIMIT}건을 넘으면 오래된 것부터 잘리고 그 사진도 지운다`, async () => {
    await seed({
      big: Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
        code: `c${i}`,
        photos: i === HISTORY_LIMIT - 1 ? ['file:///doc/scan_photos/last.jpg'] : [],
      })),
    });
    await updateHistory(h => { prependCapped(h, 'big', { code: 'new', photos: [] }); });
    const d = stored();
    expect(d.big).toHaveLength(HISTORY_LIMIT);
    expect(d.big[0].code).toBe('new');
    expect(d.big[HISTORY_LIMIT - 1].code).toBe(`c${HISTORY_LIMIT - 2}`);
    expect(mockDeleted).toEqual(['file:///doc/scan_photos/last.jpg']);
  });

  test('prependCapped: 여러 건을 한 번에, 없는 그룹도', async () => {
    await seed({});
    await updateHistory(h => { prependCapped(h, 'g', [{ code: '1' }, { code: '2' }]); });
    await updateHistory(h => { prependCapped(h, 'g', { code: '0' }); });
    expect(stored().g.map(i => i.code)).toEqual(['0', '1', '2']);
  });

  test('사진 정리: 남은 기록이 쓰는 파일과 앱 폴더 밖의 파일은 지우지 않는다', async () => {
    // 저장된 경로의 앞부분이 지금과 달라도(iOS 업데이트 뒤) 파일 이름으로 찾는다
    await seed({ default: [{ code: 'K', photos: ['file:///old-container/scan_photos/keep.jpg'] }] });
    await readHistory();
    deletePhotosOf({
      photos: [
        'file:///old-container/scan_photos/keep.jpg',
        'file:///old-container/scan_photos/gone.jpg',
        'ph://gallery/1',
        'file:///storage/DCIM/a.jpg',
        null,
      ],
    });
    expect(mockDeleted).toEqual(['file:///doc/scan_photos/gone.jpg']);
  });

  test('사진 정리: 사진이 없는 항목은 아무것도 하지 않는다', async () => {
    await seed({});
    deletePhotosOf([{ code: 'a' }, null, { photos: 'not-array' }]);
    expect(mockDeleted).toEqual([]);
  });

  test('capItems: 한도 안이면 그대로, 넘으면 오래된 것부터', () => {
    const list = [{ code: 'a' }, { code: 'b' }, { code: 'c' }];
    expect(capItems(list, 3)).toEqual({ kept: list, dropped: [] });
    expect(capItems(list, 2)).toEqual({ kept: [{ code: 'a' }, { code: 'b' }], dropped: [{ code: 'c' }] });
    expect(capItems(undefined, 2)).toEqual({ kept: [], dropped: [] });
  });

  test('capItems: 고정한 항목은 남기고 고정 안 한 오래된 항목을 자른다', () => {
    const list = [{ code: 'a' }, { code: 'b' }, { code: 'c' }, { code: 'old', pinned: true }];
    const { kept, dropped } = capItems(list, 2);
    expect(kept.map(i => i.code)).toEqual(['a', 'old']);
    expect(dropped.map(i => i.code)).toEqual(['b', 'c']);
  });

  test('capItems: 고정한 것만으로 한도를 넘으면 고정 항목도 뒤에서부터 자른다', () => {
    const list = [{ code: 'n' }, { code: 'p1', pinned: true }, { code: 'p2', pinned: true }, { code: 'p3', pinned: true }];
    const { kept, dropped } = capItems(list, 2);
    expect(kept.map(i => i.code)).toEqual(['p1', 'p2']);
    expect(dropped.map(i => i.code)).toEqual(['n', 'p3']);
  });

  test('prependCapped: 가득 찬 그룹에서도 고정한 옛 기록은 남고 사진도 지워지지 않는다', async () => {
    await seed({
      default: Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
        code: 'c' + i, timestamp: HISTORY_LIMIT - i,
        photos: i >= HISTORY_LIMIT - 2 ? ['file:///doc/scan_photos/p' + i + '.jpg'] : [],
        ...(i === HISTORY_LIMIT - 1 ? { pinned: true } : {}),
      })),
    });
    await updateHistory(h => { prependCapped(h, 'default', { code: 'new', timestamp: 99999, photos: [] }); });
    const list = stored().default;
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].code).toBe('new');
    expect(list[list.length - 1]).toMatchObject({ code: 'c' + (HISTORY_LIMIT - 1), pinned: true });
    expect(list.some(i => i.code === 'c' + (HISTORY_LIMIT - 2))).toBe(false);
    expect(mockDeleted).toEqual(['file:///doc/scan_photos/p' + (HISTORY_LIMIT - 2) + '.jpg']);
  });

  test('trimGroup: 한도를 따로 줄 수 있다 (생성 그룹 500)', () => {
    const byGroup = { generated: Array.from({ length: 6 }, (_, i) => ({ code: 'g' + i })) };
    expect(trimGroup(byGroup, 'generated', 4)).toHaveLength(4);
    expect(byGroup.generated.map(i => i.code)).toEqual(['g0', 'g1', 'g2', 'g3']);
    expect(trimGroup(byGroup, 'none')).toEqual([]);
  });
});
