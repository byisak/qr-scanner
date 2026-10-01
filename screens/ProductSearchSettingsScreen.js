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

// 국가 목록 (한글 이름 가나다순 정렬)
const COUNTRIES = [
  { code: 'NO', name: '노르웨이', flag: '🇳🇴' },
  { code: 'NZ', name: '뉴질랜드', flag: '🇳🇿' },
  { code: 'KR', name: '대한민국', flag: '🇰🇷' },
  { code: 'DK', name: '덴마크', flag: '🇩🇰' },
  { code: 'DE', name: '독일', flag: '🇩🇪' },
  { code: 'RU', name: '러시아', flag: '🇷🇺' },
  { code: 'LU', name: '룩셈부르크', flag: '🇱🇺' },
  { code: 'LI', name: '리히텐슈타인', flag: '🇱🇮' },
  { code: 'MY', name: '말레이시아', flag: '🇲🇾' },
  { code: 'MX', name: '멕시코', flag: '🇲🇽' },
  { code: 'MC', name: '모나코', flag: '🇲🇨' },
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'BE', name: '벨기에', flag: '🇧🇪' },
  { code: 'BR', name: '브라질', flag: '🇧🇷' },
  { code: 'SA', name: '사우디아라비아', flag: '🇸🇦' },
  { code: 'SM', name: '산마리노', flag: '🇸🇲' },
  { code: 'SE', name: '스웨덴', flag: '🇸🇪' },
  { code: 'CH', name: '스위스', flag: '🇨🇭' },
  { code: 'ES', name: '스페인', flag: '🇪🇸' },
  { code: 'SG', name: '싱가포르', flag: '🇸🇬' },
  { code: 'AE', name: '아랍에미리트', flag: '🇦🇪' },
  { code: 'IE', name: '아일랜드', flag: '🇮🇪' },
  { code: 'GB', name: '영국', flag: '🇬🇧' },
  { code: 'AU', name: '오스트레일리아', flag: '🇦🇺' },
  { code: 'AT', name: '오스트리아', flag: '🇦🇹' },
  { code: 'EG', name: '이집트', flag: '🇪🇬' },
  { code: 'IT', name: '이탈리아', flag: '🇮🇹' },
  { code: 'IN', name: '인도', flag: '🇮🇳' },
  { code: 'JP', name: '일본', flag: '🇯🇵' },
  { code: 'CN', name: '중국 본토', flag: '🇨🇳' },
  { code: 'CZ', name: '체코', flag: '🇨🇿' },
  { code: 'CA', name: '캐나다', flag: '🇨🇦' },
  { code: 'TR', name: '튀르키예', flag: '🇹🇷' },
  { code: 'PT', name: '포르투갈', flag: '🇵🇹' },
  { code: 'PL', name: '폴란드', flag: '🇵🇱' },
  { code: 'FR', name: '프랑스', flag: '🇫🇷' },
  { code: 'FI', name: '핀란드', flag: '🇫🇮' },
  { code: 'PH', name: '필리핀', flag: '🇵🇭' },
  { code: 'HK', name: '홍콩', flag: '🇭🇰' },
];

// 공통 검색 사이트 생성 함수
const createCommonSites = (googleDomain, ebayDomain, amazonDomain) => {
  const sites = [];

  // Google
  if (googleDomain) {
    sites.push({
      id: 'google',
      name: `Google${googleDomain !== 'google.com' ? '.' + googleDomain.replace('google.', '') : ''}`,
      url: `https://${googleDomain}/search?q={code}`,
      enabled: true,
      openMode: 'inApp',
      activationMode: 'product',
    });
  }

  // eBay
  if (ebayDomain) {
    sites.push({
      id: 'ebay',
      name: ebayDomain === 'ebay.com' ? 'eBay.com' : `eBay.${ebayDomain.replace('ebay.', '')}`,
      url: `https://www.${ebayDomain}/sch/i.html?_nkw={code}&mkcid=1&mkrid=711-53200-19255-0&campid=5338057533&toolid=20008&mkevt=1`,
      enabled: true,
      openMode: 'browser',
      activationMode: 'product',
    });
  }

  // Amazon
  if (amazonDomain) {
    sites.push({
      id: 'amazon',
      name: amazonDomain === 'amazon.com' ? 'Amazon.com' : `Amazon.${amazonDomain.replace('amazon.', '')}`,
      url: `https://www.${amazonDomain}/s/?keywords={code}&language=`,
      enabled: false,
      openMode: 'browser',
      activationMode: 'product',
    });
  }

  return sites;
};

