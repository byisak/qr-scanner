// utils/scanRulesStore.js - 자동 규칙 저장소 (AsyncStorage)
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCAN_RULES_KEY = 'scanRules';
export const SCAN_RULES_ENABLED_KEY = 'scanRulesEnabled';

function normalizeRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && typeof r === 'object' && r.id)
    .map((r, index) => ({
      ...r,
      enabled: r.enabled !== false,
      order: Number.isFinite(r.order) ? r.order : index,
      stopAfterMatch: r.stopAfterMatch !== false,
      conditions: Array.isArray(r.conditions) ? r.conditions : [],
      actions: Array.isArray(r.actions) ? r.actions : [],
    }))
    .sort((a, b) => a.order - b.order);
}

export function parseRules(json) {
  try {
    return normalizeRules(json ? JSON.parse(json) : []);
  } catch {
    return [];
  }
}

export async function loadScanRules() {
  const [[, rulesJson], [, enabled]] = await AsyncStorage.multiGet([SCAN_RULES_KEY, SCAN_RULES_ENABLED_KEY]);
  return {
    rules: parseRules(rulesJson),
    enabled: enabled === null ? true : enabled === 'true',
  };
}

export async function saveScanRules(rules) {
  const ordered = normalizeRules(rules).map((r, index) => ({ ...r, order: index }));
  await AsyncStorage.setItem(SCAN_RULES_KEY, JSON.stringify(ordered));
  return ordered;
}

export async function upsertScanRule(rule) {
  const { rules } = await loadScanRules();
  const index = rules.findIndex(r => r.id === rule.id);
  const next = index === -1 ? [...rules, { ...rule, order: rules.length }] : rules.map(r => (r.id === rule.id ? { ...r, ...rule } : r));
  return saveScanRules(next);
}

export async function deleteScanRule(id) {
  const { rules } = await loadScanRules();
  return saveScanRules(rules.filter(r => r.id !== id));
}

export async function setScanRulesEnabled(enabled) {
  await AsyncStorage.setItem(SCAN_RULES_ENABLED_KEY, enabled ? 'true' : 'false');
}
