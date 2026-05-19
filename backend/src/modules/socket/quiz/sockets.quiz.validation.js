import z from "zod";

const SubmitAnswerSchema = z.object({
    roomId: z.string().min(1, "Room ID is required"),
    questionIndex: z.number().int().min(0, "Question index must be non-negative"),
    chosenOption: z.number().int().min(0).max(3, "Chosen option must be 0-3"),
}).strict();

export const validateSubmitAnswer = async (_socket, data, next) => {
    const result = SubmitAnswerSchema.safeParse(data);
    if (!result.success) {
        return next(new Error(result.error.issues[0].message));
    }
    next();
};
