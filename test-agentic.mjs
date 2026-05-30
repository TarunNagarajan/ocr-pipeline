import { resolveConflictsWithLlm } from './apps/api/src/llm.js';
import dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

async function run() {
  const rawText = "University of London\nStudent Name: Yamamoto Kenji\nDegree: Bachelor of Engineering\nCGPA: 3.5";
  
  const conflicts = {
    "cgpa": {
      vision: "3.5",
      llm: "3.0"
    },
    "studentName": {
      vision: "Yamamoto Kenji",
      llm: "Yamamoto"
    }
  };

  console.log("Starting agentic conflict resolution...");
  const result = await resolveConflictsWithLlm(
    rawText,
    conflicts,
    (reasoning) => {
      console.log("[Stream]:", reasoning);
    }
  );

  console.log("\nFinal Resolved Result:");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
