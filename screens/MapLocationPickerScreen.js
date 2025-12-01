// screens/MapLocationPickerScreen.js - Map location picker with Expo Maps
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function MapLocationPickerScreen() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const params = useLocalSearchParams();

  const [hapticEnabled, setHapticEnabled] = useState(false);
  const [markerLocation, setMarkerLocation] = useState({
    latitude: params.latitude ? parseFloat(params.latitude) : 37.5665,
    longitude: params.longitude ? parseFloat(params.longitude) : 126.9780,
  });
  const [latitudeInput, setLatitudeInput] = useState(
    params.latitude || '37.5665'
  );
  const [longitudeInput, setLongitudeInput] = useState(
    params.longitude || '126.9780'
  );
  const [cameraPosition, setCameraPosition] = useState({
    coordinates: {
      latitude: params.latitude ? parseFloat(params.latitude) : 37.5665,
      longitude: params.longitude ? parseFloat(params.longitude) : 126.9780,
    },
    zoom: 15,
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const haptic = await AsyncStorage.getItem('hapticEnabled');
        setHapticEnabled(haptic === 'true');
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Update marker when inputs change
  const handleLatitudeChange = (text) => {
    setLatitudeInput(text);
    const lat = parseFloat(text);
    if (!isNaN(lat) && lat >= -90 && lat <= 90) {
      const newLocation = { ...markerLocation, latitude: lat };
      setMarkerLocation(newLocation);
      updateCamera(newLocation);
    }
  };

  const handleLongitudeChange = (text) => {
    setLongitudeInput(text);
    const lng = parseFloat(text);
    if (!isNaN(lng) && lng >= -180 && lng <= 180) {
      const newLocation = { ...markerLocation, longitude: lng };
      setMarkerLocation(newLocation);
      updateCamera(newLocation);
    }
  };

  const updateCamera = (coordinates) => {
    const newCameraPosition = {
      coordinates,
      zoom: cameraPosition.zoom || 15,
    };
    setCameraPosition(newCameraPosition);

    if (mapRef.current?.setCameraPosition) {
      mapRef.current.setCameraPosition({
        ...newCameraPosition,
        duration: 500,
      });
    }
  };

  // Handle map click to update marker position
  const handleMapClick = async (event) => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const { coordinates } = event;
    setMarkerLocation(coordinates);
    setLatitudeInput(coordinates.latitude.toFixed(6));
    setLongitudeInput(coordinates.longitude.toFixed(6));
  };

  // Get current location
  const handleGetCurrentLocation = async () => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsLoadingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          t('common.error'),
          'Location permission is required to get your current location'
        );
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = currentLocation.coords;
      const newLocation = { latitude, longitude };

      setMarkerLocation(newLocation);
      setLatitudeInput(latitude.toFixed(6));
      setLongitudeInput(longitude.toFixed(6));

      updateCamera(newLocation);

      if (hapticEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        t('common.error'),
        'Failed to get current location. Please try again.'
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Save location and go back
  const handleSave = async () => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Validate coordinates
    const lat = parseFloat(latitudeInput);
    const lng = parseFloat(longitudeInput);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert(t('common.error'), 'Latitude must be between -90 and 90');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert(t('common.error'), 'Longitude must be between -180 and 180');
      return;
    }

    // Store the selected location for the generator screen to pick up
    await AsyncStorage.setItem('selectedLocation', JSON.stringify({
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));

    // Navigate back
    router.back();
  };

  // Render the appropriate map based on platform
  const renderMap = () => {
    const markers = [
      {
        id: 'selected-location',
        coordinates: markerLocation,
        title: t('generator.selectedLocation') || 'Selected Location',
      },
    ];

    const commonProps = {
      ref: mapRef,
      style: s.map,
      cameraPosition: cameraPosition,
      markers: markers,
      onMapClick: handleMapClick,
      onCameraMove: (event) => {
        setCameraPosition({
          coordinates: event.coordinates,
          zoom: event.zoom,
        });
      },
      properties: {
        isMyLocationEnabled: true,
      },
      uiSettings: {
        myLocationButtonEnabled: false, // We'll use our custom button
        compassEnabled: true,
        scaleBarEnabled: true,
      },
    };

    if (Platform.OS === 'ios') {
      return <AppleMaps.View {...commonProps} />;
    } else if (Platform.OS === 'android') {
      return (
        <GoogleMaps.View
          {...commonProps}
          colorScheme={isDark ? 'DARK' : 'LIGHT'}
        />
      );
    } else {
      return (
        <View style={[s.map, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text>Maps are only available on Android and iOS</Text>
        </View>
      );
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          {t('generator.selectLocation') || 'Select Location'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[s.saveButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={s.saveButtonText}>
            {t('common.save') || 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Coordinate Inputs */}
      <View style={[s.inputsContainer, { backgroundColor: colors.surface }]}>
        <View style={s.inputWrapper}>
          <Text style={[s.inputLabel, { color: colors.textSecondary }]}>
            {t('generator.fields.latitudeLabel') || 'Latitude'}
          </Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={latitudeInput}
            onChangeText={handleLatitudeChange}
            keyboardType="numeric"
            placeholder="37.5665"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={s.inputWrapper}>
          <Text style={[s.inputLabel, { color: colors.textSecondary }]}>
            {t('generator.fields.longitudeLabel') || 'Longitude'}
          </Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={longitudeInput}
            onChangeText={handleLongitudeChange}
            keyboardType="numeric"
            placeholder="126.9780"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      {/* Map */}
      <View style={s.mapContainer}>
        {renderMap()}

        {/* Current Location Button */}
        <TouchableOpacity
          style={[s.currentLocationButton, { backgroundColor: colors.surface }]}
          onPress={handleGetCurrentLocation}
          activeOpacity={0.8}
          disabled={isLoadingLocation}
        >
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={[s.instructionsContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={[s.instructionsText, { color: colors.textSecondary }]}>
          {t('generator.mapInstructions') || 'Tap on the map or enter coordinates to select a location'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  inputsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: '500',
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
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
