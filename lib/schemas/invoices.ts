import { z } from "zod";

export const SUPPLY_TYPES = [
  { value: "standard",     label: "Standard (15%)" },
  { value: "zero_rated",   label: "Zero-rated" },
  { value: "exempt",       label: "Exempt" },
  { value: "out_of_scope", label: "Out of scope" },
] as const;

export const SupplyTypeEnum = z.enum(["standard", "zero_rated", "exempt", "out_of_scope"]);

export const InvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unit_price: z.coerce.number().nonnegative(),
  position: z.coerce.number().int().nonnegative().default(0),
});

export const InvoiceSchema = z.object({
  org_id: z.string().uuid(),
  customer_id: z.coerce.number().int().positive(),
  transaction_date: z.string().min(1),
  invoice_number: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
  status: z.string().min(1).default("Pending"),
  due_date: z.string().optional(),
  // VAT (output side). vat_amount / amount_net are DB-generated columns — never sent from here.
  supply_type: SupplyTypeEnum.default("standard"),
  vat_shown_to_client: z.coerce.boolean().default(false),
  is_valid_tax_invoice: z.coerce.boolean().default(false),
});

// Edit / bulk-flag only the VAT attributes of an existing invoice.
export const InvoiceVatFlagsSchema = z.object({
  supply_type: SupplyTypeEnum.optional(),
  vat_shown_to_client: z.coerce.boolean().optional(),
  is_valid_tax_invoice: z.coerce.boolean().optional(),
});

export type InvoiceInput = z.infer<typeof InvoiceSchema>;
export type InvoiceLineInput = z.infer<typeof InvoiceLineSchema>;
