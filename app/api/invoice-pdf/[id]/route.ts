import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type Params = { id: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: invoice, error } = await supabase
    .from("fact_invoices")
    .select("id, invoice_number, amount, transaction_date")
    .eq("id", Number(id))
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Placeholder endpoint for @react-pdf/renderer implementation in the next slice.
  return NextResponse.json({
    message: "Invoice PDF generation scaffold ready",
    invoice,
  });
}
