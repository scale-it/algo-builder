import sys
sys.path.insert(0,'..')

from algobpy.parse import parseArgs
from pyteal import *

def approval_program(PERM_MANAGER):
    """
    Th Permissions smart contract defines transfer rules.
    Here, we implement two rules:
        a) receiver asset balance should be <=100 after transfer
        b) both [from, to] accounts must be whitelisted
    The Permissions smart contract must be called with the Controller to validate
    transfers. The Controller smart contract defines a manager account, which
    is used here to update user attributes and smart contract state.
    """

    true = Int(1)
    permissions_manager = Bytes("manager")	# permissions manager (manages contract permissions)
    max_tokens = Bytes("max_tokens") # maximum token transfer rule
    whitelist_count = Bytes("whitelist_count") # whitelisted accounts counter

    # verify rekey_to and close_rem_to are set as zero_address
    basic_checks = And(
        # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
        # unless the contract is specifically involved ina rekeying operation.
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address()
    )

    # Handles Permissions SSC deployment.
    # During deployment
    # * max_tokens is set to 100
    # * whitelist_counter is intialized to 0
    # * save permissions manager in global state
    on_deployment = Seq([
        Assert(basic_checks),

        # Save max_tokens count in global state (default = 100, during ssc deploy)
        App.globalPut(max_tokens, Int(100)),

        # Initialize whitelisted accounts counter to 0
        App.globalPut(whitelist_count, Int(0)),

        # Save perm_manager in global state (as it could be updated to another address as well)
        App.globalPut(permissions_manager, Addr(PERM_MANAGER)),
        Return(Int(1))
    ])

    # Change the manager of this contract. Only accepted if sender is the current permissions manager.
    # Expects 1 argument in Txn.accounts[n] array:
    # * addr : address of the new permissions manager
    change_permissions_manager = Seq([
        Assert(And(
            Txn.accounts.length() == Int(1),
            basic_checks,
            Txn.sender() == App.globalGet(permissions_manager),
        )),

        # update permissions manager address to the first account address passed in appAccounts
        App.globalPut(permissions_manager, Txn.accounts[1]),
        Return(Int(1))
    ])

    # Whitelist an account. If a non-reserve account is whitelisted then it can receive tokens.
    # Only accepted if txn sender is the permissions manager.
    add_whitelist = Seq([
        Assert(And(
            Txn.accounts.length() == Int(1),
            basic_checks,

            # verify txn sender is the permissions manager
            Txn.sender() == App.globalGet(permissions_manager),
        )),

        If(
            # If account is not already whitelisted, update the counter and continue, return otherwise
            App.localGet(Int(1), Bytes("whitelisted")) == Int(0),
            App.globalPut(whitelist_count, App.globalGet(whitelist_count) + Int(1)), # only evaluated if above is true
            Return(Int(1)) # else return
        ),

        # finally update Txn.accounts[1] local state to set whitelisted status as true(1)
        App.localPut(Int(1), Bytes("whitelisted"), true),
        Return(Int(1))
    ])

    # fetch asset_holding.balance from Txn.accounts[2] (asset_receiver)
    asset_balance = AssetHolding.balance(Int(2), Gtxn[1].xfer_asset())

    # Transfer token from accA -> accB. Both A, B are non-reserve accounts.
    # Expected arguments (fetched from Txn.Accounts array):
    # * fromAccountAddress
    # * toAccountAddress
    transfer_token = Seq([
        asset_balance, # load asset_balance of asset_receiver from store
        Assert(And(
            Gtxn[1].type_enum() == TxnType.AssetTransfer, # this should be clawback call

            # verify [from, to] addresses (from Txn.accounts) of current_tx
            # should be same as [asset_sender, asset_receiver]
            Txn.accounts[1] == Gtxn[1].asset_sender(),
            Txn.accounts[2] == Gtxn[1].asset_receiver(),

            # rule 1 - check balance of receiver after receiving token <= 100(max_tokens)
            asset_balance.value() <= App.globalGet(max_tokens),

            # rule 2 - [from, to] accounts must be whitelisted
            # NOTE: Int(0) == Txn.Sender(), Int(1) == Txn.accounts[1]
            App.localGet(Int(1), Bytes("whitelisted")) == true, # from account must be whitelisted
            App.localGet(Int(2), Bytes("whitelisted")) == true  # to account must be whitelisted
        )),
        Return(Int(1))
    ])

    # During close_out, if account is whitelisted then decrement the whitelist_counter by 1
    handle_closeout = Seq([
        Assert(And(
            Txn.application_args.length() == Int(0),
            basic_checks
        )),
        Return(If(
            App.localGet(Int(0), Bytes("whitelisted")) == true,
            Seq([
                App.globalPut(whitelist_count, App.globalGet(whitelist_count) - Int(1)),
                Int(1)
            ]),
            Int(1)
        ))
    ])

    handle_optin = Seq([
        Assert(And(
            Txn.application_args.length() == Int(0),
            basic_checks
        )),
        Return(Int(1))
    ])

    # permissions_manager can update this smart contract to update/add to
    # existing set of rule(s). Only accepted if sender is the permissions manager.
    handle_update = Seq([
        Assert(And(
            basic_checks,
            Txn.sender() == App.globalGet(permissions_manager),
        )),
        Return(Int(1))
    ])

    # Verfies that the application_id is 0, jumps to on_deployment.
    # Verifies that DeleteApplication is used and blocks that call
    # Verifies that UpdateApplication is used and jumps to handle_update.
    # Verifies that closeOut is used and approves the tx.
    # Verifies that OptInApplication is used and jumps to handle_optin
    # Verifies that first argument is "change_permissions_manager" and jumps to change_permissions_manager.
    # Verifies that first argument is "add_whitelist" and jumps to add_whitelist.
    # Verifies that first argument is "transfer" and jumps to transfer_token.
    program = Cond(
        [Txn.application_id() == Int(0), on_deployment],
        [Txn.on_completion() == OnComplete.UpdateApplication, handle_update],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))], # block delete
        [Txn.on_completion() == OnComplete.CloseOut, handle_closeout],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.application_args[0] == Bytes("change_permissions_manager"), change_permissions_manager],
        [Txn.application_args[0] == Bytes("add_whitelist"), add_whitelist],
        [Txn.application_args[0] == Bytes("transfer"), transfer_token]
    )

    return program

if __name__ == "__main__":
    params = {
        "PERM_MANAGER": "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY"
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(approval_program(params["PERM_MANAGER"]), Mode.Application, version=2))