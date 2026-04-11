import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Polyline, Marker } from 'react-native-maps';
import NativeMap from '../../../components/NativeMap';
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
    onMarkerPress,
    retraceFadedIndex,
    isTrailingBack
}) {
    // Memoize the faded route logic for performance
    const renderNavPaths = useMemo(() => {
        if (!navigationPolyline || navigationPolyline.length < 2) return null;

        if (isTrailingBack && retraceFadedIndex >= 0) {
            const fadedPath = navigationPolyline.slice(0, retraceFadedIndex + 1);
            const activePath = navigationPolyline.slice(retraceFadedIndex);

            return (
                <>
                    {fadedPath.length > 1 && (
                        <Polyline 
                            coordinates={fadedPath} 
                            strokeWidth={5} 
                            strokeColor="rgba(0, 0, 0, 0.4)" 
                            zIndex={3}
                        />
                    )}
                    {activePath.length > 1 && (
                        <Polyline 
                            coordinates={activePath} 
                            strokeWidth={6} 
                            strokeColor="#007bff" 
                            zIndex={4}
                        />
                    )}
                    {reroutePath && reroutePath.length > 0 && (
                         <Polyline coordinates={reroutePath} strokeWidth={4} strokeColor="#9c27b0" zIndex={5} />
                    )}
                </>
            );
        }

        return (
            <>
                <Polyline 
                    coordinates={navigationPolyline} 
                    strokeWidth={5} 
                    strokeColor="rgba(0, 123, 255, 0.4)" 
                    lineDashPattern={[10, 10]} 
                    zIndex={3}
                />
                {reroutePath && reroutePath.length > 0 && (
                     <Polyline coordinates={reroutePath} strokeWidth={4} strokeColor="#9c27b0" zIndex={5} />
                )}
                {offTrailPath && offTrailPath.length > 0 && (
                     <Polyline coordinates={offTrailPath} strokeWidth={3} strokeColor="rgba(220, 53, 69, 0.5)" lineDashPattern={[5, 10]} zIndex={4} />
                )}
            </>
        );
    }, [navigationPolyline, reroutePath, offTrailPath, isTrailingBack, retraceFadedIndex]);

    const renderTrekPaths = useMemo(() => {
        // If trailing back, we rely on renderNavPaths to show the faded/active return path
        if (isTrailingBack) return null;

        return (
            <>
                {pathSegments.map((seg, idx) => (
                    <Polyline 
                        key={`path-${idx}`} 
                        coordinates={seg} 
                        strokeWidth={6} 
                        strokeColor="#28a745" 
                        zIndex={5}
                    />
                ))}
                {ghostSegments.map((seg, idx) => (
                    <Polyline 
                        key={`ghost-${idx}`} 
                        coordinates={seg} 
                        strokeWidth={4} 
                        strokeColor="rgba(0,0,0,0.3)" 
                        lineDashPattern={[5, 5]} 
                        zIndex={2}
                    />
                ))}
            </>
        );
    }, [pathSegments, ghostSegments, isTrailingBack]);

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

            {/* Trek Start & End Markers */}
            {pathSegments.length > 0 && pathSegments[0].length > 0 && (
                <Marker coordinate={pathSegments[0][0]}>
                    <View style={styles.brandedMarker}>
                        <Ionicons name="location" size={45} color="#fc4c02" />
                        <View style={styles.markerLabelContainer}>
                            <Text style={styles.markerLabelText}>START</Text>
                        </View>
                    </View>
                </Marker>
            )}

            {pathSegments.length > 0 && pathSegments[pathSegments.length - 1].length > 0 && (
                <Marker coordinate={pathSegments[pathSegments.length - 1][pathSegments[pathSegments.length - 1].length - 1]}>
                    <View style={styles.brandedMarker}>
                        <Ionicons name="location" size={45} color="#28a745" />
                        <View style={styles.markerLabelContainer}>
                            <Text style={styles.markerLabelText}>FINISH</Text>
                        </View>
                    </View>
                </Marker>
            )}

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
    userMarkerArrow: { position: 'absolute', top: -6 },
    brandedMarker: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
        height: 50,
    },
    markerLabelContainer: {
        position: 'absolute',
        top: 6,
        backgroundColor: 'white',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    markerLabelText: {
        fontSize: 6,
        fontWeight: '900',
        color: '#333',
    }
});
