import { AlertCircle, CheckCircle2, Clock3, FileWarning, LoaderCircle } from "lucide-react";
import {
  fieldConfidenceTone,
  formatReviewBand,
  reviewBandClasses,
  statusClasses,
  type DocumentStatus,
  type ExtractionField,
  type ReviewBand
} from "@/lib/credential-lens";

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClasses(status)}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ReviewBandBadge({ band }: { band: ReviewBand }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${reviewBandClasses(band)}`}>
      {formatReviewBand(band)}
    </span>
  );
}

export function ReviewBandBanner({ band }: { band: ReviewBand }) {
  const copy = {
    auto_accept: {
      icon: CheckCircle2,
      title: "Auto-accept",
      body: "The extraction is coherent enough for a low-friction pass."
    },
    needs_review: {
      icon: Clock3,
      title: "Needs review",
      body: "At least one field should be manually checked before this data is trusted."
    },
    conflict: {
      icon: FileWarning,
      title: "Conflict detected",
      body: "The system found contradictory or ambiguous signals in the source."
    },
    unsupported: {
      icon: AlertCircle,
      title: "Unsupported",
      body: "The current extraction profile does not match this document shape."
    }
  } as const;

  const item = copy[band];
  const Icon = item.icon;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${reviewBandClasses(band)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{item.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-subtle)]">{item.body}</p>
        </div>
      </div>
    </div>
  );
}

export function ProgressPanel(props: {
  status: DocumentStatus;
  progress: number;
  stageLabel: string;
  errorMessage?: string | null;
  systemMessage?: string | null;
}) {
  if (props.status === "COMPLETED") return null;

  const running = props.status !== "FAILED";

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {running ? (
            <div className="relative flex h-5 w-5 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-strong)] opacity-20" />
              <LoaderCircle className="h-4 w-4 animate-spin text-[var(--accent-strong)]" />
            </div>
          ) : (
            <AlertCircle className="h-4 w-4 text-[var(--danger-text)]" />
          )}
          <span className="text-sm font-semibold">{props.stageLabel}</span>
        </div>
        <span className="text-xs font-semibold text-[var(--text-subtle)]">{props.progress}%</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className={`relative h-full rounded-full transition-all duration-500 ease-out ${props.status === "FAILED" ? "bg-[var(--danger-text)]" : "bg-[var(--accent-strong)] overflow-hidden"}`}
          style={{ width: `${Math.max(2, props.progress)}%` }}
        >
          {running && (
             <div className="absolute inset-0 w-full animate-pulse bg-white/30" />
          )}
        </div>
      </div>
      {props.errorMessage ? (
        <p className="mt-3 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
          {props.errorMessage}
        </p>
      ) : null}
      {props.systemMessage ? (
        <div className="mt-3 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2">
          <p className="font-mono text-xs tracking-tight text-purple-400">
            {props.systemMessage}
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-purple-400 align-middle"></span>
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function ExtractionFieldCard(props: {
  label: string;
  field: ExtractionField;
  onHover?: (isHovering: boolean) => void;
  id?: string;
}) {
  const confidenceWidth = Math.max(4, Math.min(100, props.field.confidence));

  return (
    <article 
      id={props.id}
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 transition-colors hover:border-[var(--accent-text)]"
      onMouseEnter={() => props.onHover?.(true)}
      onMouseLeave={() => props.onHover?.(false)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{props.label}</p>
          <p className="mt-2 break-words text-sm font-semibold text-[var(--text-primary)]">
            {props.field.value ?? "Not extracted"}
          </p>
          {props.field.normalizedValue && props.field.normalizedValue !== props.field.value ? (
            <p className="mt-1 text-xs italic text-[var(--text-subtle)]">Normalized: {props.field.normalizedValue}</p>
          ) : null}
        </div>
        <ReviewBandBadge band={props.field.band} />
      </div>

      {props.field.sources.length > 0 ? (
        <p className="mt-4 text-xs leading-5 text-[var(--text-subtle)]">
          <span className="font-semibold text-[var(--text-primary)]">Sources:</span>{" "}
          {props.field.sources.join(", ").replace(/_/g, " ")}
        </p>
      ) : null}
      {props.field.reasoning.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-[var(--text-subtle)]">{props.field.reasoning.join(" ")}</p>
      ) : null}
    </article>
  );
}
