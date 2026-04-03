import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TrekControls({ 
    isTracking, 
    isPaused, 
    trailFinished, 
    isTrailingBack,
    onStart, 
    onStop, 
    onPause, 
    onExit, 
    onTrailBack 
}) {
    if (trailFinished) {
        return (
            <View style={styles.controls}>
                <View style={styles.finishedContainer}>
                    <Text style={styles.finishedTitle}>Trek Completed!</Text>
                    {!isTrailingBack ? (
                        <View style={styles.row}>
                             <TouchableOpacity style={[styles.actionButton, styles.trailBackBtn, { marginRight: 10 }]} onPress={onTrailBack}>
                                <Ionicons name="arrow-back" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.actionButtonText}>Retrace Path</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.exitBtn]} onPress={onExit}>
                                <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.actionButtonText}>Finish & Exit</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                         <TouchableOpacity style={[styles.actionButton, styles.exitBtn]} onPress={onExit}>
                            <Text style={styles.actionButtonText}>End Session</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    if (!isTracking) {
        return (
            <View style={styles.controls}>
                 <TouchableOpacity style={styles.startBigBtn} onPress={onStart}>
                    <Ionicons name="play" size={32} color="white" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.controls}>
            <View style={styles.row}>
                <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={onStop}>
                    <Ionicons name="stop" size={30} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.pauseBtn]} onPress={onPause}>
                    <Ionicons name={isPaused ? "play" : "pause"} size={30} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    controls: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    row: { flexDirection: 'row' },
    button: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 8 },
    stopBtn: { backgroundColor: '#dc3545' },
    pauseBtn: { backgroundColor: '#ffc107' },
    startBigBtn: { backgroundColor: '#28a745', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 15 },
    finishedContainer: { backgroundColor: 'white', padding: 20, borderRadius: 20, width: '100%', alignItems: 'center', elevation: 10 },
    finishedTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    actionButton: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
    trailBackBtn: { backgroundColor: '#17a2b8' },
    exitBtn: { backgroundColor: '#28a745' },
    actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
