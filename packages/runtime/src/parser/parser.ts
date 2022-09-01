import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Interpreter } from "../interpreter/interpreter";
import { Op } from "../interpreter/opcode";
import {
	AcctParamsGet,
	Add,
	Addr,
	Addw,
	And,
	AppGlobalDel,
	AppGlobalGet,
	AppGlobalGetEx,
	AppGlobalPut,
	AppLocalDel,
	AppLocalGet,
	AppLocalGetEx,
	AppLocalPut,
	AppOptedIn,
	AppParamsGet,
	Arg,
	Args,
	Assert,
	Balance,
	Base64Decode,
	BitLen,
	BitwiseAnd,
	BitwiseNot,
	BitwiseOr,
	BitwiseXor,
	Branch,
	BranchIfNotZero,
	BranchIfNotZerov4,
	BranchIfZero,
	BranchIfZerov4,
	Branchv4,
	Bsqrt,
	Btoi,
	Byte,
	ByteAdd,
	ByteBitwiseAnd,
	ByteBitwiseInvert,
	ByteBitwiseOr,
	ByteBitwiseXor,
	Bytec,
	Bytecblock,
	ByteDiv,
	ByteEqualTo,
	ByteGreaterThan,
	ByteGreaterThanEqualTo,
	ByteLessThan,
	ByteLessThanEqualTo,
	ByteMod,
	ByteMul,
	ByteNotEqualTo,
	ByteSub,
	ByteZero,
	Callsub,
	Concat,
	Cover,
	Dig,
	Div,
	DivModw,
	Divw,
	Dup,
	Dup2,
	EcdsaPkDecompress,
	EcdsaPkRecover,
	EcdsaVerify,
	Ed25519verify,
	EqualTo,
	Err,
	Exp,
	Expw,
	Extract,
	Extract3,
	ExtractUint16,
	ExtractUint32,
	ExtractUint64,
	Gaid,
	Gaids,
	GetAssetDef,
	GetAssetHolding,
	GetBit,
	GetByte,
	Gitxn,
	Gitxna,
	Gitxnas,
	Gload,
	Gloads,
	Gloadss,
	Global,
	GreaterThan,
	GreaterThanEqualTo,
	Gtxn,
	Gtxna,
	Gtxnas,
	Gtxns,
	Gtxnsa,
	Gtxnsas,
	Int,
	Intc,
	Intcblock,
	Itob,
	ITxn,
	ITxna,
	ITxnas,
	ITxnBegin,
	ITxnField,
	ITxnNext,
	ITxnSubmit,
	Keccak256,
	Label,
	Len,
	LessThan,
	LessThanEqualTo,
	Load,
	Loads,
	Log,
	MinBalance,
	Mod,
	Mul,
	Mulw,
	Not,
	NotEqualTo,
	Or,
	Pop,
	Pragma,
	PushBytes,
	PushInt,
	Replace2,
	Replace3,
	Retsub,
	Return,
	Select,
	SetBit,
	SetByte,
	Sha256,
	Sha3_256,
	Sha512_256,
	Shl,
	Shr,
	Sqrt,
	Store,
	Stores,
	Sub,
	Substring,
	Substring3,
	Swap,
	Txn,
	Txna,
	Txnas,
	Uncover,
} from "../interpreter/opcode-list";
import {
	LOGIC_SIG_MAX_COST,
	LogicSigMaxSize,
	MAX_APP_PROGRAM_COST,
	MaxAppProgramLen,
	OpGasCost,
} from "../lib/constants";
import { assertLen } from "../lib/parsing";
import { ExecutionMode } from "../types";

