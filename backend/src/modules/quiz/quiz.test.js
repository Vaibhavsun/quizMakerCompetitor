// Manual inspection script for quizService.
//
// Two modes:
//
//   1. Single run — inspect one quiz in detail:
//        node src/modules/quiz/quiz.test.js "world capitals" easy
//
//   2. Suite mode — run a fixed set of 8 topics and print a one-line summary
//      for each, plus a tally at the end:
//        node src/modules/quiz/quiz.test.js
//        node src/modules/quiz/quiz.test.js --suite
//
// In suite mode you can also override the topic list from the command line:
//        node src/modules/quiz/quiz.test.js --suite "topic1|easy" "topic2|hard" ...

import "dotenv/config";
import quizService from "./quiz.service.js";
import { validateQuizOutput } from "./quiz.validation.js";

const DEFAULT_SUITE = [
    { description: "world history",       difficulty: "medium" },
    { description: "python programming",  difficulty: "hard"   },
    { description: "human anatomy",       difficulty: "easy"   },
    { description: "famous paintings",    difficulty: "medium" },
    { description: "indian cricket",      difficulty: "medium" },
    { description: "space exploration",   difficulty: "hard"   },
    { description: "ancient mythology",   difficulty: "medium" },
    { description: "english grammar",     difficulty: "easy"   },
];

function divider(label) {
    console.log("\n" + "─".repeat(70));
    console.log(label);
    console.log("─".repeat(70));
}

function shapeStats(quiz) {
    if (!Array.isArray(quiz)) return { count: 0, badOptions: 0, badAnswer: 0 };
    let badOptions = 0;
    let badAnswer = 0;
    for (const q of quiz) {
        if (!Array.isArray(q?.options) || q.options.length !== 4) badOptions++;
        if (!q?.answer || !q?.options?.includes(q.answer)) badAnswer++;
    }
    return { count: quiz.length, badOptions, badAnswer };
}

async function runOne({ description, difficulty }) {
    const t0 = Date.now();
    let result, threw = null;
    try {
        result = await quizService.generateQuiz({ description, difficulty });
    } catch (err) {
        threw = err.message;
    }
    const ms = Date.now() - t0;

    if (threw) return { description, difficulty, ms, threw, count: 0, schemaOk: false, badOptions: 0, badAnswer: 0 };

    const { count, badOptions, badAnswer } = shapeStats(result?.data);
    const validation = validateQuizOutput(result?.data);
    return { description, difficulty, ms, threw: null, count, schemaOk: validation.success, badOptions, badAnswer };
}

async function runSuite(items) {
    divider(`Running ${items.length} prompts`);
    const rows = [];
    for (const item of items) {
        const r = await runOne(item);
        rows.push(r);
        // One compact line per run
        const status = r.threw
            ? `THREW: ${r.threw}`
            : `count=${r.count}  schema=${r.schemaOk ? "ok" : "FAIL"}  badOptions=${r.badOptions}  badAnswer=${r.badAnswer}`;
        console.log(`  [${String(r.ms).padStart(5)}ms]  ${r.description.padEnd(22)} (${r.difficulty.padEnd(6)})  ${status}`);
    }

    // Tally
    divider("Tally");
    const ok = rows.filter(r => !r.threw && r.count === 10 && r.schemaOk && r.badOptions === 0 && r.badAnswer === 0);
    const partial = rows.filter(r => !r.threw && r.count > 0 && r.count < 10);
    const failed = rows.filter(r => r.threw || r.count === 0);
    console.log(`  perfect (10 Qs, schema ok, no shape issues): ${ok.length}/${rows.length}`);
    console.log(`  partial (1-9 questions returned):            ${partial.length}/${rows.length}`);
    console.log(`  failed (threw or 0 questions):               ${failed.length}/${rows.length}`);
    const totalMs = rows.reduce((s, r) => s + r.ms, 0);
    const avgMs = Math.round(totalMs / rows.length);
    console.log(`  avg latency: ${avgMs}ms   total: ${totalMs}ms`);
}

async function runSingle(description, difficulty) {
    divider(`Single: "${description}" (${difficulty})`);
    const r = await runOne({ description, difficulty });
    if (r.threw) {
        console.log(`THREW: ${r.threw}`);
        process.exit(1);
    }
    console.log(`took:       ${r.ms}ms`);
    console.log(`count:      ${r.count}`);
    console.log(`schema ok:  ${r.schemaOk}`);
    console.log(`badOptions: ${r.badOptions}  (questions with options.length !== 4)`);
    console.log(`badAnswer:  ${r.badAnswer}   (questions where answer is not in options)`);
}

// --- entry ------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--suite") {
    // Suite mode — use overrides if provided, else defaults.
    const overrides = args.slice(args[0] === "--suite" ? 1 : 0);
    const items = overrides.length
        ? overrides.map(pair => {
            const [description, difficulty = "medium"] = pair.split("|");
            return { description: description.trim(), difficulty: difficulty.trim() };
        })
        : DEFAULT_SUITE;
    runSuite(items);
} else {
    // Single mode: topic and difficulty as positional args.
    const [description, difficulty = "easy"] = args;
    runSingle(description, difficulty);
}
