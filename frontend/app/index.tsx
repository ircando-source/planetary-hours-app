import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const LOCATION_STORAGE_KEY = 'planetary_hours_location';
const SAVED_LOCATIONS_KEY = 'planetary_hours_saved_locations';

// Location type
interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
}

// Planet configuration
const PLANETS = {
  saturn: {
    name: 'Saturn',
    color: '#4B0082',
    symbol: '♄',
    vibration: 'Discipline & Structure',
    description: 'Time for focus, boundaries, karma work, meditation, and long-term planning. Ideal for serious commitments and spiritual discipline.',
    keywords: ['Responsibility', 'Patience', 'Wisdom', 'Limitation', 'Karma'],
  },
  jupiter: {
    name: 'Jupiter',
    color: '#1E3A5F',
    symbol: '♃',
    vibration: 'Expansion & Abundance',
    description: 'Time for growth, opportunities, luck, and prosperity. Ideal for business ventures, education, travel, and spiritual expansion.',
    keywords: ['Luck', 'Prosperity', 'Growth', 'Optimism', 'Wisdom'],
  },
  mars: {
    name: 'Mars',
    color: '#DC143C',
    symbol: '♂',
    vibration: 'Energy & Action',
    description: 'Time for courage, physical activity, competition, and assertiveness. Ideal for starting projects, workouts, and overcoming obstacles.',
    keywords: ['Courage', 'Strength', 'Passion', 'Drive', 'Willpower'],
  },
  sun: {
    name: 'Sun',
    color: '#FF8C00',
    symbol: '☉',
    vibration: 'Vitality & Success',
    description: 'Time for leadership, creativity, self-expression, and recognition. Ideal for important meetings, creative work, and personal power.',
    keywords: ['Leadership', 'Creativity', 'Joy', 'Confidence', 'Fame'],
  },
  venus: {
    name: 'Venus',
    color: '#FFD700',
    symbol: '♀',
    vibration: 'Love & Harmony',
    description: 'Time for relationships, beauty, art, and pleasure. Ideal for romance, socializing, artistic pursuits, and self-care.',
    keywords: ['Love', 'Beauty', 'Pleasure', 'Art', 'Harmony'],
  },
  mercury: {
    name: 'Mercury',
    color: '#8A2BE2',
    symbol: '☿',
    vibration: 'Communication & Intellect',
    description: 'Time for thinking, writing, speaking, and learning. Ideal for negotiations, studies, messages, and intellectual pursuits.',
    keywords: ['Communication', 'Learning', 'Travel', 'Logic', 'Adaptability'],
  },
  moon: {
    name: 'Moon',
    color: '#228B22',
    symbol: '☽',
    vibration: 'Intuition & Emotion',
    description: 'Time for introspection, dreams, psychic work, and nurturing. Ideal for emotional healing, family matters, and connecting with intuition.',
    keywords: ['Intuition', 'Dreams', 'Emotions', 'Nurturing', 'Cycles'],
  },
};

const PLANETARY_SEQUENCE = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

const DAY_RULERS: { [key: number]: string } = {
  0: 'sun', 1: 'moon', 2: 'mars', 3: 'mercury', 4: 'jupiter', 5: 'venus', 6: 'saturn',
};

// NOAA Solar Calculator Algorithm - High Precision Sunrise/Sunset
// Based on: https://gml.noaa.gov/grad/solcalc/calcdetails.html

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

// Calculate Julian Day from date
const getJulianDay = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const A = Math.floor((14 - month) / 12);
  const Y = year + 4800 - A;
  const M = month + 12 * A - 3;
  
  return day + Math.floor((153 * M + 2) / 5) + 365 * Y + Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
};

// Calculate Julian Century
const getJulianCentury = (julianDay: number): number => {
  return (julianDay - 2451545) / 36525;
};

// Calculate Geometric Mean Longitude of Sun (degrees)
const getGeomMeanLongSun = (T: number): number => {
  let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
  while (L0 > 360) L0 -= 360;
  while (L0 < 0) L0 += 360;
  return L0;
};

