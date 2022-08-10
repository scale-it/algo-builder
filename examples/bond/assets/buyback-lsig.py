from pyteal import *

def buyback_lsig():
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

    # verify that buyer deposits required algos(Not we are checking this in stateful contract)
    # Here we are verifying if the call is made to bond-dapp stateful contract
    verify_exit = And(
        # verify TMPL_BOND is being transferred
        Gtxn[0].type_enum() == TxnType.AssetTransfer,
        Gtxn[0].xfer_asset() == Tmpl.Int("TMPL_BOND"),
        Gtxn[1].type_enum() == TxnType.Payment,
        # verify call to bond-dapp
        Gtxn[2].type_enum() == TxnType.ApplicationCall,
        Gtxn[2].application_id() == Tmpl.Int("TMPL_APPLICATION_ID"),
        # verify first argument is `exit`
        Gtxn[2].application_args[0] == Bytes("exit"),
        common_fields
    )

    # Opt-in transaction
    # Note: we are checking that first transaction is payment with amount 0
    # and sent by store manager, because we don't want another
    # user to opt-in too many asa/app and block this address
    opt_in = And(
        Gtxn[0].type_enum() == TxnType.Payment,
        Gtxn[0].amount() == Int(0),
        Gtxn[0].sender() == Tmpl.Addr("TMPL_APP_MANAGER"),
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].asset_amount() == Int(0)
    )

    program = Cond(
        [Global.group_size() == Int(3), verify_exit],
        [Global.group_size() == Int(2), opt_in],
    )

    return program

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(buyback_lsig(), Mode.Signature, version = 5, optimize=optimize_options))