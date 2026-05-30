"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, Files, RefreshCcw, ScanSearch, Sparkles, Activity, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ReviewBandBadge, StatusBadge } from "@/components/document-primitives";
import { api } from "@/lib/api";
import {
  documentTypeLabel,
  formatDateTime,
  isTerminalStatus,
  type DocumentListItem,
  type ProcessDocumentResponse
} from "@/lib/credential-lens";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const hasActiveProcessing = useMemo(
    () => documents.some((document) => !isTerminalStatus(document.status)),
    [documents]
  );

  const loadDocuments = useCallback(async (initial = false) => {
    if (!initial) {
      setRefreshing(true);
    }
    try {
      const docs = await api<DocumentListItem[]>("/api/documents");
      setDocuments(docs);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDocuments(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDocuments]);

  useEffect(() => {
    if (!hasActiveProcessing) {
      return;
    }
    const timer = window.setInterval(() => void loadDocuments(), 3500);
    return () => window.clearInterval(timer);
  }, [hasActiveProcessing, loadDocuments]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setUploadError("");
    if (files.length > 0) {
      uploadDocuments(files);
    }
  }

  async function uploadDocuments(files: File[]) {
    setUploading(true);
    setUploadError("");
    try {
      let lastPayloadId = null;
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const payload = await api<ProcessDocumentResponse>("/api/documents/process", {
          method: "POST",
          body: formData
        });
        lastPayloadId = payload.id;
      }
      setSelectedFile(null);
      await loadDocuments();
      if (files.length === 1 && lastPayloadId) {
        window.location.href = `/documents/${lastPayloadId}`;
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Unable to upload documents.");
    } finally {
      setUploading(false);
    }
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setDragCounter((prev) => {
      if (prev === 0) setIsDragging(true);
      return prev + 1;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCounter = Math.max(0, prev - 1);
      if (newCounter === 0) setIsDragging(false);
      return newCounter;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg'];
      const filesToUpload = Array.from(e.dataTransfer.files).filter(
        file => validTypes.includes(file.type) || file.name.endsWith('.pdf')
      );
      
      if (filesToUpload.length > 0) {
        setUploadError("");
        uploadDocuments(filesToUpload);
      } else {
        setUploadError("Invalid file type. Please upload PDF, PNG, or JPEG.");
      }
    }
  }, []);

  const sidebar = (
    <div className="flex h-full flex-col">


      <div className="border-b border-[var(--border-subtle)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Vault overview
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]">
            <div className="flex items-center gap-2 text-sm text-[var(--text-subtle)]">
              <Files className="h-4 w-4" />
              <span>Total Documents</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">{documents.length}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]">
            <div className="flex items-center gap-2 text-sm text-[var(--text-subtle)]">
              <Activity className="h-4 w-4" />
              <span>Processing</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {documents.filter((item) => !isTerminalStatus(item.status)).length}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]">
            <div className="flex items-center gap-2 text-sm text-[var(--text-subtle)]">
              <AlertCircle className="h-4 w-4" />
              <span>Needs Review</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {documents.filter((item) => item.reviewBand === "needs_review" || item.reviewBand === "conflict").length}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 custom-scrollbar">
        <div className="mb-2 px-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Files
          </p>
        </div>
        <div className="grid gap-1">
          {documents.map((document) => (
            <Link
              key={document.id}
              href={`/documents/${document.id}`}
              className="focus-ring rounded-lg px-3 py-3 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-[var(--surface-muted)] p-2 text-[var(--text-subtle)]">
                  <Files className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.fileName}</p>
                  <p className="mt-1 truncate text-xs text-[var(--text-subtle)]">{document.summaryLine}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={document.status} />
                    <ReviewBandBadge band={document.reviewBand} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {!loading && documents.length === 0 ? (
            <div className="px-3 py-6 text-sm text-[var(--text-subtle)]">
              No documents yet. Upload one to start the workspace.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Vault"
      subtitle="An Obsidian-style document workspace with evidence-backed OCR extraction."
      sidebar={sidebar}
      actions={
        <button
          type="button"
          onClick={() => void loadDocuments()}
          className="viewer-toolbar-button focus-ring"
          title="Refresh"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      <div 
        className={`custom-scrollbar relative h-full overflow-y-auto p-8 transition-colors ${isDragging ? 'bg-[var(--surface-hover)]' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--accent-text)] bg-[var(--surface-app)] bg-opacity-90">
            <div className="flex flex-col items-center justify-center gap-4">
              <ScanSearch className="h-12 w-12 animate-pulse text-[var(--accent-text)]" />
              <p className="text-xl font-medium text-[var(--text-primary)]">Drop document to upload</p>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Vault Contents</h2>
              <p className="mt-1 text-sm text-[var(--text-subtle)]">
                Manage, review, and audit all extracted credentials.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
                {documents.length} Total
              </span>
              <label className={`focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white transition-all duration-200 ${uploading ? 'opacity-50 cursor-wait' : 'hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-sm'}`}>
                <FilePlus2 className="h-4 w-4" />
                <span className="truncate">{uploading ? "Uploading..." : "Upload Document"}</span>
                <input
                  className="hidden"
                  type="file"
                  multiple
                  disabled={uploading}
                  accept=".pdf,image/png,image/jpeg"
                  onChange={onFileChange}
                />
              </label>
            </div>
          </header>

          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-app)] shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Document</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Review Band</th>
                  <th className="px-6 py-4 font-semibold text-right">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {documents.map((document) => (
                  <tr key={document.id} className="group transition-colors hover:bg-[var(--surface-hover)]">
                    <td className="px-6 py-4">
                      <Link href={`/documents/${document.id}`} className="block focus:outline-none">
                        <div className="font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-text)]">
                          {document.fileName}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-subtle)]">
                          {documentTypeLabel(document.documentType)}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={document.status} />
                    </td>
                    <td className="px-6 py-4">
                      <ReviewBandBadge band={document.reviewBand} />
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--text-subtle)]">
                      {formatDateTime(document.updatedAt)}
                    </td>
                  </tr>
                ))}
                {!loading && documents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-24 text-center text-sm text-[var(--text-subtle)]">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-muted)]">
                          <Files className="h-8 w-8 text-[var(--text-muted)] opacity-70" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-[var(--text-primary)]">Your vault is empty</p>
                          <p className="mt-1 text-sm">Upload a document to begin processing.</p>
                        </div>
                        <label className={`focus-ring mt-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--accent-strong)] px-6 py-3 text-sm font-medium text-white transition-all duration-200 ${uploading ? 'opacity-50 cursor-wait' : 'hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-sm'}`}>
                          <ScanSearch className="h-4 w-4" />
                          <span className="truncate">{uploading ? "Uploading..." : "Upload Document"}</span>
                          <input
                            className="hidden"
                            type="file"
                            multiple
                            disabled={uploading}
                            accept=".pdf,image/png,image/jpeg"
                            onChange={onFileChange}
                          />
                        </label>
                        {uploadError ? (
                          <p className="mt-3 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
                            {uploadError}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        {error ? (
          <div className="mx-auto mt-6 max-w-6xl rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}



