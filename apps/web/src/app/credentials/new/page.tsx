"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const fields = [
  ["name", "Holder name", "Asha Rao"],
  ["degree", "Degree", "B.Tech Computer Science"],
  ["graduationYear", "Graduation year", "2026"],
  ["cgpa", "CGPA", "8.9"],
  ["marks", "Marks", "891/1000"],
  ["issuerName", "Issuer name", "Open Campus University"],
  ["issueDate", "Issue date", "2026-05-01"]
];

export default function NewCredentialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/credentials/issue", {
        method: "POST",
        body: JSON.stringify({
          claims: Object.fromEntries(fields.map(([name]) => [name, formData.get(name)]))
        })
      });
      router.push("/credentials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to issue credential");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <form action={submit} className="mx-auto max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Issue credential</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Create signed credential</h1>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {fields.map(([name, label, placeholder]) => (
            <label key={name} className="block text-sm font-medium text-zinc-700">
              {label}
              <input className="focus-ring mt-2 w-full rounded-md border border-zinc-300 px-3 py-3" name={name} placeholder={placeholder} required />
            </label>
          ))}
        </div>
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button disabled={loading} className="focus-ring mt-6 rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Signing..." : "Issue signed credential"}
        </button>
      </form>
    </main>
  );
}
