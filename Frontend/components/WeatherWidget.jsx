import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import * as Location from 'expo-location';
import WeatherAnalysisModal from './WeatherAnalysisModal';

export default function WeatherWidget({ compact = false }) {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [coords, setCoords] = useState(null);

    useEffect(() => {
        fetchWeather();
    }, []);

    const fetchWeather = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            // Check if location services are enabled
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                setError('Location off');
                setLoading(false);
                return;
            }

            // Try to get last known position first (faster)
            let location = await Location.getLastKnownPositionAsync({});

            // If no last known position, request current position
            if (!location) {
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }

            if (location) {
                const { latitude, longitude } = location.coords;
                setCoords({ latitude, longitude });
                const res = await client.get(`/weather/current?lat=${latitude}&lon=${longitude}`);
                setWeather(res.data);
            } else {
                setError('Location unavailable');
            }
        } catch (err) {
            console.log('Weather Fetch Error (Handled):', err.message);
            setError('Weather error');
        } finally {
            setLoading(false);
        }
    };

    const getWeatherIcon = (condition) => {
        const cond = condition?.toLowerCase() || '';
        if (cond.includes('clear')) return 'sunny';
        if (cond.includes('cloud')) return 'cloudy';
        if (cond.includes('rain')) return 'rainy';
        if (cond.includes('thunder')) return 'thunderstorm';
        if (cond.includes('snow')) return 'snow';
        if (cond.includes('mist') || cond.includes('fog')) return 'water';
        return 'partly-sunny';
    };

    const getWeatherEmoji = (condition) => {
        const cond = condition?.toLowerCase() || '';
        if (cond.includes('clear')) return '☀️';
        if (cond.includes('cloud')) return '☁️';
        if (cond.includes('rain')) return '🌧️';
        if (cond.includes('thunder')) return '⛈️';
        if (cond.includes('snow')) return '❄️';
        return '⛅';
    };

    if (loading) return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            <ActivityIndicator size="small" color="#28a745" />
        </View>
    );

    if (error || !weather) return null;

    return (
        <>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setModalVisible(true)}
                style={[styles.container, compact && styles.compactContainer]}
            >
                <View style={styles.mainRow}>
                    <Text style={{ fontSize: compact ? 22 : 32, marginRight: 8 }}>
                        {getWeatherEmoji(weather.condition)}
                    </Text>
                    <View style={styles.info}>
                        <Text style={[styles.temp, compact && styles.compactTemp]}>
                            {Math.round(weather.temp)}°C
                        </Text>
                        {!compact && <Text style={styles.condition}>{weather.condition}</Text>}
                    </View>
                </View>

                {!compact && (
                    <View style={styles.detailsRow}>
                        <View style={styles.detailItem}>
                            <Ionicons name="water-outline" size={14} color="#6c757d" />
                            <Text style={styles.detailText}>{weather.humidity}%</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Ionicons name="speedometer-outline" size={14} color="#6c757d" />
                            <Text style={styles.detailText}>{weather.wind}m/s</Text>
                        </View>
                        <Text style={styles.location}>{weather.city || 'Trailhead'}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <WeatherAnalysisModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                lat={coords?.latitude}
                lon={coords?.longitude}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        minWidth: 120,
    },
    compactContainer: {
        padding: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 15,
        minWidth: 70,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    info: {
        marginLeft: 4,
    },
    temp: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    compactTemp: {
        fontSize: 18,
        marginLeft: 0,
    },
    condition: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    detailText: {
        fontSize: 12,
        color: '#6c757d',
        marginLeft: 4,
    },
    location: {
        fontSize: 12,
        color: '#28a745',
        fontWeight: '500',
        marginLeft: 'auto',
    },
});


