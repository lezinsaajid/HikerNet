import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        messageType: {
            type: String,
            enum: ["text", "image", "sticker"],
            default: "text",
        },
        content: {
            type: String,
            required: function () { return this.messageType === "text"; }
        },
        mediaUrl: {
            type: String,
        },
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
    },
    { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
