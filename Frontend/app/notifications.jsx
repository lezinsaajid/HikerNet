import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Image,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client from "../api/client";
import { formatDistanceToNow } from "date-fns";

const NotificationScreen = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const fetchNotifications = async () => {
        try {
            const { data } = await client.get("/notifications");
            setNotifications(data);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications();
    }, []);

    const markAsRead = async (id) => {
        try {
            await client.patch(`/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
            );
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const handlePress = (notification) => {
        if (!notification.isRead) {
            markAsRead(notification._id);
        }

        // Navigate based on type
        switch (notification.type) {
            case "like":
            case "comment":
            case "tag":
                if (notification.postId) {
                    router.push(`/post/${notification.postId}`);
                }
                break;
            case "friend_request":
            case "follow":
                if (notification.senderId) {
                    router.push(`/user-profile/${notification.senderId._id}`);
                }
                break;
            case "trek_invite":
            case "trek_update":
            case "trek_join":
            case "trek_leave":
                if (notification.trekId) {
                    router.push(`/trek/${notification.trekId}`);
                }
                break;
            case "message":
                const chatId = notification.relatedId || (notification.data && notification.data.chatId);
                if (chatId) {
                    router.push(`/chat/${chatId}`);
                } else {
                    router.push('/chat'); // Fallback to chat list
                }
                break;
            default:
                break;
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case "like": return { name: "heart", color: "#e91e63" };
            case "comment": return { name: "chatbubble", color: "#2196f3" };
            case "tag": return { name: "pricetag", color: "#9c27b0" };
            case "friend_request": return { name: "person-add", color: "#4caf50" };
            case "trek_invite": return { name: "mail", color: "#ff9800" };
            case "trek_update": return { name: "refresh", color: "#2196f3" };
            case "trek_reminder": return { name: "alarm", color: "#f44336" };
            case "sos": return { name: "alert-circle", color: "#f44336" };
            case "message": return { name: "mail", color: "#2196f3" };
            default: return { name: "notifications", color: "#757575" };
        }
    };

    const renderItem = ({ item }) => {
        const icon = getIcon(item.type);
        const isTrekNotification = item.type.startsWith("trek_");

        return (
            <TouchableOpacity
                style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
                onPress={() => handlePress(item)}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name={icon.name} size={24} color={icon.color} />
                </View>

                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.senderName}>
                            {item.senderId?.username || "System"}
                        </Text>
                        <Text style={styles.timeText}>
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                    <Text style={[styles.message, !item.isRead && styles.unreadText]}>
                        {item.message}
                    </Text>
                    {isTrekNotification && (
                        <View style={styles.trekTag}>
                            <Ionicons name="footsteps" size={12} color="#28a745" />
                            <Text style={styles.trekTagText}>Trekking</Text>
                        </View>
                    )}
                </View>

                {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#28a745" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {notifications.some(n => !n.isRead) && (
                    <TouchableOpacity onPress={async () => {
                        await client.patch("/notifications/read-all");
                        fetchNotifications();
                    }}>
                        <Text style={styles.markAllText}>Mark all as read</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    markAllText: {
        color: "#28a745",
        fontWeight: "600",
    },
    notificationItem: {
        flexDirection: "row",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
        alignItems: "center",
    },
    unreadItem: {
        backgroundColor: "#f9fff9",
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    senderName: {
        fontWeight: "bold",
        fontSize: 16,
        color: "#333",
    },
    timeText: {
        fontSize: 12,
        color: "#888",
    },
    message: {
        fontSize: 14,
        color: "#555",
        lineHeight: 20,
    },
    unreadText: {
        color: "#000",
        fontWeight: "500",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#28a745",
        marginLeft: 8,
    },
    trekTag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#e8f5e9",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: "flex-start",
        marginTop: 6,
    },
    trekTagText: {
        fontSize: 10,
        color: "#28a745",
        fontWeight: "bold",
        marginLeft: 4,
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: "center",
    },
    emptyText: {
        marginTop: 16,
        color: "#888",
        fontSize: 16,
    },
});

export default NotificationScreen;
