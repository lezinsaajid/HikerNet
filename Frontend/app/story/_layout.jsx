
import React from 'react';
import { Stack } from 'expo-router';

export default function StoryLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="create" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="view" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        </Stack>
    );
}
