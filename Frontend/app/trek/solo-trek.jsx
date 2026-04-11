import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Feature Components
import MapLayer from './_components/MapLayer';
import StatsCard from './_components/StatsCard';
import NavigationBanner from './_components/NavigationBanner';
import TrekControls from './_components/TrekControls';
import MarkerModal from './_components/MarkerModal';
import PinDetailsModal from './_components/PinDetailsModal';
import RestModal from './_components/RestModal';
import WeatherWidget from '../../components/WeatherWidget';

// Orchestrator Hook and Data Layer
import { useTrekSession } from './_hooks/useTrekSession';
import { useRestMode } from './_hooks/useRestMode';
import { ACTIONS } from './_utils/constants';

export default function SoloTrek() {
    const router = useRouter();
    const params = useLocalSearchParams();
    useKeepAwake(); 

    // ALL core trekking logic is now encapsulated here
    const {
        state,
        dispatch,
        mapRef,
        userHeading,
        accuracyStatus,
        startTrek,
        stopTrek,
        retracePath,
        togglePause
    } = useTrekSession(params);

    const {
        isResting,
        restTimeLeft,
        warningMode,
        warningTimeLeft,
        startRest,
        endRest
    } = useRestMode(state.location);

    // Local UI only state
    const [showMarkerModal, setShowMarkerModal] = useState(false);
    const [showRestModal, setShowRestModal] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [waypointDescription, setWaypointDescription] = useState('');
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [waypointImages, setWaypointImages] = useState([]);
    const [selectedPinDetails, setSelectedPinDetails] = useState(null);

    const handleRestSelect = (minutes) => {
        startRest(minutes);
        setShowRestModal(true); // Keep it open to show timer
        dispatch({ type: ACTIONS.REST_START });
    };

    const handleEndRest = () => {
        endRest();
        setShowRestModal(false);
        dispatch({ type: ACTIONS.REST_END });
    };

    // Media Handlers
    const compressImage = async (uri) => {
        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1080 } }],
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

    const addMarker = () => {
        if (!state.location || !selectedIcon) return;
        const newMarker = {
            coordinate: state.location,
            latitude: state.location.latitude,
            longitude: state.location.longitude,
            icon: selectedIcon.icon,
            color: selectedIcon.color,
            type: selectedIcon.label,
            description: waypointDescription,
            images: waypointImages,
            timestamp: new Date()
        };
        dispatch({ type: ACTIONS.ADD_MARKER, payload: newMarker });
        setShowMarkerModal(false);
        setSelectedIcon(null);
        setWaypointDescription('');
        setWaypointImages([]);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    if (!state.location && !state.simulation.isActive) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={{ marginTop: 15, color: '#666', fontWeight: 'bold' }}>Locking GPS Satellites...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* 1. Map Layer (Isolated Native Rendering) */}
            <MapLayer
                mapRef={mapRef}
                location={state.location}
                pathSegments={state.pathSegments}
                ghostSegments={state.ghostSegments}
                markers={state.markers}
                baseWaypoints={state.baseWaypoints}
                navigationPolyline={state.navigationPolyline}
                reroutePath={state.reroutePath}
                offTrailPath={state.offTrailPath}
                mapType={state.mapType}
                mapViewMode={state.mapViewMode}
                userHeading={userHeading}
                onMarkerPress={setSelectedPinDetails}
                retraceFadedIndex={state.retraceFadedIndex}
                isTrailingBack={state.isTrailingBack}
            />

            {/* 2. Overlays - Top Bar */}
            <StatsCard 
                stats={state.stats} 
                formatDuration={formatDuration} 
            />

            {/* 3. Floating Tool Stacks */}
            {/* Left Tools */}
            <View style={styles.leftToolStack}>
                <TouchableOpacity style={styles.toolButton}>
                    <Ionicons name="expand" size={24} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.toolButton}
                    onPress={() => mapRef.current?.animateCamera({ center: state.location, zoom: 18 })}
                >
                    <Ionicons name="navigate" size={24} color="#2e7d32" />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.toolButton} 
                    onPress={() => dispatch({ type: 'UI_ACTION', payload: { mapType: state.mapType === 'satellite' ? 'standard' : 'satellite' } })}
                >
                    <Ionicons name="layers" size={24} color="#666" />
                </TouchableOpacity>
            </View>

            {/* Right Tools */}
            <View style={styles.rightToolStack}>
                <TouchableOpacity 
                    style={[styles.toolButton, styles.cameraBtn]}
                    onPress={() => setShowMarkerModal(true)}
                >
                    <Ionicons name="camera" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {state.navigationPolyline.length > 0 && state.hasStarted && !state.trailFinished && (
                 <NavigationBanner 
                    navigation={state.navigation}
                    offTrackWarning={state.navigation.offTrackWarning}
                    onToggleNavMode={() => dispatch({ type: 'UI_ACTION', payload: { mapViewMode: state.mapViewMode === 'navigation' ? 'explore' : 'navigation' } })}
                 />
            )}

            {state.simulation.isActive && (
                <View style={styles.simOverlay}>
                   <View style={styles.simBadge}>
                       <Ionicons name="pulse" size={12} color="white" />
                       <Text style={styles.simBadgeText}>{state.simulation.phase}</Text>
                   </View>
                </View>
            )}

            {/* 4. Primary Actions */}
            {!state.hasStarted ? (
                <View style={styles.bottomActionContainer}>
                    <TouchableOpacity style={styles.startTrekPill} onPress={startTrek}>
                        <Text style={styles.startTrekText}>Start Trek</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TrekControls 
                    isTracking={state.isTracking}
                    isPaused={state.isPaused}
                    trailFinished={state.trailFinished}
                    isTrailingBack={state.isTrailingBack}
                    onStart={startTrek}
                    onStop={stopTrek}
                    onPause={() => {
                        togglePause();
                        if (!state.isPaused) setShowRestModal(true);
                    }}
                    onExit={() => router.replace('/(tabs)/trek')}
                    onTrailBack={retracePath}
                    onRest={() => setShowRestModal(true)}
                />
            )}

            {/* 4. Isolated Modals */}
            <RestModal
                visible={showRestModal}
                onClose={() => setShowRestModal(false)}
                onSelect={handleRestSelect}
                isResting={isResting}
                timeLeft={restTimeLeft}
                warningMode={warningMode}
                warningTimeLeft={warningTimeLeft}
                onEndRest={handleEndRest}
            />

            <MarkerModal
                visible={showMarkerModal}
                onClose={() => setShowMarkerModal(false)}
                selectedIcon={selectedIcon}
                setSelectedIcon={setSelectedIcon}
                iconSearchQuery={iconSearchQuery}
                setIconSearchQuery={setIconSearchQuery}
                waypointDescription={waypointDescription}
                setWaypointDescription={setWaypointDescription}
                waypointImages={waypointImages}
                handleTakePhoto={handleTakePhoto}
                handlePickImage={handlePickImage}
                addMarker={addMarker}
            />

            <PinDetailsModal
                visible={!!selectedPinDetails}
                onClose={() => setSelectedPinDetails(null)}
                selectedPinDetails={selectedPinDetails}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f0' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Tool Stacks
    leftToolStack: { position: 'absolute', left: 20, bottom: 120, zIndex: 100 },
    rightToolStack: { position: 'absolute', right: 20, bottom: 120, zIndex: 100 },
    toolButton: { 
        backgroundColor: 'white', 
        width: 50, 
        height: 50, 
        borderRadius: 25, 
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: 15,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3
    },
    cameraBtn: { backgroundColor: '#c62828' },

    // Simulation
    simOverlay: { position: 'absolute', top: 121, width: '100%', alignItems: 'center', zIndex: 500 },
    simBadge: { backgroundColor: '#6f42c1', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 25, flexDirection: 'row', alignItems: 'center', elevation: 10 },
    simBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginLeft: 8 },

    // Bottom Action
    bottomActionContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center', zIndex: 1000 },
    startTrekPill: { 
        backgroundColor: '#1b5e20', 
        paddingVertical: 15, 
        paddingHorizontal: 40, 
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    startTrekText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
