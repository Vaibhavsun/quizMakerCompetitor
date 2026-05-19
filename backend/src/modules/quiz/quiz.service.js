import OpenAI from 'openai';
import dotenv from 'dotenv';
import roomRepo from '../room/room.repo.js';
dotenv.config();

class QuizService {
  constructor() {
    this.client = null;
    this.agentIntialization();
  }

  agentIntialization() {
    // Direct OpenAI client initialization (looks for process.env.OPENAI_API_KEY)
    this.client = new OpenAI({
      baseURL: "https://bedrock-runtime.eu-north-1.amazonaws.com/openai/v1"
    });
  }

  /**
   * Generates a structural quiz by querying standard OpenAI
   * @param {Object} payload 
   */
  async generateQuiz({ difficulty, description }) {
    console.log(`[OpenAI Service] Sending prompt to AI: Create a quiz about ${description} (${difficulty || 'standard'} difficulty)`);

    // The Bedrock OpenAI-compat endpoint requires response_format: json_object,
    // so we wrap the array in a `questions` key. The parser below extracts it.
    const systemPrompt = `You are a strict quiz generator.

TASK:
Generate exactly 10 multiple-choice questions based on the given description and difficulty.

OUTPUT FORMAT (MANDATORY):
Return ONLY a JSON object with this exact shape:
{
  "questions": [
    { "question": "string", "options": ["a", "b", "c", "d"], "answer": "string" }
  ]
}

CONSTRAINTS:
- The "questions" array must contain exactly 10 objects.
- Each question must have exactly 4 options.
- The "answer" must exactly match one of the options character-for-character.
- No duplicate questions.
- No markdown, no commentary, no \`\`\` fences. Only the JSON object.`;

    const userContent = `Description: ${description}\nDifficulty: ${difficulty || "easy"}`;

    const response = await this.client.chat.completions.create({
      model: "openai.gpt-oss-120b-1:0",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 16000,
      response_format: { type: "json_object" }
    });
    console.log("[OpenAI Service] Received response from AI", response);

    const rawContent = response.choices[0].message.content.trim();
    console.log("Response", rawContent);

    const filteredContent = rawContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')
      .trim();
    console.log("Filtered Content", filteredContent);

    let unfilteredParsedQuiz;
    try {
      const parsed = JSON.parse(filteredContent);
      // Expected shape: { questions: [...] }. Fall back to bare array or single object.
      if (parsed && Array.isArray(parsed.questions)) {
        unfilteredParsedQuiz = parsed.questions;
      } else if (Array.isArray(parsed)) {
        unfilteredParsedQuiz = parsed;
      } else {
        unfilteredParsedQuiz = [parsed];
      }
    } catch {
      // Output was truncated or has stray prefix/suffix — emit every balanced
      // {...} block regardless of nesting depth, then keep the question-shaped ones.
      const objects = [];
      const stack = [];
      let inStr = false, esc = false;
      for (let i = 0; i < filteredContent.length; i++) {
        const ch = filteredContent[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{') stack.push(i);
        else if (ch === '}') {
          const start = stack.pop();
          if (start !== undefined) {
            try { objects.push(JSON.parse(filteredContent.slice(start, i + 1))); } catch {}
          }
        }
      }
      // Prefer the wrapper {"questions":[...]} if present; otherwise keep individual question objects.
      const wrapper = objects.find(o => o && Array.isArray(o.questions));
      const questionShaped = wrapper
        ? wrapper.questions
        : objects.filter(o => o && typeof o.question === "string" && Array.isArray(o.options));
      if (!questionShaped.length) throw new Error("AI returned unparseable output");
      unfilteredParsedQuiz = questionShaped;
    }

    // AI validation is now handled exclusively by Express Route Middleware
    return {
      status: "success",
      data: unfilteredParsedQuiz
    };
  }

  /**
   * Get current question by index from room and quiz data
   * @param {string} roomId - Room ID
   * @returns {Object} - { success: boolean, data?: Object, error?: string }
   */
  async getCurrentQuestion(roomId) {
    try {
      // Get room with quiz data
      const room = await roomRepo.findById(roomId);
      if (!room) {
        return { success: false, error: "Room not found" };
      }

      // Get players to find current question index
      const roomPlayers = await roomRepo.getRoomPlayers(roomId);
      if (!roomPlayers || roomPlayers.length === 0) {
        return { success: false, error: "No players in room" };
      }

      // Get current question index from players
      const currentIndex = room.quiz_index;

      // Get quiz questions and current question
      const quizQuestions = room.quizdata || [];
      const currentQuestion = quizQuestions[currentIndex];

      if (!currentQuestion) {
        return { success: false, error: "Question not found" };
      }

      return {
        success: true,
        data: {
          questionIndex: currentIndex,
          question: currentQuestion,
          totalQuestions: quizQuestions.length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Advance the room to the next question and return it.
   * @param {string} roomId
   * @returns {Promise<Object>} - { success, data?, gameEnded?, error? }
   */
  async getNextQuestion(roomId) {
    const update = await roomRepo.updateQuestionIndex(roomId);
    if (!update.success) {
      return { success: false, error: update.error };
    }
    if (update.gameEnded) {
      return { success: false, gameEnded: true, error: "Game ended" };
    }
    return this.getCurrentQuestion(roomId);
  }

  /**
   * Evaluate answer against correct answer
   * @param {number} questionIndex - Question index
   * @param {number} chosenOption - Selected option index
   * @param {string} roomId - Room ID
   * @returns {Promise<Object>} - { success: boolean, correct: boolean, answer: string, error?: string }
   */
  async evaluateAnswer(questionIndex, chosenOption, roomId, userId) {
    try {
      const room = await roomRepo.findById(roomId);
      if (!room) {
        return { success: false, error: "Room not found" };
      }

      const quizQuestions = room.quizdata || [];
      const currentQuestion = quizQuestions[questionIndex];

      if (!currentQuestion) {
        return { success: false, error: "Question not found" };
      }

      const correctAnswer = currentQuestion.answer;
      const options = currentQuestion.options;

      if (chosenOption < 0 || chosenOption >= 4) {
        return { success: false, error: "Invalid option index" };
      }

      const chosenAnswer = options[chosenOption];
      const isCorrect = chosenAnswer === correctAnswer;

      let score;
      if (isCorrect) {
        const scoreResponse = await roomRepo.updatePlayerScore(roomId, userId, 1);
        if (!scoreResponse.success) {
          return { success: false, error: scoreResponse.error };
        }
        score = scoreResponse.score;
      }

      return {
        success: true,
        correct: isCorrect,
        questionIndex,
        correctAnswer,
        score
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const quizService = new QuizService();
export default quizService;
