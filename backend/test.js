import quizService from './src/modules/quiz/quiz.service.js';

async function runQuizServiceTest() {
  console.log("=========================================");
  console.log("🧪 Initiating Quiz Service Test...");
  console.log("=========================================\n");

  const testPayload = {
    difficulty: "easy",
    description: "General knowledge about the solar system and planets"
  };

  try {
    console.log(`[TEST] Calling generateQuiz with payload:`);
    console.log(testPayload);
    
    // Measuring explicitly how long the AI takes to respond
    const startTime = Date.now();

    // Call the exact service method that the controller triggers
    const result = await quizService.generateQuiz(testPayload);

    const endTime = Date.now();
    const durationms = endTime - startTime;

    console.log(`\n✅ [TEST SUCCESS] Quiz securely generated in ${durationms}ms!`);
    console.log("================OUTPUT================");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(`\n❌ [TEST FAILED] The service threw a fatal exception!`);
    console.error(`Error Message: ${error.message}`);
    if (error.status) console.error(`Error Status: ${error.status}`);
  }
  
  // Explicit exit since the background Node stream may stay alive unexpectedly 
  process.exit(0);
}

// Execute the test script immediately
runQuizServiceTest();
