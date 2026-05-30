# Native Spatial Bounding

Spatial bounding is the visual and mathematical proof of our extraction accuracy. Unlike traditional systems that simply return a JSON blob of text, Credential Lens enforces spatial accountability on every piece of extracted data.

## Enforced Accountability
Whenever the Multimodal Adjudicator outputs a structured field, it is required to generate the native spatial bounding boxes corresponding to where it found that exact piece of data on the page. We enforce this constraint strictly: if the model cannot prove visually where the data was found by highlighting it with a spatial polygon, the system flags it.

This data is then passed to the frontend, where it is rendered as organic visual highlighting. Instead of rigid, axis-aligned rectangles that fail on slanted or warped text, the pipeline renders fluid, marker-like overlays using `mix-blend-mode`. This gracefully adapts to document distortion and provides a professional, highly intuitive interface for human reviewers to instantly verify the AI's work.