// teal v1 opcodes
const opCodeMap: { [key: number]: { [key: string]: any } } = {
	// tealVersion => opcodeMap
	1: {
		// Pragma
		"#pragma": Pragma,

		len: Len,
		err: Err,

		// Arithmetic ops
		"+": Add,
		"-": Sub,
		"/": Div,
		"*": Mul,

		arg: Arg,
		bytecblock: Bytecblock,
		bytec: Bytec,
		intcblock: Intcblock,
		intc: Intc,

		"%": Mod,
		"|": BitwiseOr,
		"&": BitwiseAnd,
		"^": BitwiseXor,
		"~": BitwiseNot,

		store: Store,
		load: Load,

		// crypto opcodes
		sha256: Sha256,
		sha512_256: Sha512_256,
		keccak256: Keccak256,
		ed25519verify: Ed25519verify,

		"<": LessThan,
		">": GreaterThan,
		"<=": LessThanEqualTo,
		">=": GreaterThanEqualTo,
		"&&": And,
		"||": Or,
		"==": EqualTo,
		"!=": NotEqualTo,
		"!": Not,

		itob: Itob,
		btoi: Btoi,
		mulw: Mulw,
		pop: Pop,
		dup: Dup,

		// Pseudo-Ops
		addr: Addr,
		int: Int,
		byte: Byte,

		// Branch Opcodes
		bnz: BranchIfNotZero,

		// Transaction Opcodes
		txn: Txn,
		gtxn: Gtxn,
		global: Global,
	},
};

// teal v2 opcodes
opCodeMap[2] = {
	...opCodeMap[1], // includes all v1 opcodes

	addw: Addw,

	// txn ops
	txna: Txna,
	gtxna: Gtxna,

	// branch opcodes in v2
	b: Branch,
	bz: BranchIfZero,
	return: Return,

	dup2: Dup2,
	concat: Concat,
	substring: Substring,
	substring3: Substring3,

	// Stateful Opcodes
	app_opted_in: AppOptedIn,
	app_local_get: AppLocalGet,
	app_local_get_ex: AppLocalGetEx,
	app_global_get: AppGlobalGet,
	app_global_get_ex: AppGlobalGetEx,
	app_local_put: AppLocalPut,
	app_global_put: AppGlobalPut,
	app_local_del: AppLocalDel,
	app_global_del: AppGlobalDel,

	balance: Balance,
	asset_holding_get: GetAssetHolding,
	asset_params_get: GetAssetDef,
};

/**
 * TEALv3 opcodes: https://developer.algorand.org/articles/introducing-teal-version-3/
 */
opCodeMap[3] = {
	...opCodeMap[2],

	assert: Assert,
	swap: Swap,

	// optimized opcodes for pushing uint64s and byte slices to the stack
	pushint: PushInt,
	pushbytes: PushBytes,

	// bit & byte opcodes
	getbit: GetBit,
	setbit: SetBit,
	getbyte: GetByte,
	setbyte: SetByte,

	dig: Dig,
	select: Select,

	// txn ops in tealv3
	gtxns: Gtxns,
	gtxnsa: Gtxnsa,

	// stateful op (mode = application)
	min_balance: MinBalance,
};

/**
 * TEALv4 opcodes: https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
 */
opCodeMap[4] = {
	...opCodeMap[3],

	gload: Gload,
	gloads: Gloads,

	callsub: Callsub,
	retsub: Retsub,

	b: Branchv4,
	bnz: BranchIfNotZerov4,
	bz: BranchIfZerov4,
	// byteslice arithmetic ops
	"b+": ByteAdd,
	"b-": ByteSub,
	"b*": ByteMul,
	"b/": ByteDiv,
	"b%": ByteMod,
	"b<": ByteLessThan,
	"b>": ByteGreaterThan,
	"b<=": ByteLessThanEqualTo,
	"b>=": ByteGreaterThanEqualTo,
	"b==": ByteEqualTo,
	"b!=": ByteNotEqualTo,
	"b|": ByteBitwiseOr,
	"b&": ByteBitwiseAnd,
	"b^": ByteBitwiseXor,
	"b~": ByteBitwiseInvert,
	bzero: ByteZero,

	divmodw: DivModw,
	exp: Exp,
	expw: Expw,
	shl: Shl,
	shr: Shr,
	sqrt: Sqrt,
	bitlen: BitLen,
	// Knowable creatable asset
	gaid: Gaid,
	gaids: Gaids,
};

