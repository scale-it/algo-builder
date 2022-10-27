import WalletConnect from "@walletconnect/client";
import { IJsonRpcRequest, IRequestOptions } from "@walletconnect/types";
import { decodeUnsignedTransaction } from "algosdk";

export class WalletConnectMock extends WalletConnect {

    sendCustomRequest(request: Partial<IJsonRpcRequest>, options?: IRequestOptions | undefined): Promise<any> {

        return new Promise((resolve, reject) => {
            if (request.params) {
                console.log(" im called", decodeUnsignedTransaction(Uint8Array.from(Buffer.from(request.params as any as string, "base64"))));
            }
            // const decodedtransaction = decodeUnsignedTransaction(request.params as unknown as Uint8Array);
            // return resolve(algosdk.signTransaction(decodedtransaction, senderAccount.sk))

        });

    }
}