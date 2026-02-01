import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity, Dimensions, RefreshControl, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';

const { width } = Dimensions.get('window');

const TIMEFRAMES = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'All Time', value: 'all' },
];

const TIER_STYLING = {
    'Trail Master': { color: '#28a745', icon: 'flame' },
    'Pathfinder': { color: '#007AFF', icon: 'map' },
    'Explorer': { color: '#34C759', icon: 'compass' },
    'Wanderer': { color: '#FFD60A', icon: 'walk' },
    'Newbie': { color: '#8E8E93', icon: 'footsteps' }
};

export default function Leaderboard() {
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeframe, setTimeframe] = useState('all');

    const fetchLeaderboard = useCallback(async (selectedTimeframe) => {
        try {
            const res = await client.get(`/users/leaderboard?timeframe=${selectedTimeframe}`);
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Error fetching leaderboard", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard(timeframe);
    }, [timeframe]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchLeaderboard(timeframe);
    };

    const handleTimeframeChange = (val) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeframe(val);
    };

    const renderPodiumItem = (user, rankOrder) => {
        // rankOrder: 0 means Gold (Center), 1 means Silver (Left), 2 means Bronze (Right)
        const rank = rankOrder === 0 ? 1 : (rankOrder === 1 ? 2 : 3);
        const isFirst = rank === 1;
        const color = isFirst ? '#FFD700' : (rank === 2 ? '#C0C0C0' : '#CD7F32');
        const size = isFirst ? 80 : 65;
        const pedestalHeight = isFirst ? 110 : (rank === 2 ? 85 : 70);

        return (
            <View style={[styles.podiumItem, isFirst && { zIndex: 10 }]}>
                {user ? (
                    <TouchableOpacity
                        onPress={() => router.push(`/user-profile/${user._id}`)}
                        style={styles.podiumTouch}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.podiumAvatarContainer, { borderColor: color, width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
                            <Image
                                source={{ uri: user.profileImage || 'https://via.placeholder.com/100' }}
                                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#333' }}
                            />
                            {isFirst && <Ionicons name="ribbon" size={24} color="#FFD700" style={styles.crownIcon} />}
                        </View>
                        <Text style={styles.podiumName} numberOfLines={1}>{user.username}</Text>
                        <Text style={styles.podiumStats}>{user.treksCount} Trails</Text>
                    </TouchableOpacity>
                ) : <View style={{ height: 100 }} />}

                <View style={[styles.pedestal, { height: pedestalHeight }]}>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                        style={StyleSheet.absoluteFill}
                        borderRadius={15}
                    />
                    <Text style={[styles.pedestalRank, { color }]}>{rank}</Text>
                </View>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.headerArea}>
            <LinearGradient colors={['#1a1a1b', '#2d2d2e']} style={styles.topGradient}>
                <View style={styles.topTitleRow}>
                    <Text style={styles.headerMainTitle}>Hiker Leaderboard</Text>
                    <Ionicons name="medal" size={24} color="#28a745" />
                </View>

                <View style={styles.podiumContainer}>
                    {renderPodiumItem(users[1], 1)}
                    {renderPodiumItem(users[0], 0)}
                    {renderPodiumItem(users[2], 2)}
                </View>
            </LinearGradient>

            <View style={styles.toggleContainer}>
                <View style={styles.togglePill}>
                    {TIMEFRAMES.map((tf) => (
                        <TouchableOpacity
                            key={tf.value}
                            style={[styles.tfPill, timeframe === tf.value && styles.tfPillActive]}
                            onPress={() => handleTimeframeChange(tf.value)}
                        >
                            <Text style={[styles.tfPillText, timeframe === tf.value && styles.tfPillTextActive]}>{tf.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.listSubhead}>
                <Text style={styles.listSubheadTitle}>Global Rankings</Text>
                <Text style={styles.listSubheadDesc}>Based on completed treks in {timeframe === 'all' ? 'total' : 'this period'}</Text>
            </View>
        </View>
    );

    const renderItem = ({ item, index }) => {
        if (index < 3) return null;
        const tier = TIER_STYLING[item.tier] || TIER_STYLING['Newbie'];

        return (
            <Animated.View entering={FadeInUp.delay(200 + index * 50)} layout={Layout.springify()}>
                <TouchableOpacity style={styles.card} onPress={() => router.push(`/user-profile/${item._id}`)}>
                    <View style={styles.rankNumContainer}>
                        <Text style={styles.rankNumText}>{index + 1}</Text>
                    </View>

                    <View style={styles.cardInfo}>
                        <Image source={{ uri: item.profileImage || 'https://via.placeholder.com/50' }} style={styles.cardAvatar} />
                        <View style={styles.cardTextContainer}>
                            <Text style={styles.cardUsername}>{item.username}</Text>
                            <View style={styles.tierRow}>
                                <Ionicons name={tier.icon} size={10} color={tier.color} style={{ marginRight: 4 }} />
                                <Text style={[styles.cardTier, { color: tier.color }]}>{item.tier || 'Newbie'}</Text>
                            </View>
                        </View>
                        <View style={styles.cardStats}>
                            <Text style={styles.cardStatValue}>{item.treksCount}</Text>
                            <Text style={styles.cardStatLabel}>Trails</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#E0E0E0" />
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <SafeScreen backgroundColor="#1a1a1b" statusBarStyle="light-content" edges={['top']}>
            <View style={styles.container}>
                <FlatList
                    data={users}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    ListHeaderComponent={renderHeader}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#28a745" />
                    }
                    ListEmptyComponent={loading ? (
                        <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 50 }} />
                    ) : (
                        <Text style={styles.emptyText}>No rankings found for this timeframe.</Text>
                    )}
                />
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    headerArea: {
        backgroundColor: '#F8F9FA',
    },
    topGradient: {
        paddingBottom: 20,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
    },
    topTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingTop: 20,
        marginBottom: 40,
    },
    headerMainTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFF',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    podiumContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingHorizontal: 15,
        height: 220,
        marginTop: 20,
    },
    podiumItem: {
        width: '31%',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    podiumTouch: {
        alignItems: 'center',
        width: '100%',
        zIndex: 2,
    },
    podiumAvatarContainer: {
        borderWidth: 3,
        padding: 4,
        position: 'relative',
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    crownIcon: {
        position: 'absolute',
        top: -22,
        alignSelf: 'center',
    },
    podiumName: {
        color: '#FFF',
        fontWeight: '700',
        marginTop: 12,
        fontSize: 13,
        textAlign: 'center',
    },
    podiumStats: {
        color: '#28a745',
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 5,
    },
    pedestal: {
        width: '85%',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    pedestalRank: {
        fontSize: 24,
        fontWeight: '900',
    },
    toggleContainer: {
        alignItems: 'center',
        marginTop: -30,
        zIndex: 10,
    },
    togglePill: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderRadius: 25,
        padding: 4,
        width: width * 0.85,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    tfPill: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 22,
    },
    tfPillActive: {
        backgroundColor: '#28a745',
    },
    tfPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#8E8E93',
    },
    tfPillTextActive: {
        color: '#FFF',
    },
    listSubhead: {
        paddingHorizontal: 25,
        paddingTop: 30,
        paddingBottom: 15,
    },
    listSubheadTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1b',
    },
    listSubheadDesc: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
        marginTop: 2,
    },
    listContent: {
        paddingBottom: 40,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        marginHorizontal: 20,
        padding: 15,
        borderRadius: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    rankNumContainer: {
        width: 30,
        alignItems: 'center',
    },
    rankNumText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#D1D1D6',
    },
    cardInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    cardAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F2F2F7',
    },
    cardTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    cardUsername: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1a1b',
    },
    tierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    cardTier: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardStats: {
        alignItems: 'flex-end',
        marginRight: 10,
    },
    cardStatValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1a1a1b',
    },
    cardStatLabel: {
        fontSize: 8,
        color: '#8E8E93',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyText: {
        textAlign: 'center',
        color: '#8E8E93',
        marginTop: 50,
        fontSize: 15,
    }
});