/**
 * TEALv5 opcodes
 */
opCodeMap[5] = {
	...opCodeMap[4],

	cover: Cover,
	uncover: Uncover,

	loads: Loads,
	stores: Stores,
	// ECDSA
	ecdsa_verify: EcdsaVerify,
	ecdsa_pk_decompress: EcdsaPkDecompress,
	ecdsa_pk_recover: EcdsaPkRecover,

	// Extract opcodes
	extract: Extract,
	extract3: Extract3,
	extract_uint16: ExtractUint16,
	extract_uint32: ExtractUint32,
	extract_uint64: ExtractUint64,

	// Inner Transaction Ops
	itxn_begin: ITxnBegin,
	itxn_field: ITxnField,
	itxn_submit: ITxnSubmit,
	itxn: ITxn,
	itxna: ITxna,

	// gtxn, other ops
	txnas: Txnas,
	gtxnas: Gtxnas,
	gtxnsas: Gtxnsas,
	args: Args,
	log: Log,
	app_params_get: AppParamsGet,
};

opCodeMap[6] = {
	...opCodeMap[5],
	divw: Divw,
	bsqrt: Bsqrt,
	gloadss: Gloadss,
	acct_params_get: AcctParamsGet,
	itxn_next: ITxnNext,
	gitxn: Gitxn,
	gitxna: Gitxna,
	gitxnas: Gitxnas,
	itxnas: ITxnas,
};

/**
 * TEALv7
 */
opCodeMap[7] = {
	...opCodeMap[6],
	base64_decode: Base64Decode,
	replace2: Replace2,
	replace3: Replace3,
	sha3_256: Sha3_256,
};

// list of opcodes with exactly one parameter.
const interpreterReqList = new Set([
	"#pragma",
	"arg",
	"bytecblock",
	"bytec",
	"intcblock",
	"intc",
	"store",
	"load",
	"b",
	"bz",
	"bnz",
	"return",
	"txn",
	"gtxn",
	"txna",
	"gtxna",
	"global",
	"balance",
	"asset_holding_get",
	"asset_params_get",
	"app_opted_in",
	"app_local_get",
	"app_local_get_ex",
	"app_global_get",
	"app_global_get_ex",
	"app_local_put",
	"app_global_put",
	"app_local_del",
	"app_global_del",
	"gtxns",
	"gtxnsa",
	"min_balance",
	"gload",
	"gloads",
	"callsub",
	"retsub",
	"gaid",
	"gaids",
	"loads",
	"stores",
	"itxn_begin",
	"itxn_field",
	"itxn_submit",
	"itxn",
	"itxna",
	"txnas",
	"gtxnas",
	"gtxnsas",
	"args",
	"log",
	"app_params_get",
	"gloadss",
	"acct_params_get",
	"itxn_next",
	"gitxn",
	"gitxna",
	"gitxnas",
	"itxnas",
	"sha256",
	"sha512_256",
	"keccak256",
	"sha3_256",
]);

const signatureModeOps = new Set(["arg", "args", "arg_0", "arg_1", "arg_2", "arg_3"]);

const applicationModeOps = new Set([
	"gload",
	"gloads",
	"gaid",
	"gaids",
	"balance",
	"app_opted_in",
	"app_local_get",
	"app_local_get_ex",
	"app_global_get",
	"app_global_get_ex",
	"app_local_put",
	"app_global_put",
	"app_local_del",
	"app_global_del",
	"asset_holding_get",
	"asset_params_get",
	"app_params_get",
	"min_balance",
	"log",
	"itxn_begin",
	"itxn_field",
	"itxn_submit",
	"itxn",
	"itxna",
	"gloadss",
	"acct_params_get",
	"itxn_next",
	"gitxn",
	"gitxna",
	"gitxnas",
	"itxnas",
]);

