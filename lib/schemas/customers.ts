import { z } from "zod";

export const CustomerSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;
