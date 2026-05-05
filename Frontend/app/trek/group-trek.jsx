import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
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

// Logic Hooks
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useGroupTrekSession } from './_hooks/useGroupTrekSession';

/**
 * GroupTrek Component
 * 
 * Implements a real-time collaborative trekking experience.
 * Matches the "Solo Trek" pattern for logic and UI consistency.
 */
export default function GroupTrek() {
    const router = useRouter();
    const params = useLocalSearchParams();
    useKeepAwake(); 
    const { user: currentUser } = useAuth();
    const { leaderId, trailId: paramTrailId, uploadedTrailId } = params;

    // CORE ORCHESTRATOR (One Feature Per Function Pattern)
    const {
        state,
        actions,
        sync,
        mapRef,
        messageAnim,
        smoothedLocation,
        userHeading,
        isResting,
        restTimeLeft,
        warningMode,
        warningTimeLeft,
        startRest,
        endRest
    } = useGroupTrekSession({
        trailId: paramTrailId,
        currentUser,
        leaderId,
        uploadedTrailId,
        router
    });

    const isLeader = leaderId === currentUser?._id;

    // 1. Initialization (Fetching Details)
    useEffect(() => {
        const fetchTrekDetails = async () => {
            try {
                const res = await client.get(`/treks/${state.trailId}`);
                const data = res.data;
                const participantIds = data.participants?.map(p => typeof p === 'string' ? p : p._id) || [];
                const uniqueUsers = new Set([...participantIds]);
                if (data.user) uniqueUsers.add(typeof data.user === 'string' ? data.user : data.user._id);
                actions.setTotalExpected(uniqueUsers.size || 1);
                
                if (data.path && data.path.coordinates) {
                    let mappedRoute = [];
                    if (data.path.type === 'MultiLineString') {
                        mappedRoute = data.path.coordinates.map(segment => segment.map(p => ({ latitude: p[1], longitude: p[0] }))).flat();
                    } else {
                        mappedRoute = data.path.coordinates.map(p => ({ latitude: p[1], longitude: p[0] }));
                    }
                    actions.setNavigationPolyline(mappedRoute);
                }
            } catch (err) { console.error("Trek Init Error:", err); }
        };
        if (state.trailId) fetchTrekDetails();
    }, [state.trailId]);

    // 2. UI Data Helpers
    const displayParticipants = useMemo(() => {
        const list = { ...sync.participants };
        if (currentUser?._id) {
            list[currentUser._id] = {
                username: currentUser.username,
                profileImage: currentUser.profileImage,
                location: smoothedLocation,
                isOffTrail: state.offTrackWarning,
                role: isLeader ? 'leader' : 'member',
                isSelf: true
            };
        }
        return Object.entries(list).sort((a, b) => {
            if (a[1].role === 'leader') return -1;
            if (b[1].role === 'leader') return 1;
            if (a[1].isSelf) return -1;
            if (b[1].isSelf) return 1;
            return a[1].username.localeCompare(b[1].username);
        });
    }, [sync.participants, currentUser, smoothedLocation, state.offTrackWarning, isLeader]);

    const formatDuration = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

    // 3. Action Handlers (Delegated to Orchestrator or local UI logic)
    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled) {
            const manip = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1080 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
            actions.setWaypointImages(prev => [...prev, manip.uri]);
        }
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
        if (!result.canceled) {
            const manip = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1080 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
            actions.setWaypointImages(prev => [...prev, manip.uri]);
        }
    };

    const addMarker = async () => {
        if (!smoothedLocation || !state.selectedIcon) return;
        const m = { 
            latitude: smoothedLocation.latitude, longitude: smoothedLocation.longitude, 
            icon: state.selectedIcon.name || state.selectedIcon.icon, type: state.selectedIcon.label, 
            description: state.waypointDescription.trim(), images: state.waypointImages, timestamp: new Date() 
        };
        actions.setMarkers(prev => [...prev, m]);
        sync.emitWaypoint(m);
        actions.setShowMarkerModal(false);
        actions.setSelectedIcon(null);
        actions.setWaypointDescription('');
        actions.setWaypointImages([]);
        await client.put(`/treks/update/${state.trailId}`, { waypoints: [m] });
    };

    const handleExit = () => {
        Alert.alert("Leave Group", "Are you sure you want to leave this session?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Leave", style: "destructive", 
                onPress: () => {
                    if (isLeader) sync.emitControl('EXIT');
                    sync.leaveGroup();
                    router.replace('/(tabs)/trek');
                }
            }
        ]);
    };

    const stopTrek = () => {
        if (!isLeader) return;
        Alert.alert("Finish Trek?", "This will end the session for everyone.", [
            { text: "Continue", style: "cancel" },
            {
                text: "Finish",
                onPress: async () => {
                    actions.setTrailFinished(true);
                    actions.setIsTracking(false);
                    sync.emitControl('STOP');
                    await client.put(`/treks/update/${state.trailId}`, { status: 'completed', stats: state.stats });
                    actions.showMessage("Trek Completed!", 5000, 'success');
                }
            }
        ]);
    };

    const handleRestSelect = (minutes) => {
        startRest(minutes);
        actions.setShowRestModal(true);
    };

    const handleEndRest = () => {
        endRest();
        actions.setShowRestModal(false);
    };

    // 4. Loading State
    if (!smoothedLocation && !state.hasStarted) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1b5e20" />
                <Text style={styles.loadingText}>Syncing Group Session...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Animated Notifications */}
            {state.groupMessage && (
                <Animated.View style={[styles.messagePill, state.groupMessage.type === 'danger' && styles.messageDanger, state.groupMessage.type === 'warning' && styles.messageWarning, state.groupMessage.type === 'info' && styles.messageInfo, { transform: [{ translateY: messageAnim }] }]}>
                    <Ionicons name={state.groupMessage.type === 'danger' ? "alert-circle" : state.groupMessage.type === 'warning' ? "warning" : "notifications"} size={20} color="white" />
                    <Text style={styles.messageText}>{state.groupMessage.text}</Text>
                </Animated.View>
            )}

            {/* Map Layer */}
            <MapLayer
                mapRef={mapRef}
                location={smoothedLocation}
                pathSegments={state.pathSegments}
                ghostSegments={state.ghostSegments}
                markers={state.markers}
                baseWaypoints={state.baseWaypoints}
                navigationPolyline={state.navigationPolyline}
                reroutePath={state.reroutePath}
                mapType={state.mapType}
                mapViewMode={state.mapViewMode}
                userHeading={userHeading}
                onMarkerPress={actions.setSelectedPinDetails}
                participants={sync.participants}
                trailFinished={state.trailFinished}
                role={isLeader ? 'leader' : 'member'}
                groupCentroid={state.groupCentroid}
                trackingUserId={state.trackingUserId}
                isTrailingBack={state.isTrailingBack}
                retraceFadedIndex={state.retraceFadedIndex}
            />

            {/* Top Stats Overlay */}
            <StatsCard stats={state.stats} formatDuration={formatDuration} />

            {/* Participants Management Sidebar/Pill */}
            {state.hasStarted && !state.trailFinished && (
                <View style={styles.participantsListContainer}>
                    <Text style={styles.participantsTitle}>Group ({displayParticipants.length})</Text>
                    {displayParticipants.map(([uid, p]) => (
                        <View key={uid} style={styles.participantRow}>
                            <View style={[styles.statusDot, p.status === 'inactive' ? styles.statusInactive : styles.statusActive, p.isSelf && styles.statusActive]} />
                            <Text style={[styles.participantName, p.status === 'inactive' && styles.participantInactive]} numberOfLines={1}>
                                {p.username} {p.role === 'leader' && "(Leader)"} {p.isSelf && "(You)"}
                            </Text>
                            {(p.role === 'leader' && !isLeader) && (
                                <TouchableOpacity style={[styles.trackBtn, state.isFollowingLeader && styles.trackBtnActive]} onPress={() => actions.setIsFollowingLeader(!state.isFollowingLeader)}>
                                    <Ionicons name={state.isFollowingLeader ? "eye" : "eye-outline"} size={14} color={state.isFollowingLeader ? "white" : "#666"} />
                                </TouchableOpacity>
                            )}
                            {(isLeader && !p.isSelf) && (
                                <TouchableOpacity style={[styles.trackBtn, state.trackingUserId === uid && styles.trackBtnActive]} onPress={() => {
                                    const newId = state.trackingUserId === uid ? null : uid;
                                    actions.setTrackingUserId(newId);
                                    if (newId && p.location?.latitude) {
                                        sync.emitLeaderTrack(uid);
                                        mapRef.current?.animateToRegion({ ...p.location, latitudeDelta: 0.002, longitudeDelta: 0.002 }, 1000);
                                    }
                                }}>
                                    <Ionicons name={state.trackingUserId === uid ? "eye" : "eye-outline"} size={14} color={state.trackingUserId === uid ? "white" : "#666"} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {/* Status Badges */}
            <View style={styles.topRightOverlay}>
                <WeatherWidget compact />
                <View style={[styles.accuracyBadge, { backgroundColor: state.accuracyStatus === 'high' ? 'rgba(46,125,50,0.8)' : 'rgba(183,28,28,0.8)' }]}>
                    <Text style={styles.accuracyText}>{Math.round(state.gpsAccuracy || 0)}m Acc</Text>
                </View>
            </View>

            {/* Navigation Guidance */}
            {((state.hasStarted && !state.trailFinished) || (!isLeader && !state.hasStarted && !state.trailFinished)) && (
                <NavigationBanner navigation={{ guidance: state.navGuidance, distance: state.distanceToTrail }} offTrackWarning={state.offTrackWarning} onToggleNavMode={() => actions.setMapViewMode(prev => prev === 'navigation' ? 'explore' : 'navigation')} />
            )}

            {/* Bottom Primary Controls */}
            {(isLeader || state.trailFinished) ? (
                !state.hasStarted && !state.trailFinished ? (
                    <View style={styles.bottomActionContainer}>
                        <TouchableOpacity style={styles.startTrekPill} onPress={actions.startTrek}>
                            <Text style={styles.startTrekText}>Start Group Trek</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TrekControls 
                        isTracking={state.isTracking} 
                        isPaused={state.isPaused} 
                        trailFinished={state.trailFinished} 
                        isLeader={isLeader}
                        onStart={actions.startTrek} 
                        onStop={stopTrek} 
                        onPause={actions.togglePause} 
                        onExit={handleExit} 
                        onTrailBack={() => actions.initiateTrekBack()}
                        onRest={() => actions.setShowRestModal(true)}
                        onChat={() => {
                            actions.setChatVisible(true);
                            actions.setUnreadCount(0);
                        }}
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

            {/* Side Tool Stacks */}
            <View style={styles.leftToolStack}>
                <TouchableOpacity style={styles.toolButton} onPress={() => { if (smoothedLocation?.latitude) mapRef.current?.animateCamera({ center: smoothedLocation, zoom: 20 }); }}>
                    <Ionicons name="navigate" size={24} color="#2e7d32" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolButton} onPress={() => actions.setMapType(prev => prev === 'satellite' ? 'standard' : 'satellite')}>
                    <Ionicons name="layers" size={24} color="#666" />
                </TouchableOpacity>
            </View>

            <View style={styles.rightToolStack}>
                <TouchableOpacity style={[styles.toolButton, styles.chatBtn, state.unreadCount > 0 && styles.chatBtnUnread]} onPress={() => { actions.setChatVisible(true); actions.setUnreadCount(0); }}>
                    <Ionicons name="chatbubbles" size={24} color={state.unreadCount > 0 ? "white" : "#666"} />
                    {state.unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{state.unreadCount}</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toolButton, styles.cameraBtn]} onPress={() => actions.setShowMarkerModal(true)}>
                    <Ionicons name="camera" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {/* Modals & Overlays */}
            <RestModal
                visible={state.showRestModal}
                onClose={() => actions.setShowRestModal(false)}
                onSelect={handleRestSelect}
                isResting={isResting}
                timeLeft={restTimeLeft}
                warningMode={warningMode}
                warningTimeLeft={warningTimeLeft}
                onEndRest={handleEndRest}
            />
            <MarkerModal visible={state.showMarkerModal} onClose={() => actions.setShowMarkerModal(false)} selectedIcon={state.selectedIcon} setSelectedIcon={actions.setSelectedIcon} iconSearchQuery={state.iconSearchQuery} setIconSearchQuery={actions.setIconSearchQuery} waypointDescription={state.waypointDescription} setWaypointDescription={actions.setWaypointDescription} waypointImages={state.waypointImages} handleTakePhoto={handleTakePhoto} handlePickImage={handlePickImage} addMarker={addMarker} />
            <PinDetailsModal visible={!!state.selectedPinDetails} onClose={() => actions.setSelectedPinDetails(null)} selectedPinDetails={state.selectedPinDetails} />
            <GroupChatOverlay visible={state.chatVisible} onClose={() => actions.setChatVisible(false)} messages={state.messages} onSendMessage={sync.emitMessage} currentUser={currentUser} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f0' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, color: '#1b5e20', fontWeight: 'bold' },
    messagePill: { position: 'absolute', top: 50, left: 20, right: 20, padding: 12, borderRadius: 25, flexDirection: 'row', alignItems: 'center', zIndex: 1000, elevation: 5 },
    messageDanger: { backgroundColor: '#c62828' },
    messageWarning: { backgroundColor: '#f57c00' },
    messageInfo: { backgroundColor: '#1976d2' },
    messageText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 13, flex: 1 },
    participantsListContainer: { position: 'absolute', top: 120, left: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 15, width: 150, zIndex: 100, elevation: 3 },
    participantsTitle: { fontSize: 10, fontWeight: 'bold', color: '#666', marginBottom: 8, textTransform: 'uppercase' },
    participantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusActive: { backgroundColor: '#2e7d32' },
    statusInactive: { backgroundColor: '#999' },
    participantName: { fontSize: 12, color: '#333', flex: 1 },
    participantInactive: { color: '#999' },
    trackBtn: { padding: 4, backgroundColor: '#f0f0f0', borderRadius: 4, marginLeft: 5 },
    trackBtnActive: { backgroundColor: '#2e7d32' },
    topRightOverlay: { position: 'absolute', top: 120, right: 20, alignItems: 'flex-end', zIndex: 100 },
    accuracyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
    accuracyText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    groupBadge: { position: 'absolute', top: 55, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', zIndex: 100 },
    groupBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginLeft: 6 },
    bottomActionContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center', zIndex: 1000 },
    startTrekPill: { backgroundColor: '#1b5e20', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, elevation: 8 },
    startTrekText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    memberStatusOverlay: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    statusBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginBottom: 15, elevation: 5 },
    statusBannerText: { color: 'white', fontWeight: 'bold', marginLeft: 10 },
    exitBtnSmall: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
    exitBtnText: { color: '#c62828', fontWeight: 'bold', fontSize: 12 },
    leftToolStack: { position: 'absolute', left: 20, bottom: 120, zIndex: 100 },
    rightToolStack: { position: 'absolute', right: 20, bottom: 120, zIndex: 100 },
    toolButton: { backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
    cameraBtn: { backgroundColor: '#c62828' },
    chatBtn: { backgroundColor: 'white' },
    chatBtnUnread: { backgroundColor: '#007bff' },
    unreadBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ff4444', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
    unreadText: { color: 'white', fontSize: 10, fontWeight: 'bold' }
});
