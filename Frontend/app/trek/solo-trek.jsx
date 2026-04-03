import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Feature Components
import MapLayer from './components/MapLayer';
import StatsCard from './components/StatsCard';
import NavigationBanner from './components/NavigationBanner';
import TrekControls from './components/TrekControls';
import MarkerModal from './components/MarkerModal';
import PinDetailsModal from './components/PinDetailsModal';
import WeatherWidget from '../../components/WeatherWidget';

// Orchestrator Hook and Data Layer
import { useTrekSession } from './hooks/useTrekSession';
import { ACTIONS } from './utils/constants';

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

    // Local UI only state
    const [showMarkerModal, setShowMarkerModal] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [waypointDescription, setWaypointDescription] = useState('');
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [waypointImages, setWaypointImages] = useState([]);
    const [selectedPinDetails, setSelectedPinDetails] = useState(null);

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
            />

            {/* 2. Overlays */}
            <View style={styles.weatherOverlay}>
                <WeatherWidget />
            </View>

            <View style={styles.statusOverlay}>
                <View style={[styles.statusBadge, { opacity: accuracyStatus === 'Poor' ? 1 : 0.8 }]}>
                    <View style={[styles.accuracyDot, { backgroundColor: accuracyStatus === 'Excellent' ? '#28a745' : '#ffc107' }]} />
                    <Text style={styles.statusText}>{accuracyStatus} GPS</Text>
                </View>
            </View>
            
            {state.navigationPolyline.length > 0 && state.hasStarted && !state.trailFinished && (
                 <NavigationBanner 
                    navigation={state.navigation}
                    offTrackWarning={state.navigation.offTrackWarning}
                    onToggleNavMode={() => dispatch({ type: 'UI_ACTION', payload: { mapViewMode: state.mapViewMode === 'navigation' ? 'explore' : 'navigation' } })}
                 />
            )}

            <View style={styles.topButtonsContainer}>
                <TouchableOpacity 
                    style={styles.mapIconButton} 
                    onPress={() => dispatch({ type: 'UI_ACTION', payload: { mapType: state.mapType === 'satellite' ? 'standard' : 'satellite' } })}
                >
                    <Ionicons name="layers" size={24} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.mapIconButton} 
                    onPress={() => setShowMarkerModal(true)}
                >
                    <Ionicons name="add" size={24} color="#555" />
                </TouchableOpacity>
            </View>

            {state.simulation.isActive && (
                <View style={styles.simOverlay}>
                   <View style={styles.simBadge}>
                       <Ionicons name="pulse" size={12} color="white" />
                       <Text style={styles.simBadgeText}>{state.simulation.phase}</Text>
                   </View>
                </View>
            )}

            {/* 3. Logic-Driven UI Controls */}
            <View style={styles.bottomOverlay}>
                <StatsCard stats={state.stats} formatDuration={formatDuration} />
                <TrekControls 
                    isTracking={state.isTracking}
                    isPaused={state.isPaused}
                    trailFinished={state.trailFinished}
                    isTrailingBack={state.isTrailingBack}
                    onStart={startTrek}
                    onStop={stopTrek}
                    onPause={togglePause}
                    onExit={() => router.replace('/(tabs)/trek')}
                    onTrailBack={retracePath}
                />
            </View>

            {/* 4. Isolated Modals */}
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
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    weatherOverlay: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
    statusOverlay: { position: 'absolute', top: 80, width: '100%', alignItems: 'center', zIndex: 20 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusText: { marginLeft: 6, fontSize: 14, fontWeight: 'bold', color: '#007bff' },
    accuracyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    topButtonsContainer: { position: 'absolute', top: 110, left: 20, zIndex: 10 },
    mapIconButton: { backgroundColor: 'white', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', elevation: 5, marginBottom: 10 },
    bottomOverlay: { position: 'absolute', bottom: 0, left: 20, right: 20, zIndex: 100 },
    simOverlay: { position: 'absolute', top: 121, width: '100%', alignItems: 'center' },
    simBadge: { backgroundColor: '#6f42c1', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 25, flexDirection: 'row', alignItems: 'center', elevation: 10 },
    simBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginLeft: 8 }
});
