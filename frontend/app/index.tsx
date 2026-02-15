import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Planet configuration with colors and symbols
const PLANETS = {
  saturn: {
    name: 'Saturn',
    color: '#4B0082', // Indigo
    symbol: 'planet-outline',
  },
  jupiter: {
    name: 'Jupiter',
    color: '#1E3A5F', // Blue marine (navy blue)
    symbol: 'planet-outline',
  },
  mars: {
    name: 'Mars',
    color: '#DC143C', // Red
    symbol: 'flame-outline',
  },
  sun: {
    name: 'Sun',
    color: '#FF8C00', // Orange
    symbol: 'sunny-outline',
  },
  venus: {
    name: 'Venus',
    color: '#FFD700', // Yellow
    symbol: 'heart-outline',
  },
  mercury: {
    name: 'Mercury',
    color: '#8A2BE2', // Violet
    symbol: 'flash-outline',
  },
  moon: {
    name: 'Moon',
    color: '#228B22', // Green
    symbol: 'moon-outline',
  },
};

// Traditional planetary hour sequence (Chaldean order)
const PLANETARY_SEQUENCE = [
  'saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'
];

// Day rulers - which planet rules the first hour of each day
const DAY_RULERS: { [key: number]: string } = {
  0: 'sun',      // Sunday
  1: 'moon',     // Monday
  2: 'mars',     // Tuesday
  3: 'mercury',  // Wednesday
  4: 'jupiter',  // Thursday
  5: 'venus',    // Friday
  6: 'saturn',   // Saturday
};

// Get approximate sunrise and sunset times (simplified - 6 AM and 6 PM)
// For a more accurate app, we could use expo-location and sunrise-sunset API
const getSunTimes = (date: Date) => {
  const sunrise = new Date(date);
  sunrise.setHours(6, 0, 0, 0);
  
  const sunset = new Date(date);
  sunset.setHours(18, 0, 0, 0);
  
  return { sunrise, sunset };
};

// Calculate the current planetary hour
const calculatePlanetaryHour = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const { sunrise, sunset } = getSunTimes(now);
  
  // Determine if it's day or night
  const isDay = now >= sunrise && now < sunset;
  
  // Calculate day hour length and night hour length
  const dayLengthMs = sunset.getTime() - sunrise.getTime();
  const nightLengthMs = 24 * 60 * 60 * 1000 - dayLengthMs;
  const dayHourLength = dayLengthMs / 12;
  const nightHourLength = nightLengthMs / 12;
  
  // Get the starting planet for this day
  const dayRuler = DAY_RULERS[dayOfWeek];
  const startIndex = PLANETARY_SEQUENCE.indexOf(dayRuler);
  
  let hourIndex: number;
  let hourNumber: number;
  let nextHourTime: Date;
  let currentHourStart: Date;
  
  if (isDay) {
    // Calculate which day hour we're in (1-12)
    const msSinceSunrise = now.getTime() - sunrise.getTime();
    hourNumber = Math.floor(msSinceSunrise / dayHourLength) + 1;
    hourIndex = (startIndex + hourNumber - 1) % 7;
    
    currentHourStart = new Date(sunrise.getTime() + (hourNumber - 1) * dayHourLength);
    nextHourTime = new Date(sunrise.getTime() + hourNumber * dayHourLength);
    
    if (hourNumber > 12) {
      hourNumber = 12;
      nextHourTime = sunset;
    }
  } else {
    // Night hours
    let nightStart: Date;
    let effectiveDayOfWeek = dayOfWeek;
    
    if (now < sunrise) {
      // After midnight, before sunrise - this is technically the night of the previous day
      nightStart = new Date(now);
      nightStart.setDate(nightStart.getDate() - 1);
      nightStart.setHours(18, 0, 0, 0);
      effectiveDayOfWeek = (dayOfWeek + 6) % 7; // Previous day
    } else {
      // After sunset
      nightStart = sunset;
    }
    
    const dayRulerForNight = DAY_RULERS[effectiveDayOfWeek];
    const nightStartIndex = PLANETARY_SEQUENCE.indexOf(dayRulerForNight);
    
    const msSinceNightStart = now.getTime() - nightStart.getTime();
    hourNumber = Math.floor(msSinceNightStart / nightHourLength) + 1;
    
    // Night hours are hours 13-24 (or 1-12 of night)
    hourIndex = (nightStartIndex + 12 + hourNumber - 1) % 7;
    
    currentHourStart = new Date(nightStart.getTime() + (hourNumber - 1) * nightHourLength);
    nextHourTime = new Date(nightStart.getTime() + hourNumber * nightHourLength);
    
    if (hourNumber > 12) {
      hourNumber = 12;
      // Next change would be sunrise tomorrow
      nextHourTime = new Date(now);
      nextHourTime.setDate(nextHourTime.getDate() + 1);
      nextHourTime.setHours(6, 0, 0, 0);
    }
  }
  
  const currentPlanet = PLANETARY_SEQUENCE[hourIndex];
  const nextPlanetIndex = (hourIndex + 1) % 7;
  const nextPlanet = PLANETARY_SEQUENCE[nextPlanetIndex];
  
  return {
    currentPlanet,
    nextPlanet,
    hourNumber,
    isDay,
    nextHourTime,
    currentHourStart,
    timeUntilNext: nextHourTime.getTime() - now.getTime(),
  };
};

