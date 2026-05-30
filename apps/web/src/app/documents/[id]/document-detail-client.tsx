"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Minus,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Highlighter
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { AppShell } from "@/components/app-shell";
import {
  ExtractionFieldCard,
  ProgressPanel,
  ReviewBandBadge,
  ReviewBandBanner,
  StatusBadge
} from "@/components/document-primitives";
import { api, apiBaseUrl } from "@/lib/api";
import {
  documentTypeLabel,
  isTerminalStatus,
  type DocumentResultPayload,
  type DocumentStatusPayload,
  type EvidenceBlock,
  type ExtractionField
} from "@/lib/credential-lens";

type TabKey = "structured" | "evidence" | "raw" | "json";

export default function DocumentDetailClient() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const [payload, setPayload] = useState<DocumentResultPayload | null>(null);
  const [tab, setTab] = useState<TabKey>("structured");
  const [zoom, setZoom] = useState(180);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showHighlights, setShowHighlights] = useState(true);
  const [hoveredFieldData, setHoveredFieldData] = useState<{evidenceIds: string[], spatialBboxes?: number[][], group?: string}>({evidenceIds: []});

  const result = payload?.result ?? null;
  const evidenceIndex = useMemo(
    () => new Map((result?.evidence ?? []).map((item) => [item.id, item])),
    [result]
  );

  // Reverse map: evidenceId → field labels that reference it — for click-to-navigate
  const evidenceToFieldLabels = useMemo(() => {
    const map = new Map<string, string[]>();
    if (result?.fields) {
      for (const [label, field] of Object.entries(result.fields)) {
        for (const id of field.evidenceIds) {
          const existing = map.get(id) ?? [];
          existing.push(label);
          map.set(id, existing);
        }
      }
    }
    return map;
  }, [result]);

  const clickHighlightTimeoutRef = useRef<number | null>(null);

  const handleClickEvidence = useCallback((evidenceId: string) => {
    const labels = evidenceToFieldLabels.get(evidenceId);
    if (!labels || labels.length === 0) return;
    const sanitized = labels[0].replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById(`field-${sanitized}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[var(--accent-strong)]');
      if (clickHighlightTimeoutRef.current !== null) {
        window.clearTimeout(clickHighlightTimeoutRef.current);
      }
      clickHighlightTimeoutRef.current = window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[var(--accent-strong)]');
        clickHighlightTimeoutRef.current = null;
      }, 2500);
    }
  }, [evidenceToFieldLabels]);

  const loadDocument = useCallback(async (initial = false) => {
    if (!initial) {
      setRefreshing(true);
    }
    try {
      const nextPayload = await api<DocumentResultPayload>(`/api/documents/${documentId}/result`);
      setPayload(nextPayload);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load document.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [documentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDocument(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDocument]);

  useEffect(() => {
    if (!payload || isTerminalStatus(payload.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const statusPayload = await api<DocumentStatusPayload>(`/api/documents/${documentId}/status`);
        setPayload((current) => (current ? { ...current, ...statusPayload } : current));
        if (isTerminalStatus(statusPayload.status)) {
          const finalPayload = await api<DocumentResultPayload>(`/api/documents/${documentId}/result`);
          setPayload(finalPayload);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to refresh document status.");
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [documentId, payload]);

  const sidebar = (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="border-b border-[var(--border-subtle)] px-4 py-4">
        <Link
          href="/documents"
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-xs font-medium text-[var(--text-subtle)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to vault
        </Link>
        {payload ? (
          <div className="mt-4">
            <p className="break-all text-sm font-semibold">{payload.fileName}</p>
            <p className="mt-1 text-xs text-[var(--text-subtle)]">{payload.mimeType}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={payload.status} />
              {result ? <ReviewBandBadge band={result.summary.reviewBand} /> : null}
              {result?.authenticity ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${result.authenticity.isAuthentic ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`} title={result.authenticity.reasoning.join(" ")}>
                  {result.authenticity.isAuthentic ? "Authentic" : "Suspected Forgery"}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-b border-[var(--border-subtle)] p-3">
        <div className="flex w-full items-center justify-between rounded-lg bg-[var(--surface-app)] p-1 shadow-inner">
          {(["structured", "evidence", "raw", "json"] as TabKey[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`flex-1 rounded-md border px-3 py-1.5 text-center text-xs font-medium capitalize transition-all outline-none ${
                tab === item
                  ? "bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-sm border-[var(--border-subtle)]"
                  : "text-[var(--text-subtle)] hover:text-[var(--text-primary)] border-transparent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 custom-scrollbar overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-[var(--text-subtle)]">Loading document...</p>
        ) : error ? (
          <div className="rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">{error}</div>
        ) : !payload ? (
          <p className="text-sm text-[var(--text-subtle)]">Document not found.</p>
        ) : tab === "structured" ? (
          <StructuredPane 
            payload={payload} 
            evidenceIndex={evidenceIndex}
            onHoverField={setHoveredFieldData}
          />
        ) : tab === "evidence" ? (
          <EvidencePane evidence={result?.evidence ?? []} />
        ) : tab === "json" ? (
          <JsonPane result={result} />
        ) : (
          <RawPane rawText={result?.rawText ?? ""} />
        )}
      </div>
    </div>
  );

  const previewUrl = payload ? `${apiBaseUrl}${payload.previewUrl}` : "";

  return (
    <AppShell
      title="Viewer"
      subtitle="Firefox-style document surface with OCR status, evidence, and structured extraction."
      sidebar={sidebar}
      actions={
        <>
          <button
            type="button"
            onClick={() => void loadDocument()}
            className="viewer-toolbar-button focus-ring"
            title="Refresh"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </>
      }
    >
      {payload ? (
        <div className="flex h-full flex-col">
          <div className="flex h-[42px] items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-toolbar)] px-4">
            <div className="flex items-center gap-2">
              <button type="button" className="viewer-toolbar-button focus-ring">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="viewer-toolbar-button focus-ring">
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="ml-2 flex items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-sm text-[var(--text-primary)]">
                <span className="inline-flex h-6 min-w-9 items-center justify-center rounded bg-[var(--surface-panel)] px-2 text-xs font-medium">
                  1
                </span>
                <span className="text-xs text-[var(--text-subtle)]">of {Math.max(1, payload.pageCount)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button type="button" className="viewer-toolbar-button focus-ring" onClick={() => setZoom((z) => Math.max(80, z - 10))}>
                <Minus className="h-4 w-4" />
              </button>
              <div className="viewer-zoom-label rounded-md bg-black/20 px-3 py-1 text-sm text-[var(--text-primary)]">{zoom}%</div>
              <button type="button" className="viewer-toolbar-button focus-ring" onClick={() => setZoom((z) => Math.min(250, z + 10))}>
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button 
                type="button" 
                className={`viewer-toolbar-button focus-ring ${showHighlights ? "bg-black/20 text-[var(--accent-text)]" : ""}`}
                onClick={() => setShowHighlights(!showHighlights)}
                title="Toggle Visual Highlights"
              >
                <Highlighter className="h-4 w-4" />
              </button>
              <button 
                type="button" 
                className="viewer-toolbar-button focus-ring" 
                onClick={() => alert("To search the document, use Ctrl+F (Cmd+F) while hovering over the Raw or JSON tabs!")}
                title="Search Document"
              >
                <Search className="h-4 w-4" />
              </button>
              <button 
                type="button" 
                className="viewer-toolbar-button focus-ring" 
                onClick={() => {
                  navigator.clipboard.writeText(result?.rawText || window.location.href);
                  alert(result?.rawText ? "Copied raw OCR text to clipboard!" : "Copied document link to clipboard!");
                }}
                title="Copy Document Text"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button 
                type="button" 
                className="viewer-toolbar-button focus-ring" 
                onClick={() => window.print()}
                title="Print Document"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-auto bg-[var(--surface-viewer)] p-6">
            <div className="mx-auto max-w-[1200px]">
              <ProgressPanel
                status={payload.status}
                progress={payload.progress}
                stageLabel={payload.stageLabel}
                errorMessage={payload.errorMessage}
              />
              <div className="viewer-shadow mt-6 overflow-hidden rounded-sm border border-black/20 bg-[var(--surface-canvas)] relative">
                <div style={{ transform: `scale(${zoom / 180})`, transformOrigin: "top left" }}>
                  {payload.mimeType === "application/pdf" ? (
                    <div className="relative inline-block bg-white shadow-2xl">
                      <Document file={previewUrl} loading={<div className="p-8 text-[var(--text-subtle)]">Loading PDF...</div>}>
                        <Page pageNumber={1} renderTextLayer={true} renderAnnotationLayer={true} />
                      </Document>
                      {showHighlights && (
                        <BoundingBoxOverlay evidenceIndex={evidenceIndex} hoveredData={hoveredFieldData} onClickEvidence={handleClickEvidence} />
                      )}
                    </div>
                  ) : (
                    <div className="relative inline-block bg-white shadow-2xl">
                      {}
                      <img
                        src={previewUrl}
                        alt={payload.fileName}
                        className="block h-auto w-auto max-w-none"
                      />
                      {showHighlights && (hoveredFieldData.evidenceIds.length > 0 || hoveredFieldData.spatialBboxes) && (
                         <BoundingBoxOverlay evidenceIndex={evidenceIndex} hoveredData={hoveredFieldData} onClickEvidence={handleClickEvidence} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-subtle)]">
          No document selected.
        </div>
      )}
    </AppShell>
  );
}


interface HighlighterPalette {
  fill: string;
  fillLight: string;
  fillMid: string;
  stroke: string;
  glow: string;
}

const HIGHLIGHTER_PALETTE: Record<string, HighlighterPalette> = {
  amber: {
    fill: 'rgba(250, 204, 21, 0.32)',
    fillLight: 'rgba(250, 204, 21, 0.10)',
    fillMid: 'rgba(250, 204, 21, 0.48)',
    stroke: 'rgba(250, 204, 21, 0.20)',
    glow: 'rgba(250, 204, 21, 0.22)',
  },
  blue: {
    fill: 'rgba(96, 165, 250, 0.28)',
    fillLight: 'rgba(96, 165, 250, 0.08)',
    fillMid: 'rgba(96, 165, 250, 0.42)',
    stroke: 'rgba(96, 165, 250, 0.18)',
    glow: 'rgba(96, 165, 250, 0.22)',
  },
  purple: {
    fill: 'rgba(167, 139, 250, 0.28)',
    fillLight: 'rgba(167, 139, 250, 0.08)',
    fillMid: 'rgba(167, 139, 250, 0.42)',
    stroke: 'rgba(167, 139, 250, 0.18)',
    glow: 'rgba(167, 139, 250, 0.22)',
  },
  green: {
    fill: 'rgba(52, 211, 153, 0.28)',
    fillLight: 'rgba(52, 211, 153, 0.08)',
    fillMid: 'rgba(52, 211, 153, 0.42)',
    stroke: 'rgba(52, 211, 153, 0.18)',
    glow: 'rgba(52, 211, 153, 0.22)',
  },
  rose: {
    fill: 'rgba(251, 146, 60, 0.28)',
    fillLight: 'rgba(251, 146, 60, 0.08)',
    fillMid: 'rgba(251, 146, 60, 0.42)',
    stroke: 'rgba(251, 146, 60, 0.18)',
    glow: 'rgba(251, 146, 60, 0.22)',
  },
};

const FIELD_GROUP_TONE: Record<string, string> = {
  "Personal Information": "amber",
  "Extracted Details": "amber",
  "Education Details": "blue",
  "Document Details": "green",
  "Credential Details": "green",
  "Issuer Information": "purple",
};

function getHighlighter(group?: string): HighlighterPalette {
  const toneKey = FIELD_GROUP_TONE[group ?? ''] ?? 'amber';
  return HIGHLIGHTER_PALETTE[toneKey];
}

function naturalRotation(idx: number, xPos: number): number {
  
  const seed = ((idx + 1) * 17 + Math.round(xPos * 100) * 31 + 13) % 97;
  return (seed - 48) / 32; 
}

function BoundingBoxOverlay({ evidenceIndex, hoveredData, onClickEvidence }: {
  evidenceIndex: Map<string, EvidenceBlock>;
  hoveredData: { evidenceIds: string[]; spatialBboxes?: number[][]; group?: string };
  onClickEvidence?: (evidenceId: string) => void;
}) {
  const palette = getHighlighter(hoveredData.group);
  const isSpatial = hoveredData.spatialBboxes && hoveredData.spatialBboxes.length > 0;
  const items = isSpatial ? hoveredData.spatialBboxes! : hoveredData.evidenceIds;

  if (items.length === 0) return null;

  return (
    <div className="absolute inset-0 z-50">
      {items.map((item, idx) => {
        let left: string, top: string, width: string, height: string;
        let clickEvidenceId: string | undefined;

        if (isSpatial) {
          const [ymin, xmin, ymax, xmax] = item as number[];
          left = `${(xmin / 1000) * 100}%`;
          top = `${(ymin / 1000) * 100}%`;
          width = `${((xmax - xmin) / 1000) * 100}%`;
          height = `${((ymax - ymin) / 1000) * 100}%`;
          
          clickEvidenceId = hoveredData.evidenceIds[0];
        } else {
          const block = evidenceIndex.get(item as string);
          if (!block?.bbox) return null;
          left = `${block.bbox.x}px`;
          top = `${block.bbox.y}px`;
          width = `${block.bbox.width}px`;
          height = `${block.bbox.height}px`;
          clickEvidenceId = item as string;
        }

        
        const rotation = isSpatial
          ? naturalRotation(idx, parseFloat(left))
          : naturalRotation(idx, parseFloat(width));

        const handleClick = clickEvidenceId && onClickEvidence
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onClickEvidence(clickEvidenceId!);
            }
          : undefined;

        return (
          <div
            key={isSpatial ? `hl-${idx}` : (item as string)}
            className={`absolute ${handleClick ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
            style={{
              left,
              top,
              width,
              height,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              borderRadius: '3px 15px 5px 15px',
              
              background: `linear-gradient(178deg,
                ${palette.fillLight} 0%,
                ${palette.fillMid} 40%,
                ${palette.fillMid} 60%,
                ${palette.fillLight} 100%
              )`,
              
              boxShadow: `
                0 0 12px ${palette.glow},
                0 0 24px ${palette.glow}
              `,
              mixBlendMode: 'multiply',
              transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'transform',
            }}
          />
        );
      })}
    </div>
  );
}

