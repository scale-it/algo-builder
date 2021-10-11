import * as z from 'zod';

export const AddressSchema = z.string();

// https://developer.algorand.org/docs/reference/rest-apis/algod/
const totalRegex = /^\d+$/;

export const ASADefSchema = z.object({
  total: z.union([z.number(), z.bigint(), z.string()]), // 'string' to support bigint from yaml file
  decimals: z.union([z.number(), z.bigint()]),
  defaultFrozen: z.boolean().optional(),
  unitName: z.string().optional(),
  url: z.string().optional(),
  metadataHash: z.any().optional(),
  note: z.string().optional(),
  noteb64: z.string().optional(),
  manager: AddressSchema.optional(),
  reserve: AddressSchema.optional(),
  freeze: AddressSchema.optional(),
  clawback: AddressSchema.optional(),
  optInAccNames: z.array(z.string()).optional()
})
  .refine(o => (totalRegex.test(String(o.total)) &&
  BigInt(o.total) <= 0xFFFFFFFFFFFFFFFFn && BigInt(o.total) > 0n), {
    message: "Total must be a positive number and smaller than 2^64-1 ",
    path: ['total']
  })
  .refine(o => ((o.decimals <= 19) && (o.decimals >= 0)), {
    message: "Decimals must be between 0(non divisible) and 19",
    path: ['decimals']
  })
  .refine(o => (!o.unitName || o.unitName.length <= 8), {
    message: "Unit name must not be longer than 8 bytes",
    path: ['unitName']
  })
  // https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
  .refine(o => (!o.url || o.url.length <= 96), {
    message: "URL must not be longer than 96 bytes",
    path: ['url']
  })
  .refine(o => (!o.metadataHash ||
    (typeof o.metadataHash === "string" && Buffer.from(o.metadataHash).byteLength === 32) ||
    (o.metadataHash.constructor === Uint8Array && o.metadataHash.length === 32)), {
    message: "Metadata Hash must be a 32 byte Uint8Array or 32 byte string",
    path: ['metadataHash']
  });

export const ASADefsSchema = z.record(ASADefSchema);
