# Credential Lens

Credential Lens is the completed Problem 2 implementation in this workspace: an OCR and structured extraction system for credential-style PDFs, PNGs, and JPEGs. The app is intentionally running in an auth-free demo mode right now so the intake and viewer workflow can be exercised without login friction. The backend still keeps the session and audit primitives in place, but the visible product path is a dark, Obsidian-like document vault with a Firefox-style viewer surface for processed files.

## What the system does

The browser uploads a document to the Express API. The API stores the original file on disk, extracts text from born-digital PDFs through `pdfjs-dist`, falls back to OCR for scanned PDFs when Poppler is available, runs OCR on images with `tesseract.js`, builds evidence blocks, structures holder and credential fields, computes review bands, encrypts the structured result, and exposes that payload back to the frontend for inspection.

The extracted result shape includes:

- holder name, father name, and date of birth
- credential degree, institution, graduation year, and CGPA
- issuer name
- field-level confidence
- raw OCR text
- evidence blocks
- review-band summary and quality notes

The design principle is simple: OCR and text-layer evidence remain the source of truth. Any model-based reasoning is optional and bounded to that evidence.

## Runtime shape

The frontend runs on `http://localhost:3000`. The API runs on `http://localhost:4000`.

The frontend experience is split into two main routes:

- `/documents` for intake, history, and workspace overview
- `/documents/:id` for the Firefox-style viewer and structured extraction report

The backend exposes:

- `GET /health`
- `POST /api/documents/process`
- `GET /api/documents`
- `GET /api/documents/:id/status`
- `GET /api/documents/:id/result`
- `GET /api/documents/:id/file`
- `GET /api/documents/stream`

There are still auth endpoints under `/api/auth`, but the current product flow does not require them. The API resolves a shared demo actor automatically when document routes are used.

## Storage and persistence

This build uses SQLite by default for local development through Prisma. The database lives at `apps/api/prisma/dev.db` when `DATABASE_URL=file:./dev.db`.

Original uploads are stored under `STORAGE_ROOT`. The default local value is `./storage`, which resolves relative to `apps/api`.

Structured extraction payloads are encrypted before they are written to the database. Raw uploads remain private and are only streamed back through the API.

## PDF and OCR behavior

Born-digital PDFs use direct text extraction first. That path is fast and keeps line structure so field extraction remains clean.

If a PDF does not yield enough text, the API attempts scanned-PDF OCR by rasterizing pages with `pdftoppm` and then running `tesseract.js`. If Poppler is not installed, scanned PDFs fail explicitly with a clear error message instead of pretending to succeed.

PNG and JPEG files go directly through the OCR path.

## Environment variables

Copy `.env.example` to `.env`.

Important variables:

- `PORT=4000`
- `DATABASE_URL=file:./dev.db`
- `WEB_ORIGIN=http://localhost:3000`
- `API_PUBLIC_URL=http://localhost:4000`
- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `JWT_SECRET=...`
- `DOCUMENT_ENCRYPTION_KEY=...`
- `STORAGE_ROOT=./storage`
- `MAX_UPLOAD_MB=10`
- `LLM_MODE=none`

Optional OpenAI-compatible adjudication variables are only used when `LLM_MODE=openai-compatible`:

- `OPENAI_COMPAT_BASE_URL`
- `OPENAI_COMPAT_MODEL`
- `OPENAI_COMPAT_API_KEY`

The default and recommended mode for sensitive documents is still `LLM_MODE=none`.

Optional Vertex AI variables are used when `LLM_MODE=vertex-ai` or `VLM_MODE=vertex-ai`:

- `STORAGE_BACKEND=gcs`
- `GCS_BUCKET`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION=global`
- `VERTEX_LLM_MODEL=gemini-2.5-flash`
- `VERTEX_VLM_MODEL=gemini-2.5-flash`

The deployed cloud path uses Gemini 2.5 Flash twice: once as a text-only evidence adjudicator, and once as a multimodal validator over the original document bytes or `gs://` object.

## Local setup

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npm run prisma:generate -w apps/api
```

Initialize the local SQLite schema:

```bash
npm run db:init -w apps/api
```

Start the API:

```bash
npm run dev -w apps/api
```

Start the frontend in a second terminal:

```bash
npm run dev -w apps/web
```

Then open `http://localhost:3000/documents`.

## Docker

`docker-compose.yml` now reflects the local SQLite demo shape. It runs only the API and web services, mounts the workspace, initializes the local SQLite file, and persists uploaded files under a Docker volume.

Use:

```bash
docker compose up --build
```

## Tests and build

Run the current automated tests:

```bash
npm test
```

Build the workspaces:

```bash
npm run build
```

## Deployment direction

The repository now includes a working Google Cloud deployment path:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `cloudbuild.api.yaml`
- `cloudbuild.web.yaml`

The current deployed shape is:

- Cloud Run service for the API
- Cloud Run service for the web app
- Cloud Storage bucket for uploaded originals
- Vertex AI Gemini 2.5 Flash for evidence adjudication and multimodal document validation

The current compromise is persistence. The API still uses SQLite inside the container, so the Cloud Run deployment is intentionally single-instance and demo-grade. That is enough to prove the OCR, LLM, and VLM paths on GCP, but it is not the correct long-term persistence layer. The next production step is to move metadata off SQLite and onto Postgres or Cloud SQL.

## What I would improve with more time

I would add page-aware evidence highlighting in the viewer, a stronger image preprocessing stage before OCR, richer conflict detection across pages, and a cloud worker split so OCR, reasoning, and API traffic scale independently instead of sharing one process boundary.