// Calculate Geometric Mean Anomaly of Sun (degrees)
const getGeomMeanAnomalySun = (T: number): number => {
  return 357.52911 + T * (35999.05029 - 0.0001537 * T);
};

// Calculate Eccentricity of Earth's Orbit
const getEccentricityEarthOrbit = (T: number): number => {
  return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
};

// Calculate Sun's Equation of Center
const getSunEqOfCenter = (T: number): number => {
  const M = getGeomMeanAnomalySun(T);
  const mrad = toRadians(M);
  const sinm = Math.sin(mrad);
  const sin2m = Math.sin(2 * mrad);
  const sin3m = Math.sin(3 * mrad);
  return sinm * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin2m * (0.019993 - 0.000101 * T) + sin3m * 0.000289;
};

// Calculate Sun's True Longitude (degrees)
const getSunTrueLong = (T: number): number => {
  return getGeomMeanLongSun(T) + getSunEqOfCenter(T);
};

// Calculate Sun's Apparent Longitude (degrees)
const getSunApparentLong = (T: number): number => {
  const O = getSunTrueLong(T);
  const omega = 125.04 - 1934.136 * T;
  return O - 0.00569 - 0.00478 * Math.sin(toRadians(omega));
};

// Calculate Mean Obliquity of Ecliptic (degrees)
const getMeanObliquityOfEcliptic = (T: number): number => {
  const seconds = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
};

// Calculate Obliquity Correction (degrees)
const getObliquityCorrection = (T: number): number => {
  const e0 = getMeanObliquityOfEcliptic(T);
  const omega = 125.04 - 1934.136 * T;
  return e0 + 0.00256 * Math.cos(toRadians(omega));
};

// Calculate Sun's Declination (degrees)
const getSunDeclination = (T: number): number => {
  const e = getObliquityCorrection(T);
  const lambda = getSunApparentLong(T);
  const sint = Math.sin(toRadians(e)) * Math.sin(toRadians(lambda));
  return toDegrees(Math.asin(sint));
};

// Calculate Equation of Time (minutes)
const getEquationOfTime = (T: number): number => {
  const epsilon = getObliquityCorrection(T);
  const L0 = getGeomMeanLongSun(T);
  const e = getEccentricityEarthOrbit(T);
  const M = getGeomMeanAnomalySun(T);
  
  let y = Math.tan(toRadians(epsilon / 2));
  y *= y;
  
  const sin2l0 = Math.sin(2 * toRadians(L0));
  const sinm = Math.sin(toRadians(M));
  const cos2l0 = Math.cos(2 * toRadians(L0));
  const sin4l0 = Math.sin(4 * toRadians(L0));
  const sin2m = Math.sin(2 * toRadians(M));
  
  const Etime = y * sin2l0 - 2 * e * sinm + 4 * e * y * sinm * cos2l0 - 0.5 * y * y * sin4l0 - 1.25 * e * e * sin2m;
  return toDegrees(Etime) * 4; // in minutes
};

// Calculate Hour Angle for sunrise/sunset (degrees)
const getHourAngleSunrise = (lat: number, solarDec: number, zenith: number): number => {
  const latRad = toRadians(lat);
  const sdRad = toRadians(solarDec);
  const zenithRad = toRadians(zenith);
  
  const hourAngle = Math.acos(
    (Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(sdRad))) - Math.tan(latRad) * Math.tan(sdRad)
  );
  
  return toDegrees(hourAngle);
};

