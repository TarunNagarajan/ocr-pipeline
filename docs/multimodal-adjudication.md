# Multimodal Adjudication

Multimodal Adjudication is the cognitive brain of the Credential Lens pipeline. While traditional pipelines attempt to solve OCR correction using blind regex or basic natural language processing (NLP), our architecture utilizes state-of-the-art Vision-Language Models (VLMs) like Gemini 1.5 Pro.

## Bridging Spatial and Semantic Domains
Traditional computer vision fails when dealing with complex structures like signatures overlapping text, slanted stamps, or highly degraded academic transcripts. Pure text-based heuristics cannot solve this because they cannot "see" the structural cause of the error.

By feeding both the deterministic text layer *and* the raw, high-resolution rasterized image directly into a VLM, the model acts as a forensic adjudicator. It physically "sees" the document layout and resolves ambiguities. This enables the system to dynamically adapt to unknown layouts (like a completely new template for a No Objection Certificate) without requiring any hardcoded templates or rigid rules. The VLM maps visual relationships and semantics directly into our structured output schema, completely bypassing the limitations of traditional OCR parsing.
