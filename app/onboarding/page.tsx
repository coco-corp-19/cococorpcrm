import { createOrganization } from "@/server-actions/auth";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h1 className="text-xl font-semibold">Organization setup</h1>
        <form action={createOrganization} className="mt-4 space-y-3">
          <input
            name="name"
            required
            placeholder="Organization name"
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          />
          <select
            name="currency"
            defaultValue="ZAR"
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          >
            <option value="ZAR">ZAR</option>
            <option value="USD">USD</option>
          </select>
          <button className="w-full rounded-md bg-indigo-600 p-2 text-white">
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
