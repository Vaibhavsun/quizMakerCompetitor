import { z } from "zod";
import userRepo from "../user/user.repo.js";
import { validateUserExists } from "../user/user.validation.js";

// Zod schema for validating the incoming string and userId
export const quizSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  topic: z.string().min(3, "Topic string must be at least 3 characters").max(200, "Topic too long"),
  difficulty: z.string().optional(),
  description: z.string().optional()
});

/**
 * Validates the structure of the request using Zod
 */
export const validateQuizInput = async (req, res, next) => {
  try {
    const validatedData = quizSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Zod schema for validating the raw AI output payload inside the Service.
 * Protects against strict AI hallucinations by enforcing exactly 10 arrays and 4 options.
 */
export const quizOutSchema = z.array(
  z.object({
    question: z.string().min(1, "Question cannot be empty"),
    options: z.array(z.string()).length(4, "Must have exactly 4 array strings as options"),
    answer: z.string().min(1, "Answer cannot be empty")
  }).strict().refine(
    q => q.options.includes(q.answer),
    { message: "Answer must exactly match one of the options" }
  )
).length(10, "Quiz must contain exactly 10 questions");

/**
 * Validates raw AI response payload structure
 * @param {Array} data - AI generated quiz data
 * @returns {Object} - { success: boolean, data?: Array, error?: string }
 */
export const validateQuizOutput = (data) => {
  const validationResult = quizOutSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("AI Strict Output Validation Failed:", validationResult.error.errors);
    return { success: false, error: "AI generated an invalid payload structure. Please try again." };
  }

  return { success: true, data: validationResult.data };
};