// 국가별 검색 사이트 설정
const COUNTRY_SEARCH_SITES = {
  // 노르웨이
  NO: createCommonSites('google.no', 'ebay.com', 'amazon.com'),
  // 뉴질랜드
  NZ: createCommonSites('google.co.nz', 'ebay.com.au', 'amazon.com.au'),
  // 대한민국
  KR: [
    { id: 'google', name: 'Google', url: 'https://www.google.co.kr/search?q={code}', enabled: true, openMode: 'inApp', activationMode: 'product' },
    { id: 'naver', name: 'Naver 쇼핑', url: 'https://search.shopping.naver.com/search/all?query={code}', enabled: true, openMode: 'inApp', activationMode: 'product' },
    { id: 'coupang', name: '쿠팡', url: 'https://www.coupang.com/np/search?q={code}', enabled: true, openMode: 'browser', activationMode: 'product' },
    { id: 'gmarket', name: 'G마켓', url: 'https://browse.gmarket.co.kr/search?keyword={code}', enabled: false, openMode: 'browser', activationMode: 'product' },
    { id: 'auction', name: '옥션', url: 'https://browse.auction.co.kr/search?keyword={code}', enabled: false, openMode: 'browser', activationMode: 'product' },
  ],
  // 덴마크
  DK: createCommonSites('google.dk', 'ebay.com', 'amazon.de'),
  // 독일
  DE: createCommonSites('google.de', 'ebay.de', 'amazon.de'),
  // 러시아
  RU: createCommonSites('google.ru', 'ebay.com', null),
  // 룩셈부르크
  LU: createCommonSites('google.lu', 'ebay.fr', 'amazon.fr'),
  // 리히텐슈타인
  LI: createCommonSites('google.li', 'ebay.ch', 'amazon.de'),
  // 말레이시아
  MY: createCommonSites('google.com.my', 'ebay.com.my', 'amazon.com'),
  // 멕시코
  MX: createCommonSites('google.com.mx', 'ebay.com', 'amazon.com.mx'),
  // 모나코
  MC: createCommonSites('google.fr', 'ebay.fr', 'amazon.fr'),
  // 미국
  US: createCommonSites('google.com', 'ebay.com', 'amazon.com'),
  // 벨기에
  BE: createCommonSites('google.be', 'ebay.be', 'amazon.fr'),
  // 브라질
  BR: createCommonSites('google.com.br', 'ebay.com', 'amazon.com.br'),
  // 사우디아라비아
  SA: createCommonSites('google.com.sa', 'ebay.com', 'amazon.sa'),
  // 산마리노
  SM: createCommonSites('google.sm', 'ebay.it', 'amazon.it'),
  // 스웨덴
  SE: createCommonSites('google.se', 'ebay.com', 'amazon.se'),
  // 스위스
  CH: createCommonSites('google.ch', 'ebay.ch', 'amazon.de'),
  // 스페인
  ES: createCommonSites('google.es', 'ebay.es', 'amazon.es'),
  // 싱가포르
  SG: createCommonSites('google.com.sg', 'ebay.com.sg', 'amazon.sg'),
  // 아랍에미리트
  AE: createCommonSites('google.ae', 'ebay.com', 'amazon.ae'),
  // 아일랜드
  IE: createCommonSites('google.ie', 'ebay.ie', 'amazon.co.uk'),
  // 영국
  GB: createCommonSites('google.co.uk', 'ebay.co.uk', 'amazon.co.uk'),
  // 오스트레일리아
  AU: createCommonSites('google.com.au', 'ebay.com.au', 'amazon.com.au'),
  // 오스트리아
  AT: createCommonSites('google.at', 'ebay.at', 'amazon.de'),
  // 이집트
  EG: createCommonSites('google.com.eg', 'ebay.com', 'amazon.eg'),
  // 이탈리아
  IT: createCommonSites('google.it', 'ebay.it', 'amazon.it'),
  // 인도
  IN: createCommonSites('google.co.in', 'ebay.in', 'amazon.in'),
  // 일본
  JP: [
    { id: 'google', name: 'Google', url: 'https://www.google.co.jp/search?q={code}', enabled: true, openMode: 'inApp', activationMode: 'product' },
    { id: 'rakuten', name: '楽天市場', url: 'https://search.rakuten.co.jp/search/mall/{code}/', enabled: true, openMode: 'browser', activationMode: 'product' },
    { id: 'yahoo', name: 'Yahoo!ショッピング', url: 'https://shopping.yahoo.co.jp/search?p={code}', enabled: false, openMode: 'browser', activationMode: 'product' },
    { id: 'amazon', name: 'Amazon.co.jp', url: 'https://www.amazon.co.jp/s/?keywords={code}&language=', enabled: false, openMode: 'browser', activationMode: 'product' },
  ],
  // 중국 본토
  CN: [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={code}', enabled: true, openMode: 'inApp', activationMode: 'product' },
    { id: 'taobao', name: '淘宝', url: 'https://s.taobao.com/search?q={code}', enabled: true, openMode: 'browser', activationMode: 'product' },
    { id: 'jd', name: '京东', url: 'https://search.jd.com/Search?keyword={code}', enabled: false, openMode: 'browser', activationMode: 'product' },
  ],
  // 체코
  CZ: createCommonSites('google.cz', 'ebay.com', 'amazon.de'),
  // 캐나다
  CA: createCommonSites('google.ca', 'ebay.ca', 'amazon.ca'),
  // 튀르키예
  TR: createCommonSites('google.com.tr', 'ebay.com', 'amazon.com.tr'),
  // 포르투갈
  PT: createCommonSites('google.pt', 'ebay.com', 'amazon.es'),
  // 폴란드
  PL: createCommonSites('google.pl', 'ebay.pl', 'amazon.pl'),
  // 프랑스
  FR: createCommonSites('google.fr', 'ebay.fr', 'amazon.fr'),
  // 핀란드
  FI: createCommonSites('google.fi', 'ebay.com', 'amazon.de'),
  // 필리핀
  PH: createCommonSites('google.com.ph', 'ebay.ph', 'amazon.com'),
  // 홍콩
  HK: [
    { id: 'google', name: 'Google', url: 'https://www.google.com.hk/search?q={code}', enabled: true, openMode: 'inApp', activationMode: 'product' },
    { id: 'ebay', name: 'eBay.com.hk', url: 'https://www.ebay.com.hk/sch/i.html?_nkw={code}&mkcid=1&mkrid=711-53200-19255-0&campid=5338057533&toolid=20008&mkevt=1', enabled: true, openMode: 'browser', activationMode: 'product' },
    { id: 'amazon', name: 'Amazon.com', url: 'https://www.amazon.com/s/?keywords={code}&language=', enabled: false, openMode: 'browser', activationMode: 'product' },
  ],
};