// TODO: Check where we can use `commonModeOps`
// opcodes allowed in both application and signature mode
const commonModeOps = new Set([
	"err",
	"sha256",
	"keccak256",
	"sha3_256",
	"sha512_256",
	"ed25519verify",
	"ecdsa_verify",
	"ecdsa_pk_decompress",
	"+",
	"-",
	"/",
	"*",
	"<",
	">",
	"<=",
	">=",
	"&&",
	"||",
	"==",
	"!=",
	"!",
	"len",
	"itob",
	"btoi",
	"%",
	"|",
	"&",
	"^",
	"~",
	"mulw",
	"addw",
	"divmodw",
	"intcblock",
	"intc",
	"intc_0",
	"intc_1",
	"intc_2",
	"intc_3",
	"intc_0",
	"bytecblock",
	"bytec",
	"bytec_0",
	"bytec_1",
	"bytec_2",
	"bytec_3",
	"txn",
	"global",
	"gtxn",
	"load",
	"store",
	"txna",
	"gtxna",
	"gtxns",
	"gtxnsa",
	"stores",
	"bnz",
	"bz",
	"b",
	"return",
	"assert",
	"pop",
	"dup",
	"dup2",
	"dig",
	"swap",
	"select",
	"cover",
	"uncover",
	"concat",
	"substring",
	"substring3",
	"getbit",
	"setbit",
	"getbyte",
	"setbyte",
	"extract",
	"extract3",
	"extract_uint16",
	"extract_uint32",
	"extract_uint64",
	"pushbytes",
	"pushint",
	"callsub",
	"retsub",
	"shl",
	"shr",
	"sqrt",
	"bitlen",
	"exp",
	"expw",
	"b+",
	"b-",
	"b*",
	"b/",
	"b%",
	"b<",
	"b>",
	"b<=",
	"b>=",
	"b==",
	"b!=",
	"b|",
	"b&",
	"b^",
	"b~",
	"bzero",
	"txnas",
	"gtxnas",
	"gtxnsas",
	"divw",
	"bsqrt",
	"gloadss",
]);

/**
 * Description: Read line and split it into words
 * - ignore comments, keep only part that is relevant to interpreter
 * @param line : Line read from TEAL file
 */
/* eslint-disable sonarjs/cognitive-complexity */
export function wordsFromLine(line: string): string[] {
	// Trim whitespace from both sides of a string
	line = line.trim();
	const words = [] as string[];
	let i = 0;
	let start = i;
	let inString = false;
	let inBase64 = false;
	while (i < line.length) {
		// check if not space
		if (line[i] !== " ") {
			switch (line[i]) {
				// check for string literal
				case '"':
					if (!inString) {
						if (i === 0 || (i > 0 && line[i - 1] === " ")) {
							inString = true;
						}
					} else {
						// if not escape symbol
						if (line[i - 1] !== "\\") {
							inString = false;
						}
					}
					break;
				// is a comment?
				case "/":
					if (i < line.length - 1 && line[i + 1] === "/" && !inBase64 && !inString) {
						// if a comment without whitespace
						if (start !== i) {
							words.push(line.substr(start, i - start));
						}
						return words;
					}
					break;
				// is base64( seq?
				case "(": {
					const prefix = line.substr(start, i - start);
					if (prefix === "base64" || prefix === "b64") {
						inBase64 = true;
					}
					break;
				}
				// is ) as base64( completion
				case ")":
					if (inBase64) {
						inBase64 = false;
					}
					break;
				default:
					break;
			}
			i++;
			continue;
		}
		if (!inString) {
			const value = line.substr(start, i - start);
			words.push(value);
			if (value === "base64" || value === "b64") {
				inBase64 = true;
			} else if (inBase64) {
				inBase64 = false;
			}
		}
		i++;

		if (!inString) {
			while (i < line.length && line[i] === " ") {
				i++;
			}
			start = i;
		}
	}

	// add rest of the string if any
	if (start < line.length) {
		words.push(line.substr(start, i - start));
	}

	return words;
}

