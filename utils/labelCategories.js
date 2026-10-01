// utils/labelCategories.js - 라벨 카테고리·무시 패턴·발견된 패턴 저장소 (AsyncStorage)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCategory, signatureOf } from './labelParser';

export const LABEL_CATEGORIES_KEY = 'labelCategories';
export const LABEL_IGNORED_KEY = 'labelIgnoredPatterns';
export const LABEL_DISCOVERED_KEY = 'labelDiscoveredPatterns'; // 연속 모드 등에서 묻지 못하고 쌓아 둔 패턴
export const LABEL_AUTO_SPLIT_KEY = 'labelAutoSplit';

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function loadLabelSettings() {
  const [categories, ignored, discovered, autoSplit] = await Promise.all([
    readJson(LABEL_CATEGORIES_KEY, []),
    readJson(LABEL_IGNORED_KEY, []),
    readJson(LABEL_DISCOVERED_KEY, []),
    AsyncStorage.getItem(LABEL_AUTO_SPLIT_KEY),
  ]);
  return {
    categories: Array.isArray(categories) ? categories : [],
    ignored: Array.isArray(ignored) ? ignored : [],
    discovered: Array.isArray(discovered) ? discovered : [],
    autoSplit: autoSplit === null ? true : autoSplit === 'true',
  };
}

export async function saveCategories(categories) {
  await AsyncStorage.setItem(LABEL_CATEGORIES_KEY, JSON.stringify(categories));
  return categories;
}

export async function addCategory(category) {
  const { categories } = await loadLabelSettings();
  if (categories.some(c => c.signature === category.signature)) {
    return categories.find(c => c.signature === category.signature);
  }
  await saveCategories([...categories, category]);
  await removeDiscovered(category.signature);
  return category;
}

// 코드로 새 카테고리를 만들어 저장 (이미 같은 서명이 있으면 그것을 돌려준다)
export async function createCategoryFromCode(code, t, name) {
  const { categories } = await loadLabelSettings();
  const category = buildCategory(code, categories, t);
  if (!category) return null;
  if (name && name.trim()) category.name = name.trim();
  return addCategory(category);
}

export async function updateCategory(id, patch) {
  const { categories } = await loadLabelSettings();
  const next = categories.map(c => (c.id === id ? { ...c, ...patch } : c));
  await saveCategories(next);
  return next.find(c => c.id === id) || null;
}

export async function deleteCategory(id) {
  const { categories } = await loadLabelSettings();
  await saveCategories(categories.filter(c => c.id !== id));
}

// 저장 횟수 +1 (설정 화면 표시용). 실패해도 무시
export async function bumpCategoryCount(id) {
  try {
    const { categories } = await loadLabelSettings();
    const next = categories.map(c => (c.id === id ? { ...c, count: (c.count || 0) + 1 } : c));
    await saveCategories(next);
  } catch {
    // 통계용이라 조용히 넘어간다
  }
}

export async function ignorePattern(signature) {
  const { ignored } = await loadLabelSettings();
  if (!ignored.includes(signature)) {
    await AsyncStorage.setItem(LABEL_IGNORED_KEY, JSON.stringify([...ignored, signature]));
  }
  await removeDiscovered(signature);
}

export async function restorePattern(signature) {
  const { ignored } = await loadLabelSettings();
  await AsyncStorage.setItem(LABEL_IGNORED_KEY, JSON.stringify(ignored.filter(s => s !== signature)));
}

// 연속·배치 모드처럼 스캔을 멈출 수 없을 때, 나중에 설정에서 보여 주려고 쌓아 둔다
export async function addDiscovered(code) {
  const signature = signatureOf(code);
  if (!signature) return;
  const { discovered, categories, ignored } = await loadLabelSettings();
  if (categories.some(c => c.signature === signature) || ignored.includes(signature)) return;
  if (discovered.some(d => d.signature === signature)) return;
  await AsyncStorage.setItem(
    LABEL_DISCOVERED_KEY,
    JSON.stringify([...discovered, { signature, sample: code, at: Date.now() }].slice(-20))
  );
}

export async function removeDiscovered(signature) {
  const { discovered } = await loadLabelSettings();
  await AsyncStorage.setItem(LABEL_DISCOVERED_KEY, JSON.stringify(discovered.filter(d => d.signature !== signature)));
}

export async function setAutoSplit(enabled) {
  await AsyncStorage.setItem(LABEL_AUTO_SPLIT_KEY, enabled ? 'true' : 'false');
}
