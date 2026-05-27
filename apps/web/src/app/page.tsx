import Link from "next/link";
import { ShieldCheck, QrCode, LockKeyhole } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-800">Selective disclosure credential wallet</p>
          <h1 className="text-4xl font-semibold leading-tight text-zinc-950 md:text-6xl">Share proof, not private data.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700">
            Issue signed education credentials, disclose only selected fields, and let verifiers validate a BBS+ zero-knowledge proof without seeing CGPA, marks, or other hidden claims.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="focus-ring rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white" href="/register">
              Create holder account
            </Link>
            <Link className="focus-ring rounded-md border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900" href="/login">
              Sign in
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          {[
            [ShieldCheck, "BBS+ Proofs", "Multi-message signatures with selective disclosure proofs over BLS12-381."],
            [LockKeyhole, "Private By Design", "Full credentials stay encrypted at rest and hidden fields never reach verifiers."],
            [QrCode, "One-Tap Sharing", "Time-limited public links and QR codes for mobile-first verification."]
          ].map(([Icon, title, body]) => (
            <div key={String(title)} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <Icon className="mb-4 h-6 w-6 text-emerald-700" />
              <h2 className="font-semibold text-zinc-950">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{body as string}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
