import * as fs from "fs";
import path from "path";

import type { NetworkCredentials } from "../types";

export function algodCredentialsFromEnv(): NetworkCredentials {
	const token = process.env.ALGOD_TOKEN;
	const algodAddr = process.env.ALGOD_ADDR;

	if (token === undefined && algodAddr === undefined) {
		const algoData = process.env.ALGORAND_DATA;
		if (algoData === undefined) {
			throw new Error(
				"Either Algod Credentials or ALGORAND_DATA must be defined as an environment variable"
			);
		}

		const loadToken = fs.readFileSync(path.join(algoData, "algod.token"), "utf8");
		const loadNet = fs.readFileSync(path.join(algoData, "algod.net"), "utf8");
		const arr = loadNet.toString().split(":");

		return {
			host: arr[0],
			port: +arr[1],
			token: loadToken.toString(),
		};
	} else if (token === undefined || algodAddr === undefined) {
		throw new Error("Both Algod Token and Algod Address should be defined in env");
	}

	const arr = algodAddr.split(":");
	return { host: arr[0], port: +arr[1], token: token };
}

export function KMDCredentialsFromEnv(): NetworkCredentials {
	let token = process.env.KMD_TOKEN;
	let kmdAddr = process.env.KMD_ADDR;

	if (token === undefined && kmdAddr === undefined) {
		const kmdData = process.env.KMD_DATA;
		if (kmdData === undefined) {
			throw new Error("Either KMD Credentials or KMD_DATA should be defined in env");
		}
		token = fs.readFileSync(path.join(kmdData, "kmd.token"), "utf8");
		kmdAddr = fs.readFileSync(path.join(kmdData, "kmd.net"), "utf8");
	} else if (token === undefined || kmdAddr === undefined) {
		throw new Error("Both KMD Token and KMD Address should be defined in env");
	}

	const arr = kmdAddr.toString().split(":");
	if (arr.length !== 2) {
		throw new Error("Wrong network address in kmd.net file. Expected: [http://]host:port");
	}
	if (!arr[0].startsWith("http")) arr[0] = "http://" + arr[0];

	return { host: arr[0], port: +arr[1], token: token };
}
