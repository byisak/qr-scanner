import { matchCondition, matchRule, evaluateRules, substituteTemplate, validateRule, newRule, safeRegex } from '../utils/scanRules';

const input = { code: 'ABC-12345', type: 'QR', categoryId: 'cat1', values: ['A1', '30', ''] };

describe('matchCondition', () => {
  test('문자열 조건', () => {
    expect(matchCondition({ type: 'startsWith', value: 'ABC' }, input)).toBe(true);
    expect(matchCondition({ type: 'startsWith', value: 'BC' }, input)).toBe(false);
    expect(matchCondition({ type: 'contains', value: '-123' }, input)).toBe(true);
    expect(matchCondition({ type: 'endsWith', value: '345' }, input)).toBe(true);
  });

  test('빈 값 조건은 아무것에도 걸리지 않는다', () => {
    for (const type of ['startsWith', 'contains', 'endsWith', 'barcodeType', 'category']) {
      expect(matchCondition({ type, value: '' }, input)).toBe(false);
    }
  });

  test('정규식 (잘못된 식은 걸리지 않음)', () => {
    expect(matchCondition({ type: 'regex', value: '^[A-Z]{3}-\\d+$' }, input)).toBe(true);
    expect(matchCondition({ type: 'regex', value: '^\\d+$' }, input)).toBe(false);
    expect(matchCondition({ type: 'regex', value: '([' }, input)).toBe(false);
    expect(safeRegex('([')).toBeNull();
  });

  test('바코드 종류는 대소문자 무시', () => {
    expect(matchCondition({ type: 'barcodeType', value: 'qr' }, input)).toBe(true);
    expect(matchCondition({ type: 'barcodeType', value: 'ean13' }, input)).toBe(false);
  });

  test('카테고리', () => {
    expect(matchCondition({ type: 'category', value: 'cat1' }, input)).toBe(true);
    expect(matchCondition({ type: 'category', value: 'cat2' }, input)).toBe(false);
  });

  test('필드 비교: 숫자로 비교할 수 있으면 숫자로', () => {
    const field = (op, value, fieldIndex = 1) => ({ type: 'field', categoryId: 'cat1', fieldIndex, op, value });
    expect(matchCondition(field('eq', '30'), input)).toBe(true);
    expect(matchCondition(field('ne', '30'), input)).toBe(false);
    expect(matchCondition(field('gt', '4'), input)).toBe(true); // 문자열 비교였다면 '30' < '4'
    expect(matchCondition(field('lt', '100'), input)).toBe(true);
    expect(matchCondition(field('contains', 'A', 0), input)).toBe(true);
    expect(matchCondition(field('empty', '', 2), input)).toBe(true);
    expect(matchCondition(field('notEmpty', '', 2), input)).toBe(false);
    expect(matchCondition(field('gt', '0', 2), input)).toBe(false); // 빈 칸은 크다/작다에 걸리지 않음
    expect(matchCondition(field('empty', '', 9), input)).toBe(true); // 없는 칸은 빈 칸
  });

  test('다른 카테고리의 필드 조건은 걸리지 않는다', () => {
    expect(matchCondition({ type: 'field', categoryId: 'cat2', fieldIndex: 0, op: 'notEmpty' }, input)).toBe(false);
  });

  test('모르는 조건·빈 입력', () => {
    expect(matchCondition({ type: 'nope', value: 'x' }, input)).toBe(false);
    expect(matchCondition(null, input)).toBe(false);
    expect(matchCondition({ type: 'contains', value: 'x' }, null)).toBe(false);
  });
});

describe('matchRule', () => {
  const rule = { id: 'r', conditions: [{ type: 'startsWith', value: 'ABC' }, { type: 'endsWith', value: '5' }] };
  test('조건을 모두 만족해야 한다', () => {
    expect(matchRule(rule, input)).toBe(true);
    expect(matchRule({ ...rule, conditions: [...rule.conditions, { type: 'contains', value: 'zzz' }] }, input)).toBe(false);
  });
  test('꺼진 규칙·조건 없는 규칙은 걸리지 않는다', () => {
    expect(matchRule({ ...rule, enabled: false }, input)).toBe(false);
    expect(matchRule({ id: 'r', conditions: [] }, input)).toBe(false);
  });
});

