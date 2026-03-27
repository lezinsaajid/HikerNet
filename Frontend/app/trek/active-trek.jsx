import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import SoloTrek from './solo-trek';
import GroupTrek from './group-trek';

/**
 * ActiveTrek Router
 * This component acts as a lightweight switch between Solo and Group trekking modes.
 * It dynamically renders the appropriate tracking engine based on the 'mode' parameter.
 */
export default function ActiveTrekRouter() {
    const params = useLocalSearchParams();
    const { mode } = params;

    if (mode === 'group') {
        return <GroupTrek />;
    }

    // Default to Solo Trek for 'solo' mode or if mode is undefined
    return <SoloTrek />;
}
