// utils/scanRules.js - 스캔 후 자동 동작 규칙 (순수 함수. 저장은 scanRulesStore.js)
// 규칙 = 조건(모두 만족) + 동작(순서대로). 위에서부터 보고, 걸린 규칙이 stopAfterMatch면 아래는 건너뛴다.

export const CONDITION_TYPES = ['startsWith', 'contains', 'endsWith', 'regex', 'barcodeType', 'category', 'field'];
export const FIELD_OPS = ['eq', 'ne', 'gt', 'lt', 'contains', 'empty', 'notEmpty'];
export const ACTION_TYPES = ['saveToGroup', 'skip', 'copy', 'openUrl', 'setLocation', 'feedback'];
export const FEEDBACK_HAPTICS = ['success', 'warning', 'error'];

// 숫자로 비교할 수 있으면 숫자로, 아니면 문자열로
function compareValues(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

export function safeRegex(pattern) {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

// input = { code, type, categoryId, values, groupId }
export function matchCondition(condition, input) {
  if (!condition || !input) return false;
  const code = String(input.code ?? '');
  const value = condition.value ?? '';
  switch (condition.type) {
    case 'startsWith': return value !== '' && code.startsWith(value);
    case 'contains': return value !== '' && code.includes(value);
    case 'endsWith': return value !== '' && code.endsWith(value);
    case 'regex': {
      const re = safeRegex(value);
      return !!re && re.test(code);
    }
    case 'barcodeType': return !!value && String(input.type || '').toLowerCase() === String(value).toLowerCase();
    case 'category': return !!value && input.categoryId === value;
    case 'field': {
      if (!condition.categoryId || input.categoryId !== condition.categoryId) return false;
      const values = Array.isArray(input.values) ? input.values : [];
      const index = Number.isInteger(condition.fieldIndex) ? condition.fieldIndex : -1;
      const fieldValue = index >= 0 && index < values.length ? String(values[index] ?? '') : '';
      switch (condition.op || 'eq') {
        case 'eq': return fieldValue === String(value);
        case 'ne': return fieldValue !== String(value);
        case 'gt': return fieldValue !== '' && compareValues(fieldValue, value) > 0;
        case 'lt': return fieldValue !== '' && compareValues(fieldValue, value) < 0;
        case 'contains': return value !== '' && fieldValue.includes(String(value));
        case 'empty': return fieldValue === '';
        case 'notEmpty': return fieldValue !== '';
        default: return false;
      }
    }
    default: return false;
  }
}

export function matchRule(rule, input) {
  if (!rule || rule.enabled === false) return false;
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  if (conditions.length === 0) return false;
  return conditions.every(c => matchCondition(c, input));
}

export function emptyDecision() {
  return { skip: false, targetGroupId: null, actions: [], matchedRuleIds: [] };
}

// 걸린 규칙의 동작을 결정으로 합친다. skip/saveToGroup은 결정 필드로, 나머지는 actions 목록으로
export function evaluateRules(rules, input) {
  const decision = emptyDecision();
  const matched = [];
  const ordered = (Array.isArray(rules) ? rules : []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const rule of ordered) {
    if (!matchRule(rule, input)) continue;
    matched.push(rule);
    decision.matchedRuleIds.push(rule.id);
    for (const action of (Array.isArray(rule.actions) ? rule.actions : [])) {
      if (!action) continue;
      if (action.type === 'skip') decision.skip = true;
      else if (action.type === 'saveToGroup') { if (action.groupId) decision.targetGroupId = action.groupId; }
      else if (ACTION_TYPES.includes(action.type)) decision.actions.push({ ...action, ruleId: rule.id });
    }
    if (rule.stopAfterMatch !== false) break;
  }
  return { matched, decision };
}

// URL 템플릿 치환: {code} {group} {field:이름} {field1} (1부터)
export function substituteTemplate(template, input, context = {}) {
  if (typeof template !== 'string') return '';
  const values = Array.isArray(input?.values) ? input.values : [];
  const fieldNames = Array.isArray(context.fieldNames) ? context.fieldNames : [];
  return template.replace(/\{(code|group|field:[^}]+|field\d+)\}/g, (whole, token) => {
    if (token === 'code') return encodeURIComponent(String(input?.code ?? ''));
    if (token === 'group') return encodeURIComponent(String(context.groupName ?? ''));
    if (token.startsWith('field:')) {
      const name = token.slice(6);
      const index = fieldNames.findIndex(n => n === name);
      return index === -1 ? '' : encodeURIComponent(String(values[index] ?? ''));
    }
    const index = parseInt(token.slice(5), 10) - 1;
    return index >= 0 && index < values.length ? encodeURIComponent(String(values[index] ?? '')) : '';
  });
}

// 저장 전 검증. 문제 없으면 빈 배열
export function validateRule(rule, t) {
  const tr = (key) => (t ? t(key) : key);
  const errors = [];
  if (!rule || !String(rule.name || '').trim()) errors.push(tr('scanRules.errorName'));
  const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
  if (conditions.length === 0) errors.push(tr('scanRules.errorNoConditions'));
  for (const c of conditions) {
    if (!CONDITION_TYPES.includes(c.type)) { errors.push(tr('scanRules.errorCondition')); continue; }
    if (['startsWith', 'contains', 'endsWith', 'regex', 'barcodeType', 'category'].includes(c.type) && !String(c.value ?? '').trim()) {
      errors.push(tr('scanRules.errorConditionValue'));
    }
    if (c.type === 'regex' && !safeRegex(c.value)) errors.push(tr('scanRules.errorRegex'));
    if (c.type === 'field') {
      if (!c.categoryId || !Number.isInteger(c.fieldIndex)) errors.push(tr('scanRules.errorField'));
      if (!['empty', 'notEmpty'].includes(c.op || 'eq') && !String(c.value ?? '').trim()) errors.push(tr('scanRules.errorConditionValue'));
    }
  }
  const actions = Array.isArray(rule?.actions) ? rule.actions : [];
  if (actions.length === 0) errors.push(tr('scanRules.errorNoActions'));
  for (const a of actions) {
    if (!ACTION_TYPES.includes(a.type)) { errors.push(tr('scanRules.errorAction')); continue; }
    if (a.type === 'saveToGroup' && !a.groupId) errors.push(tr('scanRules.errorGroup'));
    if (a.type === 'openUrl' && !/^https?:\/\//i.test(String(a.url || '').trim())) errors.push(tr('scanRules.errorUrl'));
  }
  return Array.from(new Set(errors));
}

export function newRule(order = 0) {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    enabled: true,
    order,
    stopAfterMatch: true,
    conditions: [{ type: 'startsWith', value: '' }],
    actions: [{ type: 'saveToGroup', groupId: null }],
  };
}

// 목록용 한 줄 요약. context = { groups, categories }
export function describeCondition(condition, context = {}, t) {
  const tr = (key, params) => (t ? t(key, params) : key);
  if (!condition) return '';
  switch (condition.type) {
    case 'startsWith':
    case 'contains':
    case 'endsWith':
    case 'regex':
      return tr(`scanRules.summary.${condition.type}`, { value: condition.value ?? '' });
    case 'barcodeType':
      return tr('scanRules.summary.barcodeType', { value: String(condition.value || '').toUpperCase() });
    case 'category': {
      const category = (context.categories || []).find(c => c.id === condition.value);
      return tr('scanRules.summary.category', { value: category ? category.name : '?' });
    }
    case 'field': {
      const category = (context.categories || []).find(c => c.id === condition.categoryId);
      const name = category && category.fields && category.fields[condition.fieldIndex]
        ? category.fields[condition.fieldIndex]
        : `#${(condition.fieldIndex ?? 0) + 1}`;
      return tr('scanRules.summary.field', { field: name, op: tr(`scanRules.ops.${condition.op || 'eq'}`), value: condition.value ?? '' });
    }
    default:
      return '';
  }
}

export function describeAction(action, context = {}, t) {
  const tr = (key, params) => (t ? t(key, params) : key);
  if (!action) return '';
  switch (action.type) {
    case 'saveToGroup': {
      const group = (context.groups || []).find(g => g.id === action.groupId);
      return tr('scanRules.summary.saveToGroup', { group: group ? group.name : '?' });
    }
    case 'openUrl':
      return tr(action.mode === 'send' ? 'scanRules.summary.sendUrl' : 'scanRules.summary.openUrl', { url: action.url || '' });
    case 'feedback':
      return tr('scanRules.summary.feedback', { haptic: tr(`scanRules.haptics.${action.haptic || 'success'}`) });
    default:
      return tr(`scanRules.actions.${action.type}`);
  }
}
