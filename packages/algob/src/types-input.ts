import * as z from 'zod';

export const AddressSchema = z.string();

// https://developer.algorand.org/docs/reference/rest-apis/algod/
const metadataRegex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==\|[A-Za-z0-9+/]{3}=)?$/;

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
  })
  .refine(o => (!o.metadataHash || (o.metadataHash && (metadataRegex.test(o.metadataHash)))), {
    message: "metadataHash doesn't match regex from " +
      "https://developer.algorand.org/docs/reference/rest-apis/algod/",
    path: ['metadataHash']
  });

export const ASADefsSchema = z.record(ASADefSchema);
