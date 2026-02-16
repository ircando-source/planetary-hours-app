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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for location
const LOCATION_STORAGE_KEY = 'planetary_hours_location';

// Location type
interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
}

// Planet configuration with colors, symbols, and vibrations
const PLANETS = {
  saturn: {
    name: 'Saturn',
    color: '#4B0082',
    symbol: 'planet-outline',
    vibration: 'Discipline & Structure',
    description: 'Time for focus, boundaries, karma work, meditation, and long-term planning. Ideal for serious commitments and spiritual discipline.',
    keywords: ['Responsibility', 'Patience', 'Wisdom', 'Limitation', 'Karma'],
  },
  jupiter: {
    name: 'Jupiter',
    color: '#1E3A5F',
    symbol: 'planet-outline',
    vibration: 'Expansion & Abundance',
    description: 'Time for growth, opportunities, luck, and prosperity. Ideal for business ventures, education, travel, and spiritual expansion.',
    keywords: ['Luck', 'Prosperity', 'Growth', 'Optimism', 'Wisdom'],
  },
  mars: {
    name: 'Mars',
    color: '#DC143C',
    symbol: 'flame-outline',
    vibration: 'Energy & Action',
    description: 'Time for courage, physical activity, competition, and assertiveness. Ideal for starting projects, workouts, and overcoming obstacles.',
    keywords: ['Courage', 'Strength', 'Passion', 'Drive', 'Willpower'],
  },
  sun: {
    name: 'Sun',
    color: '#FF8C00',
    symbol: 'sunny-outline',
    vibration: 'Vitality & Success',
    description: 'Time for leadership, creativity, self-expression, and recognition. Ideal for important meetings, creative work, and personal power.',
    keywords: ['Leadership', 'Creativity', 'Joy', 'Confidence', 'Fame'],
  },
  venus: {
    name: 'Venus',
    color: '#FFD700',
    symbol: 'heart-outline',
    vibration: 'Love & Harmony',
    description: 'Time for relationships, beauty, art, and pleasure. Ideal for romance, socializing, artistic pursuits, and self-care.',
    keywords: ['Love', 'Beauty', 'Pleasure', 'Art', 'Harmony'],
  },
  mercury: {
    name: 'Mercury',
    color: '#8A2BE2',
    symbol: 'flash-outline',
    vibration: 'Communication & Intellect',
    description: 'Time for thinking, writing, speaking, and learning. Ideal for negotiations, studies, messages, and intellectual pursuits.',
    keywords: ['Communication', 'Learning', 'Travel', 'Logic', 'Adaptability'],
  },
  moon: {
    name: 'Moon',
    color: '#228B22',
    symbol: 'moon-outline',
    vibration: 'Intuition & Emotion',
    description: 'Time for introspection, dreams, psychic work, and nurturing. Ideal for emotional healing, family matters, and connecting with intuition.',
    keywords: ['Intuition', 'Dreams', 'Emotions', 'Nurturing', 'Cycles'],
  },
};

const PLANETARY_SEQUENCE = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

const DAY_RULERS: { [key: number]: string } = {
  0: 'sun', 1: 'moon', 2: 'mars', 3: 'mercury', 4: 'jupiter', 5: 'venus', 6: 'saturn',
};

// Calculate sunrise and sunset based on location
const calculateSunTimes = (date: Date, latitude: number, longitude: number) => {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  
  // Solar declination
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
  
  // Hour angle
  const latRad = latitude * Math.PI / 180;
  const decRad = declination * Math.PI / 180;
  
  let cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
  cosHourAngle = Math.max(-1, Math.min(1, cosHourAngle));
  
  const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
  
  // Solar noon (in hours, UTC)
  const solarNoon = 12 - longitude / 15;
  
  // Sunrise and sunset times (UTC)
  const sunriseUTC = solarNoon - hourAngle / 15;
  const sunsetUTC = solarNoon + hourAngle / 15;
  
  // Convert to local time
  const timezoneOffset = -date.getTimezoneOffset() / 60;
  const sunriseLocal = sunriseUTC + timezoneOffset;
  const sunsetLocal = sunsetUTC + timezoneOffset;
  
  // Create Date objects
  const sunrise = new Date(date);
  sunrise.setHours(Math.floor(sunriseLocal), Math.round((sunriseLocal % 1) * 60), 0, 0);
  
  const sunset = new Date(date);
  sunset.setHours(Math.floor(sunsetLocal), Math.round((sunsetLocal % 1) * 60), 0, 0);
  
  return { sunrise, sunset };
};

