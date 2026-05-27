"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Share2 } from "lucide-react";
import { api } from "@/lib/api";

interface CredentialListItem {
  id: string;
  issuerName: string;
  issueDate: string;
  degree: string;
  graduationYear: string;
  status: "ACTIVE" | "REVOKED";
  availableFields: string[];
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ credentials: CredentialListItem[] }>("/api/credentials")
      .then((payload) => setCredentials(payload.credentials))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load credentials"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Holder dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">My credentials</h1>
          </div>
          <Link className="focus-ring inline-flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white" href="/credentials/new">
            <Plus className="h-4 w-4" />
            Issue credential
          </Link>
        </div>
        {loading ? <p className="mt-8 text-zinc-600">Loading credentials...</p> : null}
        {error ? <p className="mt-8 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {!loading && !error && credentials.length === 0 ? (
          <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-950">No credentials yet</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Issue a signed credential first, then generate a selective disclosure share link.</p>
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {credentials.map((credential) => (
            <article key={credential.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">{credential.degree}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{credential.issuerName}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{credential.status}</span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Graduation year</dt>
                  <dd className="font-medium text-zinc-900">{credential.graduationYear}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Issue date</dt>
                  <dd className="font-medium text-zinc-900">{credential.issueDate}</dd>
                </div>
              </dl>
              <Link className="focus-ring mt-5 inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900" href={`/credentials/${credential.id}/share`}>
                <Share2 className="h-4 w-4" />
                Share selectively
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

