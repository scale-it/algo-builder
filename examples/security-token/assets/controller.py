from pyteal import *

def approval_program():
    """
    This smart contract acts as a controller of the token. It
    ensures that the permissions smart contract is called upon each
    token transfer between non-reserve accounts. The permissions smart contract
    validates the transfer with some rule checks (eg. asset_amount <= 100).
    Controller application id is set in clawback-escrow (as a template parameter),
    to ensure there is a call to controller during a token-transfer.
    It also handles kill_status of the token. If token is killed then no token transfers
    are allowed. User can only optOut of the asset.
    """

    var_is_killed = Bytes("is_token_killed")
    var_total = Bytes("total_rules")
    token_id = Bytes("token_id")
    permissions_manager = Bytes("permissions_manager")	# permissions manager (asa.manager by default)
    permission_id = Bytes("permissions_sc_app_id") # permissions smart contract application index

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved in a rekeying operation.
    no_rekey_addr = Txn.rekey_to() == Global.zero_address()

    # retreive asset manager from Txn.ForeignAssets[0]
    assetManager = AssetParam.manager(Int(0))

    on_deployment = Seq([
        assetManager, # load asset manager from store
	Assert(And(
		Txn.application_args.length() == Int(1),
		# Txn.assets.length() == Int(1), [TEALv3]
		no_rekey_addr,

       	# Controller should be deployed by ASA.manager
		assetManager.hasValue(),
		Txn.sender() == assetManager.value()
        )),

        # total permission contracts during deploy is set to 0.
        App.globalPut(var_total, Int(0)),

        # set kill_status to false(0) during deploy
        App.globalPut(var_is_killed, Int(0)),

        # Save token index in controller's global state
        App.globalPut(token_id, Btoi(Txn.application_args[0])), # or maybe use App.globalPut(token_id, Btoi(Txn.assets[0])) with TEALv3
        Return(Int(1))
    ])

    # retreive asset reserve from Txn.ForeignAssets[0]
    assetReserve = AssetParam.reserve(Int(0))
    issue_token = Seq([
        assetReserve,
        Assert(And(
		Txn.application_args.length() == Int(1),
		# Txn.assets.length() == Int(1), [TEALv3]
		Gtxn[1].type_enum() == TxnType.AssetTransfer,
		Gtxn[1].xfer_asset() == App.globalGet(token_id), # verify if token index is correct

		# Issue should only be done by token reserve
		assetReserve.hasValue(),
			Gtxn[0].sender() == assetReserve.value(),
		Gtxn[1].asset_sender() == assetReserve.value(),

		# only allow issue if token is not killed
		App.globalGet(var_is_killed) == Int(0)
        )),
        Return(Int(1))
    ])

    # kill a token, after verifying transaction set is_killed to true(Int(1))
    assetManager = AssetParam.manager(Int(0))
    kill_token = Seq([
        assetManager, # load asset_manager of Txn.ForeignAssets[0]
        Assert(And(
		Txn.application_args.length() == Int(1),
		# Txn.assets.length() == Int(1), [TEALv3],
		# Txn.assets[0] == App.globalGet(token_id), [TEALv3] # verify if token index is correct
		Txn.type_enum() == TxnType.ApplicationCall,

		# Only asset manager can kill the token
		assetManager.hasValue(),
		Txn.sender() == assetManager.value(),
        )),

        # finally set is_killed to true
        App.globalPut(var_is_killed, Int(1)),
        Return(Int(1))
    ])

    add_new_permission = Seq([
        assetManager,
        Assert(And(
		Txn.application_args.length() == Int(3),
		# Txn.assets[0] == App.globalGet(token_id), [TEALv3]

		assetManager.hasValue(),
		Txn.sender() == assetManager.value(),
        )),

        # Update total rules counter (= 1 in this case) as we only have a single
        # permissions contract
        App.globalPut(var_total, App.globalGet(var_total) + Int(1)),

        # Add permissions(rules) smart contract config in global state (permission_id, permissions_manager)
        App.globalPut(permission_id, Btoi(Txn.application_args[1])),
        App.globalPut(permissions_manager, Txn.application_args[2]),
        Return(Int(1))
    ])

    # Token manager can update permissions manager to a different address
    change_permissions_manager = Seq([
        assetManager,
        Assert(And(
		Txn.application_args.length() == Int(1),
		# Txn.assets[0] == App.globalGet(token_id), [TEALv3]

		assetManager.hasValue(),
		Txn.sender() == assetManager.value(),
        )),

        # update permissions manager address to the first account address passed in appAccounts
        App.globalPut(permissions_manager, Txn.accounts[1]),
        Return(Int(1))
    ])

	# check properties of txGroup passed
    group_tx_checks = And(
        # Ensure 3 basic calls + 1 rules contract call is present in group
        Global.group_size() == Add(Int(3), App.globalGet(var_total)),
        Gtxn[0].type_enum() == TxnType.ApplicationCall, # call to controller smart contract
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[2].type_enum() == TxnType.Payment, # paying fees of escrow
        Gtxn[3].type_enum() == TxnType.ApplicationCall, # call to permissions contract
        # this tx should be 1st in group
        Txn.group_index() == Int(0)
    )

    # check no rekeying etc
    common_fields = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address(),
        Gtxn[2].rekey_to() == Global.zero_address(),
        Gtxn[3].rekey_to() == Global.zero_address(),
        Gtxn[0].close_remainder_to() == Global.zero_address(),
        Gtxn[1].close_remainder_to() == Global.zero_address(),
        Gtxn[2].close_remainder_to() == Global.zero_address(),
        Gtxn[3].close_remainder_to() == Global.zero_address(),
        Gtxn[0].asset_close_to() == Global.zero_address(),
        Gtxn[1].asset_close_to() == Global.zero_address(),
        Gtxn[2].asset_close_to() == Global.zero_address(),
        Gtxn[3].asset_close_to() == Global.zero_address()
    )

    all_transaction_checks = And(
        # verify first transaction
        # call to controller smart contract - signed by asset sender
        Gtxn[0].application_id() == Global.current_application_id(),
        Gtxn[0].sender() == Gtxn[2].sender(),
        Gtxn[0].sender() == Gtxn[3].sender(),
        Gtxn[0].sender() == Gtxn[1].asset_sender(),

        # verify 2nd tx - check asset_id passed through params
        Gtxn[1].xfer_asset() == App.globalGet(token_id),

        # verify 3rd tx checks
        Gtxn[1].sender() == Gtxn[2].receiver(),
        Gtxn[2].amount() >= Gtxn[1].fee(), # verify the fee amount is good

        # verify rules call (Ensure permissions smart contract is being called in 4th tx)
        Gtxn[3].application_id() == App.globalGet(permission_id),
        Gtxn[3].sender() == Gtxn[1].asset_sender()
    )

    # transfer token from A -> B. Both A, B are non-reserve accounts
    transfer_token = Seq([
        Assert(And(
            Txn.application_args.length() == Int(1),
            App.globalGet(var_is_killed) == Int(0), # check token is not killed
            common_fields,
            group_tx_checks,
            all_transaction_checks
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
    # Verifies that first argument is "add_permission" and jumps to add_new_permission.
    # Verifies that first argument is "change_permissions_manager" and jumps to change_permissions_manager.
    # Verifies that first argument is "issue" and jumps to issue.
    # Verifies that first argument is "kill" and jumps to kill.
    # Verifies that first argument is "transfer" and jumps to transfer.
    program = Cond(
        [Txn.application_id() == Int(0), on_deployment],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))], # block update
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))], # block delete
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.application_args[0] == Bytes("add_permission"), add_new_permission],
        [Txn.application_args[0] == Bytes("change_permissions_manager"), change_permissions_manager],
        [Txn.application_args[0] == Bytes("issue"), issue_token],
        [Txn.application_args[0] == Bytes("kill"), kill_token],
        [Txn.application_args[0] == Bytes("transfer"), transfer_token]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application))
