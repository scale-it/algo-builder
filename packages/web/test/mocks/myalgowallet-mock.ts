import type {
    Options,
    Accounts,
    Address,
    AlgorandTxn,
    Base64,
    ConnectionSettings,
    EncodedTransaction,
    SignedTx,
    SignTransactionOptions,
} from "@randlabs/myalgo-connect";

export default class MyAlgoConnectMock {

    /**
     * @param {Options} options Override default popup options.
     */
    constructor(options?: Options) {

    };

    /**
     * @async
     * @description Receives user's accounts from MyAlgo.
     * @param {ConnectionSettings} [settings] Connection settings
     * @returns Returns an array of Algorand addresses.
     */
    connect(settings?: ConnectionSettings): Promise<Accounts[]> {
        return new Promise((resolve, reject) => {
            return resolve([{
                address: "",
                name: ""
            }]);
        });
    };

    /**
     * @async
     * @description Sign an Algorand Transaction.
     * @param transaction Expect a valid Algorand transaction
     * @param signOptions Sign transactions options object.
     * @returns Returns signed transaction
     */
    signTransaction(transaction: AlgorandTxn | EncodedTransaction, signOptions?: SignTransactionOptions): Promise<SignedTx>;

    /**
     * @async
     * @description Sign an Algorand Transaction.
     * @param transaction Expect a valid Algorand transaction array.
     * @param signOptions Sign transactions options object.
     * @returns Returns signed an array of signed transactions.
     */
    signTransaction(transaction: (AlgorandTxn | EncodedTransaction)[], signOptions?: SignTransactionOptions): Promise<SignedTx[]>;

    signTransaction(transaction: AlgorandTxn | EncodedTransaction | (AlgorandTxn | EncodedTransaction)[], signOptions?: SignTransactionOptions): Promise<SignedTx | SignedTx[]> {
        return new Promise((resolve, reject) => {
            return resolve([{
                blob: new Uint8Array(),
                txID: ""
            }]);
        });
    }


    /**
     * @async
     * @description Sign a teal program
     * @param logic Teal program
     * @param address Signer Address
     * @returns Returns signed teal
     */
    signLogicSig(logic: Uint8Array | Base64, address: Address): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            return resolve(new Uint8Array());
        });
    };

    /**
     * @async
     * @description Creates a signature the data that can later be verified by the contract through the ed25519verify opcode
     * @param data Arbitrary data to sign
     * @param contractAddress Contract address/TEAL program hash
     * @param address Signer Address
     * @returns Returns the data signature
     */
    tealSign(data: Uint8Array | Base64, contractAddress: Address, address: Address): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            return resolve(new Uint8Array());
        });
    };
}