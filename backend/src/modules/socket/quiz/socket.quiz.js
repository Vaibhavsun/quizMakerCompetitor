import { roomState } from "../index.js";
import { handleNextQuestion } from "../timer/socket.timer.js";

export const handleSumbitAnswer = async (io, socket, data, callback) => {
    const state = roomState[data.roomId];
    if (!state || state.status !== "PLAYING") {
        return callback({ success: false, error: "Game is paused or ended" });
    }

    if (state.answersThisRound.has(socket.userId)) {
        return callback({ success: false, error: "Already answered this question" });
    }

    // Pair the player's choice with the server's current question index, not
    // the one the client sent — clients can't grade themselves for stale
    // questions in future rounds.
    state.answersThisRound.set(socket.userId, {
        questionIndex: state.currentQuestionIndex,
        chosenOption: data.chosenOption,
    });

    callback({ success: true });

    if (state.answersThisRound.size === state.players.length) {
        handleNextQuestion(data.roomId, io);
    }
};
