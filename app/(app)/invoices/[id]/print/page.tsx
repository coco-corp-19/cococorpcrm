import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

type Params = { id: string };

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const invoiceId = Number(id);
  const supabase = await createServerClient();

  const { data: invoice } = await supabase
    .from("fact_invoices")
    .select("*, dim_customers(name)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black">
      <h1 className="text-3xl font-bold">Invoice #{invoice.invoice_number}</h1>
      <p className="mt-2">Customer: {invoice.dim_customers?.name ?? "-"}</p>
      <p>Date: {invoice.transaction_date}</p>
      <p>Due: {invoice.due_date || "-"}</p>
      <p className="mt-6 text-xl font-semibold">Total: R{Number(invoice.amount).toFixed(2)}</p>
    </main>
  );
}
