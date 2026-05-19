class GameManager {
    startGame(io, roomId) {
        // Basic validation
        if (!io || !roomId) {
            throw new Error("Socket.io instance and roomId are required");
        }
        io.to(roomId).emit("game-started", { roomId });
    }

    endGame(io, roomId) {
        if (!io || !roomId) {
            throw new Error("Socket.io instance and roomId are required");
        }
        io.to(roomId).emit("game-ended", { roomId });
    }

    sendQuestion(io, roomId, question) {
        if (!io || !roomId || !question) {
            throw new Error("Socket.io instance, roomId, and question are required");
        }
        io.to(roomId).emit("question", { question });
    }

    evalQuestion(io, roomId, questionId, answer) {
        if (!io || !roomId || !questionId || answer === undefined) {
            throw new Error("Socket.io instance, roomId, questionId, and answer are required");
        }
    }

}
