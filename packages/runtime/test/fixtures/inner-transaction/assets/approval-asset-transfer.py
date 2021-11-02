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
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 5))