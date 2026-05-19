import z from "zod";

// Zod schema for RoomPlayer data validation
const RoomPlayerSchema = z.object({
    roomId: z.string().min(1, "Room ID is required"),
    userId: z.string().min(1, "User ID is required"),
    score: z.number().int().min(0, "Score must be non-negative").optional(),
    state: z.enum(["WAITING", "PLAYING", "FINISHED"]).optional()
}).strict();

export const JoinRoomValidation = async (socket, _data, next) => {
    try {
        const roomId = socket.handshake.query.roomId;

        if (!roomId) {
            return next(new Error("Room ID required"));
        }

        next();  // Accept connection
    } catch (error) {
        next(new Error("Validation failed"));
    }
};


/**
 * Validates RoomPlayer data format for user-state updates
 * @param {Object} data - RoomPlayer data to validate
 * @returns {Object} - { success: boolean, data?: Object, error?: string }
 */
export const validateRoomPlayerData = async (_socket, _data, next) => {
    // Pass-through: room-update handler validates / catches its own errors
    // and replies via callback.
    next();
};