/**
 * Description: Returns Opcode object for given field
 * NOTE: we are also calculating the gas cost associated with each opcode,
 * and throwing error if the total gas of TEAL code exceeds the max gas cost for
 * respective execution modes
 * @param words : words extracted from line
 * @param counter: line number in TEAL file
 * @param interpreter: interpreter object
 */
export function opcodeFromSentence(
	words: string[],
	counter: number,
	interpreter: Interpreter,
	mode: ExecutionMode
): Op {
	let opCode = words[0];
	const tealVersion = interpreter.tealVersion;

	// arg
	if (opCode.startsWith("arg_")) {
		assertLen(words.length, 1, counter);
		words = [];
		words.push("arg_");
		words.push(opCode.slice(4));
		opCode = "arg";
	}
	// intc
	if (opCode.startsWith("intc_")) {
		assertLen(words.length, 1, counter);
		words = [];
		words.push("intc_");
		words.push(opCode.slice(5));
		opCode = "intc";
	}
	// bytec
	if (opCode.startsWith("bytec_")) {
		assertLen(words.length, 1, counter);
		words = [];
		words.push("bytec_");
		words.push(opCode.slice(6));
		opCode = "bytec";
	}

	words.shift();

	// Handle Label
	if (opCode.endsWith(":")) {
		assertLen(words.length, 0, counter);
		if (opCodeMap[tealVersion][opCode.slice(0, opCode.length - 1)] !== undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_LABEL, { line: counter }); // eg. `int:` is invalid label as `int` is an opcode
		}
		interpreter.lineToCost[counter] = 0;
		return new Label([opCode], counter);
	}

	if (opCodeMap[tealVersion][opCode] === undefined) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_OPCODE, {
			opcode: opCode,
			version: tealVersion,
			line: counter,
		});
	}

	if (mode === ExecutionMode.APPLICATION && signatureModeOps.has(opCode)) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.EXECUTION_MODE_NOT_VALID, {
			opcode: opCode,
			allowedIn: "signature",
			ranIn: "application",
			tealV: tealVersion,
			line: counter,
		});
	}

	if (mode === ExecutionMode.SIGNATURE && applicationModeOps.has(opCode)) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.EXECUTION_MODE_NOT_VALID, {
			opcode: opCode,
			allowedIn: "application",
			ranIn: "signature",
			tealV: tealVersion,
			line: counter,
		});
	}

	// store cost for opcodes at each line in `interpreter.lineToCost`
	if (opCode === "#pragma") {
		interpreter.lineToCost[counter] = 0;
	} else {
		interpreter.lineToCost[counter] = OpGasCost[tealVersion][opCode] ?? 1;
	}
	interpreter.gas += interpreter.lineToCost[counter]; // total "static" cost

	if (interpreterReqList.has(opCode)) {
		return new opCodeMap[tealVersion][opCode](words, counter, interpreter);
	}
	return new opCodeMap[tealVersion][opCode](words, counter);
}

/**
 * verify max cost of TEAL code is within consensus parameters
 * @param gas total cost consumed by the TEAL code (can be dynamic or static)
 * @param mode Execution mode - Signature (stateless) OR Application (stateful)
 * @param maxPooledApplCost Since AVM 1.0, opcode cost for APPLICATION mode can be pooled accross
 * multiple transactions. If passed, gas is evaluated against maxPooledApplCost
 */
export function assertMaxCost(
	gas: number,
	mode: ExecutionMode,
	maxPooledApplCost?: number
): void {
	if (mode === ExecutionMode.SIGNATURE) {
		// check max cost (for stateless)
		if (gas > LOGIC_SIG_MAX_COST) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED, {
				cost: gas,
				maxcost: LOGIC_SIG_MAX_COST,
				mode: "Stateless",
			});
		}
	} else {
		if (gas > (maxPooledApplCost ?? MAX_APP_PROGRAM_COST)) {
			// check max cost (for stateful)
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED, {
				cost: gas,
				maxcost: maxPooledApplCost ?? MAX_APP_PROGRAM_COST,
				mode: "Stateful",
			});
		}
	}
}

