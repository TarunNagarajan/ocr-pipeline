"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      router.push("/credentials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return <AuthForm title="Sign in" submitText="Sign in" loading={loading} error={error} action={submit} alternateHref="/register" alternateText="Create an account" />;
}

function AuthForm(props: {
  title: string;
  submitText: string;
  loading: boolean;
  error: string;
  action: (formData: FormData) => void;
  alternateHref: string;
  alternateText: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <form action={props.action} className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">{props.title}</h1>
        <label className="mt-6 block text-sm font-medium text-zinc-700">
          Email
          <input className="focus-ring mt-2 w-full rounded-md border border-zinc-300 px-3 py-3" name="email" type="email" required />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-700">
          Password
          <input className="focus-ring mt-2 w-full rounded-md border border-zinc-300 px-3 py-3" name="password" type="password" minLength={10} required />
        </label>
        {props.error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{props.error}</p> : null}
        <button disabled={props.loading} className="focus-ring mt-6 w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {props.loading ? "Working..." : props.submitText}
        </button>
        <Link className="focus-ring mt-4 block rounded-md py-2 text-center text-sm font-medium text-emerald-800" href={props.alternateHref}>
          {props.alternateText}
        </Link>
      </form>
    </main>
  );
}

