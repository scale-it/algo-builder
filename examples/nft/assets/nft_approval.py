from pyteal import *

def approval_program():
    """
    This smart contract implements a Non Fungible Token
    Each NFT is an (ID, ref_data, hash) triple.
    NFT ID is the total count of NFT's in asc.
    ref-data is represented as "https://nft-name/<total>/nft-ref"
    hash is an hash of the external resources data.

    Commands:
      create    Creates a new NFT. Expects 2 additional arguments:
                * nft-ref: a reference data (usually a URL or CID)
                * nft-ref-hash: a hash of the underlying reference data
                Only creator can create new NFTs.
      transfer  Transfers an NFT between two accounts. Expects one additional arg: NFT_ID.
                  Additionally, two Accounts(from, to) must also be passed to the smart contract.
    """

    var_total = Bytes("total")
    var_1 = Int(1)

    # Check to see that the application ID is not set, indicating this is a creation call.
    # Store the creator address to global state.
    # Set total nft count to 0
    on_deployment = Seq([
        App.globalPut(Bytes("creator"), Txn.sender()),
        Assert(Txn.application_args.length() == Int(0)),
        App.globalPut(var_total, Int(0)),
        Return(var_1)
    ])

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved ina rekeying operation.
    no_rekey_addr = Txn.rekey_to() == Global.zero_address()

    # Checks whether the sender is creator.
    is_creator = Txn.sender() == App.globalGet(Bytes("creator"))

    # Get total amount of NFT's from global storage
    create_nft_id = Itob(App.globalGet(var_total))

    # create transaction parameters
    data_ref = Txn.application_args[1]
    data_hash = Txn.application_args[2]

    # var to store id_h
    id_h = ScratchVar(TealType.bytes)

    # Verifies if the creater is making this request
    # Verifies three arguments are passed to this transaction ("create", nft-name, nft-ref)
    # Increment Global NFT count by 1
    # Assign data_ref to NFT ID (= total)
    # Assign hash of nft-ref to ID_h
    # Add above two keys to global and creator's local storage
    create_nft = Seq([
        Assert(And(
            Txn.application_args.length() == Int(3),
            is_creator,
            no_rekey_addr
        )),

        App.globalPut(var_total, App.globalGet(var_total) + var_1),

        id_h.store(Concat(create_nft_id, Bytes("_h"))), # store id_h in scratchVar
        App.globalPut(create_nft_id, data_ref),
        App.globalPut(id_h.load() , data_hash),

        App.localPut(Int(0), create_nft_id, var_1),  # Int(0) represents the address of caller
        Return(is_creator)
    ])

    transfer_nft_id = Txn.application_args[1]  # this is only in the transfer condition

    # Verify two arguments are passed
    # Verify NFT_ID is present in global storage
    # Add nft to account_2's local storage
    # Remove nft from account_1's local storage
    transfer_nft = Seq([
        Assert(And(
            Txn.application_args.length() == Int(2),
            no_rekey_addr,
            # assert that a account_1 holds the NFT
            App.localGet(var_1, transfer_nft_id) == var_1
        )),

        App.localDel(var_1, transfer_nft_id),
        App.localPut(Int(2), transfer_nft_id, var_1),
        Return(var_1)
    ])

    # Verfies that the application_id is 0, jumps to on_deployment.
    # Verifies that DeleteApplication is used and verifies that sender is creator.
    # Verifies that UpdateApplication is used and blocks that call (unsafe for production use).
    # Verifies that closeOut is used and jumps to on_closeout.
    # Verifies that the account has opted in and jumps to on_register.
    # Verifies that first argument is "vote" and jumps to on_vote.
    program = Cond(
        [Txn.application_id() == Int(0), on_deployment],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))], #block update
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.CloseOut, Return(var_1)],
        [Txn.on_completion() == OnComplete.OptIn, Return(var_1)],
        [Txn.application_args[0] == Bytes("create"), create_nft],
        [Txn.application_args[0] == Bytes("transfer"), transfer_nft]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application))
