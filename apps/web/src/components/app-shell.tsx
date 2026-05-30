"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Files, PanelLeftOpen, Search, Settings2, ChevronRight, ChevronDown, Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import { usePlatform } from "@/lib/use-platform";
import type { DocumentListItem } from "@credential-lens/types";

interface AppShellProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ title, subtitle, actions, sidebar, children }: AppShellProps) {
  const platform = usePlatform();
  const [activeTab, setActiveTab] = useState<"vault" | "explorer" | "search" | "settings">("vault");
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // On mobile, sidebar starts closed; on desktop it's always open
  useEffect(() => {
    setSidebarOpen(!platform.isMobileOrNative);
  }, [platform.isMobileOrNative]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleTabChange = useCallback((tab: "vault" | "explorer" | "search" | "settings") => {
    setActiveTab(tab);
    
    if (platform.isMobileOrNative) {
      setSidebarOpen(true);
    }
  }, [platform.isMobileOrNative]);

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
        <div className="pt-2 px-3 pb-1 custom-scrollbar overflow-y-auto">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <div className="flex items-center justify-between">
              <span>Workspaces</span>
              <button
                type="button"
                className="text-[10px] text-[var(--accent-text)] hover:underline"
                onClick={closeSidebar}
              >
                Done
              </button>
            </div>
          </div>
          <div className="grid gap-1">
            {Object.keys(explorerGroups).length === 0 ? (
              <div className="px-2 py-3 text-xs text-[var(--text-subtle)] text-center">No processed documents yet.</div>
            ) : (
              Object.entries(explorerGroups).map(([type, docs]) => (
                <div key={type}>
                  <div 
                    onClick={() => toggleBucket(type)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface-muted)]"
                  >
                    {expandedBuckets[type] ? (
                      <ChevronDown className="h-4 w-4 text-[var(--text-subtle)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--text-subtle)]" />
                    )}
                    <span className="font-medium capitalize truncate">{type.replace(/-/g, " ")}</span>
                    <span className="ml-auto text-xs text-[var(--text-muted)]">{docs.length}</span>
                  </div>
                  {expandedBuckets[type] && (
                    <div className="ml-6 mt-1 grid gap-1">
                      {docs.map(doc => (
                        <Link 
                          key={doc.id} 
                          href={`/documents/${doc.id}`}
                          onClick={() => platform.isMobileOrNative && closeSidebar()}
                          className="block rounded-lg px-2 py-2 text-xs text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:bg-[var(--surface-muted)] transition-colors truncate touch-target"
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Search</h3>
          <button
            type="button"
            className="text-[10px] text-[var(--accent-text)] hover:underline"
            onClick={closeSidebar}
          >
            Done
          </button>
        </div>
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
                  onClick={() => platform.isMobileOrNative && closeSidebar()}
                  className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3 hover:border-[var(--accent-text)] active:border-[var(--accent-text)] transition-colors"
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Settings</h3>
          <button
            type="button"
            className="text-[10px] text-[var(--accent-text)] hover:underline"
            onClick={closeSidebar}
          >
            Done
          </button>
        </div>
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
    );
  }

  const getNavButtonClass = (tabName: string) =>
    `flex h-9 w-9 items-center justify-center rounded-lg transition-colors outline-none ${
      activeTab === tabName
        ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
        : "text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
    }`;

  return (
    <main className={`flex h-screen overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)] ${platform.isNative ? 'capacitor' : ''}`}>
      {}
      <nav className="app-shell-nav-desktop w-[56px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-app)]">
        <div className="flex h-full flex-col items-center gap-3 py-3">
          {platform.isMobileOrNative && (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] outline-none"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              type="button"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
          <Link
            href="/documents"
            className={getNavButtonClass("vault")}
            onClick={() => handleTabChange("vault")}
            title="Vault"
          >
            <Files className="h-4 w-4" />
          </Link>
          <button
            className={getNavButtonClass("explorer")}
            onClick={() => handleTabChange("explorer")}
            title="Explorer"
            type="button"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
          <button
            className={getNavButtonClass("search")}
            onClick={() => handleTabChange("search")}
            title="Search"
            type="button"
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="mt-auto">
            <button
              className={getNavButtonClass("settings")}
              onClick={() => handleTabChange("settings")}
              title="Settings"
              type="button"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {}
      {(!platform.isMobileOrNative || sidebarOpen) && (
        <>
          {platform.isMobileOrNative && (
            <div className="sidebar-backdrop" onClick={closeSidebar} />
          )}
          <aside
            className={`app-shell-sidebar flex h-full w-[360px] min-w-[280px] max-w-[50%] shrink-0 resize-x flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-app)] ${
              platform.isMobileOrNative && !sidebarOpen ? 'app-shell-sidebar--hidden' : ''
            }`}
          >
            <div className="border-b border-[var(--border-subtle)] px-5 py-4 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {activeTab === "vault" ? title : activeTab}
              </p>
              {platform.isMobileOrNative && (
                <button
                  type="button"
                  onClick={closeSidebar}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col min-h-0">{activeSidebarContent}</div>
          </aside>
        </>
      )}

      {}
      <section className="app-shell-content flex h-full min-w-0 flex-1 flex-col bg-[var(--surface-viewer)]">
        <header className="flex h-[var(--viewer-toolbar-height)] items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-toolbar)] px-4 shrink-0">
          <div className="flex items-center gap-3 text-sm text-[var(--text-subtle)]">
            {!platform.isMobileOrNative && (
              <span className="rounded bg-black/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Workspace
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </section>

      {}
      <nav className="app-shell-nav-bottom fixed bottom-0 left-0 right-0 z-150 border-t border-[var(--border-subtle)] bg-[var(--surface-app)]">
        <div className="flex items-center h-full">
          <Link
            href="/documents"
            className={`bottom-nav-btn ${activeTab === "vault" ? "active" : ""}`}
            onClick={() => handleTabChange("vault")}
          >
            <Files />
            <span>Vault</span>
          </Link>
          <button
            type="button"
            className={`bottom-nav-btn ${activeTab === "explorer" ? "active" : ""}`}
            onClick={() => handleTabChange("explorer")}
          >
            <PanelLeftOpen />
            <span>Explore</span>
          </button>
          <button
            type="button"
            className={`bottom-nav-btn ${activeTab === "search" ? "active" : ""}`}
            onClick={() => handleTabChange("search")}
          >
            <Search />
            <span>Search</span>
          </button>
          <button
            type="button"
            className={`bottom-nav-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => handleTabChange("settings")}
          >
            <Settings2 />
            <span>Settings</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
