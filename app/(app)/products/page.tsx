import { createServerClient } from "@/lib/supabase/server";
import { ProductsClient } from "@/components/ProductsClient";

export default async function ProductsPage() {
  const supabase = await createServerClient();
  const [{ data: products }, { data: org }] = await Promise.all([
    supabase.from("dim_products").select("id, name, sku, description, unit_price, category, is_active, created_at")
      .is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").single(),
  ]);

  const currency = org?.currency || "ZAR";

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-6">Products &amp; Services</h1>
      <ProductsClient products={products || []} currency={currency} />
    </section>
  );
}
