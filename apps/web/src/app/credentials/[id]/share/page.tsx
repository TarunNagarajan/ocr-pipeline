"use client";

import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import { api } from "@/lib/api";

const fieldOptions = [
  ["name", "Holder name"],
  ["degree", "Degree"],
  ["graduationYear", "Graduation year"],
  ["cgpa", "CGPA"],
  ["marks", "Marks"]
];

export default function ShareCredentialPage() {
  const params = useParams<{ id: string }>();
  const [selected, setSelected] = useState<string[]>(["name", "degree", "graduationYear"]);
  const [ttlHours, setTtlHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ publicLink: string; expiresAt: string } | null>(null);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!result) {
      return;
    }
    QRCode.toDataURL(result.publicLink, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(""));
  }, [result]);

  function toggle(name: string) {
    setSelected((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  async function createShare() {
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ publicLink: string; expiresAt: string }>("/api/credentials/share", {
        method: "POST",
        body: JSON.stringify({
          credentialId: params.id,
          fields: selected,
          ttlHours
        })
      });
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create share link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Selective disclosure</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Choose fields to reveal</h1>
          <div className="mt-7 grid gap-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              Issuer name, issuer key, and issue date are always included as mandatory verification metadata.
            </div>
            {fieldOptions.map(([name, label]) => (
              <label key={name} className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 p-4">
                <span className="font-medium text-zinc-900">{label}</span>
                <input className="h-5 w-5 accent-emerald-700" checked={selected.includes(name)} onChange={() => toggle(name)} type="checkbox" />
              </label>
            ))}
          </div>
          <label className="mt-5 block text-sm font-medium text-zinc-700">
            Link expiry
            <select className="focus-ring mt-2 w-full rounded-md border border-zinc-300 px-3 py-3" value={ttlHours} onChange={(event) => setTtlHours(Number(event.target.value))}>
              <option value={1}>1 hour</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </label>
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button disabled={loading || selected.length === 0} onClick={createShare} className="focus-ring mt-6 rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Creating proof..." : "Generate secure link"}
          </button>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <QrCode className="h-7 w-7 text-emerald-700" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-950">Share package</h2>
          {result ? (
            <div className="mt-5">
              {qr ? <img className="rounded-md border border-zinc-200" src={qr} alt="QR code for verification link" /> : null}
              <p className="mt-4 break-all rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">{result.publicLink}</p>
              <button className="focus-ring mt-3 inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900" onClick={() => navigator.clipboard.writeText(result.publicLink)}>
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <p className="mt-4 text-sm text-zinc-600">Expires at {new Date(result.expiresAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-zinc-600">A verifier will see only the selected fields plus cryptographic trust indicators.</p>
          )}
        </div>
      </section>
    </main>
  );
}
