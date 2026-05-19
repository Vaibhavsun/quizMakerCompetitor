import RoomRepository from "../../room/room.repo.js";
export const joinRoom = async (roomId, userId, socket) => {
    try {
        const room = await RoomRepository.findById(roomId);
        if (!room) {
            return { error: "Room not found" };
        }

        const roomPlayers = await RoomRepository.getRoomPlayers(roomId);
        const alreadyJoined = roomPlayers.some(p => p.userId === userId);

        if (!alreadyJoined && roomPlayers.length >= 2) {
            return { error: "Room is full" };
        }

        if (!alreadyJoined) {
            await RoomRepository.addInRoomPlayer({ roomId, userId });
        }

        socket.join(room.id);
        socket.roomId = room.id;
        return { success: true };
    } catch (error) {
        return { error: error.message || "Failed to join room" };
    }
};



