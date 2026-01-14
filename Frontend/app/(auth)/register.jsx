import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [creating, setCreating] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const handleRegister = async () => {
        if (!username || !email || !password) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        setCreating(true);
        console.log("Attempting register with:", username, email);
        const result = await register(username, email, password);
        console.log("Register result:", result);
        setCreating(false);

        if (!result.success) {
            Alert.alert("Registration Failed", result.msg);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
                    {/* Leaf Accent Decoration */}
                    <Image
                        source={require('../../assets/images/leaf_accent.png')}
                        style={styles.leafAccent}
                        resizeMode="contain"
                    />

                    {/* Back Button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color="#2D5A27" />
                    </TouchableOpacity>

                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Register</Text>
                        <Text style={styles.subtitle}>Create your new account</Text>

                        <View style={styles.inputSection}>
                            {/* Full Name Input */}
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    placeholder="Full Name"
                                    style={styles.input}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="words"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Email Input */}
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    placeholder="user@mail.com"
                                    style={styles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    placeholderTextColor="#999"
                                />
                                <Ionicons name="checkmark" size={20} color="#4A7C44" />
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

                            {/* Register Button */}
                            <TouchableOpacity
                                style={styles.registerBtn}
                                onPress={handleRegister}
                                disabled={creating}
                            >
                                {creating ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.registerBtnText}>Register</Text>
                                )}
                            </TouchableOpacity>

                            {/* Remember Me */}
                            <View style={styles.row}>
                                <TouchableOpacity style={styles.checkboxRow}>
                                    <Ionicons name="checkmark-circle" size={18} color="#4A7C44" />
                                    <Text style={styles.rememberText}>Remember Me</Text>
                                </TouchableOpacity>
                                <TouchableOpacity>
                                    <Text style={styles.forgotText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Divider */}
                            <View style={styles.dividerContainer}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>Or continue with</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {/* Social Buttons */}
                            <View style={styles.socialRow}>
                                <TouchableOpacity style={styles.socialBtn}>
                                    <Ionicons name="logo-facebook" size={22} color="#1877F2" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.socialBtn}>
                                    <Ionicons name="logo-google" size={22} color="#EA4335" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.socialBtn}>
                                    <Ionicons name="logo-apple" size={22} color="#000" />
                                </TouchableOpacity>
                            </View>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Already have an account? </Text>
                                <Link href="/login" asChild>
                                    <TouchableOpacity>
                                        <Text style={styles.signUpText}>Sign In</Text>
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
    leafAccent: {
        position: 'absolute',
        top: -20,
        right: -30,
        width: 150,
        height: 150,
        opacity: 0.8,
    },
    backButton: {
        marginTop: 60,
        marginLeft: 25,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F4EF',
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
    registerBtn: {
        backgroundColor: '#4A7C44',
        borderRadius: 15,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: "#4A7C44",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    registerBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: -5,
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
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
        gap: 15,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#EEE',
    },
    dividerText: {
        color: '#999',
        fontSize: 12,
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    socialBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#EEE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
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
