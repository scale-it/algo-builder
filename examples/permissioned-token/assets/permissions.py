from pyteal import *

def approval_program():
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
    controller_app_id = Bytes("controller_app_id") # token's controller application index

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved ina rekeying operation.
    rekey_check = Txn.rekey_to() == Global.zero_address()

    on_deployment = Seq([
    	Assert(And(
    		Txn.application_args.length() == Int(1),
            rekey_check
    	)),

        # Save max_tokens count in global state (default = 100, during ssc deploy)
        App.globalPut(max_tokens, Int(100)),

        # Initialize whitelisted accounts counter to 0
        App.globalPut(whitelist_count, Int(0)),

        # Save controller application index in global state
        App.globalPut(controller_app_id, Btoi(Txn.application_args[0])),
        Return(Int(1))
    ])

    # fetch permissions manager, token_id from controller's global state (using foreignApps)
    permissions_manager = App.globalGetEx(Int(1), Bytes("manager"))
    token_id = App.globalGetEx(Int(1), Bytes("token_id"))

    # whitelist an account
    add_whitelist = Seq([
        permissions_manager,
        token_id,
        Assert(And(
    		Txn.application_args.length() == Int(2),
    		Txn.accounts.length() == Int(1),
    		rekey_check,
    		# Txn.applications.length() ==  Int(1), [TEALv3]

    		# verify from global state whether controller application passed is the valid one
    		# note: with tealv3 we can just use txn.applications[0] instead of passing an an appArg
    		Btoi(Txn.application_args[1]) == App.globalGet(controller_app_id),

    		# first verify correct token value is passed
    		# token_id.hasValue(),
    		# Txn.assets[0] == token_id.value(), [TEALv3]

    		# then verify txn sender is the token manager
    		# permissions_manager.hasValue(),
    		Txn.sender() == permissions_manager.value(),
        )),

        If(
            # If account is not already whitelisted, update the counter and continue, return otherwise
            App.localGet(Int(1), Bytes("whitelisted")) == Int(0),
            App.globalPut(whitelist_count, App.globalGet(whitelist_count) + Int(1)), # only evaluated if above is true
            Return(Int(1)) # else return
        ),

        # finally update txn.accounts[1] local state to set whitelisted status as true(1)
        App.localPut(Int(1), Bytes("whitelisted"), Int(1)),
        Return(Int(1))
    ])

    asset_balance = AssetHolding.balance(Int(1), Gtxn[1].xfer_asset())
    transfer_token = Seq([
        asset_balance, # load asset_balance of asset_receiver from store
        Assert(And(
            Gtxn[1].type_enum() == TxnType.AssetTransfer, # this should be clawback call

    		# verify tx.accounts[1] of current_tx should be same as asset receiver
    		Txn.accounts[1] == Gtxn[1].asset_receiver(),

    		# rule 1 - check balance of receiver after receiving token <= 100(max_tokens)
    		asset_balance.hasValue(),
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

    # Verfies that the application_id is 0, jumps to on_deployment.
    # Verifies that DeleteApplication is used and blocks that call
    # Verifies that UpdateApplication is used and blocks that call (unsafe for production use).
    # Verifies that closeOut is used and approves the tx.
    # Verifies that OptInApplication is used and jumps to handle_optin
    # Verifies that first argument is "add_whitelist" and jumps to add_whitelist.
    # Verifies that first argument is "transfer" and jumps to transfer_token.
    program = Cond(
        [Txn.application_id() == Int(0), on_deployment],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))], # block update
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))], # block delete
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.application_args[0] == Bytes("add_whitelist"), add_whitelist],
        [Txn.application_args[0] == Bytes("transfer"), transfer_token]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version=2))