// 국가별 기본 검색 사이트 가져오기
const getDefaultSearchSites = (countryCode) => {
  return COUNTRY_SEARCH_SITES[countryCode] || COUNTRY_SEARCH_SITES['US'];
};

// 기본 검색 사이트 (한국 기본값)
const DEFAULT_SEARCH_SITES = COUNTRY_SEARCH_SITES['KR'];

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
      const savedSitesJson = await AsyncStorage.getItem('productSearchSites');
      const savedCountry = await AsyncStorage.getItem('productSearchSitesCountry');

      if (autoSearch !== null) setAutoSearchEnabled(autoSearch === 'true');

      const currentCountry = country || 'KR';
      setSelectedCountry(currentCountry);

      // 저장된 사이트가 현재 국가의 것인지 확인
      if (savedSitesJson && savedCountry === currentCountry) {
        setSearchSites(JSON.parse(savedSitesJson));
      } else {
        // 국가별 기본 검색 사이트 로드
        const defaultSites = getDefaultSearchSites(currentCountry);
        setSearchSites(defaultSites);
      }
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

  const handleCountrySelect = async (countryCode) => {
    setSelectedCountry(countryCode);
    saveSettings('productSearchCountry', countryCode);

    // 국가 변경 시 해당 국가의 기본 검색 사이트로 변경
    const newSites = getDefaultSearchSites(countryCode);
    setSearchSites(newSites);
    await AsyncStorage.setItem('productSearchSites', JSON.stringify(newSites));
    await AsyncStorage.setItem('productSearchSitesCountry', countryCode);

    setShowCountryPicker(false);
  };

  const handleSiteToggle = async (siteId) => {
    const updatedSites = searchSites.map(site =>
      site.id === siteId ? { ...site, enabled: !site.enabled } : site
    );
    setSearchSites(updatedSites);
    await AsyncStorage.setItem('productSearchSites', JSON.stringify(updatedSites));
    await AsyncStorage.setItem('productSearchSitesCountry', selectedCountry);
  };

  const handleAddSite = async () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      Alert.alert(t('common.notice'), t('productSearch.enterNameAndUrl'));
      return;
    }

    if (!newSiteUrl.includes('{code}')) {
      Alert.alert(t('common.notice'), t('productSearch.includePlaceholder'));
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
    await AsyncStorage.setItem('productSearchSites', JSON.stringify(updatedSites));
    await AsyncStorage.setItem('productSearchSitesCountry', selectedCountry);
    setShowAddSiteModal(false);
    setNewSiteName('');
    setNewSiteUrl('');
  };

  const handleDeleteSite = (siteId) => {
    Alert.alert(
      t('productSearch.deleteConfirmTitle'),
      t('productSearch.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const updatedSites = searchSites.filter(site => site.id !== siteId);
            setSearchSites(updatedSites);
            await AsyncStorage.setItem('productSearchSites', JSON.stringify(updatedSites));
            await AsyncStorage.setItem('productSearchSitesCountry', selectedCountry);
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
          {t('productSearch.title')}
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
                {t('productSearch.autoProductSearch')}
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('productSearch.autoProductSearchDesc')}
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
            {t('productSearch.countrySettings')}
          </Text>
          <TouchableOpacity
            style={[styles.countrySelector, { borderColor: colors.border }]}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.countryFlag}>{selectedCountryData?.flag}</Text>
            <Text style={[styles.countryName, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t(`productSearch.countries.${selectedCountry}`)}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 검색 사이트 목록 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
              {t('productSearch.searchSites')}
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
                      {site.openMode === 'inApp' ? t('productSearch.inAppBrowser') : t('productSearch.defaultBrowser')}
                    </Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.background }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {site.activationMode === 'all' ? t('productSearch.allCodes') : t('productSearch.productCodes')}
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
      <Modal visible={showCountryPicker} animationType="slide" transparent onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                {t('productSearch.selectCountry')}
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
                    {t(`productSearch.countries.${country.code}`)}
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
      <Modal visible={showAddSiteModal} animationType="slide" transparent onRequestClose={() => setShowAddSiteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                {t('productSearch.addSearchSite')}
              </Text>
              <TouchableOpacity onPress={() => setShowAddSiteModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.addSiteForm}>
              <Text style={[styles.inputLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('productSearch.siteName')}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder={t('productSearch.siteNamePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={newSiteName}
                onChangeText={setNewSiteName}
              />
              <Text style={[styles.inputLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('productSearch.searchUrl')}
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
                {t('productSearch.urlHint')}
              </Text>
              <TouchableOpacity
                style={[styles.addSiteButton, { backgroundColor: colors.primary }]}
                onPress={handleAddSite}
              >
                <Text style={[styles.addSiteButtonText, { fontFamily: fonts.semiBold }]}>
                  {t('productSearch.add')}
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
