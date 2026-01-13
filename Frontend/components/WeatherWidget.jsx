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
        return 'partly-sunny';
    };

    if (loading) return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            <ActivityIndicator size="small" color="#28a745" />
        </View>
    );

    if (error) return null; // Silently hide if error

    return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            <Ionicons
                name={getWeatherIcon(weather.condition)}
                size={compact ? 20 : 32}
                color="#28a745"
            />
            <View style={styles.info}>
                <Text style={[styles.temp, compact && styles.compactTemp]}>
                    {Math.round(weather.temp)}°C
                </Text>
                {!compact && (
                    <Text style={styles.location}>{weather.city || 'Somewhere out there'}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    compactContainer: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 0,
        borderRadius: 10,
    },
    info: {
        marginLeft: 10,
    },
    temp: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
    },
    compactTemp: {
        fontSize: 14,
        marginLeft: 5,
    },
    location: {
        fontSize: 12,
        color: '#6c757d',
    },
});
