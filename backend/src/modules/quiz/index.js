import quizService from './quiz.service.js';
import { validateQuizOutput } from './quiz.validation.js';

/**
 * Creates and validates a quiz. Assumes input has already been validated by route middleware.
 * @param {Object} data - Quiz creation data { userId, difficulty, description }
 * @returns {Object} - { success: boolean, data?: Object, error?: string }
 */
const MAX_ATTEMPTS = 3; // 1 initial + 2 retries

export const createQuiz = async (data) => {
  const { userId, difficulty, description } = data;
  let lastError = "Failed to generate quiz";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const generatedQuiz = await quizService.generateQuiz({ difficulty, description });
      const outputValidation = validateQuizOutput(generatedQuiz.data);

      if (outputValidation.success) {
        if (attempt > 1) console.log(`[createQuiz] succeeded on attempt ${attempt}`);
        return { success: true, data: { userId, quiz: outputValidation.data } };
      }

      lastError = outputValidation.error;
      console.warn(`[createQuiz] attempt ${attempt}/${MAX_ATTEMPTS} failed validation: ${lastError}`);
    } catch (err) {
      lastError = err.message || "Failed to generate quiz";
      console.warn(`[createQuiz] attempt ${attempt}/${MAX_ATTEMPTS} threw: ${lastError}`);
    }
  }

  return { success: false, error: `Quiz generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}` };
};
