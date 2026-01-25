import React from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * A standard wrapper for screens to handle safe area insets consistently.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {Object} [props.style] - Style for the SafeAreaView
 * @param {string[]} [props.edges] - Which edges to apply safe area to (default: ['top', 'left', 'right'])
 * @param {string} [props.backgroundColor] - Background color for the screen (default: #fff)
 * @param {string} [props.statusBarStyle] - Style for the status bar (default: dark-content)
 */
export default function SafeScreen({
    children,
    style,
    edges = ['top', 'left', 'right'],
    backgroundColor = '#fff',
    statusBarStyle = 'dark-content'
}) {
    return (
        <SafeAreaView style={[styles.container, { backgroundColor }, style]} edges={edges}>
            <StatusBar barStyle={statusBarStyle} />
            {children}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
