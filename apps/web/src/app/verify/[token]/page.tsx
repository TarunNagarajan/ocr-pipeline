"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldX } from "lucide-react";
import { api } from "@/lib/api";

interface VerificationPayload {
  presentation: {
    issuerName: string;
    issueDate: string;
    expiresAt: string;
    disclosedFields: Array<{ name: string; value: string; trust: string }>;
  };
  verification: {
    status: "VERIFIED" | "INVALID" | "EXPIRED" | "REVOKED";
    verified: boolean;
    reason: string;
    issuer: { keyId: string; name: string };
    checkedAt: string;
    proofType: string;
  };
}

export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const [payload, setPayload] = useState<VerificationPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<VerificationPayload>(`/api/shares/${params.token}`)
      .then(setPayload)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to verify share"))
      .finally(() => setLoading(false));
  }, [params.token]);

  const status = payload?.verification.status;
  const Icon = status === "VERIFIED" ? CheckCircle2 : status ? ShieldX : AlertTriangle;
  const statusClass = status === "VERIFIED" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800";

  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Public verification</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Credential proof report</h1>
        {loading ? <p className="mt-8 text-zinc-600">Verifying proof...</p> : null}
        {error ? <p className="mt-8 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {payload ? (
          <div className="mt-7">
            <div className={`flex items-center gap-3 rounded-lg px-4 py-4 ${statusClass}`}>
              <Icon className="h-6 w-6" />
              <div>
                <p className="font-semibold">{payload.verification.status}</p>
                <p className="text-sm">{payload.verification.reason}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 rounded-lg bg-zinc-50 p-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Issuer</dt>
                <dd className="font-medium text-zinc-950">{payload.verification.issuer.name}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Issue date</dt>
                <dd className="font-medium text-zinc-950">{payload.presentation.issueDate}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Proof type</dt>
                <dd className="font-medium text-zinc-950">{payload.verification.proofType}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Checked at</dt>
                <dd className="font-medium text-zinc-950">{new Date(payload.verification.checkedAt).toLocaleString()}</dd>
              </div>
            </dl>
            <h2 className="mt-7 text-xl font-semibold text-zinc-950">Disclosed fields</h2>
            <div className="mt-4 grid gap-3">
              {payload.presentation.disclosedFields.map((field) => (
                <div key={field.name} className="rounded-md border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-500">{field.name}</p>
                      <p className="mt-1 font-semibold text-zinc-950">{field.value}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{field.trust}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
