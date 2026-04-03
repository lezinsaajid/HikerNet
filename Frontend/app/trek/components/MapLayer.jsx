import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import NativeMap, { Polyline, Marker } from '../../../components/NativeMap';
import { Ionicons } from '@expo/vector-icons';

export default function MapLayer({ 
    mapRef,
    location, 
    pathSegments, 
    ghostSegments,
    markers, 
    baseWaypoints,
    navigationPolyline,
    reroutePath,
    offTrailPath,
    mapType,
    mapViewMode,
    isNavMode,
    userHeading,
    onMarkerPress
}) {
    // Memoize the faded route logic for performance
    const renderNavPaths = useMemo(() => {
        if (!navigationPolyline || navigationPolyline.length < 2) return null;
        return (
            <>
                <Polyline 
                    coordinates={navigationPolyline} 
                    strokeWidth={5} 
                    strokeColor="rgba(0, 123, 255, 0.3)" 
                    lineDashPattern={[10, 10]} 
                />
                {reroutePath && reroutePath.length > 0 && (
                     <Polyline coordinates={reroutePath} strokeWidth={4} strokeColor="#9c27b0" />
                )}
                {offTrailPath && offTrailPath.length > 0 && (
                     <Polyline coordinates={offTrailPath} strokeWidth={3} strokeColor="rgba(220, 53, 69, 0.5)" lineDashPattern={[5, 10]} />
                )}
            </>
        );
    }, [navigationPolyline, reroutePath, offTrailPath]);

    const renderTrekPaths = useMemo(() => {
        return (
            <>
                {pathSegments.map((seg, idx) => (
                    <Polyline 
                        key={`path-${idx}`} 
                        coordinates={seg} 
                        strokeWidth={6} 
                        strokeColor="#28a745" 
                    />
                ))}
                {ghostSegments.map((seg, idx) => (
                    <Polyline 
                        key={`ghost-${idx}`} 
                        coordinates={seg} 
                        strokeWidth={4} 
                        strokeColor="rgba(0,0,0,0.2)" 
                        lineDashPattern={[5, 5]} 
                    />
                ))}
            </>
        );
    }, [pathSegments, ghostSegments]);

    return (
        <NativeMap
            ref={mapRef}
            style={styles.map}
            mapType={mapType}
            initialRegion={location ? {
                ...location,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005
            } : null}
            showsUserLocation={false} 
        >
            {renderNavPaths}
            {renderTrekPaths}

            {/* Global/Reference Trail Waypoints */}
            {baseWaypoints.map((wp, idx) => (
                <Marker 
                    key={`base-wp-${idx}`} 
                    coordinate={wp.coordinate || wp} 
                    onPress={() => onMarkerPress(wp)}
                >
                    <Ionicons name="location" size={24} color="#888" />
                </Marker>
            ))}

            {/* Current Session Waypoints */}
            {markers.map((m, idx) => (
                <Marker 
                    key={`marker-${idx}`} 
                    coordinate={m.coordinate || m} 
                    onPress={() => onMarkerPress(m)}
                >
                    <Ionicons name={m.icon || 'location'} size={32} color={m.color || '#007bff'} />
                </Marker>
            ))}

            {/* Custom Interactive User Marker */}
            {location && (
                <Marker coordinate={location}>
                    <View style={styles.userMarkerContainer}>
                        <View style={styles.userMarkerPulse} />
                        <View style={styles.userMarkerContainerInner}>
                            <View style={styles.userMarkerDot} />
                            <View style={[styles.userMarkerArrow, { transform: [{ rotate: `${userHeading}deg` }] }]}>
                                <Ionicons name="caret-up" size={14} color="#007bff" />
                            </View>
                        </View>
                    </View>
                </Marker>
            )}
        </NativeMap>
    );
}

const styles = StyleSheet.create({
    map: { flex: 1 },
    userMarkerContainer: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
    userMarkerPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,123,255,0.4)' },
    userMarkerContainerInner: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    userMarkerDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#007bff', borderWidth: 3, borderColor: 'white' },
    userMarkerArrow: { position: 'absolute', top: -6 }
});
