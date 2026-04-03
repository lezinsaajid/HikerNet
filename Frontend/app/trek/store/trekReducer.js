import { ACTIONS } from '../utils/constants';

export const INITIAL_STATE = {
    // Session status
    isTracking: false,
    isPaused: false,
    trailFinished: false,
    isTrailingBack: false,
    hasStarted: false,
    hasJoinedTrail: true, // will be updated based on params
    hasReachedMidpoint: false,
    flowState: 'idle', // 'idle', 'trekking', 'goto-start'

    // Data
    trailId: null,
    pathSegments: [[]],
    ghostSegments: [],
    routeCoordinates: [],
    targetRoute: [],
    navigationPolyline: [],
    markers: [],
    baseWaypoints: [],
    offTrailPath: [],
    reroutePath: [],

    // Stats
    stats: {
        distance: 0,
        duration: 0,
        elevationGain: 0,
        avgSpeed: 0,
        maxAltitude: -Infinity,
        startName: ''
    },

    // Navigation State
    navigation: {
        guidance: "Initializing...",
        distanceToTrail: 9999,
        offTrackWarning: false,
        targetBearing: 0,
        currentNavIndex: 0,
    },

    // Simulation State
    simulation: {
        isActive: false,
        location: null,
        phase: "Initializing...",
    },

    // UI state that doesn't belong in refs or local only
    mapType: 'standard',
    mapViewMode: 'top-down', // 'top-down', 'navigation', 'explore'
    isNavMode: false,
};



export function trekReducer(state, action) {
    switch (action.type) {
        case ACTIONS.INITIALIZE_TREK_DATA:
            return {
                ...state,
                ...action.payload,
            };

        case ACTIONS.SET_STATUS:
            return {
                ...state,
                ...action.payload,
            };

        case ACTIONS.START_TREK:
            return {
                ...state,
                isTracking: true,
                isPaused: false,
                trailFinished: false,
                hasStarted: true,
                hasJoinedTrail: action.payload.hasJoinedTrail,
                trailId: action.payload.trailId,
                navigationPolyline: action.payload.navigationPolyline,
                flowState: 'trekking',
                mapViewMode: 'navigation',
                navigation: {
                    ...state.navigation,
                    guidance: action.payload.guidance,
                    currentNavIndex: 0,
                },
                stats: {
                    ...state.stats,
                    startName: action.payload.startName
                }
            };

        case ACTIONS.STOP_TREK:
            return {
                ...state,
                isTracking: false,
                trailFinished: true,
                mapViewMode: 'explore',
                flowState: 'idle',
            };

        case ACTIONS.PAUSE_TREK:
            return {
                ...state,
                isPaused: true,
            };

        case ACTIONS.RESUME_TREK:
            return {
                ...state,
                isPaused: false,
            };

        case ACTIONS.TRAIL_BACK:
            return {
                ...state,
                ...action.payload,
                isTrailingBack: true,
                isTracking: true,
                hasStarted: true,
                trailFinished: false,
                isPaused: false,
                flowState: 'goto-start',
                mapViewMode: 'navigation',
                stats: {
                    ...INITIAL_STATE.stats
                }
            };

        case ACTIONS.UPDATE_LOCATION:
            const { 
                pathSegments, 
                routeCoordinates, 
                stats, 
                offTrailPath 
            } = action.payload;
            
            return {
                ...state,
                pathSegments: pathSegments || state.pathSegments,
                routeCoordinates: routeCoordinates || state.routeCoordinates,
                stats: stats || state.stats,
                offTrailPath: offTrailPath || state.offTrailPath,
            };

        case ACTIONS.UPDATE_NAVIGATION:
            return {
                ...state,
                navigation: {
                    ...state.navigation,
                    ...action.payload.navigation,
                },
                reroutePath: action.payload.reroutePath === undefined ? state.reroutePath : action.payload.reroutePath,
                hasJoinedTrail: action.payload.hasJoinedTrail === undefined ? state.hasJoinedTrail : action.payload.hasJoinedTrail,
                hasReachedMidpoint: action.payload.hasReachedMidpoint === undefined ? state.hasReachedMidpoint : action.payload.hasReachedMidpoint,
                trailFinished: action.payload.trailFinished === undefined ? state.trailFinished : action.payload.trailFinished,
            };

        case ACTIONS.DETECT_LOOP:
            return {
                ...state,
                pathSegments: action.payload.pathSegments,
                routeCoordinates: action.payload.routeCoordinates,
                ghostSegments: [...state.ghostSegments, action.payload.ghostPart],
            };

        case ACTIONS.SET_SIMULATION:
            return {
                ...state,
                simulation: {
                    ...state.simulation,
                    ...action.payload,
                }
            };

        case ACTIONS.ADD_MARKER:
            return {
                ...state,
                markers: [...state.markers, action.payload]
            };
        
        case ACTIONS.SET_MARKERS:
            return {
                ...state,
                markers: action.payload
            };

        case ACTIONS.UI_ACTION:
            return {
                ...state,
                ...action.payload
            };

        default:
            return state;
    }
}