// Calculate planetary hour
const calculatePlanetaryHour = (location: LocationData) => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const { sunrise, sunset } = calculateSunTimes(now, location.latitude, location.longitude);
  
  const isDay = now >= sunrise && now < sunset;
  
  const dayLengthMs = sunset.getTime() - sunrise.getTime();
  const nightLengthMs = 24 * 60 * 60 * 1000 - dayLengthMs;
  const dayHourLength = dayLengthMs / 12;
  const nightHourLength = nightLengthMs / 12;
  
  const dayRuler = DAY_RULERS[dayOfWeek];
  const startIndex = PLANETARY_SEQUENCE.indexOf(dayRuler);
  
  let hourIndex: number;
  let hourNumber: number;
  let nextHourTime: Date;
  
  if (isDay) {
    const msSinceSunrise = now.getTime() - sunrise.getTime();
    hourNumber = Math.floor(msSinceSunrise / dayHourLength) + 1;
    hourIndex = (startIndex + hourNumber - 1) % 7;
    nextHourTime = new Date(sunrise.getTime() + hourNumber * dayHourLength);
    
    if (hourNumber > 12) {
      hourNumber = 12;
      nextHourTime = sunset;
    }
  } else {
    let nightStart: Date;
    let effectiveDayOfWeek = dayOfWeek;
    
    if (now < sunrise) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const { sunset: yesterdaySunset } = calculateSunTimes(yesterday, location.latitude, location.longitude);
      nightStart = yesterdaySunset;
      effectiveDayOfWeek = (dayOfWeek + 6) % 7;
    } else {
      nightStart = sunset;
    }
    
    const dayRulerForNight = DAY_RULERS[effectiveDayOfWeek];
    const nightStartIndex = PLANETARY_SEQUENCE.indexOf(dayRulerForNight);
    
    const msSinceNightStart = now.getTime() - nightStart.getTime();
    hourNumber = Math.floor(msSinceNightStart / nightHourLength) + 1;
    hourIndex = (nightStartIndex + 12 + hourNumber - 1) % 7;
    nextHourTime = new Date(nightStart.getTime() + hourNumber * nightHourLength);
    
    if (hourNumber > 12) {
      hourNumber = 12;
      nextHourTime = sunrise;
    }
  }
  
  const currentPlanet = PLANETARY_SEQUENCE[hourIndex];
  const nextPlanet = PLANETARY_SEQUENCE[(hourIndex + 1) % 7];
  
  return {
    currentPlanet,
    nextPlanet,
    hourNumber,
    isDay,
    nextHourTime,
    timeUntilNext: nextHourTime.getTime() - now.getTime(),
    sunrise,
    sunset,
  };
};

