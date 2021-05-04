from pyteal import *

def approval_program():
    """
    This smart contract acts as a controller of the token. It
    ensures that the permissions smart contract (which defines transfer rules)
    is called with each token transfer transaction between non-reserve accounts.
    Controller application id is part of the clawback logic sig (template parameter),
    to ensure there is a call to controller during a token-transfer.
    We separate the Controller smart contract from clawback to be able to update
    the permissions smart contract (or add a new one) without changing the clawback.
    It also handles kill_status of the token. If token is killed then no token transfers
    are allowed. User can only optOut of the asset.
    """

    var_is_killed = Bytes("killed")
    var_total = Bytes("total_rules")
    token_id = Bytes("token_id")
    permissions_manager = Bytes("manager")	# permissions manager (asa.manager by default)
    permission_id = Bytes("perm_app") # permissions smart contract application index

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved in a rekeying operation.
    no_rekey_addr = Txn.rekey_to() == Global.zero_address()

    # retreive asset manager from Txn.ForeignAssets[0]
    assetManager = AssetParam.manager(Int(0))

    """
    Handles Controller SSC deployment. Expects 1 argument:
    * token_id : token index (passed via txn.application_args)
    NOTE: token_id is also passed in txn.ForeignAssets (to load it's asset manager)
    """
    on_deployment = Seq([
        assetManager, # load asset manager from store
    	Assert(And(
    		Txn.application_args.length() == Int(1),
    		# Txn.assets.length() == Int(1), [TEALv3]
    		no_rekey_addr,

           	# Controller should be deployed by ASA.manager
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

    """
    Issues/mint new token. Only accepted if sender is the asset reserve.
    """
    issue_token = Seq([
        assetReserve,
        Assert(And(
    		# Issue should only be done by token reserve
    		Gtxn[0].sender() == assetReserve.value(),
    		Gtxn[1].asset_sender() == assetReserve.value(),

    		# only allow issue if token is not killed
    		App.globalGet(var_is_killed) == Int(0)
        )),
        Return(Int(1))
    ])

    """
    Kills the token (updates global state). Only accepted if sender is asset manager.
    """
    kill_token = Seq([
        assetManager, # load asset_manager (from Store) of Txn.ForeignAssets[0]
        Assert(And(
    		# Txn.assets.length() == Int(1), [TEALv3],
    		# Txn.assets[0] == App.globalGet(token_id), [TEALv3] # verify if token index is correct
    		Txn.type_enum() == TxnType.ApplicationCall,

    		# Only asset manager can kill the token
    		Txn.sender() == assetManager.value(),
        )),

        # finally set is_killed to true
        App.globalPut(var_is_killed, Int(1)),
        Return(Int(1))
    ])

    """
    Adds a new permissions contract to the controller. Only accepted if sender is asset manager.
    Expects 3 arguments:
    * add_permission : name of the branch
    * permission_id : permissions smart contract application index
    * permissions_manager : premissions manager address
    NOTE: token_id is also passed in txn.ForeignAssets (to load it's asset manager)
    """
    add_new_permission = Seq([
        assetManager, # load asset_manager (from Store) of Txn.ForeignAssets[0]
        Assert(And(
    		Txn.application_args.length() == Int(3),
            # Txn.assets.length() == Int(1), [TEALv3]
    		# Txn.assets[0] == App.globalGet(token_id), [TEALv3]

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

    """
    Change permissions manager of permissions ssc. Only accepted if sender is asset manager.
    Expects 1 argument in Txn.accounts[n] array:
    * addr : address of the new permissions manager
    """
    change_permissions_manager = Seq([
        assetManager,
        Assert(And(
    		Txn.application_args.length() == Int(1),
    		# Txn.assets[0] == App.globalGet(token_id), [TEALv3]

    		Txn.sender() == assetManager.value(),
        )),

        # update permissions manager address to the first account address passed in appAccounts
        App.globalPut(permissions_manager, Txn.accounts[1]),
        Return(Int(1))
    ])

    # Check basic tx (call to controller, clawback tx)
    verify_basic_calls = And(
        # verify first transaction
        # call to controller smart contract - signed by asset sender
        Txn.group_index() == Int(0), # this tx (call to controller) should be 1st in group
        Gtxn[0].application_id() == Global.current_application_id(),

        # verify 2nd tx
        Gtxn[1].type_enum() == TxnType.AssetTransfer, # this should be clawback call (to transfer asset)
        Gtxn[1].xfer_asset() == App.globalGet(token_id), # check asset_id passed through params
    )

    # Check permissions smart contract is called and it's application index is correct
    verify_perm_call = And(
        # verify rules call (ensure permissions smart contract is being called in 4th tx)
        Gtxn[3].type_enum() == TxnType.ApplicationCall,
        Gtxn[3].application_id() == App.globalGet(permission_id),
    )

    # verifies that asset sender in 2nd tx
    # - calls the controller smart contract
    # - is also the sender of the payment tx (to pay fees of clawback escrow)
    # - calls the permissions smart contract (ensures rules check)
    verify_sender = And(
        Gtxn[0].sender() == Gtxn[2].sender(),
        Gtxn[0].sender() == Gtxn[1].asset_sender(),
        Gtxn[3].sender() == Gtxn[1].asset_sender()
    )

    """
    Transfer token from accA -> accB. Both A, B are non-reserve accounts.
    Only accepted if token is not killed.
    """
    transfer_token = Seq([
        Assert(And(
            App.globalGet(var_is_killed) == Int(0), # check token is not killed

            # Ensure 3 basic calls + 1 rules contract call is present in group
            Global.group_size() == Add(Int(3), App.globalGet(var_total)),
            verify_basic_calls,
            verify_perm_call,
            verify_sender
        )),
        Return(Int(1))
    ])

    """
    Force transfer (clawback) some tokens between two accounts.
    Only accepted if token is not killed and sender is asset manager.
    """
    force_transfer = Seq([
        assetManager,
        assetReserve,
        Assert(And(
            App.globalGet(var_is_killed) == Int(0), # check token is not killed

            verify_basic_calls,
            Txn.sender() == assetManager.value(), # force_transfer is only allowed by asset manager
        )),
        Return(
            If(
                Or(
                    # If the receiver is the reserve address - old, or the new one being updated in the assset config tx (Gtxn[3]),
                    # then it can bypass permission checks
                    Gtxn[1].asset_receiver() == assetReserve.value(),
                    Gtxn[1].asset_receiver() == Gtxn[3].config_asset_reserve()
                ),
                Int(1),
                And (
                    # else permissions ssc should be called by asset manager
                    verify_perm_call,
                    Gtxn[3].sender() == assetManager.value()
                )
            )
        )
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
    # Verifies that first argument is "force_transfer" and jumps to force_transfer.
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
        [Txn.application_args[0] == Bytes("transfer"), transfer_token],
        [Txn.application_args[0] == Bytes("force_transfer"), force_transfer]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application))