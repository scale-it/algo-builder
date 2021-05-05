import sys
sys.path.insert(0,'..')

from algobpy.parse import parseArgs
from pyteal import *

def approval_program(CONTROLLER_APP_ID):
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
    max_tokens = Bytes("max_tokens") # maximum token transfer rule
    whitelist_count = Bytes("whitelist_count") # whitelisted accounts counter

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved ina rekeying operation.
    rekey_check = Txn.rekey_to() == Global.zero_address()

    # Handles Permissions SSC deployment.
    # During deployment
    # * max_tokens is set to 100
    # * whitelist_counter is intialized to 0
    # * controller application index is saved in global state
    on_deployment = Seq([
    	Assert(rekey_check),

        # Save max_tokens count in global state (default = 100, during ssc deploy)
        App.globalPut(max_tokens, Int(100)),

        # Initialize whitelisted accounts counter to 0
        App.globalPut(whitelist_count, Int(0)),
        Return(Int(1))
    ])

    # fetch permissions manager from controller's global state (using foreignApps)
    permissions_manager = App.globalGetEx(Int(1), Bytes("manager"))

    # Whitelist an account. If a non-reserve account is whitelisted then it can receive tokens.
    # Only accepted if txn sender is the permissions manager.
    # 1 expected argument:
    # * controller_app_id: controller application index
    # NOTE: controller_app_id is also passed in txn.ForeignApps (to load perm_id, manager from controller's global state)
    add_whitelist = Seq([
        permissions_manager,
        Assert(And(
    		Txn.application_args.length() == Int(2),
    		Txn.accounts.length() == Int(1),
    		rekey_check,
    		# Txn.applications.length() ==  Int(1), [TEALv3]

    		# verify from global state whether controller application passed is the valid one
    		# note: with tealv3 we can just use txn.applications[0] instead of passing an an appArg
    		Btoi(Txn.application_args[1]) == Int(CONTROLLER_APP_ID),

    		# then verify txn sender is the permissions manager
    		Txn.sender() == permissions_manager.value(),
        )),

        If(
            # If account is not already whitelisted, update the counter and continue, return otherwise
            App.localGet(Int(1), Bytes("whitelisted")) == Int(0),
            App.globalPut(whitelist_count, App.globalGet(whitelist_count) + Int(1)), # only evaluated if above is true
            Return(Int(1)) # else return
        ),

        # finally update txn.accounts[1] local state to set whitelisted status as true(1)
        App.localPut(Int(1), Bytes("whitelisted"), true),
        Return(Int(1))
    ])

    asset_balance = AssetHolding.balance(Int(1), Gtxn[1].xfer_asset())

    # Transfer token from accA -> accB. Both A, B are non-reserve accounts.
    # Expected arguments:
    # * toAccountAddress (fetched from Txn.ForeignApps[0])
    transfer_token = Seq([
        asset_balance, # load asset_balance of asset_receiver from store
        Assert(And(
            Gtxn[1].type_enum() == TxnType.AssetTransfer, # this should be clawback call

    		# verify tx.accounts[1] of current_tx should be same as asset receiver
    		Txn.accounts[1] == Gtxn[1].asset_receiver(),

    		# rule 1 - check balance of receiver after receiving token <= 100(max_tokens)
    		asset_balance.value() <= App.globalGet(max_tokens),

    		# rule 2 - [from, to] accounts must be whitelisted
    		# NOTE: Int(0) == Txn.Sender(), Int(1) == Txn.accounts[1]
    		App.localGet(Int(0), Bytes("whitelisted")) == true, # from account must be whitelisted
    		App.localGet(Int(1), Bytes("whitelisted")) == true  # to account must be whitelisted
        )),
        Return(Int(1))
    ])

    handle_optin = Seq([
        Assert(And(
            Txn.application_args.length() == Int(0),
            Txn.group_index() == Int(0)
        )),
        Return(Int(1))
    ])

    # permissions_manager can update this smart contract to update/add to
    # existing set of rule(s)
    handle_update = Seq([
        permissions_manager,
        Assert(And(
            Btoi(Txn.application_args[1]) == Int(CONTROLLER_APP_ID), # verify controller_app_id
    		Txn.sender() == permissions_manager.value(),
        )),
        Return(Int(1))
    ])

    # Verfies that the application_id is 0, jumps to on_deployment.
    # Verifies that DeleteApplication is used and blocks that call
    # Verifies that UpdateApplication is used and jumps to handle_update.
    # Verifies that closeOut is used and approves the tx.
    # Verifies that OptInApplication is used and jumps to handle_optin
    # Verifies that first argument is "add_whitelist" and jumps to add_whitelist.
    # Verifies that first argument is "transfer" and jumps to transfer_token.
    program = Cond(
        [Txn.application_id() == Int(0), on_deployment],
        [Txn.on_completion() == OnComplete.UpdateApplication, handle_update],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))], # block delete
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.application_args[0] == Bytes("add_whitelist"), add_whitelist],
        [Txn.application_args[0] == Bytes("transfer"), transfer_token]
    )

    return program

if __name__ == "__main__":
    params = {
        "CONTROLLER_APP_ID": 11,
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(approval_program(params["CONTROLLER_APP_ID"]), Mode.Application, version=2))