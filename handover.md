# Cystar Handover

This document is the working handoff for the project currently located at `C:\Users\ultim\cystar`.

The project is a full-stack implementation of the internship assessment's Problem 2, reworked into a document intelligence product called `Credential Lens`, with current emphasis on OCR, structured extraction, privacy-aware handling, and Google Cloud deployment.

## What This Project Is

This repository began as a solution for Problem 1, then was pivoted into Problem 2.

It now implements an OCR and structured extraction workflow for uploaded PDFs, PNGs, and JPEGs. The current product shape is:

- a dark, Obsidian-like workspace UI
- a Firefox-style document viewer surface
- a backend that extracts text, OCRs images, structures fields, and stores results
- optional model-assisted extraction using Vertex AI
- a live Google Cloud deployment

The current visible user flow is intentionally auth-free. Backend auth/session primitives still exist, but the main experience does not require login right now.

## The Problem Statement

The target assessment problem is:

`Problem 2: Intelligent Document OCR & Extraction Pipeline`

The intended outcome is a production-grade system that:

- accepts uploaded identity and professional/academic documents
- supports `.pdf`, `.jpg`, `.jpeg`, `.png`
- preprocesses and extracts text
- performs OCR and layout-aware evidence extraction
- structures data into a schema like:
  - `holder.name`
  - `holder.fatherName`
  - `holder.dob`
  - `credential.degree`
  - `credential.institution`
  - `credential.year`
  - `credential.cgpa`
  - `issuer.name`
- returns confidence and warnings
- keeps a history of processed documents
- presents a good frontend experience

The strongest interpretation of the problem is not "OCR plus JSON." It is "auditable document extraction with evidence and confidence."

## Your Preferences And Product Direction

These are the project-specific preferences that shaped the implementation and should continue to guide it.

You wanted the UI to feel like:

- Obsidian in dark mode
- a serious file-based workspace, not a toy dashboard
- a Firefox-style document viewer for PDFs and images

You explicitly did not want auth to be the current focus, so the visible flow is auth-free for now.

You wanted the system to:

- feel production-oriented, not hackathon-cheap
- use cloud deployment seriously
- actually run an LLM and VLM in the deployed path
- prioritize privacy and security
- avoid blindly trusting an LLM
- eventually generalize beyond one narrow academic certificate template

Later, you pushed for the model stack to do more of the actual extraction work. The current code reflects that direction: when models are enabled, the text LLM or the VLM is now the primary extractor/classifier, and heuristics serve mainly as fallback, normalization, and validation.

## Current Product State

The project is currently deployed and running.

Deployed frontend:

