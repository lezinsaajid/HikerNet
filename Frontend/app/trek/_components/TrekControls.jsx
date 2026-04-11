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
    onTrailBack,
    onRest
}) {
    if (trailFinished) {
        return (
            <View style={styles.fullscreenOverlay}>
                <View style={styles.finishedContainer}>
                    <Text style={styles.finishedTitle}>Trek Completed!</Text>
                    
                    {!isTrailingBack ? (
                        <View style={styles.column}>
                             <TouchableOpacity style={[styles.actionButton, styles.trailBackBtn, styles.fullWidthBtn]} onPress={onTrailBack}>
                                <Ionicons name="arrow-back" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.actionButtonText}>Trail Back</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionButton, styles.restBtn, styles.fullWidthBtn]} onPress={onRest}>
                                <Ionicons name="cafe" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.actionButtonText}>Take a Rest</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionButton, styles.exitBtn, styles.fullWidthBtn]} onPress={onExit}>
                                <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.actionButtonText}>Finish & Exit</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                         <View style={styles.column}>
                            <TouchableOpacity style={[styles.actionButton, styles.restBtn, styles.fullWidthBtn]} onPress={onRest}>
                                <Ionicons name="cafe" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.actionButtonText}>Take a Rest</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.exitBtn, styles.fullWidthBtn]} onPress={onExit}>
                                <Text style={styles.actionButtonText}>End Session</Text>
                            </TouchableOpacity>
                         </View>
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
                    <Ionicons name="stop" size={24} color="white" />
                    <Text style={styles.buttonLabel}>Stop</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.pauseBtn]} onPress={onPause}>
                    <Ionicons name={isPaused ? "play" : "pause"} size={24} color="white" />
                    <Text style={styles.buttonLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fullscreenOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 2000 },
    controls: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    row: { flexDirection: 'row' },
    column: { width: '100%', paddingHorizontal: 10 },
    button: { width: 75, height: 75, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8, elevation: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
    stopBtn: { backgroundColor: '#c62828' },
    pauseBtn: { backgroundColor: '#f9a825' },
    restBtn: { backgroundColor: '#1565c0', marginBottom: 12 },
    buttonLabel: { color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
    startBigBtn: { backgroundColor: '#28a745', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 15 },
    finishedContainer: { backgroundColor: 'white', padding: 25, borderRadius: 30, width: '85%', alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    finishedTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 25, color: '#333' },
    actionButton: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    fullWidthBtn: { width: '100%' },
    trailBackBtn: { backgroundColor: '#0288d1' },
    exitBtn: { backgroundColor: '#2e7d32' },
    actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
