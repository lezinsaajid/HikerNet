export const MARKER_ICONS = [
    { name: 'water', icon: 'water', color: '#007bff', label: 'Water', tags: ['river', 'lake', 'drink', 'stream', 'wet'] },
    { name: 'camera', icon: 'camera', color: '#6610f2', label: 'Viewpoint', tags: ['photo', 'view', 'picture', 'scenery', 'lookout'] },
    { name: 'danger', icon: 'warning', color: '#dc3545', label: 'Danger', tags: ['warning', 'careful', 'hazard', 'risk', 'steep'] },
    { name: 'camp', icon: 'bonfire', color: '#fd7e14', label: 'Camp', tags: ['fire', 'night', 'tent', 'sleep', 'stay'] },
    { name: 'rest', icon: 'cafe', color: '#6f42c1', label: 'Rest', tags: ['coffee', 'food', 'break', 'sit', 'eat'] },
    { name: 'mountain', icon: 'mountain', color: '#6d4c41', label: 'Peak', tags: ['summit', 'climb', 'top', 'hill', 'high'] },
    { name: 'tree', icon: 'leaf', color: '#2e7d32', label: 'Forest', tags: ['trees', 'woods', 'jungle', 'nature', 'green'] },
    { name: 'animal', icon: 'paw', color: '#ef6c00', label: 'Wildlife', tags: ['tiger', 'bear', 'deer', 'animal', 'track', 'cat', 'dog'] },
    { name: 'flag', icon: 'flag', color: '#c62828', label: 'Goal', tags: ['finish', 'end', 'destination', 'target', 'win'] },
    { name: 'info', icon: 'information-circle', color: '#00838f', label: 'Info', tags: ['help', 'details', 'note', 'guide', 'sign'] },
    { name: 'trail', icon: 'trail-sign', color: '#455a64', label: 'Trail', tags: ['path', 'road', 'way', 'direction', 'route'] },
    { name: 'rain', icon: 'rainy', color: '#0288d1', label: 'Rain', tags: ['storm', 'wet', 'weather', 'clouds', 'umbrella'] },
    { name: 'bicycle', icon: 'bicycle', color: '#311b92', label: 'Cycle', tags: ['bike', 'ride', 'wheels', 'fast', 'cyclist'] },
    { name: 'fish', icon: 'fish', color: '#03a9f4', label: 'Fishing', tags: ['water', 'sea', 'river', 'catch', 'food'] },
];

export const NAVIGATION_CONFIG = {
    OFF_TRACK_THRESHOLD: 15,
    ON_TRACK_THRESHOLD: 10,
    GOAL_PROXIMITY: 10,
    START_PROXIMITY: 15,
    ROAD_REROUTE_MIN_DISTANCE: 50,
};

export const TREK_CONFIG = {
    NEW_SEGMENT_THRESHOLD: 20, // meters since last point to force new segment
    LOOP_DETECTION: {
        minPoints: 40,
        ignoreLast: 25,
        maxDistance: 15,
        maxHeadingDiff: 90
    },
    LOOP_COOLDOWN: 30, // points to wait before detecting next loop
    SYNC_INTERVAL: 1000,
    AUTO_START_DELAY: 1000,
};

export const ACTIONS = {
    INITIALIZE_TREK_DATA: 'INITIALIZE_TREK_DATA',
    SET_STATUS: 'SET_STATUS',
    UPDATE_STATS: 'UPDATE_STATS',
    UPDATE_LOCATION: 'UPDATE_LOCATION',
    START_TREK: 'START_TREK',
    STOP_TREK: 'STOP_TREK',
    PAUSE_TREK: 'PAUSE_TREK',
    RESUME_TREK: 'RESUME_TREK',
    TRAIL_BACK: 'TRAIL_BACK',
    UPDATE_NAVIGATION: 'UPDATE_NAVIGATION',
    ADD_MARKER: 'ADD_MARKER',
    SET_MARKERS: 'SET_MARKERS',
    DETECT_LOOP: 'DETECT_LOOP',
    SET_SIMULATION: 'SET_SIMULATION',
    UI_ACTION: 'UI_ACTION',
    UPDATE_TREK_BACK_PROGRESS: 'UPDATE_TREK_BACK_PROGRESS',
    REST_START: 'REST_START',
    REST_END: 'REST_END',
};