// Calculate sunrise and sunset based on location using NOAA algorithm
const calculateSunTimes = (date: Date, latitude: number, longitude: number) => {
  // Official zenith for sunrise/sunset (90.833 degrees accounts for atmospheric refraction)
  const ZENITH = 90.833;
  
  const JD = getJulianDay(date);
  const T = getJulianCentury(JD);
  
  // Get equation of time and solar declination
  const eqTime = getEquationOfTime(T);
  const solarDec = getSunDeclination(T);
  
  // Get timezone offset in hours
  const timezoneOffset = -date.getTimezoneOffset() / 60;
  
  // Calculate hour angle for sunrise
  let hourAngle: number;
  try {
    hourAngle = getHourAngleSunrise(latitude, solarDec, ZENITH);
  } catch (e) {
    // Sun never rises or sets at this location on this date (polar regions)
    hourAngle = 90;
  }
  
  // Calculate solar noon (in minutes from midnight, local time)
  const solarNoonMinutes = 720 - 4 * longitude - eqTime + timezoneOffset * 60;
  
  // Calculate sunrise and sunset times (in minutes from midnight)
  const sunriseMinutes = solarNoonMinutes - hourAngle * 4;
  const sunsetMinutes = solarNoonMinutes + hourAngle * 4;
  
  // Convert to Date objects
  const sunrise = new Date(date);
  sunrise.setHours(0, 0, 0, 0);
  sunrise.setMinutes(Math.round(sunriseMinutes));
  
  const sunset = new Date(date);
  sunset.setHours(0, 0, 0, 0);
  sunset.setMinutes(Math.round(sunsetMinutes));
  
  return { sunrise, sunset };
};

// Calculate planetary hour - Algoritm precis bazat pe răsărit și apus
// Implementare conform codului Python: get_calcul_astral_precis
const calculatePlanetaryHour = (location: LocationData) => {
  const now = new Date();
  
  // Obține răsăritul și apusul pentru azi
  const todaySun = calculateSunTimes(now, location.latitude, location.longitude);
  const rasarit = todaySun.sunrise;
  const apus = todaySun.sunset;
  
  let durata: number;       // Durata unei ore planetare în ms
  let idx: number;          // Indexul orei curente (0-11)
  let prox: Date;           // Timpul următoarei schimbări
  let zi_ast: number;       // Ziua săptămânii pentru calcul
  let este_zi: boolean;     // Dacă e zi sau noapte
  
  if (now >= rasarit && now < apus) {
    // ZIUA: între răsărit și apus
    este_zi = true;
    durata = (apus.getTime() - rasarit.getTime()) / 12;
    idx = Math.floor((now.getTime() - rasarit.getTime()) / durata);
    idx = Math.min(idx, 11); // Limitează la max 11
    prox = new Date(rasarit.getTime() + durata * (idx + 1));
    zi_ast = now.getDay();
  } else {
    // NOAPTEA
    este_zi = false;
    
    if (now >= apus) {
      // După apus - calculăm până la răsăritul de mâine
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowSun = calculateSunTimes(tomorrow, location.latitude, location.longitude);
      
      durata = (tomorrowSun.sunrise.getTime() - apus.getTime()) / 12;
      idx = Math.floor((now.getTime() - apus.getTime()) / durata);
      idx = Math.min(idx, 11);
      prox = new Date(apus.getTime() + durata * (idx + 1));
      zi_ast = now.getDay();
    } else {
      // Înainte de răsărit - calculăm de la apusul de ieri
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdaySun = calculateSunTimes(yesterday, location.latitude, location.longitude);
      
      durata = (rasarit.getTime() - yesterdaySun.sunset.getTime()) / 12;
      idx = Math.floor((now.getTime() - yesterdaySun.sunset.getTime()) / durata);
      idx = Math.min(idx, 11);
      prox = new Date(yesterdaySun.sunset.getTime() + durata * (idx + 1));
      zi_ast = yesterday.getDay();
    }
  }
  
  // Planetele care guvernează prima oră a fiecărei zile
  // Duminică=0:Soare, Luni=1:Luna, Marți=2:Marte, etc.
  const PLANET_ZI: { [key: number]: string } = {
    0: 'sun',      // Duminică - Soare
    1: 'moon',     // Luni - Luna
    2: 'mars',     // Marți - Marte
    3: 'mercury',  // Miercuri - Mercur
    4: 'jupiter',  // Joi - Jupiter
    5: 'venus',    // Vineri - Venus
    6: 'saturn',   // Sâmbătă - Saturn
  };
  
  // Ordinea planetară (secvența Chaldeană)
  const ORDINE_PLANETE = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
  
  // Calculează indexul final al planetei
  const planetaZilei = PLANET_ZI[zi_ast];
  const startIdx = ORDINE_PLANETE.indexOf(planetaZilei);
  const offsetNoapte = este_zi ? 0 : 12;
  const idx_final = (startIdx + idx + offsetNoapte) % 7;
  
  const currentPlanet = ORDINE_PLANETE[idx_final];
  const nextPlanet = ORDINE_PLANETE[(idx_final + 1) % 7];
  const hourNumber = idx + 1;
  
  return {
    currentPlanet,
    nextPlanet,
    hourNumber,
    isDay: este_zi,
    nextHourTime: prox,
    timeUntilNext: prox.getTime() - now.getTime(),
    sunrise: rasarit,
    sunset: apus,
    hourDuration: durata, // Durata orei planetare în ms
  };
};

