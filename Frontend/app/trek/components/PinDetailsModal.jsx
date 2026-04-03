import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TouchableWithoutFeedback, Image } from 'react-native';

export default function PinDetailsModal({
    visible,
    onClose,
    selectedPinDetails
}) {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedPinDetails && (
                            <>
                                <Text style={styles.modalTitle}>{selectedPinDetails.type}</Text>
                                <Text style={styles.pinDescText}>{selectedPinDetails.description}</Text>
                                {selectedPinDetails.images && (
                                    <FlatList 
                                        data={selectedPinDetails.images} 
                                        horizontal 
                                        keyExtractor={(item) => item}
                                        renderItem={({ item }) => <Image source={{ uri: item }} style={styles.pinDetailThumbnail} />} 
                                        style={{ maxHeight: 120 }} 
                                    />
                                )}
                                <TouchableOpacity style={styles.closeModal} onPress={onClose}>
                                    <Text style={styles.closeText}>Close</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 400 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    closeModal: { marginTop: 20, padding: 15, alignItems: 'center' },
    closeText: { color: '#666', fontSize: 16 },
    pinDetailThumbnail: { width: 120, height: 120, borderRadius: 8, marginRight: 10 },
    pinDescText: { fontSize: 15, color: '#444', marginBottom: 10 },
});