// verify max length of TEAL code is within consensus parameters
function _assertMaxLen(len: number, mode: ExecutionMode): void {
	if (mode === ExecutionMode.SIGNATURE) {
		// check max program cost (for stateless)
		if (len > LogicSigMaxSize) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED, {
				length: len,
				maxlen: LogicSigMaxSize,
				mode: "Stateless",
			});
		}
	} else {
		if (len > MaxAppProgramLen) {
			// check max program length (for stateful)
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED, {
				length: len,
				maxlen: MaxAppProgramLen,
				mode: "Stateful",
			});
		}
	}
}

/**
 * Description: Returns a list of Opcodes object after reading text from given TEAL file
 * @param program : TEAL code as string
 * @param mode : execution mode of TEAL code (Stateless or Application)
 * @param interpreter: interpreter object
 */
export function parser(program: string, mode: ExecutionMode, interpreter: Interpreter): Op[] {
	const opCodeList: Op[] = [];
	let counter = 0;

	const lines = program.split("\n");
	for (const line of lines) {
		counter++;
		// If line is blank or is comment, continue.
		if (line.length === 0 || line.startsWith("//")) {
			continue;
		}

		// Trim whitespace from line and extract words from line
		const words = wordsFromLine(line);
		if (words.length !== 0) {
			opCodeList.push(opcodeFromSentence(words, counter, interpreter, mode));
		}
	}

	// for versions <= 3, cost is calculated & evaluated statically
	if (interpreter.tealVersion <= 3) {
		assertMaxCost(interpreter.gas, mode);
	}

	// TODO: check if we can calculate length in: https://www.pivotaltracker.com/story/show/176623588
	// assertMaxLen(interpreter.length, mode);
	return opCodeList;
}

// check algorand is auto added intcblock for optimize size contract
export function isAddIntcblock(ops: Op[], interpreter: Interpreter): boolean {
	if (interpreter.tealVersion < 4) return false;
	if (ops[0] instanceof Intcblock || ops[1] instanceof Intcblock) return false;
	const intCount: { [key: string]: number } = {};
	for (const int of interpreter.intcblock) {
		intCount[int.toString()] = 1;
	}

	for (const op of ops) {
		if (op instanceof Int) {
			if (intCount[op.uint64.toString()] === undefined) {
				intCount[op.uint64.toString()] = 0;
			}
			intCount[op.uint64.toString()] += 1;
			if (intCount[op.uint64.toString()] >= 2) return true;
		}
	}

	return false;
}

// check algorand is auto added byteblock for optimize size contract
export function isAddedBytecblock(ops: Op[], interpreter: Interpreter): boolean {
	if (interpreter.tealVersion < 4) return false;
	if (ops[0] instanceof Bytecblock || ops[1] instanceof Bytecblock) return false;
	const byteCount: { [key: string]: number } = {};
	for (const byte of interpreter.bytecblock) {
		byteCount[byte.toString()] = 1;
	}

	for (const op of ops) {
		if (op instanceof Byte) {
			if (byteCount[op.str] === undefined) {
				byteCount[op.str] = 0;
			}
			byteCount[op.str] += 1;
			if (byteCount[op.str] >= 2) return true;
		}
	}

	return false;
}

/**
 *
 * @param program teal program
 * @returns pragma version of this file
 */
export function getProgramVersion(program: string): number {
	const firstLine = program.split("\n")[0];
	const ip = new Interpreter();
	opcodeFromSentence(wordsFromLine(firstLine), 1, ip, ExecutionMode.APPLICATION);
	return ip.tealVersion;
}
