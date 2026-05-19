import { Server } from "socket.io";
import dotenv from "dotenv";
import ConnectionValidation from "./socket_validation.js";
import { joinRoom } from "./rooms/join-room.js";
import roomRepo from "../room/room.repo.js";
import { JoinRoomValidation, validateRoomPlayerData } from "./rooms/sockets.room.validation.js";
import { validateSubmitAnswer } from "./quiz/sockets.quiz.validation.js";
import quizService from "../quiz/quiz.service.js";
import { handleNextQuestion, handleOpponentTimeout } from "./timer/socket.timer.js";
import { handleSumbitAnswer } from "./quiz/socket.quiz.js";
dotenv.config();

const CORS_ORIGIN = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
    : ["http://localhost:3000", "http://localhost:5173"];

const io = new Server(process.env.SOCKET_PORT || 5000, {
    cors: { origin: CORS_ORIGIN, credentials: true },
});

const middlewares = {
    "join-room": JoinRoomValidation,
    "room-update": validateRoomPlayerData,
    "submit-answer": validateSubmitAnswer,
};

export const QUESTION_DURATION_MS = Number(process.env.QUESTION_DURATION_MS) || 10_000;
export const RECONNECT_WINDOW_MS = Number(process.env.RECONNECT_WINDOW_MS) || 60_000;

// roomState[roomId] = {
//   status: "PLAYING" | "PAUSED" | "ENDED",
//   players: [userId, userId],            // for winner lookup without DB hit
//   questionTimer, questionStartedAt, questionRemaining,
//   disconnectTimer, disconnectedUserId,
// }
export const roomState = {};

io.use(ConnectionValidation);
io.on("connection", async (socket) => {
    socket.use((packet, next) => {
        const mw = middlewares[packet[0]];
        if (!mw) return next();
        return mw(socket, packet[1], next);
    });

    socket.on("join-room", async (roomId, callback) => {
        const existing = roomState[roomId];

        // Reconnect path: this user is the one we're waiting for
        if (existing && existing.status === "PAUSED" && existing.disconnectedUserId === socket.userId) {
            clearTimeout(existing.disconnectTimer);
            existing.disconnectTimer = null;
            existing.disconnectedUserId = null;

            socket.join(roomId);
            socket.roomId = roomId;

            existing.status = "PLAYING";
            existing.questionStartedAt = Date.now();
            existing.questionTimer = setTimeout(
                () => handleNextQuestion(roomId, io),
                existing.questionRemaining
            );

            const question = await quizService.getCurrentQuestion(roomId);
            io.to(roomId).emit("game-resumed", {
                remainingMs: existing.questionRemaining,
                question: question?.success ? question.data : null,
            });
            return callback({ success: true, resumed: true });
        }

        if (existing && existing.status === "ENDED") {
            return callback({ error: "Game has ended" });
        }

        // Rejoin path: the game is already PLAYING and this user is one of
        // the two players. Common cause: React StrictMode remounted the
        // GamePage and the old socket disconnected before the new one joined.
        // Send the current question directly to this socket only — do NOT
        // re-broadcast start-game (that would reset the timer on the other
        // player's screen).
        if (existing && existing.status === "PLAYING" && existing.players.includes(socket.userId)) {
            socket.join(roomId);
            socket.roomId = roomId;
            const question = await quizService.getCurrentQuestion(roomId);
            if (!question.success) return callback({ error: question.error });
            const elapsed = Date.now() - existing.questionStartedAt;
            const remainingMs = Math.max(0, QUESTION_DURATION_MS - elapsed);
            socket.emit("start-game", {
                message: "Rejoined game in progress",
                roomId,
                questions: question.data,
                timeLimit: remainingMs > 0 ? remainingMs : QUESTION_DURATION_MS,
            });
            return callback({ success: true, rejoined: true });
        }

        if (io.sockets.adapter.rooms.get(roomId)?.size == 2) {
            return callback({ error: "Room is full" });
        }

        const res = await joinRoom(roomId, socket.userId, socket);
        if (res.error) return callback(res);
        socket.roomId = roomId;

        if (io.sockets.adapter.rooms.get(roomId)?.size === 2) {
            const question = await quizService.getCurrentQuestion(roomId);
            if (!question.success) {
                return callback({ error: question.error });
            }

            // Clear any stale timers from a previous game in this room
            const prev = roomState[roomId];
            if (prev?.questionTimer) clearTimeout(prev.questionTimer);
            if (prev?.disconnectTimer) clearTimeout(prev.disconnectTimer);

            const players = await roomRepo.getRoomPlayers(roomId);
            roomState[roomId] = {
                status: "PLAYING",
                players: players.map(p => p.userId),
                currentQuestionIndex: question.data.questionIndex,
                questionStartedAt: Date.now(),
                questionRemaining: QUESTION_DURATION_MS,
                questionTimer: setTimeout(() => handleNextQuestion(roomId, io), QUESTION_DURATION_MS),
                disconnectTimer: null,
                disconnectedUserId: null,
                answersThisRound: new Map(),
            };

            io.to(roomId).emit("start-game", {
                message: "Game started",
                roomId,
                questions: question.data,
                timeLimit: QUESTION_DURATION_MS,
            });
        }
        callback(res);
    });

    socket.on("room-update", async (data, callback) => {
        try {
            const res = await roomRepo.update(socket.roomId, socket.userId, data);
            callback({ success: true, data: res });
        }
        catch (error) {
            callback({ error: error.message });
        }
    });

    socket.on("disconnect", () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const state = roomState[roomId];
        if (!state || state.status !== "PLAYING") return;

        // Freeze the question timer, remember how much time was left.
        // Baseline is questionRemaining (the budget for the current run),
        // not QUESTION_DURATION_MS — after a resume the question doesn't
        // restart from full duration.
        clearTimeout(state.questionTimer);
        state.questionRemaining = Math.max(
            0,
            state.questionRemaining - (Date.now() - state.questionStartedAt)
        );
        state.questionTimer = null;

        state.status = "PAUSED";
        state.disconnectedUserId = socket.userId;
        state.disconnectTimer = setTimeout(
            () => handleOpponentTimeout(roomId, io),
            RECONNECT_WINDOW_MS
        );

        io.to(roomId).emit("opponent-left", {
            message: "Opponent left the game",
            reconnectWindowMs: RECONNECT_WINDOW_MS,
        });
    });

    socket.on("submit-answer", async (data, callback) => {
        handleSumbitAnswer(io, socket, data, callback);
    });
});



export default io;
