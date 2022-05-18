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

    # Buy transaction.
    verify_purchase = And(
        # verify first transaction is payment
        Gtxn[0].type_enum() == TxnType.Payment,
        # verify bond-dapp contract is called
        Gtxn[2].type_enum() == TxnType.ApplicationCall,
        Gtxn[2].application_id() == Tmpl.Int("TMPL_APPLICATION_ID"),
        # verify first argument is `buy`
        Gtxn[2].application_args[0] == Bytes("buy"),
        common_fields
    )

    # Burn token transaction when creating a dex.
    # tx0: app call: "create_dex"
    # tx1: sending new bonds to the issuer
    # tx2: burn old tokens
    burn_tx = And(
        # verify bond-dapp is called
        Gtxn[0].application_id() == Tmpl.Int("TMPL_APPLICATION_ID"),
        Gtxn[0].application_args[0] == Bytes("create_dex"),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[2].type_enum() == TxnType.AssetTransfer,
    )

    # verify owner can take out algos from this account
    payout = And(
        Txn.type_enum() == TxnType.Payment,
        Txn.receiver() == Tmpl.Addr("TMPL_OWNER")
    )

    # Opt-in transaction
    # Note: we are checking that first transaction is payment with amount 0
    # and sent by store manager, because we don't want another
    # user to opt-in too many asa/app and block this address
    opt_in = And(
        # verify first transaction is payment
        Gtxn[0].type_enum() == TxnType.Payment,
        Gtxn[0].amount() == Int(0),
        Gtxn[0].sender() == Tmpl.Addr("TMPL_APP_MANAGER"),
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].asset_amount() == Int(0)
    )

    # issue transaction
    issue_tx = And(
        Gtxn[0].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].application_id() == Tmpl.Int("TMPL_APPLICATION_ID")
    )

    # Verify opt-in or issue transaction
    opt_in_or_issue = Or(opt_in, issue_tx)

    program = Cond(
        [Global.group_size() == Int(3), verify_purchase],
        [Global.group_size() == Int(5), burn_tx],
        [Global.group_size() == Int(2), opt_in_or_issue],
        [Global.group_size() == Int(1), payout],
    )

    return program

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(issuer_lsig(), Mode.Signature, version = 5, optimize=optimize_options))
