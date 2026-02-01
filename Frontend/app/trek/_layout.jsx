import { Stack } from 'expo-router';

export default function TrailLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="active-trek" />
        </Stack>
    );
}
