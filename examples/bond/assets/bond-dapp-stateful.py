from pyteal import *

def approval_program():
    """
    A stateful smart contract which will store the bond parameters:
    issue price, nominal price, maturity date and coupon date.
    Additionally, the App will store a reference to the currently
    tradeable bond ASA and the current epoch number.
    """

    store_manager = Bytes("store_manager")
    issue_price = Bytes("issue_price")
    nominal_price = Bytes("nominal_price")
    maturity_date = Bytes("maturity_date")
    coupon_value = Bytes("coupon_value")
    issuer_address = Bytes("issuer_address")
    epoch = Bytes("epoch")
    total = Bytes("total")
    current_bond = Bytes("current_bond")

    # verify rekey_to and close_rem_to are set as zero_address
    basic_checks = And(
        # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
        # unless the contract is specifically involved ina rekeying operation.
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address()
    )

    on_initialize = Seq([
        App.globalPut(store_manager, Txn.application_args[0]),
        App.globalPut(issue_price, Txn.application_args[1]),
        App.globalPut(nominal_price, Txn.application_args[2]),
        App.globalPut(maturity_date, Txn.application_args[3]),
        App.globalPut(coupon_value, Txn.application_args[4]),
        App.globalPut(epoch, Txn.application_args[5]),
        App.globalPut(current_bond, Txn.application_args[6]),
        Return(Int(1))
    ])

    update_issuer = Seq([
        Assert(
            Txn.sender() == App.globalGet(store_manager),
            basic_checks
        ),
        App.globalPut(issuer_address, Txn.application_args[1]),
        Return(Int(1))
    ])

    on_issue = And(
        Gtxn[0].type_enum() == TxnType.AssetTransfer,
        Gtxn[0].receiver() == App.globalGet(issuer_address),
        Gtxn[0].application_id == App.globalGet(current_bond),
        basic_checks
    )

    on_buy = Seq([
        And(

        )
    ])

program = Cond(
        [Txn.application_id() == Int(0), on_initialize],
        [Txn.on_completion() == OnComplete.UpdateApplication, handle_update],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.CloseOut, handle_closeout],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.application_args[0] == Bytes("update_issuer_address"), update_issuer],
        [Txn.application_args[0] == Bytes("issue"), on_issue],
        [Txn.application_args[0] == Bytes("buy"), on_buy]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version=3))