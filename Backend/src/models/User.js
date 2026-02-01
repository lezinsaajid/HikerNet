import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
        },
        profileImage: {
            type: String,
            default: "",
        },
        bio: {
            type: String,
            default: "",
        },
        location: {
            type: String,
            default: "",
        },
        followers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        following: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        emergencyContacts: [
            {
                name: { type: String, required: true },
                phoneNumber: { type: String, required: true },
                email: { type: String },
            }
        ],
        expoPushToken: {
            type: String, // For notifications
        },
        medicalInfo: {
            type: String,
            default: "",
        },
        blockedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        trekInvitations: [
            {
                roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
                roomCode: String,
                trekName: String,
                inviter: {
                    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                    username: String
                },
                sentAt: { type: Date, default: Date.now }
            }
        ],
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        publicKey: {
            type: String,
            default: "", // For E2EE
        },
        encryptedPrivateKey: {
            type: String,
            default: "", // Encrypted with recovery password
        },
        keyBackupSalt: {
            type: String,
            default: "", // Salt used for PBKDF2
        },
    },
    { timestamps: true }
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (userPassword) {
    return await bcrypt.compare(userPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