const formatTimeRemaining = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
};

const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const formatSunTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ============ LOCATION MENU MODAL ============
const LocationMenuModal = ({ 
  visible, 
  onClose, 
  savedLocations, 
  currentLocation,
  onSelectLocation, 
  onAddNew,
  onDeleteLocation,
}: { 
  visible: boolean;
  onClose: () => void;
  savedLocations: LocationData[];
  currentLocation: LocationData | null;
  onSelectLocation: (loc: LocationData) => void;
  onAddNew: () => void;
  onDeleteLocation: (loc: LocationData) => void;
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Saved Locations</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={modalStyles.scrollView}>
            {savedLocations.length === 0 ? (
              <View style={modalStyles.emptyState}>
                <Ionicons name="location-outline" size={48} color="#666" />
                <Text style={modalStyles.emptyText}>No saved locations yet</Text>
              </View>
            ) : (
              savedLocations.map((loc, index) => {
                const isActive = currentLocation && 
                  loc.latitude === currentLocation.latitude && 
                  loc.longitude === currentLocation.longitude;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[modalStyles.locationItem, isActive && modalStyles.locationItemActive]}
                    onPress={() => onSelectLocation(loc)}
                  >
                    <View style={modalStyles.locationInfo}>
                      <View style={modalStyles.locationNameRow}>
                        {isActive && (
                          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginRight: 8 }} />
                        )}
                        <Text style={[modalStyles.locationName, isActive && modalStyles.locationNameActive]}>
                          {loc.name}
                        </Text>
                      </View>
                      <Text style={modalStyles.locationCoords}>
                        {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={modalStyles.deleteButton}
                      onPress={() => onDeleteLocation(loc)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          
          <TouchableOpacity style={modalStyles.addButton} onPress={onAddNew}>
            <Ionicons name="add-circle-outline" size={24} color="#FFD700" />
            <Text style={modalStyles.addButtonText}>Add New Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: 400,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  locationItemActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  locationInfo: {
    flex: 1,
  },
  locationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  locationNameActive: {
    color: '#4CAF50',
  },
  locationCoords: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

// ============ ADD LOCATION SCREEN ============
const AddLocationScreen = ({ 
  onLocationAdded, 
  onCancel 
}: { 
  onLocationAdded: (loc: LocationData) => void;
  onCancel: () => void;
}) => {
  const [mode, setMode] = useState<'menu' | 'gps' | 'search' | 'manual'>('menu');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationName, setLocationName] = useState('');

  const handleGPSLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      let name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
          name = address.city || address.region || address.country || name;
        }
      } catch (e) {}

      onLocationAdded({ latitude, longitude, name });
    } catch (error) {
      Alert.alert('Error', 'Failed to get GPS location.');
    }
    setLoading(false);
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a location name.');
      return;
    }

    setLoading(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        onLocationAdded({ latitude, longitude, name: searchQuery.trim() });
      } else {
        Alert.alert('Not Found', 'Location not found. Try coordinates instead.');
      }
    } catch (error) {
      Alert.alert('Error', 'Search failed.');
    }
    setLoading(false);
  };

  const handleManualEntry = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Error', 'Please enter valid coordinates.');
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      Alert.alert('Error', 'Invalid coordinate range.');
      return;
    }

    const name = locationName.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    onLocationAdded({ latitude: lat, longitude: lon, name });
  };

  if (loading) {
    return (
      <View style={addStyles.container}>
        <View style={addStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={addStyles.loadingText}>Getting location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={addStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <SafeAreaView style={addStyles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={addStyles.scrollContent} keyboardShouldPersistTaps="handled">
            
            {/* Back Button */}
            <TouchableOpacity style={addStyles.backButton} onPress={onCancel}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
              <Text style={addStyles.backText}>Back to Locations</Text>
            </TouchableOpacity>

            {mode === 'menu' && (
              <>
                <View style={addStyles.header}>
                  <Ionicons name="add-circle-outline" size={60} color="#FFD700" />
                  <Text style={addStyles.title}>Add Location</Text>
                  <Text style={addStyles.subtitle}>Choose how to add your location</Text>
                </View>

                <View style={addStyles.menuContainer}>
                  <TouchableOpacity style={addStyles.menuButton} onPress={handleGPSLocation}>
                    <Ionicons name="locate-outline" size={28} color="#fff" />
                    <View style={addStyles.menuTextContainer}>
                      <Text style={addStyles.menuButtonTitle}>Use GPS</Text>
                      <Text style={addStyles.menuButtonSubtitle}>Detect current position</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#888" />
                  </TouchableOpacity>

                  <TouchableOpacity style={addStyles.menuButton} onPress={() => setMode('search')}>
                    <Ionicons name="search-outline" size={28} color="#fff" />
                    <View style={addStyles.menuTextContainer}>
                      <Text style={addStyles.menuButtonTitle}>Search City</Text>
                      <Text style={addStyles.menuButtonSubtitle}>Find by name</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#888" />
                  </TouchableOpacity>

                  <TouchableOpacity style={addStyles.menuButton} onPress={() => setMode('manual')}>
                    <Ionicons name="keypad-outline" size={28} color="#fff" />
                    <View style={addStyles.menuTextContainer}>
                      <Text style={addStyles.menuButtonTitle}>Enter Coordinates</Text>
                      <Text style={addStyles.menuButtonSubtitle}>Input lat/long manually</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {mode === 'search' && (
              <>
                <TouchableOpacity style={addStyles.modeBackButton} onPress={() => setMode('menu')}>
                  <Ionicons name="arrow-back" size={20} color="#FFD700" />
                  <Text style={addStyles.modeBackText}>Back</Text>
                </TouchableOpacity>

                <View style={addStyles.inputSection}>
                  <Ionicons name="search-outline" size={50} color="#FFD700" />
                  <Text style={addStyles.inputTitle}>Search Location</Text>
                  <TextInput
                    style={addStyles.textInput}
                    placeholder="e.g., Galați, Romania"
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  <TouchableOpacity style={addStyles.submitButton} onPress={handleSearchLocation}>
                    <Text style={addStyles.submitButtonText}>Search</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {mode === 'manual' && (
              <>
                <TouchableOpacity style={addStyles.modeBackButton} onPress={() => setMode('menu')}>
                  <Ionicons name="arrow-back" size={20} color="#FFD700" />
                  <Text style={addStyles.modeBackText}>Back</Text>
                </TouchableOpacity>

                <View style={addStyles.inputSection}>
                  <Ionicons name="keypad-outline" size={50} color="#FFD700" />
                  <Text style={addStyles.inputTitle}>Enter Coordinates</Text>
                  <TextInput
                    style={addStyles.textInput}
                    placeholder="Location name (e.g., Galați)"
                    placeholderTextColor="#888"
                    value={locationName}
                    onChangeText={setLocationName}
                  />
                  <TextInput
                    style={addStyles.textInput}
                    placeholder="Latitude (e.g., 45.4353)"
                    placeholderTextColor="#888"
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={addStyles.textInput}
                    placeholder="Longitude (e.g., 28.0080)"
                    placeholderTextColor="#888"
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={addStyles.submitButton} onPress={handleManualEntry}>
                    <Text style={addStyles.submitButtonText}>Add Location</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const addStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { color: '#fff', fontSize: 16, marginLeft: 8 },
  header: { alignItems: 'center', paddingVertical: 30 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#aaa', marginTop: 6 },
  menuContainer: { marginTop: 10 },
  menuButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  menuTextContainer: { flex: 1, marginLeft: 14 },
  menuButtonTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  menuButtonSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  modeBackButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modeBackText: { color: '#FFD700', fontSize: 14, marginLeft: 6 },
  inputSection: { alignItems: 'center', paddingTop: 10 },
  inputTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 16, marginBottom: 24 },
  textInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 16, fontSize: 16, color: '#fff', marginBottom: 14,
  },
  submitButton: { backgroundColor: '#FFD700', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 50, marginTop: 10 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
});

// ============ MAIN PLANETARY HOURS SCREEN ============
const PlanetaryHoursScreen = ({ 
  location, 
  onOpenLocationMenu 
}: { 
  location: LocationData; 
  onOpenLocationMenu: () => void;
}) => {
  const [planetaryHour, setPlanetaryHour] = useState(calculatePlanetaryHour(location));
  const [currentTime, setCurrentTime] = useState(new Date());
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [prevPlanet, setPrevPlanet] = useState(planetaryHour.currentPlanet);

  useEffect(() => {
    const interval = setInterval(() => {
      const newHour = calculatePlanetaryHour(location);
      setCurrentTime(new Date());
      
      if (newHour.currentPlanet !== prevPlanet) {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.8, duration: 500, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]),
        ]).start();
        setPrevPlanet(newHour.currentPlanet);
      }
      
      setPlanetaryHour(newHour);
    }, 1000);

    return () => clearInterval(interval);
  }, [prevPlanet, fadeAnim, scaleAnim, location]);

  const currentPlanetData = PLANETS[planetaryHour.currentPlanet as keyof typeof PLANETS];
  const nextPlanetData = PLANETS[planetaryHour.nextPlanet as keyof typeof PLANETS];
  const isLightBackground = ['venus', 'sun'].includes(planetaryHour.currentPlanet);
  const textColor = isLightBackground ? '#1a1a1a' : '#ffffff';
  const subTextColor = isLightBackground ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';

  return (
    <View style={[mainStyles.container, { backgroundColor: currentPlanetData.color }]}>
      <StatusBar barStyle={isLightBackground ? 'dark-content' : 'light-content'} backgroundColor={currentPlanetData.color} />
      <SafeAreaView style={mainStyles.safeArea}>
        <ScrollView style={mainStyles.scrollView} contentContainerStyle={mainStyles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[mainStyles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            
            {/* Location Header - Tap to open menu */}
            <TouchableOpacity style={mainStyles.locationHeader} onPress={onOpenLocationMenu}>
              <Ionicons name="location" size={16} color={subTextColor} />
              <Text style={[mainStyles.locationText, { color: subTextColor }]}>{location.name}</Text>
              <Ionicons name="chevron-down" size={16} color={subTextColor} />
            </TouchableOpacity>

            {/* Time Header */}
            <View style={mainStyles.header}>
              <Text style={[mainStyles.timeText, { color: subTextColor }]}>{formatTime(currentTime)}</Text>
              <Text style={[mainStyles.dayNightText, { color: subTextColor }]}>
                {planetaryHour.isDay ? 'Day Hours' : 'Night Hours'}
              </Text>
              <View style={mainStyles.sunTimesRow}>
                <View style={mainStyles.sunTimeItem}>
                  <Ionicons name="sunny-outline" size={14} color={subTextColor} />
                  <Text style={[mainStyles.sunTimeText, { color: subTextColor }]}>{formatSunTime(planetaryHour.sunrise)}</Text>
                </View>
                <View style={mainStyles.sunTimeItem}>
                  <Ionicons name="moon-outline" size={14} color={subTextColor} />
                  <Text style={[mainStyles.sunTimeText, { color: subTextColor }]}>{formatSunTime(planetaryHour.sunset)}</Text>
                </View>
              </View>
            </View>

            {/* Main Planet Display */}
            <View style={mainStyles.mainContent}>
              <View style={mainStyles.iconContainer}>
                <Text style={[mainStyles.astroSymbol, { color: textColor }]}>{currentPlanetData.symbol}</Text>
              </View>
              
              <Text style={[mainStyles.planetName, { color: textColor }]}>{currentPlanetData.name}</Text>
              <Text style={[mainStyles.vibrationText, { color: textColor }]}>{currentPlanetData.vibration}</Text>
              <Text style={[mainStyles.hourLabel, { color: subTextColor }]}>
                Planetary Hour {planetaryHour.hourNumber} of {planetaryHour.isDay ? 'Day' : 'Night'}
              </Text>

              <View style={[mainStyles.vibrationCard, { backgroundColor: isLightBackground ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
                <Text style={[mainStyles.vibrationDescription, { color: subTextColor }]}>{currentPlanetData.description}</Text>
                <View style={mainStyles.keywordsContainer}>
                  {currentPlanetData.keywords.map((keyword, index) => (
                    <View key={index} style={[mainStyles.keywordBadge, { backgroundColor: isLightBackground ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)' }]}>
                      <Text style={[mainStyles.keywordText, { color: textColor }]}>{keyword}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Timer Section */}
            <View style={mainStyles.timerSection}>
              <View style={[mainStyles.timerCard, { backgroundColor: isLightBackground ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
                <Text style={[mainStyles.timerLabel, { color: subTextColor }]}>Time until next hour</Text>
                <Text style={[mainStyles.timerValue, { color: textColor }]}>{formatTimeRemaining(planetaryHour.timeUntilNext)}</Text>
                <View style={mainStyles.nextPlanetRow}>
                  <Text style={[mainStyles.nextLabel, { color: subTextColor }]}>Next:</Text>
                  <View style={[mainStyles.nextPlanetBadge, { backgroundColor: nextPlanetData.color }]}>
                    <Text style={mainStyles.nextPlanetSymbol}>{nextPlanetData.symbol}</Text>
                    <Text style={mainStyles.nextPlanetName}>{nextPlanetData.name}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Planet Legend */}
            <View style={mainStyles.legendSection}>
              <View style={mainStyles.legendRow}>
                {PLANETARY_SEQUENCE.map((planet) => {
                  const planetData = PLANETS[planet as keyof typeof PLANETS];
                  const isActive = planet === planetaryHour.currentPlanet;
                  return (
                    <View key={planet} style={[mainStyles.legendItem, isActive && mainStyles.legendItemActive]}>
                      <Text style={[mainStyles.legendSymbol, { color: isActive ? textColor : subTextColor }]}>
                        {planetData.symbol}
                      </Text>
                      <Text style={[mainStyles.legendText, { color: subTextColor }, isActive && { color: textColor, fontWeight: '700' }]}>
                        {planetData.name.substring(0, 3)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const mainStyles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10, gap: 6 },
  locationText: { fontSize: 14, fontWeight: '600' },
  header: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  timeText: { fontSize: 18, fontWeight: '600', letterSpacing: 1 },
  dayNightText: { fontSize: 14, marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 },
  sunTimesRow: { flexDirection: 'row', marginTop: 8, gap: 20 },
  sunTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sunTimeText: { fontSize: 12 },
  mainContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconContainer: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  astroSymbol: { fontSize: 80, fontWeight: '300' },
  planetName: { fontSize: 40, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  vibrationText: { fontSize: 20, fontWeight: '600', marginTop: 8, letterSpacing: 1, fontStyle: 'italic' },
  hourLabel: { fontSize: 14, marginTop: 4, letterSpacing: 1 },
  vibrationCard: { marginTop: 20, borderRadius: 16, padding: 16, marginHorizontal: 10, width: '100%' },
  vibrationDescription: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  keywordsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  keywordBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  keywordText: { fontSize: 12, fontWeight: '600' },
  timerSection: { paddingBottom: 20 },
  timerCard: { borderRadius: 20, padding: 20, alignItems: 'center' },
  timerLabel: { fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  timerValue: { fontSize: 36, fontWeight: '700', letterSpacing: 2 },
  nextPlanetRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  nextLabel: { fontSize: 14, marginRight: 8 },
  nextPlanetBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  nextPlanetSymbol: { color: '#fff', fontSize: 18 },
  nextPlanetName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  legendSection: { paddingBottom: 20 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 },
  legendItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, minWidth: 44 },
  legendItemActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  legendSymbol: { fontSize: 20, marginBottom: 2 },
  legendText: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
});

// ============ MAIN APP ============
export default function PlanetaryHoursApp() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [savedCurrent, savedList] = await Promise.all([
        AsyncStorage.getItem(LOCATION_STORAGE_KEY),
        AsyncStorage.getItem(SAVED_LOCATIONS_KEY),
      ]);
      
      if (savedList) {
        setSavedLocations(JSON.parse(savedList));
      }
      if (savedCurrent) {
        setCurrentLocation(JSON.parse(savedCurrent));
      }
    } catch (error) {
      console.log('Error loading data:', error);
    }
    setLoading(false);
  };

  const saveLocations = async (locations: LocationData[]) => {
    await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
    setSavedLocations(locations);
  };

  const saveCurrentLocation = async (location: LocationData) => {
    await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
    setCurrentLocation(location);
  };

  const handleSelectLocation = async (location: LocationData) => {
    await saveCurrentLocation(location);
    setShowLocationMenu(false);
  };

  const handleAddLocation = async (location: LocationData) => {
    // Check if already exists
    const exists = savedLocations.some(
      loc => loc.latitude === location.latitude && loc.longitude === location.longitude
    );
    
    if (!exists) {
      const newList = [...savedLocations, location];
      await saveLocations(newList);
    }
    
    await saveCurrentLocation(location);
    setShowAddLocation(false);
    setShowLocationMenu(false);
  };

  const handleDeleteLocation = async (location: LocationData) => {
    Alert.alert(
      'Delete Location',
      `Remove "${location.name}" from saved locations?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const newList = savedLocations.filter(
              loc => !(loc.latitude === location.latitude && loc.longitude === location.longitude)
            );
            await saveLocations(newList);
            
            // If deleted location is current, clear current
            if (currentLocation && 
                currentLocation.latitude === location.latitude && 
                currentLocation.longitude === location.longitude) {
              await AsyncStorage.removeItem(LOCATION_STORAGE_KEY);
              setCurrentLocation(newList.length > 0 ? newList[0] : null);
              if (newList.length > 0) {
                await saveCurrentLocation(newList[0]);
              }
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  // Show add location screen
  if (showAddLocation) {
    return (
      <AddLocationScreen
        onLocationAdded={handleAddLocation}
        onCancel={() => setShowAddLocation(false)}
      />
    );
  }

  // No location set - show add location
  if (!currentLocation) {
    return (
      <AddLocationScreen
        onLocationAdded={handleAddLocation}
        onCancel={() => {}}
      />
    );
  }

  return (
    <>
      <PlanetaryHoursScreen
        location={currentLocation}
        onOpenLocationMenu={() => setShowLocationMenu(true)}
      />
      <LocationMenuModal
        visible={showLocationMenu}
        onClose={() => setShowLocationMenu(false)}
        savedLocations={savedLocations}
        currentLocation={currentLocation}
        onSelectLocation={handleSelectLocation}
        onAddNew={() => {
          setShowLocationMenu(false);
          setShowAddLocation(true);
        }}
        onDeleteLocation={handleDeleteLocation}
      />
    </>
  );
}
