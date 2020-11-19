from pyteal import *

def approval_program():
    """
    https://developer.algorand.org/solutions/example-permissioned-voting-stateful-smart-contract-application/?query=asset%2520contract
    To implement a permissioned voting application on Algorand, a central authority is needed to 
    provide users the right to vote. In this example, this is handled by an Algorand Standard 
    Asset. The central authority creates a vote token and then gives voters who have registered 
    one voting token. The voter then registers within a round range with the voting smart 
    contract, by Opting into the contract. Voters then vote by grouping two transactions. 
    The first is a smart contract call to vote for either candidate A or candidate B, and 
    the second is transferring the vote token back to the central authority. Voting is only
     allowed within the voting range.
    """
    # Check to see that the application ID is not set, indicating this is a creation call.
    # Store the creator address to global state.
    # Store both register and voting round ranges to global state.
    # Store Asset ID to global state
    on_creation = Seq([
        App.globalPut(Bytes("Creator"), Txn.sender()),
        Assert(Txn.application_args.length() == Int(5)),
        App.globalPut(Bytes("RegBegin"), Btoi(Txn.application_args[0])),
        App.globalPut(Bytes("RegEnd"), Btoi(Txn.application_args[1])),
        App.globalPut(Bytes("VoteBegin"), Btoi(Txn.application_args[2])),
        App.globalPut(Bytes("VoteEnd"), Btoi(Txn.application_args[3])),
        App.globalPut(Bytes("AssetID"), Btoi(Txn.application_args[4])),
        Return(Int(1))
    ])

    # Checks whether the sender is creator.
    is_creator = Txn.sender() == App.globalGet(Bytes("Creator"))

    # Checks whether sender has voted before or not.
    get_vote_of_sender = App.localGetEx(Int(0), App.id(), Bytes("voted"))

    on_closeout = Seq([
        get_vote_of_sender,
        If(And(Global.round() <= App.globalGet(Bytes("VoteEnd")), get_vote_of_sender.hasValue()),
            App.globalPut(get_vote_of_sender.value(), App.globalGet(get_vote_of_sender.value()) - Int(1))
        ),
        Return(Int(1))
    ])

    # Checks that the first argument to the smart contract is the word “register”.
    # Verifies that the round is currently between registration begin and end rounds.
    on_register = Return(
        And(
        Txn.application_args[0] == Bytes("register"),
        Global.round() >= App.globalGet(Bytes("RegBegin")),
        Global.round() <= App.globalGet(Bytes("RegEnd")))
    )

    # Verifies the first application argument contains the string “vote”.
    # Verifies the vote call is between the beginning and end of the voting round ranges.
    # Verifies that two transactions are in the group.
    # Checks that the second transaction is an asset transfer, and the token transferred is the vote token.
    # Checks that the second transaction receiver is the creator of the application.
    # Checks if the account has already voted, and if so, just returns true with no change to global state.
    # Verifies that the user is either voting for candidate A or B.
    # Reads the candidate’s current total from the global state and increments the value.
    # Stores the candidate choice to the user’s local state.
    choice = Txn.application_args[1]
    choice_tally = App.globalGet(choice)
    on_vote = Seq([
        Assert(And(
            Global.round() >= App.globalGet(Bytes("VoteBegin")),
            Global.round() <= App.globalGet(Bytes("VoteEnd"))
        )),
        Assert(And(
            Global.group_size() == Int(2),
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[1].asset_receiver() == App.globalGet(Bytes("Creator")),
            Gtxn[1].xfer_asset() == App.globalGet(Bytes("AssetID")),
            Gtxn[1].asset_amount() == Int(1),
            Or(choice == Bytes("candidatea"), choice == Bytes("candidateb"))
        )),
        get_vote_of_sender,
        If(get_vote_of_sender.hasValue(),
            Return(Int(0))
        ),
        App.globalPut(choice, choice_tally + Int(1)),
        App.localPut(Int(0), Bytes("voted"), choice),
        Return(Int(1))
    ])

    # Verfies that the application_id is 0, jumps to on_creation.
    # Verifies that DeleteApplication is used and verifies that sender is creator.
    # Verifies that UpdateApplication is used and verifies that sender is creator.
    # Verifies that closeOut is used and jumps to on_closeout.
    # Verifies that the account has opted in and jumps to on_register.
    # Verifies that first argument is "vote" and jumps to on_vote.
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.CloseOut, on_closeout],
        [Txn.on_completion() == OnComplete.OptIn, on_register],
        [Txn.application_args[0] == Bytes("vote"), on_vote]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application))
