import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, FlatList, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MARKER_ICONS } from '../_utils/constants';

export default function MarkerModal({
    visible,
    onClose,
    selectedIcon,
    setSelectedIcon,
    iconSearchQuery,
    setIconSearchQuery,
    waypointDescription,
    setWaypointDescription,
    waypointImages,
    handleTakePhoto,
    handlePickImage,
    addMarker
}) {
    const handleSelectIcon = (iconData) => {
        setSelectedIcon(iconData);
        setIconSearchQuery('');
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedIcon ? `Pin ${selectedIcon.label}` : 'Select Waypoint Icon'}</Text>
                            {!selectedIcon ? (
                                <>
                                    <View style={styles.searchContainer}>
                                        <TextInput style={styles.searchInput} placeholder="Search icons..." value={iconSearchQuery} onChangeText={setIconSearchQuery} />
                                    </View>
                                    <FlatList
                                        data={MARKER_ICONS.filter(item => item.label.toLowerCase().includes(iconSearchQuery.toLowerCase()))}
                                        numColumns={3}
                                        keyExtractor={(item) => item.name}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity style={styles.iconOption} onPress={() => handleSelectIcon(item)}>
                                                <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                                                    <Ionicons name={item.icon} size={24} color="white" />
                                                </View>
                                                <Text style={styles.iconLabel}>{item.label}</Text>
                                            </TouchableOpacity>
                                        )}
                                    />
                                </>
                            ) : (
                                <View style={styles.descriptionSection}>
                                    <TextInput style={styles.descriptionInput} placeholder="Add a note..." value={waypointDescription} onChangeText={setWaypointDescription} multiline />
                                    <View style={styles.mediaButtonsRow}>
                                        <TouchableOpacity style={styles.mediaBtn} onPress={handleTakePhoto}><Text style={styles.mediaBtnText}>Camera</Text></TouchableOpacity>
                                        <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: '#007bff' }]} onPress={handlePickImage}><Text style={styles.mediaBtnText}>Gallery</Text></TouchableOpacity>
                                    </View>
                                    {waypointImages.length > 0 && <FlatList data={waypointImages} horizontal keyExtractor={(item) => item} renderItem={({ item }) => <Image source={{ uri: item }} style={styles.waypointThumbnail} />} style={{ marginTop: 10, maxHeight: 80 }} />}
                                    <TouchableOpacity style={[styles.actionButton, styles.exitBtn, { marginTop: 20, justifyContent: 'center' }]} onPress={addMarker}><Text style={styles.actionButtonText}>Pin Waypoint</Text></TouchableOpacity>
                                </View>
                            )}
                            <TouchableOpacity style={styles.closeModal} onPress={onClose}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 400 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    iconOption: { flex: 1, alignItems: 'center', marginBottom: 20 },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    iconLabel: { fontSize: 12, color: '#333', marginTop: 5 },
    closeModal: { marginTop: 20, padding: 15, alignItems: 'center' },
    closeText: { color: '#666', fontSize: 16 },
    descriptionSection: { padding: 5 },
    descriptionInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 15, fontSize: 16, minHeight: 80 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f5', borderRadius: 12, marginBottom: 20, paddingHorizontal: 10 },
    searchInput: { flex: 1, height: 45 },
    keyboardAvoidingView: { width: '100%' },
    mediaButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    mediaBtn: { backgroundColor: '#6c757d', padding: 10, borderRadius: 8, flex: 0.48, alignItems: 'center' },
    mediaBtnText: { color: 'white', fontWeight: 'bold' },
    waypointThumbnail: { width: 70, height: 70, borderRadius: 8, marginRight: 10 },
    actionButton: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
    exitBtn: { backgroundColor: '#28a745' },
    actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