// Format time remaining
const formatTimeRemaining = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

// Format current time
const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function PlanetaryHoursApp() {
  const [planetaryHour, setPlanetaryHour] = useState(calculatePlanetaryHour());
  const [currentTime, setCurrentTime] = useState(new Date());
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [prevPlanet, setPrevPlanet] = useState(planetaryHour.currentPlanet);

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      const newHour = calculatePlanetaryHour();
      setCurrentTime(new Date());
      
      // Check if planet changed
      if (newHour.currentPlanet !== prevPlanet) {
        // Animate transition
        Animated.sequence([
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.8,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
        
        setPrevPlanet(newHour.currentPlanet);
      }
      
      setPlanetaryHour(newHour);
    }, 1000);

    return () => clearInterval(interval);
  }, [prevPlanet, fadeAnim, scaleAnim]);

  const currentPlanetData = PLANETS[planetaryHour.currentPlanet as keyof typeof PLANETS];
  const nextPlanetData = PLANETS[planetaryHour.nextPlanet as keyof typeof PLANETS];

  // Determine text color based on background brightness
  const isLightBackground = ['venus', 'sun'].includes(planetaryHour.currentPlanet);
  const textColor = isLightBackground ? '#1a1a1a' : '#ffffff';
  const subTextColor = isLightBackground ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';

  return (
    <View style={[styles.container, { backgroundColor: currentPlanetData.color }]}>
      <StatusBar 
        barStyle={isLightBackground ? 'dark-content' : 'light-content'} 
        backgroundColor={currentPlanetData.color}
      />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View 
          style={[
            styles.content,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.timeText, { color: subTextColor }]}>
              {formatTime(currentTime)}
            </Text>
            <Text style={[styles.dayNightText, { color: subTextColor }]}>
              {planetaryHour.isDay ? 'Day Hours' : 'Night Hours'}
            </Text>
          </View>

          {/* Main Planet Display */}
          <View style={styles.mainContent}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name={currentPlanetData.symbol as any} 
                size={120} 
                color={textColor} 
              />
            </View>
            
            <Text style={[styles.planetName, { color: textColor }]}>
              {currentPlanetData.name}
            </Text>
            
            <Text style={[styles.hourLabel, { color: subTextColor }]}>
              Planetary Hour {planetaryHour.hourNumber} of {planetaryHour.isDay ? 'Day' : 'Night'}
            </Text>
          </View>

          {/* Timer Section */}
          <View style={styles.timerSection}>
            <View style={[styles.timerCard, { backgroundColor: isLightBackground ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.timerLabel, { color: subTextColor }]}>
                Time until next hour
              </Text>
              <Text style={[styles.timerValue, { color: textColor }]}>
                {formatTimeRemaining(planetaryHour.timeUntilNext)}
              </Text>
              
              <View style={styles.nextPlanetRow}>
                <Text style={[styles.nextLabel, { color: subTextColor }]}>
                  Next:
                </Text>
                <View style={[styles.nextPlanetBadge, { backgroundColor: nextPlanetData.color }]}>
                  <Ionicons 
                    name={nextPlanetData.symbol as any} 
                    size={16} 
                    color="#fff" 
                  />
                  <Text style={styles.nextPlanetName}>
                    {nextPlanetData.name}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Planet Legend */}
          <View style={styles.legendSection}>
            <View style={styles.legendRow}>
              {PLANETARY_SEQUENCE.map((planet) => {
                const planetData = PLANETS[planet as keyof typeof PLANETS];
                const isActive = planet === planetaryHour.currentPlanet;
                return (
                  <View 
                    key={planet} 
                    style={[
                      styles.legendItem,
                      isActive && styles.legendItemActive,
                      { borderColor: isLightBackground ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }
                    ]}
                  >
                    <View 
                      style={[
                        styles.legendDot, 
                        { backgroundColor: planetData.color },
                        isActive && styles.legendDotActive,
                      ]} 
                    />
                    <Text style={[
                      styles.legendText, 
                      { color: subTextColor },
                      isActive && { color: textColor, fontWeight: '700' }
                    ]}>
                      {planetData.name.substring(0, 3)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  dayNightText: {
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  planetName: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hourLabel: {
    fontSize: 16,
    marginTop: 8,
    letterSpacing: 1,
  },
  timerSection: {
    paddingBottom: 20,
  },
  timerCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
  },
  nextPlanetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  nextLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  nextPlanetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  nextPlanetName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  legendSection: {
    paddingBottom: 20,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 44,
  },
  legendItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  legendDotActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
});
