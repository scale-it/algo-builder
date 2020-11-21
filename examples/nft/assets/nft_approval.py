from pyteal import *

def approval_program():
    """
    This smart contract implements a Non Fungible Token 
    Each NFT is an (ID, ref_data, hash) triple.
    NFT ID is the total count of NFT's in asc.
    ref-data is represented as "https://nft-name/<total>/nft-ref"
    hash is an hash of the external resources data.

    Commands:
        create    Creates a new NFT. Expects two additional arguments - nft-name, nft-ref 
        tranfer   Transfers an NFT between two accounts. Expects one additional arg - NFT_ID.
                  Additionally, two Accounts(from, to) must also be passed to the smart contract. 
    """

    # Check to see that the application ID is not set, indicating this is a creation call.
    # Store the creator address to global state.
    # Set total nft count to 0
    on_creation = Seq([
        App.globalPut(Bytes("creator"), Txn.sender()),
        Assert(Txn.application_args.length() == Int(0)),
        App.globalPut(Bytes("total"), Int(0)),
        Return(Int(1))
    ])                  

	# Checks whether the sender is creator.
    is_creator = Txn.sender() == App.globalGet(Bytes("creator"))

    # Get total count of NFT's from global storage
    total_nft = Itob(App.globalGet(Bytes("total")))

    #create ref_data for NFT (https://nft-name/<total>/nft-ref)
    ref_data = Concat(  
        Bytes("https://"), 
        Txn.application_args[1], # nft-name
        Bytes(".com/"), 
        Itob(App.globalGet(Bytes("total"))), 
        Bytes("/"), 
        Txn.application_args[2] # nft-ref
    )

    # Verifies if the creater is making this request
    # Verifies three arguments are passed to this transaction ("create", nft-name, nft-ref)
    # Increment Global NFT count by 1
    # Assign ref_data to NFT ID (= total)
    # Assign hash of nft-ref to ID_h
    # Add above two keys to global and creator's local storage
    create_nft = Seq([
        Assert(is_creator),
        Assert(Txn.application_args.length() == Int(3)),

        App.globalPut(Bytes("total"), App.globalGet(Bytes("total")) + Int(1)),

        App.globalPut(total_nft, ref_data),
        App.globalPut(Concat(total_nft, Bytes("_h")) , Sha256(Txn.application_args[2])),

        App.localPut(Int(0), total_nft, ref_data),  # Int(0) represents the address of caller
        App.localPut(Int(0), Concat(total_nft, Bytes("_h")) , Sha256(Txn.application_args[2])),
        Return(is_creator)
    ])
    

    # Verify two arguments are passed 
    # Verify NFT_ID is present in global storage
    # Add nft to account_2's local storage
    # Remove nft from account_1's local storage
    transfer_nft = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(App.globalGet(Bytes("total")) >= Btoi(Txn.application_args[1])),

        App.localPut(Int(2), Txn.application_args[1], App.localGet(Int(1), Txn.application_args[1])),
        App.localPut(Int(2), Concat(Txn.application_args[1], Bytes("_h")), App.localGet(Int(1), Concat(Txn.application_args[1], Bytes("_h")))),

        App.localDel(Int(1), Txn.application_args[1]),
        App.localDel(Int(1), Concat(Txn.application_args[1], Bytes("_h"))),
        Return(Int(1))
    ])

    # Verfies that the application_id is 0, jumps to on_creation.
    # Verifies that DeleteApplication is used and verifies that sender is creator.
    # Verifies that UpdateApplication is used and blocks that call (unsafe for production use).
    # Verifies that closeOut is used and jumps to on_closeout.
    # Verifies that the account has opted in and jumps to on_register.
    # Verifies that first argument is "vote" and jumps to on_vote.
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))], #block update
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
        [Txn.application_args[0] == Bytes("create"), create_nft],
        [Txn.application_args[0] == Bytes("transfer"), transfer_nft]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application))
