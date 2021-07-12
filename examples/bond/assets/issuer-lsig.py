from pyteal import *

def issuer_lsig():
    # check no rekeying, close remainder to, asset close to
    common_fields = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address(),
        Gtxn[2].rekey_to() == Global.zero_address(),
        Gtxn[0].close_remainder_to() == Global.zero_address(),
        Gtxn[1].close_remainder_to() == Global.zero_address(),
        Gtxn[2].close_remainder_to() == Global.zero_address(),
        Gtxn[1].asset_close_to() == Global.zero_address(),
    )

    # verify that buyer deposits required algos 
    verify_tx = And(
        Gtxn[0].type_enum() == TxnType.Payment,
        Gtxn[2].application_id() == Tmpl.Int("TMPL_APPLICATION_ID"),
        Gtxn[2].application_args[0] == Bytes("buy"),
        common_fields
    )

    # burn tx
    burn_tx = And(
        Gtxn[2].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[0].application_id() == Tmpl.Int("TMPL_APPLICATION_ID")
    )

    # verify owner can take out algos from this account
    payout = And(
        Txn.type_enum() == TxnType.Payment,
        Txn.receiver() == Tmpl.Addr("TMPL_OWNER")
    )

    # allow opt-in transaction
    opt_in = And(
        Txn.type_enum() == TxnType.AssetTransfer,
        Txn.asset_amount() == Int(0)
    )

    combine = Or(payout, opt_in)

    transactions = Cond(
        [Gtxn[0].type_enum() == TxnType.Payment, verify_tx],
        [Gtxn[1].type_enum() == TxnType.AssetTransfer, burn_tx]
    )

    program = Cond(
        [Global.group_size() == Int(3), transactions],
        [Global.group_size() == Int(1), combine],
    )

    return program

if __name__ == "__main__":
    print(compileTeal(issuer_lsig(), Mode.Signature))