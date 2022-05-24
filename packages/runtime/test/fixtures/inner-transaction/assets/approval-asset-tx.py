from pyteal import *

def approval_program():
    """
    A stateful app to test inner transactions (asset transfer + asset clawback)
    """

    # OptInTo ASA by contract (ID passed as first foreign asset)
    opt_in_to_asa = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0], # first foreign asset
                TxnField.asset_receiver: Global.current_application_address(),
                TxnField.asset_amount: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Transfer 1 ASA from Contract -> Sender (aka txn.accounts[0])
    # Transfer 2 ASA from Contract -> Txn.Accounts[1]
    # should reject if ASA not optedin
    transfer_asa = Seq([
        # txA
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0], # first foreign asset
                TxnField.asset_receiver: Txn.sender(),
                TxnField.asset_amount: Int(1),
            }
        ),
        InnerTxnBuilder.Submit(),

        # txB
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],
                TxnField.asset_receiver: Txn.accounts[1],
                TxnField.asset_amount: Int(2),
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # empties application's account's holding of ASA (as closeremto is passed)
    transfer_asa_with_close_rem_to = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],
                TxnField.asset_receiver: Txn.sender(),
                TxnField.asset_amount: Int(0),
                TxnField.asset_close_to: Txn.accounts[1]
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Clawback 2 ASA from txn.accounts[1] -> txn.accounts[2], where clawback == app account
    asa_clawback_from_txn1_to_txn2 = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],
                TxnField.asset_sender: Txn.accounts[1],
                TxnField.asset_receiver: Txn.accounts[2],
                TxnField.asset_amount: Int(2),
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Freeze ASA passed in Txn.Assets[0] for account Txn.Accounts[1]
    # (fails if app account !== freeze address)
    freeze_asa = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetFreeze,
                TxnField.freeze_asset: Txn.assets[0],
                TxnField.freeze_asset_account: Txn.accounts[1],
                TxnField.freeze_asset_frozen: Int(1), # freeze = true
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Unfreeze ASA passed in Txn.Assets[0] for account Txn.Accounts[1]
    # (fails if app account !== asset freeze address)
    unfreeze_asa = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetFreeze,
                TxnField.freeze_asset: Txn.assets[0],
                TxnField.freeze_asset_account: Txn.accounts[1],
                TxnField.freeze_asset_frozen: Int(0), # freeze = false
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Delete ASA passed in Txn.Assets[0]
    # (fails if app account !== asset manager address)
    delete_asa = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetConfig,
                TxnField.config_asset: Txn.assets[0]
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Modify ASA passed in Txn.Assets[0]
    # (fails if app account !== asset manager address). Updates:
    # manager, reserve = txn.accounts[1], txn.accounts[2]
    # freeze = sender
    # clawback = app account address
    modify_asa = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetConfig,
                TxnField.config_asset: Txn.assets[0],
                TxnField.config_asset_manager: Txn.accounts[1],
                TxnField.config_asset_reserve: Txn.accounts[2],
                TxnField.config_asset_freeze: Txn.sender(),
                TxnField.config_asset_clawback: Global.current_application_address(),
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    # Deploy ASA (by app account)
    # https://developer.algorand.org/articles/discover-avm-10/
    deploy_asa = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetConfig,
                TxnField.config_asset_name: Bytes('gold'),
                TxnField.config_asset_unit_name: Bytes('oz'),
                TxnField.config_asset_total: Int(10000000),
                TxnField.config_asset_decimals: Int(3),
                TxnField.config_asset_url: Bytes('https://gold.rush/'),
                TxnField.config_asset_manager: Global.current_application_address(),
                TxnField.config_asset_reserve: Global.current_application_address(),
                TxnField.config_asset_freeze: Global.current_application_address(),
                TxnField.config_asset_clawback: Global.current_application_address(),
            }
        ),
        InnerTxnBuilder.Submit(),
        # save newly created assetID
        App.globalPut(Bytes("created_asa_key"), InnerTxn.created_asset_id()),
        Return(Int(1))
    ])

    # Deploy ASA with app args (by app account)
    # https://developer.algorand.org/articles/discover-avm-10/
    deploy_asa_with_app_args = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetConfig,
                TxnField.config_asset_unit_name: Bytes("TEST"),
                TxnField.config_asset_name: Txn.application_args[1],
                TxnField.config_asset_total: Int(1),
                TxnField.config_asset_decimals: Int(0),
                TxnField.config_asset_metadata_hash: Bytes("12312442142141241244444411111133"),
                TxnField.config_asset_default_frozen: Int(1),
                TxnField.config_asset_url: Txn.application_args[2],
                TxnField.config_asset_manager: Global.current_application_address(),
                TxnField.config_asset_reserve: Txn.application_args[3],
                TxnField.config_asset_freeze: Txn.application_args[3],
                TxnField.config_asset_clawback: Txn.application_args[3],
            }
        ),
        InnerTxnBuilder.Submit(),
        # save newly created assetID
        App.globalPut(Bytes("created_asa_key"), InnerTxn.created_asset_id()),
        Return(Int(1))
    ])

    program = Cond(
        # Verfies that the application_id is 0, accepts it
        [Txn.application_id() == Int(0), Return(Int(1))],
        # Verifies Update or delete transaction, rejects it.
        [
            Or(
                Txn.on_completion() == OnComplete.UpdateApplication,
                Txn.on_completion() == OnComplete.DeleteApplication
            ),
            Return(Int(0))
        ],
        # Verifies closeout or OptIn transaction, approves it.
        [
            Or(
                Txn.on_completion() == OnComplete.CloseOut,
                Txn.on_completion() == OnComplete.OptIn
            ),
            Return(Int(1))
        ],
        [Txn.application_args[0] == Bytes("opt_in_to_asa"), opt_in_to_asa],
        [Txn.application_args[0] == Bytes("transfer_asa"), transfer_asa],
        [Txn.application_args[0] == Bytes("transfer_asa_with_close_rem_to"), transfer_asa_with_close_rem_to],
        [Txn.application_args[0] == Bytes("asa_clawback_from_txn1_to_txn2"), asa_clawback_from_txn1_to_txn2],
        [Txn.application_args[0] == Bytes("freeze_asa"), freeze_asa],
        [Txn.application_args[0] == Bytes("unfreeze_asa"), unfreeze_asa],
        [Txn.application_args[0] == Bytes("delete_asa"), delete_asa],
        [Txn.application_args[0] == Bytes("modify_asa"), modify_asa],
        [Txn.application_args[0] == Bytes("deploy_asa"), deploy_asa],
        [Txn.application_args[0] == Bytes("deploy_asa_with_app_args"), deploy_asa_with_app_args],
    )

    return program

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 5, optimize=optimize_options))