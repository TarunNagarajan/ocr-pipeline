# Credential Lens: The OCR Pipeline That Actually Works

I love to compare software architectures with mis-incentivized Rube Goldberg machines. Here we are today. Discussing bloated, caffeine-addicted microservices making unstructured progress towards an already solved problem, or being burdened to hack up a small-scale temporary regex parser for an OCR problem which doesn't exist, which could easily be solved by a multimodal LLM.

Before 2024, if you were building an OCR pipeline, you'd worry about balancing Tesseract's fragile character recognition with a good heuristic matcher that does justice to the backend. All of that depends on the document templates you have at hand, so during your ideation process, you'd take into account the effort, and whether it is tangible or not to start writing 500 lines of regex in the first place.

Now, with VLM (Vision-Language Models) into play, the implementation isn't even a point of concern, as the cost of extracting structured data is practically non-existent, with technical intelligence commoditized. It boils down to how well you can specify the problem, and guide the LLM towards getting it done for you.

Credential Lens is a multimodal, agentic document extraction pipeline. We treat document extraction not as a text-parsing speed-run, but as an architectural problem. It marries the deterministic, grounded reality of traditional OCR (Tesseract / PDF text layers) with the spatial reasoning and unstructured understanding of Gemini 1.5 Pro.

## Architecture

Most post-GPT software misses the point entirely. People get carried away with the features that they can include (given you have an obedient software developer at your service), instead of the problem they have at hand. This pipeline avoids over-engineering by splitting the problem into two distinct, deliberate phases:

1. **Deterministic Grounding (The Baseline)**
   The system starts by extracting raw, undeniable text evidence. We rasterize PDFs, run Tesseract, and pull text layers directly. This gives us `EvidenceBlocks`. We aren't guessing; we know exactly where every word is on the page, with exact bounding boxes. 

2. **Multimodal Adjudication (The Brain)**
   Instead of forcing trendy technology into a problem solution where it doesn't belong, we use VLMs precisely where they excel: understanding context and spatial relationships. We feed the raw text, the evidence blocks, and the rasterized image into Gemini. The LLM acts as an adjudicator and forensic examiner. It maps the visual relationships (like signatures, seals, or slanted text) into a structured schema (`StructuredDocumentResult`).

3. **Agentic Conflict Resolution**
   If the LLM's structured output conflicts with the deterministic OCR evidence, an agentic audit loop is triggered. We don't just blindly accept hallucinated fields. The pipeline forces the model to explain its reasoning, resolving the discrepancy with high confidence.

## Features

- **Native Spatial Bounding Boxes**: Uses Gemini's token-grounded spatial capabilities to generate bounding boxes for fields that OCR misses.
- **Organic Visual Highlighting**: Instead of rigid axis-aligned rectangles that fail on slanted text, the frontend renders fluid, marker-like overlays using `mix-blend-mode` to gracefully adapt to document distortion.
- **Forensic Analysis**: Detects digital manipulation, low-signal OCR traps, and verifies authenticity.
- **Cloud Run Deployment Ready**: Fully containerized and optimized for serverless execution on Google Cloud.

## The Takeaway

This pipeline should never be treated as a proxy metric for judging how many API calls you can chain together. It is an exercise in how well you can architect a system that solves a complex, unstructured problem (credential extraction) by leveraging intelligence only where deterministic logic hits its ceiling. Working, and simply thinking about a problem over a long period of time is a major part of architecture. 

This isn't a hackathon toy. It's a production pipeline.
