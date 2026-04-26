import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { setActiveOrganization, signout } from "@/server-actions/auth";
import { SideNav, BotNav } from "@/components/SideNav";
import { FAB } from "@/components/FAB";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const activeOrgId = String(user.user_metadata?.active_org_id ?? memberships?.[0]?.org_id ?? "");

  const [{ data: accounts }, { data: customers }, { data: payTypes }, { data: statuses }, { data: costCats }] = await Promise.all([
    supabase.from("dim_accounts").select("id, name").order("name"),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("dim_payment_types").select("id, name").order("name"),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("dim_cost_categories").select("id, name").order("name"),
  ]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)" }}>
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r shrink-0"
        style={{ background: "var(--card)", borderColor: "var(--border)", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h1 className="text-lg font-bold tracking-widest">
            <span style={{ color: "var(--pink)" }}>COCO</span>
            <span className="text-white">CORP</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>CRM Engine v2</p>
        </div>
        <SideNav />
        <div className="p-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs truncate" style={{ color: "var(--muted2)" }}>{user.email}</p>
          <form action={setActiveOrganization}>
            <select name="org_id" defaultValue={activeOrgId}
              className="w-full text-xs rounded px-2 py-1.5 border"
              style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
              {memberships?.map(m => (
                <option key={m.org_id} value={m.org_id}>
                  {(m.organizations as { name: string }[])?.[0]?.name ?? m.org_id}
                </option>
              ))}
            </select>
          </form>
          <form action={signout}>
            <button className="w-full text-xs rounded px-2 py-1.5 border text-left transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-3 border-b"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h1 className="text-base font-bold tracking-widest">
            <span style={{ color: "var(--pink)" }}>COCO</span>
            <span className="text-white">CORP</span>
          </h1>
          <div className="flex items-center gap-2">
            <form action={setActiveOrganization}>
              <select name="org_id" defaultValue={activeOrgId}
                className="text-xs rounded px-2 py-1 border"
                style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
                {memberships?.map(m => (
                  <option key={m.org_id} value={m.org_id}>
                    {(m.organizations as { name: string }[])?.[0]?.name ?? m.org_id}
                  </option>
                ))}
              </select>
            </form>
            <form action={signout}>
              <button className="text-xs rounded border px-2 py-1" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                Out
              </button>
            </form>
          </div>
        </header>

        <ToastProvider>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>

        <FAB
          accounts={accounts || []}
          customers={customers || []}
          paymentTypes={payTypes || []}
          statuses={statuses || []}
          costCategories={costCats || []}
        />

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <BotNav />
        </nav>
        </ToastProvider>
      </div>
    </div>
  );
}
