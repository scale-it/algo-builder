import { IJsonRpcRequest, IRequestOptions } from "@walletconnect/types";
import algosdk, { decodeUnsignedTransaction } from "algosdk";
import { senderAccount } from "./tx";
import Connector from "@walletconnect/core";

export class WalletConnectMock extends Connector {
	async sendCustomRequest(
		request: Partial<IJsonRpcRequest>,
		options?: IRequestOptions | undefined
	): Promise<any> {
		return new Promise((resolve, reject) => {
			const signedTransactions = [];
			if (request.params) {
				for (const param of request.params) {
					const decodedtransaction = decodeUnsignedTransaction(
						Uint8Array.from(Buffer.from(param[0].txn as string, "base64"))
					);
					const encodedSignedTxn = Buffer.from(
						algosdk.signTransaction(decodedtransaction, senderAccount.sk).blob
					).toString("base64");
					signedTransactions.push(encodedSignedTxn);
				}
			}
			return resolve(signedTransactions);
		});
	}
}
