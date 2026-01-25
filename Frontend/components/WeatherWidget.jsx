import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import * as Location from 'expo-location';

export default function WeatherWidget({ compact = false }) {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchWeather();
    }, []);

    const fetchWeather = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location access denied');
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            const res = await client.get(`/weather/current?lat=${latitude}&lon=${longitude}`);
            setWeather(res.data);
        } catch (err) {
            console.error('Weather Fetch Error:', err);
            setError('Weather unavailable');
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

    if (loading) return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            <ActivityIndicator size="small" color="#28a745" />
        </View>
    );

    if (error || !weather) return null;

    return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            <View style={styles.mainRow}>
                <Ionicons
                    name={getWeatherIcon(weather.condition)}
                    size={compact ? 22 : 36}
                    color="#28a745"
                />
                <View style={styles.info}>
                    <Text style={[styles.temp, compact && styles.compactTemp]}>
                        {Math.round(weather.temp)}°C
                    </Text>
                    <Text style={styles.condition}>{weather.condition}</Text>
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
        </View>
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
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 12,
        minWidth: 80,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    info: {
        marginLeft: 12,
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


