# Agentic Conflict Resolution (Chain of Thought)

Agentic Conflict Resolution is our pipeline's ultimate defense against LLM hallucination—a known and fatal flaw in modern AI systems, particularly in secure environments like credential verification.

## The Audit Loop
When the Vision-Language Model extracts a semantic field (e.g., a specific Date of Birth or GPA), the system does not blindly trust it. The output is forcefully cross-referenced against the deterministic OCR baseline. If the VLM's structured output contradicts the deterministic data, a conflict is trapped.

At this point, an independent, highly-parameterized auditor agent is spun up. This agent acts as a digital forensic examiner. It is fed the raw image, the conflicting VLM output, and the deterministic OCR data. The agent strictly utilizes **Chain of Thought Reasoning** to independently verify the absolute truth. It breaks down the visual evidence, analyzes the discrepancy step-by-step, and explicitly justifies its final decision. By fusing semantic AI with an autonomous auditing agent, we achieve an extraction engine that is mathematically auditable and practically immune to silent hallucinations.
