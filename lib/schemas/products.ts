import { z } from "zod";

export const ProductSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  unit_price: z.coerce.number().nonnegative(),
  category: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof ProductSchema>;
