import { z } from "zod";

export const LeadSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  lead_date: z.string().optional().nullable(),
  status_id: z.coerce.number().optional().nullable(),
  last_follow_up: z.string().optional().nullable(),
  opportunity_value: z.coerce.number().default(0),
  weight: z.coerce.number().min(0).max(100).default(0),
  total_revenue: z.coerce.number().optional().nullable(),
  secured_revenue: z.coerce.number().optional().nullable(),
  contacted: z.boolean().default(false),
  responded: z.boolean().default(false),
  developed: z.boolean().default(false),
  paid: z.boolean().default(false),
});

export type LeadInput = z.infer<typeof LeadSchema>;
