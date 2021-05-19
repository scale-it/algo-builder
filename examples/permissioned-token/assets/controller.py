import sys
sys.path.insert(0,'..')

from algobpy.parse import parseArgs
from pyteal import *

def approval_program(TOKEN_ID):
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
    permission_id = Bytes("perm_app") # permissions smart contract application index

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved in a rekeying operation.
    no_rekey_addr = Txn.rekey_to() == Global.zero_address()

    # retreive asset manager from Txn.ForeignAssets[0]
    assetManager = AssetParam.manager(Int(0))

    # Handles Controller SSC deployment. Only accepted if sender is asset manager.
    # Must be called with the TOKEN_ID asset.
    on_deployment = Seq([
        assetManager, # load asset manager from store
        Assert(And(
            no_rekey_addr,

            # Txn.assets.length() == Int(1), [TEALv3]
            # Txn.assets[0] == Int(TOKEN_ID), [TEALv3]

            # Controller should be deployed by ASA.manager
            Txn.sender() == assetManager.value()
        )),

        # set kill_status to false(0) during deploy
        App.globalPut(var_is_killed, Int(0)),
        Return(Int(1))
    ])

    # retreive asset reserve address from Txn.ForeignAssets[0]
    assetReserve = AssetParam.reserve(Int(0))

    # Issues/mint new token. Only accepted if sender is the asset reserve.
    issue_token = Seq([
        assetReserve,
        Assert(And(
            # Issue should only be done by token reserve
            # NOTE: if we want to limit this call only to TOKEN_ID, then we need to check:
            # Txn.assets[0] == Int(TOKEN_ID)
            Txn.sender() == assetReserve.value(),
            Gtxn[1].asset_sender() == assetReserve.value(),

            # only allow issue if token is not killed
            App.globalGet(var_is_killed) == Int(0)
        )),
        Return(Int(1))
    ])

    # Kills the token (updates global state). Only accepted if sender is asset manager.
    kill_token = Seq([
        assetManager, # load asset_manager (from Store) of Txn.ForeignAssets[0]
        Assert(And(
            # Txn.assets.length() == Int(1), [TEALv3],
            # Txn.assets[0] == Int(TOKEN_ID), [TEALv3] # verify if token index is correct
            Txn.type_enum() == TxnType.ApplicationCall,

            # Only asset manager can kill the token
            Txn.sender() == assetManager.value(),
        )),

        # finally set is_killed to true
        App.globalPut(var_is_killed, Int(1)),
        Return(Int(1))
    ])

    # Sets a permissions contract to the controller. Only accepted if sender is asset manager.
    # Expects 2 arguments:
    # * str 'add_permission' : name of the branch
    # * permission_id : permissions smart contract application index
    # NOTE: token_id is passed in txn.ForeignAssets (to load it's asset manager)
    set_permission_contract = Seq([
        assetManager, # load asset_manager (from Store) of Txn.ForeignAssets[0]
        Assert(And(
            Txn.application_args.length() == Int(2),
            # Txn.assets.length() == Int(1), [TEALv3]
            # Txn.assets[0] == Int(TOKEN_ID), [TEALv3]

            Txn.sender() == assetManager.value(),
        )),

        # Add permissions(rules) smart contract app_id in global state
        App.globalPut(permission_id, Btoi(Txn.application_args[1])),
        Return(Int(1))
    ])

    # Check basic tx (call to controller, clawback tx)
    verify_basic_calls = And(
        # verify first transaction
        # call to controller smart contract - signed by asset sender
        Txn.group_index() == Int(0), # this tx (call to controller) should be 1st in group

        # verify 2nd tx
        Gtxn[1].type_enum() == TxnType.AssetTransfer, # this should be clawback call (to transfer asset)
        Gtxn[1].xfer_asset() == Int(TOKEN_ID), # verify asset_id of the asset transfer(clawback) txn
    )

    # Check permissions smart contract is called and it's application index is correct
    verify_perm_is_called = And(
        # verify rules call (ensure permissions smart contract is being called in 4th tx)
        Gtxn[3].type_enum() == TxnType.ApplicationCall,
        Gtxn[3].application_id() == App.globalGet(permission_id),
    )

    # Transfer token from accA -> accB. Both A, B are non-reserve accounts.
    # Only accepted if token is not killed.
    # NOTE: We only ensure that the asset_sender also calls the controller(this) smart contract.
    # For payment txn (paying fees of escrow) and call to the permissions smart contract,
    # they can be signed by any account - we just ensure that they are present in group.
    transfer_token = Seq([
        Assert(And(
            App.globalGet(var_is_killed) == Int(0), # check token is not killed

            # verify caller of controller is also the asset sender
            Txn.sender() == Gtxn[1].asset_sender(),

            # Ensure atleast 3 basic calls, and verify rule(s) smart contract is called
            Global.group_size() >= Int(3),
            verify_basic_calls,
            verify_perm_is_called,
        )),
        Return(Int(1))
    ])

    # Force transfer (clawback) some tokens between two accounts.
    # Only accepted if token is not killed and sender is asset manager.
    # NOTE: If the asset_receiver is the reserve address (current one, or the new one being set
    # in the asset config txn in group while updating reserve), then we don't need to verify
    # permissions is called - it can bypass rule(s) checks.
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
                    If(Global.group_size() > Int(3), Gtxn[1].asset_receiver() == Gtxn[3].config_asset_reserve(), Int(0))
                ),
                Int(1),
                # else verify that permissions ssc is called
                verify_perm_is_called
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
    # Verifies that first argument is "set_permission" and jumps to set_permission_contract.
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
        [Txn.application_args[0] == Bytes("set_permission"), set_permission_contract],
        [Txn.application_args[0] == Bytes("issue"), issue_token],
        [Txn.application_args[0] == Bytes("kill"), kill_token],
        [Txn.application_args[0] == Bytes("transfer"), transfer_token],
        [Txn.application_args[0] == Bytes("force_transfer"), force_transfer]
    )

    return program

if __name__ == "__main__":
    params = {
        "TOKEN_ID": 11,
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(approval_program(params["TOKEN_ID"]), Mode.Application))
