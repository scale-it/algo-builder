from pyteal import *


@Subroutine(TealType.none)
def call_logs():
    app_create, asset_create, proxy_action = Gtxn[0], Gtxn[1], Gtxn[2]
    validate_txns = And(
        # group size 
        Global.group_size() == Int(3),
        # first tx is application create tx
        app_create.type_enum() == TxnType.ApplicationCall,
        app_create.on_completion() == OnComplete.NoOp,
        app_create.application_id() == Int(0),
        app_create.close_remainder_to() == Global.zero_address(),
        # second tx is asset create tx
        asset_create.type_enum() == TxnType.AssetConfig,
        asset_create.xfer_asset() == Int(0),
        asset_create.close_remainder_to() == Global.zero_address(),
        # third tx is call proxy app tx
        proxy_action.type_enum() == TxnType.ApplicationCall,
        proxy_action.on_completion() == OnComplete.NoOp,
        proxy_action.application_id() == Global.current_application_id(),
        proxy_action.close_remainder_to() == Global.zero_address(),
    )

    # Compute the newly created app address from the app id
    created_appl_id = Itob(app_create.created_application_id())
    created_asset_id = Itob(asset_create.created_asset_id())

    return Seq(
        Assert(validate_txns),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.ApplicationCall,
                TxnField.application_id: app_create.created_application_id(),
                TxnField.application_args: [Bytes("logs"), created_appl_id, created_asset_id],
                TxnField.fee: Int(0),  # make caller pay
            }
        ),
        InnerTxnBuilder.Submit(),
        Log(InnerTxn.logs[0])
    )


def approval():
    handlers = [
        [
            Txn.application_args[0] == Bytes("call_logs"),
            Return(Seq(call_logs(), Int(1))),
        ]
    ]

    return Cond(
        [Txn.application_id() == Int(0), Approve()],
        [
            Txn.on_completion() == OnComplete.DeleteApplication,
            Return(Txn.sender() == Global.creator_address()),
        ],
        [
            Txn.on_completion() == OnComplete.UpdateApplication,
            Return(Txn.sender() == Global.creator_address()),
        ],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        *handlers,
    )


def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6)


if __name__ == "__main__":
    print(get_approval())
