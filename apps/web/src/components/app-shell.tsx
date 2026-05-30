"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Files, PanelLeftOpen, Search, Settings2, ChevronRight, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { DocumentListItem } from "@credential-lens/types";

interface AppShellProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ title, subtitle, actions, sidebar, children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<"vault" | "explorer" | "search" | "settings">("vault");
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeTab === "explorer" || activeTab === "search") {
      api<DocumentListItem[]>("/api/documents")
        .then((res) => setDocuments(res || []))
        .catch((err) => {
          console.error(err);
          setDocuments([]);
        });
    }
  }, [activeTab]);

  const explorerGroups = useMemo(() => {
    const groups: Record<string, DocumentListItem[]> = {};
    for (const doc of documents) {
      if (doc.status !== "COMPLETED") continue;
      const type = doc.documentType || "unknown";
      if (!groups[type]) groups[type] = [];
      groups[type].push(doc);
    }
    return groups;
  }, [documents]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    return documents.filter(d => 
      (d.fileName || "").toLowerCase().includes(lower) || 
      (d.summaryLine || "").toLowerCase().includes(lower) ||
      (d.documentType || "").toLowerCase().includes(lower)
    );
  }, [documents, searchQuery]);

  const toggleBucket = (type: string) => {
    setExpandedBuckets(prev => ({ ...prev, [type]: !prev[type] }));
  };

  let activeSidebarContent: React.ReactNode = null;
  if (activeTab === "vault") {
    activeSidebarContent = sidebar;
  } else if (activeTab === "explorer") {
    activeSidebarContent = (
      <div className="flex h-full flex-col">
        <div className="p-3 custom-scrollbar overflow-y-auto">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Workspaces</div>
          <div className="grid gap-1">
            {Object.keys(explorerGroups).length === 0 ? (
              <div className="px-2 py-3 text-xs text-[var(--text-subtle)] text-center">No processed documents yet.</div>
            ) : (
              Object.entries(explorerGroups).map(([type, docs]) => (
                <div key={type}>
                  <div 
                    onClick={() => toggleBucket(type)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    {expandedBuckets[type] ? (
                      <ChevronDown className="h-4 w-4 text-[var(--text-subtle)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--text-subtle)]" />
                    )}
                    <span className="font-medium capitalize">{type.replace(/-/g, " ")}</span>
                    <span className="ml-auto text-xs text-[var(--text-muted)]">{docs.length}</span>
                  </div>
                  {expandedBuckets[type] && (
                    <div className="ml-6 mt-1 grid gap-1">
                      {docs.map(doc => (
                        <Link 
                          key={doc.id} 
                          href={`/documents/${doc.id}`}
                          className="block rounded-lg px-2 py-1.5 text-xs text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors truncate"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  } else if (activeTab === "search") {
    activeSidebarContent = (
      <div className="flex h-full flex-col p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-subtle)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents or fields..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-app)] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent-text)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {searchQuery ? (
            <div className="grid gap-2">
              {searchResults.map(doc => (
                <Link 
                  key={doc.id} 
                  href={`/documents/${doc.id}`}
                  className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3 hover:border-[var(--accent-text)] transition-colors"
                >
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="mt-1 text-xs text-[var(--text-subtle)] truncate">{doc.summaryLine}</p>
                </Link>
              ))}
              {searchResults.length === 0 && (
                <div className="text-center text-xs text-[var(--text-subtle)] mt-4">
                  No documents match your query.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-xs text-[var(--text-subtle)] mt-4">
              Try searching for a document name or extracted credential field.
            </div>
          )}
        </div>
      </div>
    );
  } else if (activeTab === "settings") {
    activeSidebarContent = (
      <div className="custom-scrollbar flex h-full flex-col overflow-y-auto p-4">
        <div className="mb-6">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Extraction Pipeline
          </h3>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3 mb-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">Vision Language Model</p>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--surface-app)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]">
              <span>Gemini 2.5 Pro (Vertex AI)</span>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">Strict Schema Enforcement</p>
            <p className="mt-1 text-xs text-[var(--text-subtle)]">Reject hallucinatory fields via Zod validation</p>
            <div className="mt-3 flex justify-end">
              <div className="h-5 w-9 rounded-full bg-[var(--accent-text)] relative shadow-inner">
                <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getNavButtonClass = (tabName: string) =>
    `flex h-9 w-9 items-center justify-center rounded-lg transition-colors outline-none ${
      activeTab === tabName
        ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
        : "text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
    }`;

  return (
    <main className="flex h-screen overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)]">
      <nav className="w-[56px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-app)]">
        <div className="flex h-full flex-col items-center gap-3 py-3">
          <Link
            href="/documents"
            className={getNavButtonClass("vault")}
            onClick={() => setActiveTab("vault")}
            title="Vault"
          >
            <Files className="h-4 w-4" />
          </Link>
          <button
            className={getNavButtonClass("explorer")}
            onClick={() => setActiveTab("explorer")}
            title="Explorer"
            type="button"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
          <button
            className={getNavButtonClass("search")}
            onClick={() => setActiveTab("search")}
            title="Search"
            type="button"
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="mt-auto">
            <button
              className={getNavButtonClass("settings")}
              onClick={() => setActiveTab("settings")}
              title="Settings"
              type="button"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <aside className="flex h-full w-[360px] min-w-[280px] max-w-[50%] shrink-0 resize-x flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-app)]">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {activeTab === "vault" ? title : activeTab}
          </p>
        </div>
        <div className="flex flex-1 flex-col min-h-0">{activeSidebarContent}</div>
      </aside>

      <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--surface-viewer)]">
        <header className="flex h-[var(--viewer-toolbar-height)] items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-toolbar)] px-4">
          <div className="flex items-center gap-3 text-sm text-[var(--text-subtle)]">
            <span className="rounded bg-black/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Workspace
            </span>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </main>
  );
}
