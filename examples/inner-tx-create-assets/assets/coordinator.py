"""
NOTE: This is  a demo contract, doesn't have security measures. Please don't use it in production

This smart contract does:

1. Creates an application, an asset and uses new application id and asset id after we create them
   by using group transaction.

2. Creates an application, an asset and uses new application id and asset id after we create them
   by using use inner transactions.

"""

from pyteal import *
from pytealutils.strings import itoa

@Subroutine(TealType.none)
def created_by_group_txn():
    """
        User send a group transaction which:
            - First transaction will create a new ASA transaction.
            - Second transaction will create a new application Transaction.
            - Third will `log` a new asset id and a new application id. 
    """
    app_create, asset_create, this_tx = Gtxn[0], Gtxn[1], Gtxn[2]
    validate_txns = And(
        # check that this tx is the third transaction
        Txn.group_index() == Int(2), 
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
        this_tx.type_enum() == TxnType.ApplicationCall,
        this_tx.on_completion() == OnComplete.NoOp,
        this_tx.application_id() == Global.current_application_id(),
        this_tx.close_remainder_to() == Global.zero_address(),
    )

    # Compute the newly created app address from the app id
    created_appl_id = Itob(app_create.created_application_id())
    created_asset_id = Itob(asset_create.created_asset_id())

    return Seq(
        Assert(validate_txns),
        Log(itoa(app_create.created_application_id())), # log new appl id
        Log(itoa(asset_create.created_asset_id())) # log new asset id
    ) 


Subroutine(TealType.none)
def created_by_inner_txns():
    """
        This method will: 
            1. Create new asset by used inner tx and log new asset id. 
            2. Create new application and log new application id.
    """
    return Seq(
        app_prog := AppParam.approvalProgram(Global.current_application_id()),
        clear_prog := AppParam.clearStateProgram(Global.current_application_id()),
        # create ASA
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_total: Int(1000000),
            TxnField.config_asset_decimals: Int(3),
            TxnField.config_asset_unit_name: Bytes("oz"),
            TxnField.config_asset_name: Bytes("Gold"),
            TxnField.config_asset_url: Bytes("https://gold.rush"),
            TxnField.config_asset_manager: Global.current_application_address(),
            TxnField.config_asset_reserve: Global.current_application_address(),
            TxnField.config_asset_freeze: Global.current_application_address(),
            TxnField.config_asset_clawback: Global.current_application_address()
        }),
        InnerTxnBuilder.Submit(),
        Log(itoa(InnerTxn.created_asset_id())),  # Log new asset id
        # create new application
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.ApplicationCall,
            TxnField.approval_program: app_prog.value(),
            TxnField.clear_state_program: clear_prog.value(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Log(itoa(InnerTxn.created_application_id())),  # Log new asset id

    )  


def approval():
    handlers = [
        [
            Txn.application_args[0] == Bytes("create_by_group_txn"),
            Return(Seq(created_by_group_txn(), Int(1))),
        ],
        [
            Txn.application_args[0] == Bytes("create_by_inner_txn"),
            Return(Seq(created_by_inner_txns(), Int(1))),
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

optimize_options = OptimizeOptions(scratch_slots=True)
def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6, optimize=optimize_options)


if __name__ == "__main__":
    print(get_approval())
