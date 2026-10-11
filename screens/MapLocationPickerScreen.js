// screens/MapLocationPickerScreen.js - 지도 위치 선택 화면
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import haptics from '../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// react-native-maps는 development build에서만 동작
let MapView = null;
let Marker = null;
let PROVIDER_GOOGLE = null;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  console.log('[MAP DEBUG] react-native-maps 로드 성공:', { MapView: !!MapView, Marker: !!Marker, PROVIDER_GOOGLE });
} catch (e) {
  console.log('[MAP DEBUG] react-native-maps 로드 실패:', e.message);
}

const SELECTED_LOCATION_KEY = '@selected_map_location';

// 기본 위치 (서울 시청)
const DEFAULT_LOCATION = {
  latitude: 37.5665,
  longitude: 126.9780,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapLocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const { t, fonts, language } = useLanguage();

  // 앱 언어를 Google API 언어 코드로 변환
  const getApiLanguage = () => {
    const langMap = {
      ko: 'ko',
      en: 'en',
      ja: 'ja',
      zh: 'zh-CN',
    };
    return langMap[language] || 'en';
  };
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const params = useLocalSearchParams();

  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // 상태
  const [region, setRegion] = useState(DEFAULT_LOCATION);
  const [markerPosition, setMarkerPosition] = useState({
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
  });
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // 초기 위치 설정 (파라미터로 전달된 경우)
  useEffect(() => {
    console.log('[MAP DEBUG] 컴포넌트 마운트됨');
    console.log('[MAP DEBUG] MapView 사용 가능:', !!MapView);
    console.log('[MAP DEBUG] params:', JSON.stringify(params));

    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude);
      const lng = parseFloat(params.longitude);
      console.log('[MAP DEBUG] 파라미터에서 위치 파싱:', { lat, lng });
      if (!isNaN(lat) && !isNaN(lng)) {
        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        setMarkerPosition({ latitude: lat, longitude: lng });
        reverseGeocode(lat, lng);
      }
    } else {
      // 현재 위치로 초기화
      console.log('[MAP DEBUG] 파라미터 없음, 현재 위치 가져오기');
      getCurrentLocation();
    }
  }, []);

  // 역지오코딩 (좌표 → 주소)
  const reverseGeocode = async (latitude, longitude) => {
    console.log('[MAP DEBUG] 역지오코딩 시작:', { latitude, longitude });
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      console.log('[MAP DEBUG] 역지오코딩 결과:', JSON.stringify(results, null, 2));
      if (results && results.length > 0) {
        const result = results[0];
        const addressParts = [];
        if (result.country) addressParts.push(result.country);
        if (result.region) addressParts.push(result.region);
        if (result.city) addressParts.push(result.city);
        if (result.district) addressParts.push(result.district);
        if (result.street) addressParts.push(result.street);
        if (result.streetNumber) addressParts.push(result.streetNumber);

        const formattedAddress = addressParts.join(' ') || result.name || '';
        console.log('[MAP DEBUG] 포맷된 주소:', formattedAddress);
        setAddress(formattedAddress);
      }
    } catch (error) {
      console.log('[MAP DEBUG] 역지오코딩 에러:', error.message, error);
    }
  };

  // Google Maps API Key
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBbUKvaAOEmB3EReIKjqchon5pGSKIW4mQ';

  // Google Maps Geocoding API를 사용한 주소 검색
  const searchAddress = async (query) => {
    console.log('[MAP DEBUG] 주소 검색 시작:', query);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchQuery = query.trim();
      const apiLanguage = getApiLanguage();

      // 현재 지도 중심 좌표를 기반으로 위치 편향 설정 (Google Maps 방식)
      const locationBias = `&location=${markerPosition.latitude},${markerPosition.longitude}&radius=50000`;

      // Google Places API (Text Search) 사용
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&language=${apiLanguage}${locationBias}&key=${GOOGLE_MAPS_API_KEY}`;
      console.log('[MAP DEBUG] Google Places API 호출, 언어:', apiLanguage, '위치:', markerPosition.latitude, markerPosition.longitude);

      const response = await fetch(placesUrl);
      const data = await response.json();
      console.log('[MAP DEBUG] Google Places 전체 응답:', JSON.stringify(data, null, 2));

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const results = data.results.slice(0, 5).map((place) => ({
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          displayAddress: place.formatted_address || place.name,
          name: place.name,
        }));
        console.log('[MAP DEBUG] 변환된 결과:', results.length);
        setSearchResults(results);
        setShowResults(true);
      } else {
        // Places API 실패 시 Geocoding API로 폴백
        console.log('[MAP DEBUG] Places 실패, Geocoding API 시도');
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&language=${apiLanguage}&key=${GOOGLE_MAPS_API_KEY}`;

        const geoResponse = await fetch(geocodeUrl);
        const geoData = await geoResponse.json();
        console.log('[MAP DEBUG] Geocoding 전체 응답:', JSON.stringify(geoData, null, 2));

        if (geoData.status === 'OK' && geoData.results && geoData.results.length > 0) {
          const results = geoData.results.slice(0, 5).map((result) => ({
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            displayAddress: result.formatted_address,
            name: result.formatted_address,
          }));
          setSearchResults(results);
          setShowResults(true);
        } else {
          setSearchResults([]);
          setShowResults(false);
          Alert.alert(
            t('map.noResults') || '검색 결과 없음',
            t('map.noResultsDesc') || '해당 주소를 찾을 수 없습니다. 다른 검색어를 시도해주세요.'
          );
        }
      }
    } catch (error) {
      console.log('[MAP DEBUG] 검색 에러:', error.message, error);
      Alert.alert('API 오류', `검색 중 오류가 발생했습니다: ${error.message}`);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 변경 시 디바운스 처리
  const handleSearchChange = (text) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAddress(text);
    }, 500);
  };

  // 검색 결과 선택
  const selectSearchResult = (result) => {
    const newRegion = {
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(newRegion);
    setMarkerPosition({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setAddress(result.displayAddress);
    setSearchQuery('');
    setShowResults(false);
    Keyboard.dismiss();

    // 지도 이동
    mapRef.current?.animateToRegion(newRegion, 500);

    // 햅틱 피드백
    haptics.tap();
  };

  // 현재 위치 가져오기
  const getCurrentLocation = async () => {
    console.log('[MAP DEBUG] 현재 위치 가져오기 시작');
    setIsLoadingLocation(true);
    try {
      console.log('[MAP DEBUG] 위치 권한 요청 중...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[MAP DEBUG] 위치 권한 상태:', status);
      if (status !== 'granted') {
        Alert.alert(
          t('common.error') || '오류',
          t('location.permissionDenied') || '위치 권한이 필요합니다.'
        );
        return;
      }

      console.log('[MAP DEBUG] 현재 위치 조회 중...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log('[MAP DEBUG] 현재 위치:', JSON.stringify(location.coords, null, 2));

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setRegion(newRegion);
      setMarkerPosition({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // 지도 이동
      console.log('[MAP DEBUG] 지도 이동, mapRef:', !!mapRef.current);
      mapRef.current?.animateToRegion(newRegion, 500);

      // 역지오코딩
      reverseGeocode(location.coords.latitude, location.coords.longitude);

      // 햅틱 피드백
      haptics.impact();
    } catch (error) {
      console.log('[MAP DEBUG] 현재 위치 에러:', error.message, error);
      Alert.alert(
        t('common.error') || '오류',
        t('location.fetchError') || '현재 위치를 가져올 수 없습니다.'
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // 마커 드래그 완료
  const handleMarkerDragEnd = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerPosition({ latitude, longitude });
    reverseGeocode(latitude, longitude);
    haptics.tap();
  };

  // 지도 탭 시 마커 이동
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerPosition({ latitude, longitude });
    reverseGeocode(latitude, longitude);
    haptics.tap();
  };

  // 위치 선택 확인
  const confirmLocation = async () => {
    try {
      // AsyncStorage에 선택된 위치 저장
      const locationData = {
        latitude: markerPosition.latitude.toFixed(6),
        longitude: markerPosition.longitude.toFixed(6),
        address: address,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(locationData));

      haptics.success();
      router.back();
    } catch (error) {
      console.log('Save location error:', error);
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 · 빈 자리 (확인은 아래 시트의 주 버튼) */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.headerButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('generator.selectLocation') || '위치 선택'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: searchFocused ? colors.primary : colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('map.searchPlaceholder') || '주소 검색...'}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            onSubmitEditing={() => searchAddress(searchQuery)}
          />
          {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => { setSearchQuery(''); setShowResults(false); }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {showResults && searchResults.length > 0 && (
          <ScrollView
            style={[styles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}
            keyboardShouldPersistTaps="handled"
          >
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.searchResultItem,
                  index < searchResults.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
                ]}
                onPress={() => selectSearchResult(result)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                <View style={styles.searchResultText}>
                  {result.name && result.name !== result.displayAddress && (
                    <Text style={[styles.searchResultName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                      {result.name}
                    </Text>
                  )}
                  <Text style={[styles.searchResultAddress, { color: result.name ? colors.textSecondary : colors.text, fontFamily: fonts.regular }]} numberOfLines={2}>
                    {result.displayAddress}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {MapView ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={region}
              onPress={handleMapPress}
              onMapReady={() => console.log('[MAP DEBUG] 지도 렌더링 완료!')}
              onRegionChangeComplete={(r) => {
                console.log('[MAP DEBUG] 지도 영역 변경:', r);
                // 지도 드래그 시 중앙 좌표로 업데이트
                setMarkerPosition({ latitude: r.latitude, longitude: r.longitude });
                reverseGeocode(r.latitude, r.longitude);
              }}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              mapType="standard"
            />

            {/* Current Location Button */}
            <TouchableOpacity
              style={[styles.currentLocationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={getCurrentLocation}
              activeOpacity={0.8}
              disabled={isLoadingLocation}
              accessibilityRole="button"
              accessibilityLabel={t('map.useCurrentLocation') || '현재 위치 사용'}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate" size={22} color={colors.primaryText} />
              )}
            </TouchableOpacity>

            {/* Center Pin */}
            <View style={styles.centerPinContainer} pointerEvents="none">
              <Ionicons name="location" size={40} color={colors.primary} />
            </View>
          </>
        ) : (
          /* Fallback when react-native-maps is not available */
          <View style={[styles.mapFallback, { backgroundColor: colors.background }]}>
            <Ionicons name="map-outline" size={56} color={colors.textTertiary} />
            <Text style={[styles.mapFallbackTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('map.requiresBuild') || 'Development Build 필요'}
            </Text>
            <Text style={[styles.mapFallbackText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('map.requiresBuildDesc') || '지도 기능을 사용하려면 Development Build가 필요합니다.\nExpo Go에서는 지원되지 않습니다.'}
            </Text>
            <TouchableOpacity
              style={[styles.fallbackLocateButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
              onPress={getCurrentLocation}
              activeOpacity={0.8}
              disabled={isLoadingLocation}
              accessibilityRole="button"
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate" size={20} color={colors.text} />
              )}
              <Text style={[styles.mapFallbackHint, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('map.useCurrentLocation') || '현재 위치 사용'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 하단 시트: 선택된 위치 + 확인 버튼 */}
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {t('map.selectedLocation') || '선택된 위치'}
        </Text>

        {address ? (
          <Text style={[styles.addressText, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={2}>
            {address}
          </Text>
        ) : null}

        <View style={[styles.coordsRow, { backgroundColor: colors.raised }]}>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('map.latitude') || '위도'}
            </Text>
            <Text style={[styles.coordValue, { color: colors.text }]} numberOfLines={1}>
              {markerPosition.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={[styles.coordDivider, { backgroundColor: colors.border }]} />
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('map.longitude') || '경도'}
            </Text>
            <Text style={[styles.coordValue, { color: colors.text }]} numberOfLines={1}>
              {markerPosition.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        <MaterialPressable
          onPress={confirmLocation}
          style={[styles.confirmButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={[styles.confirmText, { fontFamily: fonts.semiBold }]}>
            {t('common.confirm') || '확인'}
          </Text>
        </MaterialPressable>
      </View>
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: SPACE.screen,
    paddingBottom: 12,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    marginRight: -12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResults: {
    position: 'absolute',
    top: 54,
    left: SPACE.screen,
    right: SPACE.screen,
    maxHeight: 240,
    borderRadius: RADIUS.control,
    borderWidth: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  searchResultText: {
    flex: 1,
    gap: 2,
  },
  searchResultName: {
    ...TYPE.body,
  },
  searchResultAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    right: SPACE.screen,
    // 시트가 지도 아래를 둥근 모서리만큼 덮으므로 그만큼 올린다
    bottom: 16 + RADIUS.card,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    marginTop: -RADIUS.card,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: SPACE.card,
    paddingHorizontal: SPACE.card,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.control,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  coordItem: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  coordDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  coordValue: {
    fontSize: 15,
    fontFamily: MONO,
  },
  confirmButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 20 + RADIUS.card,
  },
  mapFallbackTitle: {
    fontSize: 17,
    marginTop: 16,
    textAlign: 'center',
  },
  mapFallbackText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  fallbackLocateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: SIZE.button,
    paddingHorizontal: 20,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    marginTop: 20,
  },
  mapFallbackHint: {
    fontSize: 15,
  },
});
