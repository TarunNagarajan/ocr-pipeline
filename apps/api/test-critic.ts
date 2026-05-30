import { readFile } from "fs/promises";
import { resolveConflictsWithLlm } from "./src/llm.js";

async function run() {
  console.log("Loading file...");
  const fileBuffer = await readFile("../../scratch/hard_conflict.pdf");
  
  const rawText = "Degree Certificate\nDegree Certificate\nName: Agentic Conflict\nInstitution: Paradox University\nCGPA: 2.0";
  const conflicts = {
    cgpa: { vision: "4.0", llm: "2.0" }
  };
  
  console.log("Calling resolveConflictsWithLlm...");
  try {
    const result = await resolveConflictsWithLlm(
      rawText,
      conflicts,
      (text) => console.log("Stream:", text),
      fileBuffer,
      "application/pdf"
    );
    console.log("FINAL RESULT:", result);
  } catch(e) {
    console.error("Error:", e);
  }
}

run();
