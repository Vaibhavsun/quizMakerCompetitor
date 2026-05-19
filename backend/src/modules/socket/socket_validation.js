import userRepo from "../user/user.repo.js";
import zod from "zod";
const ConnectionValidation = async (socket, next) => {
    try {
        const userId = socket.handshake.query.userId;

        if (!userId) {
            return next(new Error("User ID required"));
        }

        const user = await userRepo.findById(userId);
        if (!user) {
            return next(new Error("User not found"));
        }

        socket.userId = userId;  // Attach to socket
        next();  // ✅ Accept connection
    } catch (error) {
        next(new Error("Authentication failed"));
    }
};




export default ConnectionValidation;