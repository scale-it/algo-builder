import * as z from "zod";

export const AddressSchema = z.string();

// https://developer.algorand.org/docs/reference/rest-apis/algod/
const totalRegex = /^\d+$/;

export const ASADefSchema = z.object({
	name: z.string().optional(), // req. for runtime (in checkpoint we store name as the key)
	total: z
		.union([z.number(), z.bigint(), z.string()]) // 'string' to support bigint from yaml file
		.refine(
			(t) => totalRegex.test(String(t)) && BigInt(t) <= 0xffffffffffffffffn && BigInt(t) >= 0n,
			{ message: "Total must be a positive number <= 2^64-1" }
		),
	decimals: z
		.union([z.number(), z.bigint()])
		.refine((decimals) => decimals <= 19 && decimals >= 0, {
			message: "Decimals must be between 0 (non divisible) and 19",
		}),
	defaultFrozen: z.boolean().optional(),
	unitName: z
		.string()
		.optional()
		.refine((unitName) => !unitName || unitName.length <= 8, {
			message: "Unit name must not be longer than 8 bytes",
		}),
	url: z
		.string()
		.optional()
		.refine((url) => !url || url.length <= 96, {
			message: "URL must not be longer than 96 bytes",
		}),
	metadataHash: z
		.string()
		.or(z.instanceof(Buffer))
		.or(z.instanceof(Uint8Array))
		.optional()
		.refine(
			(m) =>
				!m ||
				(typeof m === "string" && Buffer.from(m).byteLength === 32) ||
				(m instanceof Uint8Array && m.length === 32),
			{ message: "Metadata Hash must be a 32 byte Uint8Array or 32 byte string" }
		),
	note: z.string().optional(),
	noteb64: z.string().optional(),
	manager: AddressSchema.optional(),
	reserve: AddressSchema.optional(),
	freeze: AddressSchema.optional(),
	clawback: AddressSchema.optional(),
	optInAccNames: z.array(z.string()).optional(),
});

export const ASADefsSchema = z.record(ASADefSchema);
