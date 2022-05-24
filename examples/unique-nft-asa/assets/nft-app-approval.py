from pyteal import *

def approval_program():
    """
    A stateful app with governance rules. Stores
    deposit, min_support, min_duration, max_duration, url.

    Commands:
        handle_optin     Transfer Algo from creater, optin & deploy NFT
        handle_redeem    Noop call, transfers NFT from C_p --> creator
    """

    handle_optin = Seq([
        Assert(
            # Verify transaction structure
            # NOTE: basic checks are handled by stateless.py
            And(
                # tx0 (NOTE: anyone can make payment, doesn't necessarily have to be "creator")
                Gtxn[0].amount() == Int(10 ** 6), # 1 Algo

                # tx1 (ensure both senders are C_p)
                Gtxn[1].sender() == Gtxn[2].sender(),

                # tx2 (ensure that total supply is 1 and decimals are 0)
                Gtxn[2].config_asset_total() == Int(1),
                Gtxn[2].config_asset_decimals() == Int(0),
                Gtxn[2].sender() == Gtxn[0].receiver()
            )
        ),
        # set p, creator in C_p local state
        # NOTE: we don't check if app is already opted in, as
        # the stateless contract(C_p) doesn't allow opt-outs, and once C_p is optedin to app,
        # trying to opt-in again is rejected by the protocol
        App.localPut(Int(0), Bytes("p"), Btoi(Txn.application_args[0])),
        App.localPut(Int(0), Bytes("creator"), Gtxn[0].sender()),
        Return(Int(1))
    ])

    handle_redeem = Seq([
        Assert(
            # creator of NFT should receive the NFT
            App.localGet(Int(0), Bytes("creator")) == Gtxn[1].asset_receiver()
        ),
        App.localDel(Int(0), Bytes("creator")),
        Return(Int(1)),
    ])

    program = Cond(
        # Deployment
        [Txn.application_id() == Int(0), Return(Int(1))],
        # Verifies NoOp call, jumps to handle_redeem branch.
        [Txn.on_completion() == OnComplete.NoOp, handle_redeem],
        # Verifies opt-in call, jumps to handle_optin branch.
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        # Verifies Update or delete transaction, rejects it.
        [
            Or(
                Txn.on_completion() == OnComplete.UpdateApplication,
                Txn.on_completion() == OnComplete.DeleteApplication
            ),
            Return(Int(0))
        ],
    )

    return program

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 5, optimize=optimize_options))