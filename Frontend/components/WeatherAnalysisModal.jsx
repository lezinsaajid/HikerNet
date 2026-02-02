import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';

const { width } = Dimensions.get('window');

export default function WeatherAnalysisModal({ visible, onClose, lat, lon }) {
    const [forecast, setForecast] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Day'); // 'Day', 'Week', 'Month'

    useEffect(() => {
        if (visible && lat && lon) {
            fetchForecast();
        }
    }, [visible, lat, lon]);

    const fetchForecast = async () => {
        setLoading(true);
        try {
            const res = await client.get(`/weather/forecast?lat=${lat}&lon=${lon}`);
            setForecast(res.data);
        } catch (error) {
            console.error('Forecast Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getWeatherEmoji = (condition) => {
        const cond = condition?.toLowerCase() || '';
        if (cond.includes('clear')) return '☀️';
        if (cond.includes('cloud')) return '☁️';
        if (cond.includes('rain')) return '🌧️';
        if (cond.includes('thunder')) return '⛈️';
        if (cond.includes('snow')) return '❄️';
        if (cond.includes('mist') || cond.includes('fog')) return '🌫️';
        return '⛅';
    };

    const renderDayAnalysis = () => {
        if (!forecast || !forecast.list) return null;
        // Show hourly (every 3 hours) for next 24 hours
        const hourly = forecast.list.slice(0, 8);
        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyContainer}>
                {hourly.map((item, index) => (
                    <View key={index} style={styles.hourlyItem}>
                        <Text style={styles.hourlyTime}>
                            {new Date(item.dt * 1000).getHours()}:00
                        </Text>
                        <Text style={styles.hourlyEmoji}>{getWeatherEmoji(item.weather[0].main)}</Text>
                        <Text style={styles.hourlyTemp}>{Math.round(item.main.temp)}°</Text>
                    </View>
                ))}
            </ScrollView>
        );
    };

    const renderWeekAnalysis = () => {
        if (!forecast || !forecast.list) return null;
        // Group by day (approximate 8 samples per day)
        const daily = forecast.list.filter((_, index) => index % 8 === 0);
        return (
            <View style={styles.listContainer}>
                {daily.map((item, index) => {
                    const date = new Date(item.dt * 1000);
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                        <View key={index} style={styles.listItem}>
                            <Text style={styles.listDay}>{dayName}</Text>
                            <Text style={styles.listEmoji}>{getWeatherEmoji(item.weather[0].main)}</Text>
                            <Text style={styles.listText}>{item.weather[0].main}</Text>
                            <Text style={styles.listTemp}>{Math.round(item.main.temp)}°C</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderMonthAnalysis = () => {
        const date = new Date();
        const month = date.toLocaleDateString('en-US', { month: 'long' });
        let season = "Spring";
        const m = date.getMonth();
        if (m >= 2 && m <= 4) season = "Spring";
        else if (m >= 5 && m <= 7) season = "Summer";
        else if (m >= 8 && m <= 10) season = "Autumn";
        else season = "Winter";

        return (
            <View style={styles.monthContainer}>
                <Ionicons name="calendar-outline" size={40} color="#28a745" />
                <Text style={styles.monthTitle}>{month} Outlook</Text>
                <Text style={styles.monthSeason}>Season: {season}</Text>
                <View style={styles.monthCard}>
                    <Text style={styles.monthInfoText}>
                        Expected conditions for trek planning:
                        {"\n\n"}• Average humidity: 65%
                        {"\n"}• Primary conditions: {season === 'Winter' ? 'Cold & Crisp' : 'Variable & Mild'}
                        {"\n"}• Hiking Recommendation: {season === 'Summer' ? 'Hydrate well, start early.' : 'Dress in layers, check for trail icing.'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Weather Analysis</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabBar}>
                        {['Day', 'Week', 'Month'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, activeTab === tab && styles.activeTab]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#28a745" style={{ marginVertical: 40 }} />
                    ) : (
                        <View style={styles.contentArea}>
                            {activeTab === 'Day' && renderDayAnalysis()}
                            {activeTab === 'Week' && renderWeekAnalysis()}
                            {activeTab === 'Month' && renderMonthAnalysis()}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        minHeight: 450,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 5,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderRadius: 15,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    tabText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#28a745',
        fontWeight: 'bold',
    },
    contentArea: {
        flex: 1,
    },
    hourlyContainer: {
        paddingVertical: 10,
    },
    hourlyItem: {
        alignItems: 'center',
        marginRight: 20,
        padding: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 20,
        width: 80,
    },
    hourlyTime: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    hourlyEmoji: {
        fontSize: 24,
        marginVertical: 8,
    },
    hourlyTemp: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    listContainer: {
        gap: 12,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 15,
    },
    listDay: {
        width: 50,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    listEmoji: {
        fontSize: 20,
        marginHorizontal: 15,
    },
    listText: {
        flex: 1,
        fontSize: 14,
        color: '#666',
    },
    listTemp: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#28a745',
    },
    monthContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    monthTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 10,
    },
    monthSeason: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    monthCard: {
        backgroundColor: '#f0f9f1',
        padding: 20,
        borderRadius: 20,
        width: '100%',
    },
    monthInfoText: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
    }
});
