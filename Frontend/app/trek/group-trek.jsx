import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Shared Components
import MapLayer from './_components/MapLayer';
import StatsCard from './_components/StatsCard';
import NavigationBanner from './_components/NavigationBanner';
import TrekControls from './_components/TrekControls';
import MarkerModal from './_components/MarkerModal';
import PinDetailsModal from './_components/PinDetailsModal';
import RestModal from './_components/RestModal';
import GroupChatOverlay from './_components/GroupChatOverlay';
import WeatherWidget from '../../components/WeatherWidget';

// Orchestrator Hook
import { useGroupTrekSession } from './_hooks/useGroupTrekSession';
import { useAuth } from '../../context/AuthContext';
import { ACTIONS } from './_utils/constants';

/**
 * GroupTrek Component
 * 
 * Modular implementation of real-time collaborative trekking.
 * Features: Presence sync, leader path sharing, drift alerts, and group chat.
 */
export default function GroupTrek() {
    const router = useRouter();
    const params = useLocalSearchParams();
    useKeepAwake(); 
    const { user: currentUser } = useAuth();
    
    // Core Logic Orchestrator
    const {
        state,
        dispatch,
        mapRef,
        messageAnim,
        userHeading,
        gpsAccuracy,
        accuracyStatus,
        locationError,
        isLeader,
        sync,
        startTrek,
        stopTrek,
        initiateTrekBack,
        displayParticipants,
        startRest,
        endRest,
        restTimeLeft,
        isResting,
        warningMode,
        warningTimeLeft,
        togglePause
    } = useGroupTrekSession(params, currentUser);

    // Local UI State
    const [showMarkerModal, setShowMarkerModal] = useState(false);
    const [showRestModal, setShowRestModal] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [waypointDescription, setWaypointDescription] = useState('');
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [waypointImages, setWaypointImages] = useState([]);
    const [selectedPinDetails, setSelectedPinDetails] = useState(null);
    const [chatVisible, setChatVisible] = useState(false);
    const [isFollowingLeader, setIsFollowingLeader] = useState(false);

    // Media & Waypoint Handlers
    const compressImage = async (uri) => {
        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri, [{ resize: { width: 1080 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return manipResult.uri;
        } catch (error) { return uri; }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled) {
            const compressed = await compressImage(result.assets[0].uri);
            setWaypointImages(prev => [...prev, compressed]);
        }
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled) {
            const compressed = await compressImage(result.assets[0].uri);
            setWaypointImages(prev => [...prev, compressed]);
        }
    };

    const addMarker = async () => {
        if (!state.location || !selectedIcon) return;
        const m = { 
            latitude: state.location.latitude, 
            longitude: state.location.longitude, 
            icon: selectedIcon.name || selectedIcon.icon, 
            type: selectedIcon.label, 
            description: waypointDescription.trim(), 
            images: waypointImages, 
            timestamp: new Date() 
        };
        dispatch({ type: ACTIONS.ADD_MARKER, payload: m });
        sync.emitWaypoint(m);
        setShowMarkerModal(false);
        setSelectedIcon(null);
        setWaypointDescription('');
        setWaypointImages([]);
    };

    const handleExit = () => {
        Alert.alert("Leave Group", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: () => {
                if (isLeader) sync.emitControl('EXIT');
                sync.leaveGroup();
                router.replace('/(tabs)/trek');
            }}
        ]);
    };

    if (!state.location && !state.hasStarted) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1b5e20" />
                <Text style={styles.loadingText}>Syncing Group Session...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Notification Bar */}
            {state.groupMessage && (
                <Animated.View style={[
                    styles.messagePill, 
                    state.groupMessage.type === 'danger' && styles.messageDanger,
                    state.groupMessage.type === 'warning' && styles.messageWarning,
                    state.groupMessage.type === 'success' && styles.messageSuccess,
                    { transform: [{ translateY: messageAnim }] }
                ]}>
                    <Ionicons 
                        name={state.groupMessage.type === 'danger' ? "alert-circle" : "notifications"} 
                        size={20} color="white" 
                    />
                    <Text style={styles.messageText}>{state.groupMessage.text}</Text>
                </Animated.View>
            )}

            <MapLayer
                mapRef={mapRef}
                location={state.location}
                pathSegments={state.pathSegments}
                ghostSegments={state.ghostSegments}
                markers={state.markers}
                baseWaypoints={state.baseWaypoints}
                navigationPolyline={state.navigationPolyline}
                reroutePath={state.reroutePath}
                mapType={state.mapType}
                mapViewMode={state.mapViewMode}
                userHeading={userHeading}
                onMarkerPress={setSelectedPinDetails}
                participants={state.participants}
                trailFinished={state.trailFinished}
                role={isLeader ? 'leader' : 'member'}
                groupCentroid={state.groupCentroid}
                trackingUserId={state.trackingUserId}
            />

            <StatsCard 
                stats={state.stats} 
                formatDuration={(s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`} 
            />

            {/* Participants Overlay */}
            {state.hasStarted && !state.trailFinished && (
                <View style={styles.participantsListContainer}>
                    <Text style={styles.participantsTitle}>Active Group ({displayParticipants.length})</Text>
                    {displayParticipants.map(([uid, p]) => (
                        <View key={uid} style={styles.participantRow}>
                            <View style={[styles.statusDot, p.status === 'inactive' ? styles.statusInactive : styles.statusActive]} />
                            <Text style={[styles.participantName, p.status === 'inactive' && styles.participantInactive]} numberOfLines={1}>
                                {p.username} {p.isSelf && "(You)"}
                            </Text>
                            {isLeader && !p.isSelf && (
                                <TouchableOpacity 
                                    style={[styles.trackBtn, state.trackingUserId === uid && styles.trackBtnActive]}
                                    onPress={() => dispatch({ type: ACTIONS.UI_ACTION, payload: { trackingUserId: state.trackingUserId === uid ? null : uid } })}
                                >
                                    <Ionicons name="eye" size={12} color={state.trackingUserId === uid ? "white" : "#666"} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.topRightOverlay}>
                <WeatherWidget compact />
                <View style={[styles.accuracyBadge, { backgroundColor: accuracyStatus === 'high' ? 'rgba(46,125,50,0.8)' : 'rgba(183,28,28,0.8)' }]}>
                    <Text style={styles.accuracyText}>{Math.round(gpsAccuracy || 0)}m Accuracy</Text>
                </View>
            </View>

            <View style={styles.groupBadge}>
                <Ionicons name="people" size={16} color="white" />
                <Text style={styles.groupBadgeText}>{displayParticipants.length} / {state.totalExpected}</Text>
            </View>

            {state.hasStarted && !state.trailFinished && (
                <NavigationBanner 
                    navigation={state.navigation}
                    offTrackWarning={state.navigation.offTrackWarning}
                    onToggleNavMode={() => dispatch({ type: ACTIONS.UI_ACTION, payload: { mapViewMode: state.mapViewMode === 'navigation' ? 'explore' : 'navigation' } })}
                />
            )}

            {isLeader ? (
                !state.hasStarted ? (
                    <View style={styles.bottomActionContainer}>
                        <TouchableOpacity style={styles.startTrekPill} onPress={startTrek}>
                            <Text style={styles.startTrekText}>Start Group Trek</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TrekControls 
                        isTracking={state.isTracking}
                        isPaused={state.isPaused}
                        trailFinished={state.trailFinished}
                        onStart={startTrek}
                        onStop={stopTrek}
                        onPause={togglePause}
                        onExit={handleExit}
                        onTrailBack={() => initiateTrekBack()}
                    />
                )
            ) : (
                <View style={styles.memberStatusOverlay}>
                    <View style={[styles.statusBanner, { backgroundColor: state.isPaused ? '#f57c00' : '#2e7d32' }]}>
                        <Ionicons name={state.isPaused ? "pause-circle" : "walk"} size={20} color="white" />
                        <Text style={styles.statusBannerText}>{state.isPaused ? "Leader Paused" : "Active Session"}</Text>
                    </View>
                    <TouchableOpacity style={styles.exitBtnSmall} onPress={handleExit}>
                        <Text style={styles.exitBtnText}>Leave Group</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Floating Tools */}
            <View style={styles.leftToolStack}>
                <TouchableOpacity style={styles.toolButton} onPress={() => {
                    if (state.location?.latitude) mapRef.current?.animateCamera({ center: state.location, zoom: 18 });
                }}>
                    <Ionicons name="navigate" size={24} color="#2e7d32" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolButton} onPress={() => dispatch({ type: ACTIONS.UI_ACTION, payload: { mapType: state.mapType === 'satellite' ? 'standard' : 'satellite' } })}>
                    <Ionicons name="layers" size={24} color="#666" />
                </TouchableOpacity>
            </View>

            <View style={styles.rightToolStack}>
                {state.hasStarted && !state.trailFinished && (
                    <>
                        <TouchableOpacity style={styles.toolButton} onPress={() => { setChatVisible(true); dispatch({ type: ACTIONS.UI_ACTION, payload: { unreadCount: 0 } }); }}>
                            <Ionicons name="chatbubbles-outline" size={24} color="#1565c0" />
                            {state.unreadCount > 0 && <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{state.unreadCount}</Text></View>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.toolButton, styles.cameraToolButton]} onPress={() => setShowMarkerModal(true)}>
                            <Ionicons name="camera" size={26} color="white" />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* Modals */}
            <GroupChatOverlay visible={chatVisible} onClose={() => setChatVisible(false)} messages={state.messages} currentUser={currentUser} onSendMessage={(text) => sync.emitMessage(text)} />
            <MarkerModal visible={showMarkerModal} onClose={() => setShowMarkerModal(false)} selectedIcon={selectedIcon} setSelectedIcon={setSelectedIcon} iconSearchQuery={iconSearchQuery} setIconSearchQuery={setIconSearchQuery} waypointDescription={waypointDescription} setWaypointDescription={setWaypointDescription} waypointImages={waypointImages} handleTakePhoto={handleTakePhoto} handlePickImage={handlePickImage} addMarker={addMarker} />
            <PinDetailsModal visible={!!selectedPinDetails} onClose={() => setSelectedPinDetails(null)} selectedPinDetails={selectedPinDetails} />
            <RestModal visible={showRestModal} onClose={() => setShowRestModal(false)} onSelect={startRest} isResting={isResting} timeLeft={restTimeLeft} warningMode={warningMode} warningTimeLeft={warningTimeLeft} onEndRest={endRest} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f0' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, color: '#1b5e20', fontWeight: 'bold' },
    messagePill: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 25, flexDirection: 'row', alignItems: 'center', padding: 12, zIndex: 2000, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    messageDanger: { backgroundColor: '#d32f2f' },
    messageWarning: { backgroundColor: '#f57c00' },
    messageSuccess: { backgroundColor: '#2e7d32' },
    messageText: { color: 'white', fontWeight: 'bold', marginLeft: 10, flex: 1 },
    leftToolStack: { position: 'absolute', left: 20, bottom: 120, zIndex: 100 },
    rightToolStack: { position: 'absolute', right: 20, bottom: 120, zIndex: 100 },
    toolButton: { backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
    cameraToolButton: { backgroundColor: '#c62828' },
    chatBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#d32f2f', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'white' },
    chatBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
    topRightOverlay: { position: 'absolute', top: 120, right: 20, alignItems: 'flex-end', zIndex: 100 },
    accuracyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 10 },
    accuracyText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    groupBadge: { position: 'absolute', top: 130, right: 20, backgroundColor: '#1565c0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, flexDirection: 'row', alignItems: 'center', zIndex: 100, elevation: 5 },
    groupBadgeText: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
    bottomActionContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
    startTrekPill: { backgroundColor: '#1b5e20', paddingVertical: 18, paddingHorizontal: 50, borderRadius: 35, elevation: 12 },
    startTrekText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    memberStatusOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20, zIndex: 1000 },
    statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 15, elevation: 5 },
    statusBannerText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
    exitBtnSmall: { marginTop: 15, backgroundColor: 'white', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
    exitBtnText: { color: '#666', fontWeight: 'bold' },
    participantsListContainer: { position: 'absolute', top: 230, left: 20, backgroundColor: 'rgba(255,255,255,0.92)', padding: 12, borderRadius: 15, width: 180, zIndex: 50, elevation: 4 },
    participantsTitle: { fontSize: 10, fontWeight: 'bold', color: '#999', marginBottom: 8, textTransform: 'uppercase' },
    participantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusActive: { backgroundColor: '#4caf50' },
    statusInactive: { backgroundColor: '#ff9800' },
    participantName: { fontSize: 11, fontWeight: '600', color: '#333', flex: 1 },
    participantInactive: { color: '#999' },
    trackBtn: { padding: 4, borderRadius: 4, backgroundColor: '#f0f0f0', marginLeft: 8 },
    trackBtnActive: { backgroundColor: '#1565c0' },
});
