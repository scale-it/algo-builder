import * as z from 'zod';

export const HDAccountSchema = z.object({
  mnemonic: z.string(),
  initialIndex: z.number().optional(),
  count: z.number().optional(),
  path: z.string()
});
export type HDAccountType = z.infer<typeof HDAccountSchema>;

export const MnemonicAccountSchema = z.object({
  addr: z.string(),
  mnemonic: z.string()
});
export type MnemonicAccountType = z.infer<typeof MnemonicAccountSchema>;

export const Uint8ArraySchema = z.instanceof(Uint8Array);
// Must match `Account` from `algosdk` to create it later.
// This schema will match exact type so as all methods aren't serialized
// in the start type it's not possible to directly use Account type.
export const AlgoSDKAccountSchema = z.object({
  addr: z.string(),
  sk: Uint8ArraySchema
});
export type AlgoSDKAccountType = z.infer<typeof AlgoSDKAccountSchema>;

export const AccountDefSchema = z.union([
  AlgoSDKAccountSchema,
  MnemonicAccountSchema,
  HDAccountSchema
]);
export type AccountDefType = z.infer<typeof AccountDefSchema>;

export const ASADescriptionSchema = z.object({
  total: z.number(),
  decimals: z.number(),
  defaultFrozen: z.boolean().optional(),
  unitName: z.string().optional(),
  url: z.string().optional(),
  metadataHash: z.string().optional(),
  note: z.string().optional(),
  noteb64: z.string().optional(),
  manager: AccountDefSchema.optional(),
  reserve: AccountDefSchema.optional(),
  freeze: AccountDefSchema.optional(),
  clawback: AccountDefSchema.optional()
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
export type ASADescriptionType = z.infer<typeof ASADescriptionSchema>;
