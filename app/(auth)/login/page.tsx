import Link from "next/link";
import { login } from "@/server-actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h1 className="text-xl font-semibold">Login</h1>
        {error && (
          <div className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,.12)", border: "1px solid var(--red-c)", color: "var(--red-c)" }}>
            {error}
          </div>
        )}
        <form action={login} className="mt-4 space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          />
          <button className="w-full rounded-md bg-indigo-600 p-2 text-white">
            Sign in
          </button>
        </form>
        <p className="mt-3 text-sm text-[var(--muted)]">
          No account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </main>
  );
}
