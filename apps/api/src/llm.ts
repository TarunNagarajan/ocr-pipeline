import type { DocumentType, EvidenceBlock } from "@credential-lens/types";
import { config } from "./config.js";

export interface ExtractedFieldInfo {
  key: string;
  label: string;
  value: string | null;
  type: "string" | "date" | "number" | "boolean";
  group: string;
}

export interface ModelDocumentAssessment {
  supported?: boolean;
  documentType?: DocumentType | "unknown";
  titleHint?: string | null;
  warnings?: string[] | null;
  rationale?: string[] | null;
  fields?: ExtractedFieldInfo[] | null;
  authenticity?: {
    isAuthentic: boolean;
    score: number;
    reasoning: string[];
  } | null;
}

let cachedVertexClient: any | null = null;

function shouldUseOpenAi(rawText: string, evidence: EvidenceBlock[]) {
  return config.LLM_MODE === "openai-compatible" && !!config.OPENAI_COMPAT_API_KEY && rawText.length > 60 && evidence.length > 0;
}

function shouldUseVertexLlm(rawText: string, evidence: EvidenceBlock[]) {
  return config.LLM_MODE === "vertex-ai" && !!config.GOOGLE_CLOUD_PROJECT && rawText.length > 60 && evidence.length > 0;
}

function shouldUseVertexVlm(mimeType: string, fileBuffer: Buffer) {
  return (
    config.VLM_MODE === "vertex-ai" &&
    !!config.GOOGLE_CLOUD_PROJECT &&
    fileBuffer.byteLength > 0 &&
    (mimeType === "application/pdf" || mimeType === "image/png" || mimeType === "image/jpeg")
  );
}

async function getVertexClient() {
  if (!cachedVertexClient) {
    const { GoogleGenAI } = await import("@google/genai");
    cachedVertexClient = new GoogleGenAI({
      vertexai: true,
      project: config.GOOGLE_CLOUD_PROJECT,
      location: config.GOOGLE_CLOUD_LOCATION
    });
  }
  return cachedVertexClient;
}

function parseJsonResponse<T>(value: string | undefined): T | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export async function maybeAdjudicateWithLlm(rawText: string, evidence: EvidenceBlock[]): Promise<ModelDocumentAssessment | undefined> {
  if (shouldUseOpenAi(rawText, evidence)) {
    return adjudicateWithOpenAi(rawText, evidence);
  }

  if (shouldUseVertexLlm(rawText, evidence)) {
    return adjudicateWithVertex(rawText, evidence);
  }

  return undefined;
}

