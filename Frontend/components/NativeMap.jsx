import React from 'react';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { View, StyleSheet } from 'react-native';
import { MAP_STYLE_WHITE } from '../styles/mapStyles';

const OSM_URL_TEMPLATE = "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png";

const NativeMap = React.forwardRef((props, ref) => {
    const {
        initialRegion,
        region,
        onPress,
        onPanDrag,
        onRegionChange,
        showsUserLocation = true,
        followsUserLocation = false,
        mapType = 'standard',
        heading = 0, // Map rotation
        userHeading = 0, // Arrow direction
        children,
        style,
        ...otherProps
    } = props;

    // If standard mode, we use custom white tiles to ensure it works without API keys
    const isStandard = mapType === 'standard';

    return (
        <View style={[styles.container, style]}>
            <MapView
                ref={ref}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={initialRegion}
                region={region}
                mapType={isStandard ? 'none' : mapType}
                customMapStyle={isStandard ? MAP_STYLE_WHITE : undefined}
                onPress={onPress}
                onPanDrag={onPanDrag}
                onRegionChange={onRegionChange}
                showsUserLocation={showsUserLocation}
                followsUserLocation={followsUserLocation}
                maxZoomLevel={17}
                loadingEnabled={true}
                rotateEnabled={true}
                camera={{
                    center: region || initialRegion,
                    pitch: 0,
                    heading: heading,
                    zoom: 15,
                    altitude: 1000
                }}
                {...otherProps}
            >
                {isStandard && (
                    <UrlTile
                        urlTemplate={OSM_URL_TEMPLATE}
                        maximumZ={19}
                        flipY={false}
                        zIndex={-1} // Ensure tiles are below markers/polylines
                    />
                )}
                {children}
            </MapView>
        </View>
    );
});

// Re-export Marker, Polyline, UrlTile
export { Marker, Polyline, UrlTile };

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    map: {
        flex: 1,
    }
});

export default NativeMap;
