import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loggingIn, setLoggingIn] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        setLoggingIn(true);
        console.log("Attempting login with:", email);
        const result = await login(email, password);
        console.log("Login result:", result);
        setLoggingIn(false);

        if (!result.success) {
            Alert.alert("Login Failed", result.msg);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
                    {/* Hero Section with Curved Back */}
                    <View style={styles.heroContainer}>
                        <Image
                            source={require('../../assets/images/login_hero.png')}
                            style={styles.heroImage}
                        />
                        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Login to your account</Text>

                        <View style={styles.inputSection}>
                            {/* Email Input */}
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    placeholder="Email"
                                    style={styles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Password Input */}
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    placeholder="Password"
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    placeholderTextColor="#999"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                                </TouchableOpacity>
                            </View>

                            {/* Remember & Forgot */}
                            <View style={styles.row}>
                                <TouchableOpacity style={styles.checkboxRow}>
                                    <Ionicons name="checkmark-circle" size={18} color="#4A7C44" />
                                    <Text style={styles.rememberText}>Remember Me</Text>
                                </TouchableOpacity>
                                <TouchableOpacity>
                                    <Text style={styles.forgotText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                style={styles.loginBtn}
                                onPress={handleLogin}
                                disabled={loggingIn}
                            >
                                {loggingIn ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.loginBtnText}>Login</Text>
                                )}
                            </TouchableOpacity>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Don&apos;t have account? </Text>
                                <Link href="/register" asChild>
                                    <TouchableOpacity>
                                        <Text style={styles.signUpText}>Sign up</Text>
                                    </TouchableOpacity>
                                </Link>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    heroContainer: {
        width: width,
        height: width * 0.85,
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        overflow: 'hidden',
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 25,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: 35,
        paddingTop: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2D5A27',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 35,
    },
    inputSection: {
        width: '100%',
        gap: 20,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F4EF',
        borderRadius: 15,
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    inputIcon: {
        marginRight: 15,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rememberText: {
        fontSize: 12,
        color: '#999',
    },
    forgotText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
    },
    loginBtn: {
        backgroundColor: '#4A7C44',
        borderRadius: 25,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 30,
        shadowColor: "#4A7C44",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    loginBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
        marginBottom: 40,
    },
    footerText: {
        color: '#999',
        fontSize: 14,
    },
    signUpText: {
        color: '#4A7C44',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
