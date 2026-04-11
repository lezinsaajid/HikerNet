
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const REST_OPTIONS = [
    { label: '5 Minutes', value: 5, icon: 'cafe-outline' },
    { label: '15 Minutes', value: 15, icon: 'restaurant-outline' },
    { label: '30 Minutes', value: 30, icon: 'bed-outline' },
    { label: '1 Hour', value: 60, icon: 'timer-outline' },
];

export default function RestModal({ visible, onClose, onSelect, isResting, timeLeft, warningMode, warningTimeLeft, onEndRest }) {
    if (isResting) {
        const minutes = Math.floor((warningMode ? warningTimeLeft : timeLeft) / 60);
        const seconds = (warningMode ? warningTimeLeft : timeLeft) % 60;

        return (
            <Modal transparent visible={visible} animationType="fade">
                <BlurView intensity={80} style={styles.modalOverlay}>
                    <View style={[styles.restingCard, warningMode && styles.warningCard]}>
                        <Ionicons 
                            name={warningMode ? "warning" : "cafe"} 
                            size={60} 
                            color={warningMode ? "#ff5252" : "#1565c0"} 
                        />
                        <Text style={styles.restingTitle}>
                            {warningMode ? "ARE YOU OK?" : "Enjoy Your Rest"}
                        </Text>
                        <Text style={styles.timerText}>
                            {minutes}:{seconds < 10 ? '0' : ''}{seconds}
                        </Text>
                        <Text style={styles.restingSubtitle}>
                            {warningMode 
                                ? "Please respond or SOS will trigger automatically." 
                                : "Take your time. We're monitoring your safety."}
                        </Text>
                        
                        <TouchableOpacity style={styles.endRestBtn} onPress={onEndRest}>
                            <Text style={styles.endRestBtnText}>I'm Ready / I'm OK</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </Modal>
        );
    }

    return (
        <Modal transparent visible={visible} animationType="slide">
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Rest Duration</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.modalDesc}>
                        We will notify you when your rest is over. If you don't respond within 15 mins of the alert, we'll notify your emergency contacts.
                    </Text>
                    <View style={styles.optionsGrid}>
                        {REST_OPTIONS.map((opt) => (
                            <TouchableOpacity 
                                key={opt.value} 
                                style={styles.optionCard}
                                onPress={() => onSelect(opt.value)}
                            >
                                <Ionicons name={opt.icon} size={32} color="#1565c0" />
                                <Text style={styles.optionLabel}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    dismissArea: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, width: '100%', position: 'absolute', bottom: 0 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    modalDesc: { color: '#666', marginBottom: 25, lineHeight: 20 },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    optionCard: { width: '48%', backgroundColor: '#f5f7fa', padding: 20, borderRadius: 15, alignItems: 'center', marginBottom: 15 },
    optionLabel: { marginTop: 10, fontWeight: '600', color: '#333' },
    
    restingCard: { backgroundColor: 'white', padding: 40, borderRadius: 30, alignItems: 'center', width: '85%', elevation: 20 },
    warningCard: { borderWidth: 3, borderColor: '#ff5252' },
    restingTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 20, color: '#333' },
    timerText: { fontSize: 60, fontWeight: 'bold', marginVertical: 20, color: '#1565c0', fontVariants: ['tabular-nums'] },
    restingSubtitle: { textAlign: 'center', color: '#666', marginBottom: 30, fontSize: 16 },
    endRestBtn: { backgroundColor: '#2e7d32', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
    endRestBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});