- [https://credential-lens-web-54011184572.asia-south1.run.app/documents](https://credential-lens-web-54011184572.asia-south1.run.app/documents)

Deployed API:

- [https://credential-lens-api-54011184572.asia-south1.run.app](https://credential-lens-api-54011184572.asia-south1.run.app)

The local repository path is:

- `C:\Users\ultim\cystar`

The original dated workspace still exists separately because it was locked by a running process when the move was requested.

## Current Architecture

The repository is a TypeScript monorepo.

Main structure:

- `apps/web`
  - Next.js frontend
- `apps/api`
  - Express API
- `packages/types`
  - shared types and payload contracts
- `packages/crypto`
  - despite the folder name, this is now the extraction/pipeline package

### Frontend

The main visible routes are:

- `/documents`
  - upload, history, workspace shell
- `/documents/[id]`
  - document viewer and extraction panel

The frontend is dark-themed and workspace-oriented. It is not meant to look like marketing UI.

### Backend

Important API routes:

- `GET /health`
- `POST /api/documents/process`
- `GET /api/documents`
- `GET /api/documents/:id/status`
- `GET /api/documents/:id/result`
- `GET /api/documents/:id/file`
- `GET /api/documents/stream`

### Extraction Design

The pipeline currently does this:

For PDFs:

- attempt direct text extraction first using `pdfjs-dist`
- if the text layer is too weak, attempt scanned-PDF OCR via `pdftoppm` plus `tesseract.js`

For images:

- OCR using `tesseract.js`

Then:

- build evidence blocks
- estimate quality
- call model extractors if enabled
- structure the result
- store the encrypted result

### Current Extraction Philosophy

The system originally used heuristics more heavily, then was shifted so models do more of the extraction.

Current intended behavior:

- for text-rich PDFs:
  - text LLM is primary extractor/classifier
- for image-like or weak-text documents:
  - VLM is primary extractor/classifier
- heuristics remain for:
  - fallback
  - normalization
  - quality gating
  - review-band logic

The current output schema is still fixed to the assessment-style fields, even for different document families.

## Current Supported Document Families

The system now tries to distinguish:

- `identity-document`
- `education-certificate`
- `marksheet`
- `professional-certificate`
- `unknown`

The output schema has not yet become family-specific. Instead, all supported families are mapped into the same holder/credential/issuer structure, with unsupported fields set to `null`.

## Google Cloud Deployment

### Project

Google Cloud project:

- project name: `My First Project`
- project id: `project-f491a721-1890-46bd-a8a`
- project number: `54011184572`

Region in use:

- `asia-south1`

### Existing GCP Resources

Artifact Registry repository:

- `ocr-platform`

Storage bucket:

- `ocr-docs-54011184572-asia-south1`

Cloud Run services:

- `credential-lens-api`
- `credential-lens-web`

Service accounts:

- `ocr-project-deployer@project-f491a721-1890-46bd-a8a.iam.gserviceaccount.com`
- `ocr-project-runtime@project-f491a721-1890-46bd-a8a.iam.gserviceaccount.com`

Important org policy limitation:

- service account key creation is blocked
- you should not expect downloadable JSON service account keys to work

The workaround used here was local `gcloud auth login` via browser-assisted OAuth flow.

## How To Interact With The Google Cloud Deployment

### Local gcloud setup

A working local SDK was unpacked in the repo:

- `C:\Users\ultim\cystar\.gcloud-sdk-py\google-cloud-sdk`

The command pattern used here was:

```powershell
$env:CLOUDSDK_PYTHON='C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe'
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' version
```

The active project should be:

```powershell
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' config set project project-f491a721-1890-46bd-a8a
```

### Required APIs

These were enabled:

- `run.googleapis.com`
- `cloudbuild.googleapis.com`
- `artifactregistry.googleapis.com`
- `aiplatform.googleapis.com`
- `secretmanager.googleapis.com`
- `storage.googleapis.com`
- `iamcredentials.googleapis.com`

### Cloud Build Files

Build configs in repo:

- `cloudbuild.api.yaml`
- `cloudbuild.web.yaml`

Container files:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

### Build Commands

Build API image:

```powershell
$env:CLOUDSDK_PYTHON='C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe'
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' builds submit --async --region=asia-south1 --config=cloudbuild.api.yaml .
```

Build web image:

```powershell
$env:CLOUDSDK_PYTHON='C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe'
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' builds submit --async --region=asia-south1 --config=cloudbuild.web.yaml --substitutions=_NEXT_PUBLIC_API_URL=https://credential-lens-api-54011184572.asia-south1.run.app .
```

To inspect build status:

```powershell
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' builds describe BUILD_ID --region=asia-south1 --format='value(status)'
```

### Deploy Commands

Deploy API:

```powershell
$env:CLOUDSDK_PYTHON='C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe'
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' run deploy credential-lens-api `
  --image='asia-south1-docker.pkg.dev/project-f491a721-1890-46bd-a8a/ocr-platform/credential-lens-api:BUILD_ID' `
  --region=asia-south1 `
  --platform=managed `
  --allow-unauthenticated `
  --service-account='ocr-project-runtime@project-f491a721-1890-46bd-a8a.iam.gserviceaccount.com' `
  --cpu=2 `
  --memory=2Gi `
  --concurrency=4 `
  --min-instances=1 `
  --max-instances=1 `
  --timeout=900 `
  --set-env-vars="NODE_ENV=production,DATABASE_URL=file:./dev.db,WEB_ORIGIN=https://credential-lens-web-54011184572.asia-south1.run.app,API_PUBLIC_URL=https://credential-lens-api-54011184572.asia-south1.run.app,JWT_SECRET=...,DOCUMENT_ENCRYPTION_KEY=...,STORAGE_BACKEND=gcs,GCS_BUCKET=ocr-docs-54011184572-asia-south1,STORAGE_ROOT=/tmp/credential-lens,MAX_UPLOAD_MB=12,LLM_MODE=vertex-ai,VLM_MODE=vertex-ai,GOOGLE_CLOUD_PROJECT=project-f491a721-1890-46bd-a8a,GOOGLE_CLOUD_LOCATION=global,VERTEX_LLM_MODEL=gemini-2.5-flash,VERTEX_VLM_MODEL=gemini-2.5-flash"
```

Deploy web:

```powershell
$env:CLOUDSDK_PYTHON='C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe'
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' run deploy credential-lens-web `
  --image='asia-south1-docker.pkg.dev/project-f491a721-1890-46bd-a8a/ocr-platform/credential-lens-web:BUILD_ID' `
  --region=asia-south1 `
  --platform=managed `
  --allow-unauthenticated `
  --cpu=1 `
  --memory=1Gi `
  --min-instances=0 `
  --max-instances=2 `
  --set-env-vars='NODE_ENV=production,NEXT_PUBLIC_API_URL=https://credential-lens-api-54011184572.asia-south1.run.app'
```

### Logs

Read API logs:

```powershell
$env:CLOUDSDK_PYTHON='C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe'
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' run services logs read credential-lens-api --region=asia-south1 --limit=100
```

Read web logs:

```powershell
& '.gcloud-sdk-py\google-cloud-sdk\bin\gcloud.cmd' run services logs read credential-lens-web --region=asia-south1 --limit=100
```

### Health Checks

API health:

- [https://credential-lens-api-54011184572.asia-south1.run.app/health](https://credential-lens-api-54011184572.asia-south1.run.app/health)

Frontend:

- [https://credential-lens-web-54011184572.asia-south1.run.app/documents](https://credential-lens-web-54011184572.asia-south1.run.app/documents)

## Model Configuration

The current deployed configuration is:

- `LLM_MODE=vertex-ai`
- `VLM_MODE=vertex-ai`
- `VERTEX_LLM_MODEL=gemini-2.5-flash`
- `VERTEX_VLM_MODEL=gemini-2.5-flash`

Current intent:

- text-heavy PDFs: Gemini text path is primary
- image-like or weak-text docs: Gemini multimodal path is primary
- heuristics remain for fallback and validation

Important nuance:

The code now treats model extraction as primary when enabled, but the structured result builder still contains a fairly strong heuristic layer. If the next goal is "LLM-led extraction even more aggressively," the next structural step is to let the model return richer field provenance and confidence, then reduce heuristic candidate generation further.

## Local Development

Install:

```powershell
npm install
```

Initialize local SQLite:

```powershell
npm run db:init -w apps/api
```

Start API:

```powershell
npm run dev -w apps/api
```

Start web:

```powershell
npm run dev -w apps/web
```

Open:

- [http://localhost:3000/documents](http://localhost:3000/documents)

## Current Known Limits

### 1. Persistence is still demo-grade

Cloud Run is currently using SQLite inside the API container:

- `DATABASE_URL=file:./dev.db`

This means:

- a new revision effectively resets metadata
- old uploaded document IDs disappear after redeploy
- the deployment is intentionally single-instance

This is the largest current architectural compromise.

### 2. Schema is still assessment-shaped

All document families are forced into the same output contract:

- holder
- credential
- issuer

That works for the assignment, but it is not ideal if the product becomes truly multi-family.

### 3. Viewer is fixed, but still simple

The `/api/documents/:id/file` route was fixed so Firefox can embed PDFs in the deployed web viewer, and it now reads through the storage abstraction instead of assuming local disk.

But the viewer still does not do:

- true page-aware evidence highlighting
- click-to-bounding-box navigation
- per-page overlays

### 4. Model confidence is still coarse

The models return fields, classification, and rationale, but the system still collapses that into simple field values and review bands. If you want model-led extraction to feel first-class, richer model provenance needs to become part of the stored result.

## What Was Recently Fixed

The following issues were already fixed and should not be reintroduced:

- unsupported prose documents were being misclassified as valid credentials
- degraded OCR was allowed to produce plausible-looking but untrustworthy fields
- clean images were inheriting unrealistic confidence assumptions
- the deployed viewer iframe was blocked by browser embed headers
- the deployed `/file` route was incorrectly reading only from local disk instead of abstracted storage
- Prisma Cloud Run packaging had an OpenSSL binary-target mismatch

## Recommended Next Steps

If continuing the project, the order should be:

First, replace SQLite-in-container with Cloud SQL or Postgres.

Second, make model output a first-class structured object with:

- explicit confidence
- field provenance
- field support rationale
- contradiction indicators

Third, move from one universal schema toward family-aware sub-schemas while still providing the assessment-compatible flattened view.

Fourth, add better page-aware viewer affordances:

- field click highlights
- evidence region overlays
- page-specific navigation

Fifth, tighten privacy defaults further:

- optional short-lived retention
- explicit purge controls
- redacted history summaries

## Files That Matter Most

Core extraction:

- `packages/crypto/src/index.ts`

Shared types:

- `packages/types/src/index.ts`

Model integration:

- `apps/api/src/llm.ts`

Pipeline orchestration:

- `apps/api/src/documents.ts`

Document routes:

- `apps/api/src/routes/document.routes.ts`

Storage:

- `apps/api/src/storage.ts`

Environment parsing:

- `apps/api/src/config.ts`

Frontend viewer:

- `apps/web/src/app/documents/page.tsx`
- `apps/web/src/app/documents/[id]/page.tsx`

Deployment files:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `cloudbuild.api.yaml`
- `cloudbuild.web.yaml`

## Final Summary

This project is now a live, deployed, working OCR and structured extraction system with:

- a dark workspace UI
- a browser-style document viewer
- OCR and PDF text extraction
- Vertex AI-backed text and multimodal model paths
- basic document family generalization
- privacy-oriented constraints

The main remaining weakness is not whether it runs. It runs. The main weakness is that the persistence layer is still demo-grade and the schema is still too assessment-shaped for a truly broad document platform.
