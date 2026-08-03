import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { getCachedOrgMeta } from "@/lib/supabase/cache";

export const metadata = { title: "VAT" };

type VatRow = {
  tax_period: string;
  gross_sales: number;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
};

export default async function VatPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data, error }, orgMeta] = await Promise.all([
    supabase
      .from("vat_summary_by_period")
      .select("tax_period, gross_sales, output_vat, input_vat, net_vat_payable")
      .eq("org_id", orgId)
      .order("tax_period", { ascending: true }),
    getCachedOrgMeta(orgId),
  ]);

  const rows = (data || []) as VatRow[];
  const currency = orgMeta?.currency || "ZAR";
  const fmt = (n: number) =>
    `${currency === "ZAR" ? "R " : ""}${Number(n).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const totalGross = rows.reduce((s, r) => s + Number(r.gross_sales), 0);
  const totalOutput = rows.reduce((s, r) => s + Number(r.output_vat), 0);
  const totalInput = rows.reduce((s, r) => s + Number(r.input_vat), 0);
  const totalNet = totalOutput - totalInput;

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">VAT</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
          Output vs input VAT and net payable per two-monthly tax period. VAT is gross &times; 15/115.
          Positive net = payable to SARS. Support figures only &mdash; not a filed return.
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ background: "var(--sidebar-hover)", color: "var(--muted2)" }}
        >
          Could not load the VAT summary. Has migration 0032 been applied? ({error.message})
        </div>
      )}

      <div
        className="rounded-lg p-3 mb-4 text-xs"
        style={{ background: "var(--sidebar-hover)", color: "var(--muted2)" }}
      >
        Input VAT counts only costs flagged as having a valid tax invoice <em>and</em> claimable.
        Confirm your SARS VAT category and filing history with the accountant.
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--sidebar-border)" }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ color: "var(--muted2)" }} className="text-left">
              <th className="px-3 py-2 font-semibold">Tax period</th>
              <th className="px-3 py-2 font-semibold text-right">Gross sales</th>
              <th className="px-3 py-2 font-semibold text-right">Output VAT</th>
              <th className="px-3 py-2 font-semibold text-right">Input VAT</th>
              <th className="px-3 py-2 font-semibold text-right">Net payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4" colSpan={5} style={{ color: "var(--muted2)" }}>
                  No VAT data yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.tax_period} className="border-t" style={{ borderColor: "var(--sidebar-border)" }}>
                <td className="px-3 py-2 font-medium">{r.tax_period}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(r.gross_sales))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(r.output_vat))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(r.input_vat))}</td>
                <td
                  className="px-3 py-2 text-right tabular-nums font-semibold"
                  style={{ color: Number(r.net_vat_payable) >= 0 ? "var(--fg)" : "var(--accent)" }}
                >
                  {fmt(Number(r.net_vat_payable))}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold" style={{ borderColor: "var(--sidebar-border)" }}>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalGross)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalOutput)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalInput)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalNet)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
