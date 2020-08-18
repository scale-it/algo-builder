import * as z from 'zod';

export const AddressSchema = z.string();

export const ASADefSchema = z.object({
  total: z.number(),
  decimals: z.number(),
  defaultFrozen: z.boolean().optional(),
  unitName: z.string().optional(),
  url: z.string().optional(),
  metadataHash: z.string().optional(),
  note: z.string().optional(),
  noteb64: z.string().optional(),
  manager: AddressSchema.optional(),
  reserve: AddressSchema.optional(),
  freeze: AddressSchema.optional(),
  clawback: AddressSchema.optional()
})
  .refine(o => ((o.decimals <= 19) && (o.decimals >= 0)), {
    message: "Decimals must be between 0(non divisible) and 19",
    path: ['decimals']
  })
  .refine(o => (!o.unitName || (o.unitName && (o.unitName.length <= 8))), {
    message: "Unit name must not be longer than 8 bytes",
    path: ['unitName']
  })
  .refine(o => (!o.url || (o.url && (o.url.length <= 32))), {
    message: "URL must not be longer than 32 bytes",
    path: ['url']
  })
  .refine(o => (!o.metadataHash || (o.metadataHash && (o.metadataHash.length <= 32))), {
    message: "Metadata Hash must not be longer than 32 bytes",
    path: ['metadataHash']
  });
export type ASADefType = z.infer<typeof ASADefSchema>;
