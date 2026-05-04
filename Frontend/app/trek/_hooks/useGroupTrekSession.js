import { useReducer, useEffect, useRef, useMemo, useCallback } from 'react';
import { Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { trekReducer, INITIAL_STATE } from '../_store/trekReducer';
import { TrekService } from '../_services/trekService';
import { useSmartLocation } from '../../../hooks/useSmartLocation';
import { useCompass } from '../../../hooks/useCompass';
import { useGroupSync } from '../../../hooks/useGroupSync';
import { useRestMode } from './useRestMode';
import { useGroupTrackingEngine } from './useGroupTrackingEngine';
import { useGroupNavigationEngine } from './useGroupNavigationEngine';
import { ACTIONS } from '../_utils/constants';
import client from '../../../api/client';

export function useGroupTrekSession(params, currentUser) {
    const router = useRouter();
    const [state, dispatch] = useReducer(trekReducer, {
        ...INITIAL_STATE,
        trailId: String(params.trailId),
        hasJoinedTrail: !params.uploadedTrailId,
    });

    const isLeader = params.leaderId === currentUser?._id;
    const mapRef = useRef(null);
    const messageAnim = useRef(new Animated.Value(-100)).current;

    // 1. Unified Location Logic
    const {
        location: validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        error: locationError
    } = useSmartLocation(state.isTracking || state.isTrailingBack || !state.hasStarted);

    const userHeading = useCompass(!state.trailFinished);

    // 2. Messaging UI Logic
    const showMessage = useCallback((text, type = 'info', duration = 5000) => {
        dispatch({ type: ACTIONS.UI_ACTION, payload: { groupMessage: { text, type } } });
        Animated.spring(messageAnim, { toValue: 20, useNativeDriver: true }).start();
        setTimeout(() => {
            Animated.timing(messageAnim, { toValue: -100, duration: 500, useNativeDriver: true }).start(() => {
                dispatch({ type: ACTIONS.UI_ACTION, payload: { groupMessage: null } });
            });
        }, duration);
    }, []);

    // 3. Sync Hook
    const sync = useGroupSync({
        trailId: state.trailId,
        currentUser,
        isLeader,
        leaderId: params.leaderId,
        baseUrl: client.defaults.baseURL,
        onControlAction: (payload) => {
            const action = typeof payload === 'string' ? payload : payload.action;
            const data = typeof payload === 'object' ? payload : {};

            if (action === 'START') {
                dispatch({ type: ACTIONS.START_TREK, payload: { hasJoinedTrail: true, guidance: "Trek started by leader." } });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (action === 'PAUSE') {
                dispatch({ type: ACTIONS.PAUSE_TREK });
                if (data.reason === 'SAFETY_DEVIATION') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    showMessage(`AUTO-PAUSE: ${data.username} is too far!`, 'danger', 8000);
                }
            } else if (action === 'RESUME') {
                dispatch({ type: ACTIONS.RESUME_TREK });
                if (data.reason === 'SAFETY_DEVIATION') showMessage("Group regathered. Resuming.", 'success', 3000);
            } else if (action === 'STOP') {
                dispatch({ type: ACTIONS.STOP_TREK });
                showMessage("Trek Completed!", 'success', 10000);
            } else if (action === 'EXIT') {
                router.replace('/(tabs)/trek');
            } else if (action === 'TREKBACK') {
                initiateTrekBack(true);
            }
            
            // Complex types (Centroid, Safety)
            if (payload.type === 'CENTROID') {
                dispatch({ type: ACTIONS.UPDATE_GROUP_STATS, payload: { groupCentroid: payload.centroid } });
            } else if (payload.type === 'SAFETY_ALERT') {
                if (payload.userId === currentUser?._id) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    showMessage(`SAFETY: You've deviated ${payload.deviation}m!`, 'danger', 8000);
                }
            }
        },
        onWaypointReceived: (waypoint) => dispatch({ type: ACTIONS.ADD_MARKER, payload: waypoint }),
        onPathReceived: (pathData) => {
            if (typeof pathData === 'function') {
                // If it's a functional update (e.g. from trail-point-received), 
                // we need to resolve it against the current state
                dispatch({ 
                    type: ACTIONS.UPDATE_LOCATION, 
                    payload: (prevState) => {
                        const newPath = pathData(prevState.pathSegments);
                        return { pathSegments: newPath, routeCoordinates: newPath.flat() };
                    }
                });
            } else {
                dispatch({ 
                    type: ACTIONS.UPDATE_LOCATION, 
                    payload: { pathSegments: pathData, routeCoordinates: pathData.flat() } 
                });
            }
        },
        onDriftAlert: ({ username, isOffTrail, isLeft, userId }) => {
            if (isLeft) {
                showMessage(`Member Left: ${username} has disconnected.`, 'warning');
            } else if (isOffTrail) {
                // Only alert if this user wasn't already marked as off-trail in local state
                const wasOffTrail = state.participants[userId]?.isOffTrail;
                if (!wasOffTrail) {
                    showMessage(`${username} is off trail!`, 'warning', 3000);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            } else {
                // Back on trail message (optional, but good for clarity)
                const wasOffTrail = state.participants[userId]?.isOffTrail;
                if (wasOffTrail) {
                    showMessage(`${username} is back on trail.`, 'success', 2000);
                }
            }
        },
        onChatMessage: (message) => dispatch({ type: ACTIONS.ADD_MESSAGE, payload: message })
    });

    // 4. Engine Hooks
    useGroupTrackingEngine(state, dispatch, validatedLocation, isLeader, state.trailId);
    useGroupNavigationEngine(state, dispatch, smoothedLocation, sync);
    const { startRest, endRest, restTimeLeft, isResting, warningMode, warningTimeLeft } = useRestMode(smoothedLocation);

    // 5. Initialization
    useEffect(() => {
        const init = async () => {
            try {
                const data = await TrekService.getTrek(state.trailId);
                const participantIds = data.participants?.map(p => typeof p === 'string' ? p : p._id) || [];
                dispatch({ type: ACTIONS.UI_ACTION, payload: { totalExpected: new Set([...participantIds, data.user]).size } });
                
                if (data.path?.coordinates) {
                    const coords = data.path.type === 'MultiLineString' 
                        ? data.path.coordinates.map(s => s.map(p => ({ latitude: p[1], longitude: p[0] }))).flat()
                        : data.path.coordinates.map(p => ({ latitude: p[1], longitude: p[0] }));
                    dispatch({ type: ACTIONS.UI_ACTION, payload: { navigationPolyline: coords, targetRoute: coords } });
                }
            } catch (e) { console.error(e); }
        };
        init();
        sync.emitReady();
    }, [state.trailId]);

    // 6. Navigation Actions
    const startTrek = async () => {
        if (!isLeader) return;
        dispatch({ type: ACTIONS.START_TREK, payload: { hasJoinedTrail: true, guidance: "Trek started." } });
        sync.emitControl('START');
        if (smoothedLocation) {
            const startMarker = { latitude: smoothedLocation.latitude, longitude: smoothedLocation.longitude, icon: 'flag', type: 'Start Point', timestamp: new Date() };
            dispatch({ type: ACTIONS.ADD_MARKER, payload: startMarker });
            sync.emitWaypoint(startMarker);
        }
    };

    const stopTrek = () => {
        if (!isLeader) return;
        Alert.alert("Finish Trek?", "End session for all?", [
            { text: "Cancel" },
            { text: "Finish", onPress: async () => {
                dispatch({ type: ACTIONS.STOP_TREK });
                sync.emitControl('STOP');
                await TrekService.updateTrek(state.trailId, { status: 'completed', stats: state.stats });
            }}
        ]);
    };

    const initiateTrekBack = (remote = false) => {
        const source = state.navigationPolyline.length > 0 ? state.navigationPolyline : state.pathSegments.flat();
        if (source.length < 5) return showMessage("Not enough data to Trek-Back", 'warning');
        
        dispatch({ 
            type: ACTIONS.TRAIL_BACK, 
            payload: { navigationPolyline: [...source].reverse() } 
        });
        if (!remote) sync.emitControl('TREKBACK');
    };

    // Unified list for UI display
    const displayParticipants = useMemo(() => {
        const list = { ...sync.participants };
        if (currentUser?._id) {
            list[currentUser._id] = {
                username: currentUser.username,
                profileImage: currentUser.profileImage,
                location: smoothedLocation,
                isOffTrail: state.navigation.offTrackWarning,
                role: isLeader ? 'leader' : 'member',
                isSelf: true,
                status: 'active'
            };
        }
        return Object.entries(list).sort((a, b) => {
            if (a[1].role === 'leader') return -1;
            if (b[1].role === 'leader') return 1;
            if (a[1].isSelf) return -1;
            if (b[1].isSelf) return 1;
            return a[1].username.localeCompare(b[1].username);
        });
    }, [sync.participants, currentUser, smoothedLocation, state.navigation.offTrackWarning, isLeader]);

    return {
        state, dispatch, mapRef, messageAnim, userHeading, gpsAccuracy, accuracyStatus, locationError,
        isLeader, sync, startTrek, stopTrek, initiateTrekBack, displayParticipants,
        startRest: (m) => { startRest(m); dispatch({ type: ACTIONS.REST_START }); },
        endRest: () => { endRest(); dispatch({ type: ACTIONS.REST_END }); },
        restTimeLeft, isResting, warningMode, warningTimeLeft,
        togglePause: () => {
            const newState = !state.isPaused;
            dispatch({ type: newState ? ACTIONS.PAUSE_TREK : ACTIONS.RESUME_TREK });
            sync.emitControl(newState ? 'PAUSE' : 'RESUME');
            if (!newState) dispatch({ type: ACTIONS.UI_ACTION, payload: { resumedFromPause: true } });
        }
    };
}