function StructuredPane(props: {
  payload: DocumentResultPayload;
  evidenceIndex: Map<string, EvidenceBlock>;
  onHoverField?: (hoverData: {evidenceIds: string[], spatialBboxes?: number[][], group?: string}) => void;
}) {
  const result = props.payload.result;
  if (!result) {
    return (
      <div className="text-sm text-[var(--text-subtle)]">
        Structured output will appear once processing completes.
      </div>
    );
  }

  const groupedFields = Object.values(result.fields).reduce((acc, field) => {
    const groupName = field.group || "Extracted Details";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(field);
    return acc;
  }, {} as Record<string, any[]>);

  const groups = Object.entries(groupedFields)
    .map(([title, fields]) => ({
      title,
      fields: fields
        .filter((field) => field.band !== "unsupported")
        .map((field) => [field.label, field] as [string, any])
    }))
    .filter((g) => g.fields.length > 0);

  return (
    <div className="grid gap-5">
      <ReviewBandBanner band={result.summary.reviewBand} />
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Summary</p>
        <h3 className="mt-3 text-sm font-semibold">{documentTypeLabel(result.summary.documentType)}</h3>
        <div className="mt-2 grid gap-1 text-xs leading-5 text-[var(--text-subtle)]">
          {result.summary.titleLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {group.title}
          </h3>
          <div className="grid gap-3">
            {group.fields.map(([label, field]) => (
              <ExtractionFieldCard 
                key={label} 
                id={`field-${label.replace(/[^a-zA-Z0-9]/g, '_')}`}
                label={label} 
                field={field} 
                onHover={(isHovering) => props.onHoverField?.(isHovering ? {evidenceIds: field.evidenceIds, spatialBboxes: field.spatialBboxes, group: group.title} : {evidenceIds: []})}
              />
            ))}
          </div>
        </section>
      ))}
      {groups.length > 0 ? (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Evidence references</p>
          <div className="mt-3 grid gap-2 text-xs text-[var(--text-subtle)]">
            {groups.flatMap(g => g.fields).map(([label, field]) => (
              <div key={label} className="rounded-lg bg-[var(--surface-app)] px-3 py-2">
                <p className="font-medium text-[var(--text-primary)]">{label}</p>
                <p className="mt-1">
                  {field.evidenceIds.length > 0
                    ? field.evidenceIds
                        .map((id: string) => {
                          const evidence = props.evidenceIndex.get(id);
                          return evidence ? `${id} · page ${evidence.page}` : id;
                        })
                        .join(", ")
                    : "No evidence linked."}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EvidencePane(props: { evidence: EvidenceBlock[] }) {
  if (props.evidence.length === 0) {
    return <div className="text-sm text-[var(--text-subtle)]">Evidence blocks will populate after OCR.</div>;
  }

  return (
    <div className="grid gap-3">
      {props.evidence.map((item) => (
        <article key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{item.id}</p>
              <p className="mt-1 text-xs text-[var(--text-subtle)]">
                Page {item.page} · {item.blockType} · {item.source}
              </p>
            </div>
            <span className="rounded-md bg-[var(--surface-app)] px-2 py-1 text-xs text-[var(--text-subtle)]">
              {item.confidence ?? "n/a"}%
            </span>
          </div>
          <div className="mt-3 rounded-lg bg-[var(--surface-app)] px-3 py-3">
            <p className="text-xs leading-6 text-[var(--text-primary)]">{item.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function RawPane(props: { rawText: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        <FileText className="h-4 w-4" />
        Raw OCR text
      </div>
      <pre className="custom-scrollbar max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-app)] px-3 py-3 text-xs leading-6 text-[var(--text-primary)]">
        {props.rawText || "No OCR text available yet."}
      </pre>
    </div>
  );
}

function JsonPane(props: { result: NonNullable<DocumentResultPayload["result"]> | null }) {
  const [copied, setCopied] = useState(false);
  if (!props.result) return <div className="text-sm text-[var(--text-subtle)]">No JSON available yet.</div>;
  const jsonString = JSON.stringify(props.result, null, 2);
  const handleCopy = () => {
    void navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 relative">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          <FileText className="h-4 w-4" />
          Extracted JSON
        </div>
        <button 
          onClick={handleCopy} 
          className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors focus-ring"
        >
          {copied ? <span className="h-3.5 w-3.5 flex items-center justify-center text-[var(--accent-text)]">✓</span> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>
      <pre className="custom-scrollbar max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-app)] px-3 py-3 text-xs leading-6 text-[var(--text-primary)]">
        {jsonString}
      </pre>
    </div>
  );
}
