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
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
  const { t, fonts, language } = useLanguage();

  // 언어 코드를 Google API 파라미터로 변환
  const getGoogleApiParams = () => {
    const langMap = {
      ko: { language: 'ko', region: 'kr' },
      en: { language: 'en', region: '' },
      ja: { language: 'ja', region: 'jp' },
      zh: { language: 'zh-CN', region: 'cn' },
    };
    return langMap[language] || { language: 'en', region: '' };
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
      const apiParams = getGoogleApiParams();
      const regionParam = apiParams.region ? `&region=${apiParams.region}` : '';

      // Google Places API (Text Search) 사용
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&language=${apiParams.language}${regionParam}&key=${GOOGLE_MAPS_API_KEY}`;
      console.log('[MAP DEBUG] Google Places API 호출, 언어:', apiParams.language, '지역:', apiParams.region);

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
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&language=${apiParams.language}${regionParam}&key=${GOOGLE_MAPS_API_KEY}`;

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // 지도 탭 시 마커 이동
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerPosition({ latitude, longitude });
    reverseGeocode(latitude, longitude);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.log('Save location error:', error);
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {t('generator.selectLocation') || '위치 선택'}
        </Text>
        <TouchableOpacity
          onPress={confirmLocation}
          style={styles.confirmButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.confirmText, { color: colors.primary, fontFamily: fonts.semiBold }]}>
            {t('common.confirm') || '확인'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('map.searchPlaceholder') || '주소 검색...'}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            onSubmitEditing={() => searchAddress(searchQuery)}
          />
          {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setShowResults(false); }}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
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
                style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                onPress={() => selectSearchResult(result)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={20} color={colors.primary} />
                <View style={styles.searchResultText}>
                  {result.name && result.name !== result.displayAddress && (
                    <Text style={[styles.searchResultName, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
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
              region={region}
              onPress={handleMapPress}
              onMapReady={() => console.log('[MAP DEBUG] 지도 렌더링 완료!')}
              onRegionChangeComplete={(r) => console.log('[MAP DEBUG] 지도 영역 변경:', r)}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              mapType="standard"
            >
              <Marker
                coordinate={markerPosition}
                draggable
                onDragEnd={handleMarkerDragEnd}
                pinColor={colors.primary}
              />
            </MapView>

            {/* Current Location Button */}
            <TouchableOpacity
              style={[styles.currentLocationButton, { backgroundColor: colors.surface }]}
              onPress={getCurrentLocation}
              activeOpacity={0.8}
              disabled={isLoadingLocation}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            {/* Crosshair */}
            <View style={styles.crosshairContainer} pointerEvents="none">
              <View style={[styles.crosshairLine, styles.crosshairHorizontal, { backgroundColor: colors.primary }]} />
              <View style={[styles.crosshairLine, styles.crosshairVertical, { backgroundColor: colors.primary }]} />
            </View>
          </>
        ) : (
          /* Fallback when react-native-maps is not available */
          <View style={[styles.mapFallback, { backgroundColor: colors.surface }]}>
            <Ionicons name="map-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.mapFallbackTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('map.requiresBuild') || 'Development Build 필요'}
            </Text>
            <Text style={[styles.mapFallbackText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('map.requiresBuildDesc') || '지도 기능을 사용하려면 Development Build가 필요합니다.\nExpo Go에서는 지원되지 않습니다.'}
            </Text>
            <TouchableOpacity
              style={[styles.currentLocationButton, { backgroundColor: colors.primary, position: 'relative', marginTop: 20 }]}
              onPress={getCurrentLocation}
              activeOpacity={0.8}
              disabled={isLoadingLocation}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="locate" size={24} color="#fff" />
              )}
            </TouchableOpacity>
            <Text style={[styles.mapFallbackHint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('map.useCurrentLocation') || '현재 위치 사용'}
            </Text>
          </View>
        )}
      </View>

      {/* Coordinates Display */}
      <View style={[styles.coordsContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.coordsHeader}>
          <Ionicons name="pin" size={20} color={colors.primary} />
          <Text style={[styles.coordsTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('map.selectedLocation') || '선택된 위치'}
          </Text>
        </View>

        {address ? (
          <Text style={[styles.addressText, { color: colors.text, fontFamily: fonts.regular }]} numberOfLines={2}>
            {address}
          </Text>
        ) : null}

        <View style={styles.coordsRow}>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('map.latitude') || '위도'}
            </Text>
            <Text style={[styles.coordValue, { color: colors.text, fontFamily: fonts.medium }]}>
              {markerPosition.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={[styles.coordDivider, { backgroundColor: colors.border }]} />
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('map.longitude') || '경도'}
            </Text>
            <Text style={[styles.coordValue, { color: colors.text, fontFamily: fonts.medium }]}>
              {markerPosition.longitude.toFixed(6)}
            </Text>
          </View>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  confirmButton: {
    padding: 8,
    marginRight: -8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 12,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  searchResults: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  searchResultCoords: {
    fontSize: 12,
    marginTop: 2,
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
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  crosshairContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairLine: {
    position: 'absolute',
    opacity: 0.5,
  },
  crosshairHorizontal: {
    width: 30,
    height: 2,
  },
  crosshairVertical: {
    width: 2,
    height: 30,
  },
  coordsContainer: {
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  coordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordItem: {
    flex: 1,
    alignItems: 'center',
  },
  coordDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  coordLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  coordValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapFallbackTitle: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  mapFallbackText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  mapFallbackHint: {
    fontSize: 12,
    marginTop: 8,
  },
});
