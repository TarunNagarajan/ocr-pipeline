"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      router.push("/credentials/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <form action={submit} className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">Create holder account</h1>
        <label className="mt-6 block text-sm font-medium text-zinc-700">
          Email
          <input className="focus-ring mt-2 w-full rounded-md border border-zinc-300 px-3 py-3" name="email" type="email" required />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-700">
          Password
          <input className="focus-ring mt-2 w-full rounded-md border border-zinc-300 px-3 py-3" name="password" type="password" minLength={10} required />
        </label>
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button disabled={loading} className="focus-ring mt-6 w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Working..." : "Create account"}
        </button>
        <Link className="focus-ring mt-4 block rounded-md py-2 text-center text-sm font-medium text-emerald-800" href="/login">
          Sign in instead
        </Link>
      </form>
    </main>
  );
}
