"use client";

import Link from "next/link";

interface AuthFormProps {
  title: string;
  subtitle: string;
  submitText: string;
  loadingText: string;
  loading: boolean;
  error: string;
  action: (formData: FormData) => void | Promise<void>;
  alternateHref: string;
  alternateLabel: string;
}

export function AuthForm({
  title,
  subtitle,
  submitText,
  loadingText,
  loading,
  error,
  action,
  alternateHref,
  alternateLabel
}: AuthFormProps) {
  return (
    <main className="min-h-screen bg-[var(--surface-page)]">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="border-l border-[var(--border-strong)] pl-5">
          <p className="text-sm font-semibold tracking-[0.12em] text-[var(--text-muted)] uppercase">
            Credential Lens
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-[var(--text-primary)]">
            OCR-backed credential review without workflow clutter.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-subtle)]">
            Sign in to upload documents, monitor extraction status, and inspect evidence-linked results from one
            operational workspace.
          </p>
        </div>

        <form action={action} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-8">
          <p className="text-sm font-semibold tracking-[0.12em] text-[var(--text-muted)] uppercase">Account access</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-subtle)]">{subtitle}</p>

          <div className="mt-8 grid gap-4">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Work email
              <input
                className="focus-ring mt-2 h-12 w-full rounded-md border border-[var(--border-strong)] bg-white px-3"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Password
              <input
                className="focus-ring mt-2 h-12 w-full rounded-md border border-[var(--border-strong)] bg-white px-3"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={10}
                required
              />
            </label>
          </div>

          {error ? (
            <p className="mt-5 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">{error}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button
              disabled={loading}
              className="focus-ring rounded-md bg-[var(--accent-strong)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? loadingText : submitText}
            </button>
            <Link
              className="focus-ring rounded-md px-2 py-2 text-sm font-medium text-[var(--accent-text)]"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
