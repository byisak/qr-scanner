// screens/ProductSearchSettingsScreen.js - 제품 검색 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 국가 목록
const COUNTRIES = [
  { code: 'KR', name: '대한민국', flag: '🇰🇷' },
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'JP', name: '일본', flag: '🇯🇵' },
  { code: 'CN', name: '중국', flag: '🇨🇳' },
  { code: 'DE', name: '독일', flag: '🇩🇪' },
  { code: 'GB', name: '영국', flag: '🇬🇧' },
  { code: 'FR', name: '프랑스', flag: '🇫🇷' },
  { code: 'DK', name: '덴마크', flag: '🇩🇰' },
];

// 기본 검색 사이트
const DEFAULT_SEARCH_SITES = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q={code}',
    enabled: true,
    openMode: 'inApp',
    activationMode: 'all',
  },
  {
    id: 'naver',
    name: 'Naver 쇼핑',
    url: 'https://search.shopping.naver.com/search/all?query={code}',
    enabled: true,
    openMode: 'inApp',
    activationMode: 'product',
  },
  {
    id: 'coupang',
    name: '쿠팡',
    url: 'https://www.coupang.com/np/search?q={code}',
    enabled: true,
    openMode: 'browser',
    activationMode: 'product',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.com/s?k={code}',
    enabled: false,
    openMode: 'browser',
    activationMode: 'product',
  },
  {
    id: 'ebay',
    name: 'eBay',
    url: 'https://www.ebay.com/sch/i.html?_nkw={code}',
    enabled: false,
    openMode: 'browser',
    activationMode: 'product',
  },
];

export default function ProductSearchSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;

  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('KR');
  const [searchSites, setSearchSites] = useState(DEFAULT_SEARCH_SITES);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const autoSearch = await AsyncStorage.getItem('productAutoSearch');
      const country = await AsyncStorage.getItem('productSearchCountry');
      const sites = await AsyncStorage.getItem('productSearchSites');

      if (autoSearch !== null) setAutoSearchEnabled(autoSearch === 'true');
      if (country) setSelectedCountry(country);
      if (sites) setSearchSites(JSON.parse(sites));
    } catch (error) {
      console.error('Load product search settings error:', error);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (error) {
      console.error('Save product search settings error:', error);
    }
  };

  const handleAutoSearchToggle = (value) => {
    setAutoSearchEnabled(value);
    saveSettings('productAutoSearch', value.toString());
  };

  const handleCountrySelect = (countryCode) => {
    setSelectedCountry(countryCode);
    saveSettings('productSearchCountry', countryCode);
    setShowCountryPicker(false);
  };

  const handleSiteToggle = (siteId) => {
    const updatedSites = searchSites.map(site =>
      site.id === siteId ? { ...site, enabled: !site.enabled } : site
    );
    setSearchSites(updatedSites);
    saveSettings('productSearchSites', updatedSites);
  };

  const handleAddSite = () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      Alert.alert('알림', '사이트 이름과 URL을 모두 입력해주세요.');
      return;
    }

    if (!newSiteUrl.includes('{code}')) {
      Alert.alert('알림', 'URL에 {code} 플레이스홀더를 포함해주세요.\n예: https://example.com/search?q={code}');
      return;
    }

    const newSite = {
      id: `custom_${Date.now()}`,
      name: newSiteName.trim(),
      url: newSiteUrl.trim(),
      enabled: true,
      openMode: 'browser',
      activationMode: 'all',
      custom: true,
    };

    const updatedSites = [...searchSites, newSite];
    setSearchSites(updatedSites);
    saveSettings('productSearchSites', updatedSites);
    setShowAddSiteModal(false);
    setNewSiteName('');
    setNewSiteUrl('');
  };

  const handleDeleteSite = (siteId) => {
    Alert.alert(
      '삭제 확인',
      '이 검색 사이트를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            const updatedSites = searchSites.filter(site => site.id !== siteId);
            setSearchSites(updatedSites);
            saveSettings('productSearchSites', updatedSites);
          },
        },
      ]
    );
  };

  const selectedCountryData = COUNTRIES.find(c => c.code === selectedCountry);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          제품 검색 설정
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 자동 검색 토글 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                자동 제품 검색
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                바코드 스캔 시 자동으로 제품 정보를 검색합니다
              </Text>
            </View>
            <Switch
              value={autoSearchEnabled}
              onValueChange={handleAutoSearchToggle}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 국가 선택 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
            국가 설정
          </Text>
          <TouchableOpacity
            style={[styles.countrySelector, { borderColor: colors.border }]}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.countryFlag}>{selectedCountryData?.flag}</Text>
            <Text style={[styles.countryName, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {selectedCountryData?.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 검색 사이트 목록 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
              검색 사이트
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddSiteModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {searchSites.map((site, index) => (
            <View
              key={site.id}
              style={[
                styles.siteItem,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <View style={styles.siteInfo}>
                <Text style={[styles.siteName, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {site.name}
                </Text>
                <Text style={[styles.siteUrl, { color: colors.textTertiary, fontFamily: fonts.regular }]} numberOfLines={1}>
                  {site.url}
                </Text>
                <View style={styles.siteTags}>
                  <View style={[styles.tag, { backgroundColor: colors.background }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {site.openMode === 'inApp' ? '앱 내 브라우저' : '기본 브라우저'}
                    </Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.background }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {site.activationMode === 'all' ? '모든 코드' : '제품 코드'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.siteActions}>
                {site.custom && (
                  <TouchableOpacity
                    onPress={() => handleDeleteSite(site.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
                <Switch
                  value={site.enabled}
                  onValueChange={() => handleSiteToggle(site.id)}
                  trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* 국가 선택 모달 */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                국가 선택
              </Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.countryList}>
              {COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryItem,
                    selectedCountry === country.code && { backgroundColor: colors.primary + '20' },
                  ]}
                  onPress={() => handleCountrySelect(country.code)}
                >
                  <Text style={styles.countryItemFlag}>{country.flag}</Text>
                  <Text style={[styles.countryItemName, { color: colors.text, fontFamily: fonts.regular }]}>
                    {country.name}
                  </Text>
                  {selectedCountry === country.code && (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 사이트 추가 모달 */}
      <Modal visible={showAddSiteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                검색 사이트 추가
              </Text>
              <TouchableOpacity onPress={() => setShowAddSiteModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.addSiteForm}>
              <Text style={[styles.inputLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                사이트 이름
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="예: Google 쇼핑"
                placeholderTextColor={colors.textTertiary}
                value={newSiteName}
                onChangeText={setNewSiteName}
              />
              <Text style={[styles.inputLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                검색 URL
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="https://example.com/search?q={code}"
                placeholderTextColor={colors.textTertiary}
                value={newSiteUrl}
                onChangeText={setNewSiteUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.inputHint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {'{code}'} 부분이 스캔한 코드로 대체됩니다
              </Text>
              <TouchableOpacity
                style={[styles.addSiteButton, { backgroundColor: colors.primary }]}
                onPress={handleAddSite}
              >
                <Text style={[styles.addSiteButtonText, { fontFamily: fonts.semiBold }]}>
                  추가하기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleContent: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    gap: 12,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  siteUrl: {
    fontSize: 12,
    marginBottom: 8,
  },
  siteTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
  },
  siteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countryList: {
    maxHeight: 400,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  countryItemFlag: {
    fontSize: 28,
  },
  countryItemName: {
    flex: 1,
    fontSize: 16,
  },
  addSiteForm: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  inputHint: {
    fontSize: 12,
    marginTop: -4,
  },
  addSiteButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addSiteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpace: {
    height: 40,
  },
});
