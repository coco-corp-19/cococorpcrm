export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Password reset flow will be wired to Resend and Supabase email auth.
        </p>
      </div>
    </main>
  );
}
