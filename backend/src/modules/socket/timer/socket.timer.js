import quizService  from "../../quiz/quiz.service.js";
import roomRepo from "../../room/room.repo.js";
import { roomState, QUESTION_DURATION_MS } from "../index.js";


export const handleNextQuestion = async (roomId, io) => {
    try {
        const state = roomState[roomId];
        if (!state || state.status !== "PLAYING") return;

        // Single advancement point: clear any pending timer so the
        // submit-driven and timer-driven paths can't both advance.
        if (state.questionTimer) {
            clearTimeout(state.questionTimer);
            state.questionTimer = null;
        }

        // Grade the round that's just ending and emit the result before
        // advancing. Scores are updated inside evaluateAnswer.
        let correctAnswer = null;
        const playerResults = [];
        for (const [userId, { questionIndex, chosenOption }] of state.answersThisRound) {
            const result = await quizService.evaluateAnswer(questionIndex, chosenOption, roomId, userId);
            if (result.success) {
                correctAnswer = result.correctAnswer;
                playerResults.push({
                    userId,
                    chosenOption,
                    correct: result.correct,
                    score: result.score,
                });
            }
        }

        // If nobody submitted, still reveal the correct answer to the room.
        if (correctAnswer === null) {
            const current = await quizService.getCurrentQuestion(roomId);
            if (current.success) correctAnswer = current.data.question.answer;
        }

        io.to(roomId).emit("round-result", {
            questionIndex: state.currentQuestionIndex,
            correctAnswer,
            players: playerResults,
        });

        const question = await quizService.getNextQuestion(roomId);
        if (!question.success) {
            if (question.gameEnded) {
                const scores = await roomRepo.getScores(roomId);
                const top = scores.reduce((m, s) => Math.max(m, s.score), -Infinity);
                const winners = scores.filter(s => s.score === top).map(s => s.userId);
                io.to(roomId).emit("game-ended", {
                    reason: "completed",
                    message: "Game has ended!",
                    scores,
                    winnerUserId: winners.length === 1 ? winners[0] : null,
                    tie: winners.length > 1,
                });
                state.status = "ENDED";
                delete roomState[roomId];
            }
            return;
        }

        state.answersThisRound.clear();
        state.currentQuestionIndex = question.data.questionIndex;

        io.to(roomId).emit("send-question", {
            question: question.data,
            timeLimit: QUESTION_DURATION_MS,
        });

        state.questionStartedAt = Date.now();
        state.questionRemaining = QUESTION_DURATION_MS;
        state.questionTimer = setTimeout(() => {
            handleNextQuestion(roomId, io);
        }, QUESTION_DURATION_MS);
    } catch (err) {
        console.error("handleNextQuestion error:", err);
    }
}

export const handleOpponentTimeout = async (roomId, io) => {
    const state = roomState[roomId];
    if (!state) return;

    if (state.questionTimer) clearTimeout(state.questionTimer);

    const winnerUserId = state.players.find(uid => uid !== state.disconnectedUserId) ?? null;
    const scores = await roomRepo.getScores(roomId);

    io.to(roomId).emit("game-ended", {
        reason: "opponent-timeout",
        message: "Opponent did not return in time",
        scores,
        winnerUserId,
        tie: false,
    });

    state.status = "ENDED";
    delete roomState[roomId];
}