async function adjudicateWithOpenAi(rawText: string, evidence: EvidenceBlock[]): Promise<ModelDocumentAssessment | undefined> {
  const payload = {
    model: config.OPENAI_COMPAT_MODEL ?? "gpt-4.1-mini",
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "document_assessment",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            supported: { type: "boolean" },
            documentType: {
              type: "string",
              enum: ["identity-document", "education-certificate", "marksheet", "professional-certificate", "unknown"]
            },
            titleHint: {
              type: ["string", "null"],
              description: "A very clean, 1-line summary/title of the document (e.g. 'No Objection Certificate - IIT Ropar')"
            },
            warnings: {
              type: "array",
              items: { type: "string" }
            },
            rationale: {
              type: "array",
              items: { type: "string" }
            },
            fields: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  value: { type: ["string", "null"] },
                  type: { type: "string", enum: ["string", "date", "number", "boolean"] },
                  group: { type: "string" }
                },
                required: ["key", "label", "type", "group"]
              }
            },
            authenticity: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                isAuthentic: { type: "boolean" },
                score: { type: "number", description: "0-100 confidence score" },
                reasoning: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    },
    messages: [
      {
        role: "system",
        content:
          "You are the primary extraction and forensic analysis model for sensitive credential and identity documents. Classify the document family and extract fields using only the supplied OCR evidence. Return supported=false when the document does not fit the supported families. Do not invent missing values. In addition, act as a forensic examiner to determine if the document is authentic. Analyze visual/textual consistency, signs of digital manipulation, AI generation, and standard document markings. Populate the authenticity field with your analysis."
      },
      {
        role: "user",
        content: JSON.stringify({
          rawTextPreview: rawText.slice(0, 4000),
          supportedFamilies: ["identity-document", "education-certificate", "marksheet", "professional-certificate"],
          schema: {
            holder: ["name", "fatherName", "dob"],
            credential: ["degree", "institution", "year", "cgpa"],
            issuer: ["issuerName"]
          },
          evidence: evidence.slice(0, 80).map((item) => ({
            id: item.id,
            page: item.page,
            text: item.text,
            confidence: item.confidence
          }))
        })
      }
    ]
  };

  const response = await fetch(`${config.OPENAI_COMPAT_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.OPENAI_COMPAT_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return undefined;
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return parseJsonResponse<ModelDocumentAssessment>(json.choices?.[0]?.message?.content);
}

async function adjudicateWithVertex(rawText: string, evidence: EvidenceBlock[]): Promise<ModelDocumentAssessment | undefined> {
  const client = await getVertexClient();
  const responseSchema = {
    type: "OBJECT",
    required: ["supported", "documentType", "fields", "warnings", "rationale"],
    properties: {
      supported: { type: "BOOLEAN" },
      documentType: {
        type: "STRING",
        enum: ["identity-document", "education-certificate", "marksheet", "professional-certificate", "unknown"]
      },
      titleHint: { type: "STRING", nullable: true, description: "A very clean, 1-line summary/title of the document" },
      warnings: { type: "ARRAY", items: { type: "STRING" } },
      rationale: { type: "ARRAY", items: { type: "STRING" } },
      fields: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            key: { type: "STRING", description: "A unique camelCase key for this field, e.g., documentNumber, name, cgpa" },
            label: { type: "STRING", description: "Human readable label, e.g., Document Number, Full Name, CGPA" },
            value: { type: "STRING", nullable: true },
            type: { type: "STRING", enum: ["string", "date", "number", "boolean"] },
            group: { type: "STRING", description: "Visual group name, e.g., 'Holder Details', 'Credential Details', 'Issuer Details'" },
            bbox: { type: "ARRAY", items: { type: "NUMBER" }, description: "The bounding box of the value in the image [ymin, xmin, ymax, xmax] scaled 0-1000." }
          },
          required: ["key", "label", "type", "group"]
        }
      },
      authenticity: {
        type: "OBJECT",
        nullable: true,
        properties: {
          isAuthentic: { type: "BOOLEAN" },
          score: { type: "NUMBER", description: "0-100 confidence score" },
          reasoning: { type: "ARRAY", items: { type: "STRING" } }
        }
      }
    },
    propertyOrdering: ["supported", "documentType", "titleHint", "warnings", "rationale", "fields", "authenticity"]
  };

  const response = await client.models.generateContent({
    model: config.VERTEX_LLM_MODEL,
    contents: [
      JSON.stringify({
        task:
          "CRITICAL: You are an extraction and forensic analysis model for identity and credential documents ONLY. Evaluate if the document is actually a certificate, marksheet, or ID. If it is a proposal, letter, essay, or unrelated document, you MUST set supported=false, documentType='unknown', and leave ALL fields null. Do NOT attempt to map unrelated text into the schema. You must also act as a forensic examiner to determine authenticity. Analyze textual consistency, signs of digital manipulation, AI generation, and standard document markings. Populate the authenticity field with your forensic analysis.",
        supportedFamilies: ["identity-document", "education-certificate", "marksheet", "professional-certificate"],
        schema: {
          holder: ["name", "fatherName", "dob"],
          credential: ["degree", "institution", "year", "cgpa"],
          issuer: ["issuerName"]
        },
        rawTextPreview: rawText.slice(0, 4000),
        evidence: evidence.slice(0, 60).map((item) => ({
          id: item.id,
          page: item.page,
          text: item.text,
          confidence: item.confidence
        }))
      })
    ],
    config: {
      temperature: 0,
      systemInstruction: "CRITICAL: You are an extraction and forensic analysis model for identity and credential documents ONLY. Evaluate if the document is actually a certificate, marksheet, or ID. If it is a proposal, letter, essay, or unrelated document, you MUST set supported=false, documentType='unknown', and leave ALL fields null. Do NOT attempt to map unrelated text into the schema. You must also act as a forensic examiner to determine authenticity. Analyze textual consistency, signs of digital manipulation, AI generation, and standard document markings. Populate the authenticity field with your forensic analysis.",
      responseMimeType: "application/json",
      responseSchema
    }
  });

  return parseJsonResponse<ModelDocumentAssessment>(response.text);
}

export async function maybeAssessWithVlm(input: {
  mimeType: string;
  fileBuffer: Buffer;
  rawText: string;
  evidence: EvidenceBlock[];
  gcsUri?: string | null;
}): Promise<ModelDocumentAssessment | undefined> {
  if (!shouldUseVertexVlm(input.mimeType, input.fileBuffer)) {
    return undefined;
  }

  const client = await getVertexClient();
  const responseSchema = {
    type: "OBJECT",
    required: ["supported", "documentType", "fields", "warnings", "rationale"],
    properties: {
      supported: { type: "BOOLEAN" },
      documentType: {
        type: "STRING",
        enum: ["identity-document", "education-certificate", "marksheet", "professional-certificate", "unknown"]
      },
      titleHint: { type: "STRING", nullable: true, description: "A very clean, 1-line summary/title of the document" },
      warnings: { type: "ARRAY", items: { type: "STRING" } },
      rationale: { type: "ARRAY", items: { type: "STRING" } },
      fields: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            key: { type: "STRING", description: "A unique camelCase key for this field, e.g., documentNumber, name, cgpa" },
            label: { type: "STRING", description: "Human readable label, e.g., Document Number, Full Name, CGPA" },
            value: { type: "STRING", nullable: true },
            type: { type: "STRING", enum: ["string", "date", "number", "boolean"] },
            group: { type: "STRING", description: "Visual group name, e.g., 'Holder Details', 'Credential Details', 'Issuer Details'" },
            bbox: { type: "ARRAY", items: { type: "NUMBER" }, description: "The bounding box of the value in the image [ymin, xmin, ymax, xmax] scaled 0-1000." }
          },
          required: ["key", "label", "type", "group"]
        }
      },
      authenticity: {
        type: "OBJECT",
        nullable: true,
        properties: {
          isAuthentic: { type: "BOOLEAN" },
          score: { type: "NUMBER", description: "0-100 confidence score" },
          reasoning: { type: "ARRAY", items: { type: "STRING" } }
        }
      }
    },
    propertyOrdering: ["supported", "documentType", "titleHint", "warnings", "rationale", "fields", "authenticity"]
  };

  const filePart = input.gcsUri
    ? {
        fileData: {
          fileUri: input.gcsUri,
          mimeType: input.mimeType
        }
      }
    : {
        inlineData: {
          data: input.fileBuffer.toString("base64"),
          mimeType: input.mimeType
        }
      };

  const response = await client.models.generateContent({
    model: config.VERTEX_VLM_MODEL,
    contents: [
      filePart,
      JSON.stringify({
        task:
          "CRITICAL: You are an extraction and forensic analysis model for identity and credential documents ONLY. Evaluate if the image is actually a certificate, marksheet, or ID. If it is a proposal, letter, essay, or unrelated document, you MUST set supported=false, documentType='unknown', and leave ALL fields null. Do NOT attempt to map unrelated text into the schema. You must also act as a forensic examiner to determine authenticity. Analyze visual consistency, lighting, shadows, compression artifacts, signs of digital manipulation, AI generation, and standard document markings. Populate the authenticity field with your forensic analysis.",
        schema: {
          holder: ["name", "fatherName", "dob"],
          credential: ["degree", "institution", "year", "cgpa"],
          issuer: ["issuerName"]
        },
        ocrPreview: input.rawText.slice(0, 3000),
        evidencePreview: input.evidence.slice(0, 30).map((item) => ({
          page: item.page,
          text: item.text
        }))
      })
    ],
    config: {
      temperature: 0,
      systemInstruction: "CRITICAL: You are an extraction model for identity and credential documents ONLY. Evaluate if the image is actually a certificate, marksheet, or ID. If it is a proposal, letter, essay, or unrelated document, you MUST set supported=false, documentType='unknown', and leave ALL fields null. Do NOT attempt to map unrelated text into the schema.",
      responseMimeType: "application/json",
      responseSchema
    }
  });

  return parseJsonResponse<ModelDocumentAssessment>(response.text);
}

export async function resolveConflictsWithLlm(
  rawText: string,
  conflicts: Record<string, { vision: string | null; llm: string | null }>,
  onStreamUpdate?: (text: string) => void,
  fileBuffer?: Buffer,
  mimeType?: string,
  gcsUri?: string | null
): Promise<Record<string, string | null>> {
  const client = await getVertexClient();
  
  const contents: any[] = [];
  
  if (fileBuffer && mimeType) {
    const filePart = gcsUri
      ? {
          fileData: {
            fileUri: gcsUri,
            mimeType: mimeType
          }
        }
      : {
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType
          }
        };
    contents.push(filePart);
  }
  
  contents.push(
    JSON.stringify({ 
      task: "Resolve conflicts between two extraction models. Review the visual document and the rawText, and output the correct values for the conflicted fields. CRITICAL INSTRUCTION: You MUST heavily trust the 'vision' value from the conflicts object over the 'llm' value, because the raw text layer often contains invisible traps or OCR errors. If they conflict, almost always output the 'vision' value.", 
      rawText, 
      conflicts 
    })
  );

  const responseStream = await client.models.generateContentStream({
    model: config.VERTEX_VLM_MODEL,
    contents: contents,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          resolvedFields: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                key: { type: "STRING" },
                value: { type: "STRING", nullable: true }
              }
            }
          },
          reasoning: { type: "ARRAY", items: { type: "STRING" } }
        }
      }
    }
  });

  let fullText = "";
  for await (const chunk of responseStream) {
    fullText += chunk.text;
    if (onStreamUpdate) {
      const reasoningMatch = fullText.match(/"reasoning"\s*:\s*\[([\s\S]*?)(?:\n\s*\]|$)/);
      if (reasoningMatch) {
        try {
          const partialArrayStr = `[${reasoningMatch[1]}]`.replace(/,\s*$/, "");
          const reasoningArray = JSON.parse(partialArrayStr + (partialArrayStr.endsWith('""') ? "" : '"]'));
          const cleanReasoning = reasoningArray.join(" ");
          onStreamUpdate(cleanReasoning);
        } catch {
          
          const cleanText = reasoningMatch[1].replace(/["\n,\[\]]/g, "").trim();
          onStreamUpdate(cleanText);
        }
      }
    }
  }

  const parsed = parseJsonResponse<{ resolvedFields: Array<{ key: string, value: string | null }> }>(fullText);
  const result: Record<string, string | null> = {};
  if (parsed?.resolvedFields) {
    for (const field of parsed.resolvedFields) {
      result[field.key] = field.value;
    }
  }
  return result;
}
