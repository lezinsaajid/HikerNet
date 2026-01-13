import React from 'react';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { View, StyleSheet } from 'react-native';

const NativeMap = ({
    initialRegion,
    onPress,
    showsUserLocation = true,
    followsUserLocation = false,
    children,
    style
}) => {
    return (
        <MapView
            style={[styles.map, style]}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            onPress={onPress}
            showsUserLocation={showsUserLocation}
            followsUserLocation={followsUserLocation}
        >
            {children}
        </MapView>
    );
};

// Re-export Marker and Polyline so screens can use them without importing from react-native-maps directly
export { Marker, Polyline };

const styles = StyleSheet.create({
    map: {
        flex: 1,
    }
});

export default NativeMap;