describe('evaluateRules', () => {
  const hit = [{ type: 'startsWith', value: 'ABC' }];
  test('order 순서대로 보고, 걸리면 기본으로 멈춘다', () => {
    const rules = [
      { id: 'second', order: 2, conditions: hit, actions: [{ type: 'saveToGroup', groupId: 'g2' }] },
      { id: 'first', order: 1, conditions: hit, actions: [{ type: 'saveToGroup', groupId: 'g1' }] },
    ];
    const { decision, matched } = evaluateRules(rules, input);
    expect(decision.targetGroupId).toBe('g1');
    expect(decision.matchedRuleIds).toEqual(['first']);
    expect(matched).toHaveLength(1);
  });

  test('stopAfterMatch가 false면 아래 규칙도 본다', () => {
    const rules = [
      { id: 'a', order: 1, stopAfterMatch: false, conditions: hit, actions: [{ type: 'copy' }, { type: 'feedback', haptic: 'warning' }] },
      { id: 'b', order: 2, conditions: hit, actions: [{ type: 'skip' }, { type: 'unknown' }] },
      { id: 'c', order: 3, conditions: hit, actions: [{ type: 'saveToGroup', groupId: 'never' }] },
    ];
    const { decision } = evaluateRules(rules, input);
    expect(decision.skip).toBe(true);
    expect(decision.targetGroupId).toBeNull();
    expect(decision.matchedRuleIds).toEqual(['a', 'b']);
    expect(decision.actions).toEqual([{ type: 'copy', ruleId: 'a' }, { type: 'feedback', haptic: 'warning', ruleId: 'a' }]);
  });

  test('걸린 규칙이 없으면 빈 결정', () => {
    expect(evaluateRules([{ id: 'x', conditions: [{ type: 'startsWith', value: 'ZZZ' }], actions: [{ type: 'skip' }] }], input).decision)
      .toEqual({ skip: false, targetGroupId: null, actions: [], matchedRuleIds: [] });
    expect(evaluateRules(null, input).matched).toEqual([]);
  });
});

describe('substituteTemplate', () => {
  test('{code} {group} {field1} {field:이름}을 URL 인코딩해서 넣는다', () => {
    const url = substituteTemplate(
      'https://x.test/s?c={code}&g={group}&a={field1}&q={field:수량}&n={field9}&u={field:없음}&k={keep}',
      { code: 'A B/1', values: ['A&1', '30'] },
      { groupName: '창고 1', fieldNames: ['품목', '수량'] }
    );
    expect(url).toBe('https://x.test/s?c=A%20B%2F1&g=%EC%B0%BD%EA%B3%A0%201&a=A%261&q=30&n=&u=&k={keep}');
  });
  test('문자열이 아니면 빈 문자열', () => {
    expect(substituteTemplate(null, input)).toBe('');
  });
});

describe('validateRule', () => {
  const ok = { name: '규칙', conditions: [{ type: 'startsWith', value: 'A' }], actions: [{ type: 'saveToGroup', groupId: 'g1' }] };
  test('문제 없으면 빈 배열', () => {
    expect(validateRule(ok)).toEqual([]);
  });
  test('문제별 오류', () => {
    expect(validateRule({ ...ok, name: ' ' })).toEqual(['scanRules.errorName']);
    expect(validateRule({ ...ok, conditions: [] })).toEqual(['scanRules.errorNoConditions']);
    expect(validateRule({ ...ok, actions: [] })).toEqual(['scanRules.errorNoActions']);
    expect(validateRule({ ...ok, conditions: [{ type: 'regex', value: '([' }] })).toEqual(['scanRules.errorRegex']);
    expect(validateRule({ ...ok, conditions: [{ type: 'contains', value: '' }] })).toEqual(['scanRules.errorConditionValue']);
    expect(validateRule({ ...ok, conditions: [{ type: 'field', op: 'eq', value: '1' }] })).toEqual(['scanRules.errorField']);
    expect(validateRule({ ...ok, actions: [{ type: 'saveToGroup', groupId: null }] })).toEqual(['scanRules.errorGroup']);
    expect(validateRule({ ...ok, actions: [{ type: 'openUrl', url: 'ftp://x' }] })).toEqual(['scanRules.errorUrl']);
    expect(validateRule({ ...ok, actions: [{ type: 'nope' }] })).toEqual(['scanRules.errorAction']);
  });
  test('새 규칙은 값을 채우기 전에는 통과하지 못한다', () => {
    expect(validateRule(newRule()).length).toBeGreaterThan(0);
  });
});
