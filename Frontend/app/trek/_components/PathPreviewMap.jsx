import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Polyline, Marker } from 'react-native-maps';
import NativeMap from '../../../components/NativeMap';
import { getRegionForCoordinates } from '../../../utils/geoUtils';

/**
 * Dedicated component for "Ensuring the smooth showing" of recorded trail paths.
 * Handles automatic zooming, start/end styling, and waypoint rendering.
 */
export default function PathPreviewMap({ coordinates, waypoints, style }) {
    const mapRef = React.useRef(null);
    
    const region = useMemo(() => {
        // Tight 1.1 multiplier for maximum detail on recorded paths
        return getRegionForCoordinates(coordinates, 1.1);
    }, [coordinates]);

    // Ensure the map zooms whenever coordinates are loaded or updated
    React.useEffect(() => {
        if (coordinates && coordinates.length > 0 && mapRef.current) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true
            });
        }
    }, [coordinates]);

    if (!coordinates || coordinates.length === 0) {
        return <View style={[styles.fallback, style]} />;
    }

    const startPoint = coordinates[0];
    const endPoint = coordinates[coordinates.length - 1];

    return (
        <NativeMap
            ref={mapRef}
            initialRegion={region}
            scrollEnabled={true}
            zoomEnabled={true}
            showsUserLocation={false}
            style={[styles.map, style]}
        >
            {/* The Trail Path */}
            <Polyline
                coordinates={coordinates}
                strokeWidth={5}
                strokeColor="#fc4c02"
                lineJoin="round"
                lineCap="round"
                zIndex={5}
            />
            
            {/* Start Point Marker */}
            <Marker coordinate={startPoint} zIndex={10}>
                <View style={styles.brandedMarker}>
                    <Ionicons name="location" size={45} color="#fc4c02" />
                    <View style={styles.markerLabelContainer}>
                        <Text style={styles.markerLabelText}>START</Text>
                    </View>
                </View>
            </Marker>
            
            {/* End Point Marker */}
            {coordinates.length > 1 && (
                <Marker coordinate={endPoint} zIndex={10}>
                    <View style={styles.brandedMarker}>
                        <Ionicons name="location" size={45} color="#28a745" />
                        <View style={styles.markerLabelContainer}>
                            <Text style={styles.markerLabelText}>FINISH</Text>
                        </View>
                    </View>
                </Marker>
            )}

            {/* Waypoints / Checkpoints recorded during session */}
            {waypoints && waypoints.map((m, i) => (
                <Marker
                    key={`waypoint-${i}`}
                    coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                    title={m.title || m.type}
                    description={m.description}
                >
                    <View style={[styles.waypointDot, { backgroundColor: m.color || '#00838f' }]}>
                        <Ionicons name={m.icon || 'location'} size={10} color="white" />
                    </View>
                </Marker>
            ))}
        </NativeMap>
    );
}

const styles = StyleSheet.create({
    map: {
        width: '100%',
        height: '100%',
    },
    fallback: {
        backgroundColor: '#f0f0f0',
        width: '100%',
        height: '100%',
    },
    endpointMarker: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    waypointDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
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