const formatTimeRemaining = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatSunTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ============ LOCATION SETUP SCREEN ============
const LocationSetupScreen = ({ onLocationSet }: { onLocationSet: (loc: LocationData) => void }) => {
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
        Alert.alert('Permission Denied', 'Location permission is required to use GPS.');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      // Try to get location name
      let name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
          name = address.city || address.region || address.country || name;
        }
      } catch (e) {
        console.log('Reverse geocoding failed');
      }

      const locationData: LocationData = { latitude, longitude, name };
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
      onLocationSet(locationData);
    } catch (error) {
      Alert.alert('Error', 'Failed to get GPS location. Please try again or enter manually.');
    }
    setLoading(false);
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a city or location name.');
      return;
    }

    setLoading(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        const locationData: LocationData = {
          latitude,
          longitude,
          name: searchQuery.trim(),
        };
        await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
        onLocationSet(locationData);
      } else {
        Alert.alert('Not Found', 'Could not find that location. Please try a different search or enter coordinates manually.');
      }
    } catch (error) {
      Alert.alert('Error', 'Search failed. Please try again or enter coordinates manually.');
    }
    setLoading(false);
  };

  const handleManualEntry = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Error', 'Please enter valid numeric coordinates.');
      return;
    }

    if (lat < -90 || lat > 90) {
      Alert.alert('Error', 'Latitude must be between -90 and 90.');
      return;
    }

    if (lon < -180 || lon > 180) {
      Alert.alert('Error', 'Longitude must be between -180 and 180.');
      return;
    }

    const name = locationName.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const locationData: LocationData = { latitude: lat, longitude: lon, name };
    await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
    onLocationSet(locationData);
  };

  if (loading) {
    return (
      <View style={setupStyles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
        <SafeAreaView style={setupStyles.safeArea}>
          <View style={setupStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={setupStyles.loadingText}>Getting location...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={setupStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <SafeAreaView style={setupStyles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={setupStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'menu' && (
              <>
                <View style={setupStyles.header}>
                  <Ionicons name="planet-outline" size={80} color="#FFD700" />
                  <Text style={setupStyles.title}>Planetary Hours</Text>
                  <Text style={setupStyles.subtitle}>
                    Set your location to calculate accurate sunrise & sunset times
                  </Text>
                </View>

                <View style={setupStyles.menuContainer}>
                  <TouchableOpacity 
                    style={setupStyles.menuButton}
                    onPress={handleGPSLocation}
                  >
                    <Ionicons name="locate-outline" size={32} color="#fff" />
                    <View style={setupStyles.menuTextContainer}>
                      <Text style={setupStyles.menuButtonTitle}>Use GPS Location</Text>
                      <Text style={setupStyles.menuButtonSubtitle}>Automatically detect your position</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#888" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={setupStyles.menuButton}
                    onPress={() => setMode('search')}
                  >
                    <Ionicons name="search-outline" size={32} color="#fff" />
                    <View style={setupStyles.menuTextContainer}>
                      <Text style={setupStyles.menuButtonTitle}>Search Location</Text>
                      <Text style={setupStyles.menuButtonSubtitle}>Find by city or place name</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#888" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={setupStyles.menuButton}
                    onPress={() => setMode('manual')}
                  >
                    <Ionicons name="keypad-outline" size={32} color="#fff" />
                    <View style={setupStyles.menuTextContainer}>
                      <Text style={setupStyles.menuButtonTitle}>Enter Coordinates</Text>
                      <Text style={setupStyles.menuButtonSubtitle}>Manually input latitude & longitude</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#888" />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {mode === 'search' && (
              <>
                <TouchableOpacity 
                  style={setupStyles.backButton}
                  onPress={() => setMode('menu')}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                  <Text style={setupStyles.backText}>Back</Text>
                </TouchableOpacity>

                <View style={setupStyles.inputSection}>
                  <Ionicons name="search-outline" size={60} color="#FFD700" />
                  <Text style={setupStyles.inputTitle}>Search Location</Text>
                  <Text style={setupStyles.inputSubtitle}>Enter a city, region, or country name</Text>

                  <TextInput
                    style={setupStyles.textInput}
                    placeholder="e.g., Paris, France"
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />

                  <TouchableOpacity 
                    style={setupStyles.submitButton}
                    onPress={handleSearchLocation}
                  >
                    <Text style={setupStyles.submitButtonText}>Search</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {mode === 'manual' && (
              <>
                <TouchableOpacity 
                  style={setupStyles.backButton}
                  onPress={() => setMode('menu')}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                  <Text style={setupStyles.backText}>Back</Text>
                </TouchableOpacity>

                <View style={setupStyles.inputSection}>
                  <Ionicons name="keypad-outline" size={60} color="#FFD700" />
                  <Text style={setupStyles.inputTitle}>Enter Coordinates</Text>
                  <Text style={setupStyles.inputSubtitle}>Input your geographic coordinates</Text>

                  <TextInput
                    style={setupStyles.textInput}
                    placeholder="Location name (optional)"
                    placeholderTextColor="#888"
                    value={locationName}
                    onChangeText={setLocationName}
                  />

                  <TextInput
                    style={setupStyles.textInput}
                    placeholder="Latitude (e.g., 48.8566)"
                    placeholderTextColor="#888"
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="numeric"
                  />

                  <TextInput
                    style={setupStyles.textInput}
                    placeholder="Longitude (e.g., 2.3522)"
                    placeholderTextColor="#888"
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="numeric"
                  />

                  <TouchableOpacity 
                    style={setupStyles.submitButton}
                    onPress={handleManualEntry}
                  >
                    <Text style={setupStyles.submitButtonText}>Confirm</Text>
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

const setupStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  menuContainer: {
    marginTop: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  menuButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  menuButtonSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  inputSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  inputTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginTop: 20,
  },
  inputSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    marginBottom: 30,
  },
  textInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 60,
    marginTop: 10,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
});

// ============ MAIN PLANETARY HOURS SCREEN ============
const PlanetaryHoursScreen = ({ 
  location, 
  onChangeLocation 
}: { 
  location: LocationData; 
  onChangeLocation: () => void;
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
      <StatusBar 
        barStyle={isLightBackground ? 'dark-content' : 'light-content'} 
        backgroundColor={currentPlanetData.color}
      />
      <SafeAreaView style={mainStyles.safeArea}>
        <ScrollView 
          style={mainStyles.scrollView}
          contentContainerStyle={mainStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              mainStyles.content,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            {/* Location Header */}
            <TouchableOpacity 
              style={mainStyles.locationHeader}
              onPress={onChangeLocation}
            >
              <Ionicons name="location-outline" size={16} color={subTextColor} />
              <Text style={[mainStyles.locationText, { color: subTextColor }]}>
                {location.name}
              </Text>
              <Ionicons name="chevron-down" size={16} color={subTextColor} />
            </TouchableOpacity>

            {/* Time Header */}
            <View style={mainStyles.header}>
              <Text style={[mainStyles.timeText, { color: subTextColor }]}>
                {formatTime(currentTime)}
              </Text>
              <Text style={[mainStyles.dayNightText, { color: subTextColor }]}>
                {planetaryHour.isDay ? 'Day Hours' : 'Night Hours'}
              </Text>
              <View style={mainStyles.sunTimesRow}>
                <View style={mainStyles.sunTimeItem}>
                  <Ionicons name="sunny-outline" size={14} color={subTextColor} />
                  <Text style={[mainStyles.sunTimeText, { color: subTextColor }]}>
                    {formatSunTime(planetaryHour.sunrise)}
                  </Text>
                </View>
                <View style={mainStyles.sunTimeItem}>
                  <Ionicons name="moon-outline" size={14} color={subTextColor} />
                  <Text style={[mainStyles.sunTimeText, { color: subTextColor }]}>
                    {formatSunTime(planetaryHour.sunset)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Main Planet Display */}
            <View style={mainStyles.mainContent}>
              <View style={mainStyles.iconContainer}>
                <Ionicons name={currentPlanetData.symbol as any} size={100} color={textColor} />
              </View>
              
              <Text style={[mainStyles.planetName, { color: textColor }]}>
                {currentPlanetData.name}
              </Text>
              
              <Text style={[mainStyles.vibrationText, { color: textColor }]}>
                {currentPlanetData.vibration}
              </Text>
              
              <Text style={[mainStyles.hourLabel, { color: subTextColor }]}>
                Planetary Hour {planetaryHour.hourNumber} of {planetaryHour.isDay ? 'Day' : 'Night'}
              </Text>

              {/* Vibration Card */}
              <View style={[mainStyles.vibrationCard, { backgroundColor: isLightBackground ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
                <Text style={[mainStyles.vibrationDescription, { color: subTextColor }]}>
                  {currentPlanetData.description}
                </Text>
                <View style={mainStyles.keywordsContainer}>
                  {currentPlanetData.keywords.map((keyword, index) => (
                    <View 
                      key={index} 
                      style={[mainStyles.keywordBadge, { backgroundColor: isLightBackground ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)' }]}
                    >
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
                <Text style={[mainStyles.timerValue, { color: textColor }]}>
                  {formatTimeRemaining(planetaryHour.timeUntilNext)}
                </Text>
                
                <View style={mainStyles.nextPlanetRow}>
                  <Text style={[mainStyles.nextLabel, { color: subTextColor }]}>Next:</Text>
                  <View style={[mainStyles.nextPlanetBadge, { backgroundColor: nextPlanetData.color }]}>
                    <Ionicons name={nextPlanetData.symbol as any} size={16} color="#fff" />
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
                    <View 
                      key={planet} 
                      style={[
                        mainStyles.legendItem,
                        isActive && mainStyles.legendItemActive,
                      ]}
                    >
                      <View style={[mainStyles.legendDot, { backgroundColor: planetData.color }, isActive && mainStyles.legendDotActive]} />
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
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    gap: 6,
  },
  locationText: { fontSize: 14, fontWeight: '600' },
  header: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  timeText: { fontSize: 18, fontWeight: '600', letterSpacing: 1 },
  dayNightText: { fontSize: 14, marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 },
  sunTimesRow: { flexDirection: 'row', marginTop: 8, gap: 20 },
  sunTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sunTimeText: { fontSize: 12 },
  mainContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconContainer: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
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
  nextPlanetName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  legendSection: { paddingBottom: 20 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 },
  legendItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, minWidth: 44 },
  legendItemActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  legendDotActive: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  legendText: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
});

// ============ MAIN APP ============
export default function PlanetaryHoursApp() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedLocation();
  }, []);

  const loadSavedLocation = async () => {
    try {
      const saved = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) {
        setLocation(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading location:', error);
    }
    setLoading(false);
  };

  const handleChangeLocation = async () => {
    await AsyncStorage.removeItem(LOCATION_STORAGE_KEY);
    setLocation(null);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!location) {
    return <LocationSetupScreen onLocationSet={setLocation} />;
  }

  return <PlanetaryHoursScreen location={location} onChangeLocation={handleChangeLocation} />;
}
