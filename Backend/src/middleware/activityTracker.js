import User from '../models/User.js';

const updateLastSeen = async (req, res, next) => {
    if (req.user && req.user._id) {
        try {
            await User.findByIdAndUpdate(req.user._id, {
                lastSeen: new Date(),
                isOnline: true
            });
        } catch (error) {
            console.error("Error updating last seen:", error);
        }
    }
    next();
};

export default updateLastSeen;
