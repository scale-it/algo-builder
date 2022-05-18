from pyteal import *

def approval_program():
    """
    A stateful smart contract which will store the bond parameters:
    issue price and coupon value, total amount.
    Additionally, the App will store a reference to the currently
    tradeable bond ASA and the current epoch number.
    """

    # Address of bond smart contract manager
    app_manager = Bytes("app_manager")
    # Price at which bonds are sold by the issuer.
    issue_price = Bytes("issue_price")
    # interest paid annually to the bond holders,
    # equals to `coupon_rate x nominal_price`.
    coupon_value = Bytes("coupon_value")
    issuer_address = Bytes("issuer_address")
    # Epoch is the current period for paying the coupon.
    # For example: When bond coupons are paid every 6 month,
    # then initially the epoch is 0. After 6 months epoch 1 starts and
    # bond holders can redeem their bonds to get a coupon payment
    # and receive a bond for the next epoch. We do it to prohibit double
    # spent of coupons.  a coupon for interest payment and start epoch 1.
    # After another 6 months bond holders epoch 2 starts and bond holders
    # can repeat the process.
    epoch = Bytes("epoch")
    # Total number of sold bond tokens
    total = Bytes("total")
    # Current bond token index
    current_bond = Bytes("current_bond")
    # Maximum amount of supply of bond token
    max_issuance = Bytes("max_issuance")
    # Bond token creator
    bond_token_creator = Bytes("bond_token_creator")

    # verify rekey_to and close_rem_to are not allowed (set to zero)
    basic_checks = And(
        # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
        # unless the contract is specifically involved in a rekeying operation.
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address()
    )

    # initialization
    # Expected arguments:
    # [app_manager, issue_price
    # coupon_value, current_bond, max_issuance, bond_token_creator]
    on_initialize = Seq([
        App.globalPut(app_manager, Txn.application_args[0]),
        App.globalPut(bond_token_creator, Txn.application_args[1]),
        App.globalPut(issue_price, Btoi(Txn.application_args[2])),
        App.globalPut(coupon_value, Btoi(Txn.application_args[3])),
        App.globalPut(current_bond, Btoi(Txn.application_args[4])),
        App.globalPut(max_issuance, Btoi(Txn.application_args[5])),
        App.globalPut(epoch, Int(0)),
        Return(Int(1))
    ])

    # Update issuer address in this contract
    # only app manager can update issuer.
    # Expected arguments: [Bytes("update_issuer_address"), issuer_address]
    update_issuer = Seq([
        # asserts if sender is store manager
        Assert(
             And(
                Txn.sender() == App.globalGet(app_manager),
                basic_checks
            )
        ),
        App.globalPut(issuer_address, Txn.application_args[1]),
        Return(Int(1))
    ])

    # Update issue price
    # only bond app manager can update issue price
    # expected arguments: [Bytes("update_issue_price"), new_issue_price]
    on_update_issue_price = Seq([
        # asserts if sender is store manager
        Assert(
             And(
                Txn.sender() == App.globalGet(app_manager),
                basic_checks
            )
        ),
        App.globalPut(issue_price, Txn.application_args[1]),
        Return(Int(1))
    ])

    # Issue new bond tokens to provide a supply to the issuer.
    # Expected arguments: [Bytes("issue")]
    on_issue = Seq([
        # assert sender is bond token creator and receiver is the issuer address
        Assert(
            And(
                Gtxn[0].type_enum() == TxnType.AssetTransfer,
                Gtxn[0].sender() == App.globalGet(bond_token_creator),
                Gtxn[0].asset_receiver() == App.globalGet(issuer_address),
                # verify current bond is being transferred
                Gtxn[0].xfer_asset() == App.globalGet(current_bond),
                basic_checks
            )
        ),
        Return(Int(1))
    ])

    # Buy bonds by paying the issue price in ALGO
    # Expected arguments: [Bytes("buy")]
    # 1. amount×BondApp.issue_price + algo_tx_price
    # - ALGO payment from buyer to the issuer. algo_tx_price is required to cover the TX2 cost.
    # 2. B_i ASA transfer from issuer to the buyer.
    on_buy = Seq([
        Assert(
            And(
                basic_checks,
                # verify tx0 is ALGO payment
                Gtxn[0].type_enum() == TxnType.Payment,
                # verify buying amount,
                Gtxn[0].amount() >= Mul(Gtxn[1].asset_amount(), App.globalGet(issue_price)),
                # verify that tx1 is ASA (bond) transfer to the buyer
                Gtxn[1].type_enum() == TxnType.AssetTransfer,
                # verify issuer is not paying fees
                Gtxn[1].fee() == Int(0),
                # verify current bond is being transferred
                Gtxn[1].xfer_asset() == App.globalGet(current_bond),
                Gtxn[1].asset_receiver() == Gtxn[0].sender()
            )
        ),
        App.globalPut(total, Add(App.globalGet(total), Gtxn[1].asset_amount())),
        Return(Int(1))
    ])

    # Create buyback address transaction
    # Expected arguments: [Bytes("set_buyback"), buyback address]
    set_buyback = Seq([
        # asserts if sender is store manager
        Assert(
            And(
                Txn.sender() == App.globalGet(app_manager),
                basic_checks
            )
        ),
        # set buyback address
        App.globalPut(Bytes("buyback"), Txn.application_args[1]),
        Return(Int(1))
    ])

    # exit transaction
    # Expected arguments: [Bytes("exit")]
    on_exit = Seq([
        Assert(
            And(
                basic_checks,
                # verify tx0 is a bond ASA transfer.
                Gtxn[0].type_enum() == TxnType.AssetTransfer,
                Gtxn[0].xfer_asset() == App.globalGet(current_bond),
                # verify tx1 is ALGO payment from buyback to the bond sender (from tx0)
                Gtxn[1].type_enum() == TxnType.Payment,
                Gtxn[1].sender() == App.globalGet(Bytes("buyback")),
                Gtxn[1].receiver() == Gtxn[0].sender(),
                # verify buyback address is not paying fees
                Gtxn[1].fee() == Int(0),
                Gtxn[1].amount() == Mul(Gtxn[0].asset_amount(), Tmpl.Int("TMPL_NOMINAL_PRICE")),
                # verify maturity date is passed
                Global.latest_timestamp() > Tmpl.Int("TMPL_MATURITY_DATE")
            )
        ),
        Return(Int(1))
    ])

    # Redeem transaction
    # Expected arguments: [Bytes("redeem_coupon")]
    on_redeem_coupon = Seq([
        Assert(
            And(
                basic_checks,
                # User sends `B_i` to `DEX_i` lsig.
                Gtxn[0].type_enum() == TxnType.AssetTransfer,
                Gtxn[0].asset_amount() == Gtxn[1].asset_amount(),
                # `DEX_i` sends `B_{i+1}` to the user.
                Gtxn[1].type_enum() == TxnType.AssetTransfer,
                # verify 'DEX_I' is not paying fees
                Gtxn[1].fee() == Int(0),
                # `Dex_i` sends coupon value to user
                Gtxn[2].type_enum() == TxnType.Payment,
                Gtxn[2].receiver() == Gtxn[0].sender(),
                # verify 'DEX_i' is not paying fees
                Gtxn[2].fee() == Int(0),
                # verify coupon amount
                Gtxn[2].amount() == Mul(Gtxn[0].asset_amount(), App.globalGet(coupon_value))
            )
        ),
        Return(Int(1))
    ])

    # fetch asset_holding.balance from Txn.accounts[0] (Issuer address)
    asset_balance = AssetHolding.balance(Int(1), Gtxn[2].xfer_asset())

    # Create dex transaction
    # Expected arguments: [Bytes("create_dex")]
    on_create_dex = Seq([
        asset_balance, # load asset_balance from store
        Assert(
            And(
                basic_checks,
                Txn.sender() == App.globalGet(app_manager),
                # Transaction type for first transaction has been checked in lsig
                # transfer `balanceOf(issuer, B_i)`  of `B_{i+1}` tokens from the bond_token_creator to the `issuer`.
                # index 1 of Txn.accounts().
                asset_balance.value() == Gtxn[1].asset_amount(),
                # burn `B_i` issuer bonds: send to the bond_token_creator
                Gtxn[2].type_enum() == TxnType.AssetTransfer,
                Gtxn[2].asset_receiver() == App.globalGet(bond_token_creator),
                asset_balance.value() == Gtxn[2].asset_amount(),
                Gtxn[3].sender() == App.globalGet(bond_token_creator),
                Gtxn[3].asset_amount() == App.globalGet(total),
                Gtxn[3].asset_receiver() == Txn.accounts[2],
                Gtxn[4].sender() == App.globalGet(bond_token_creator),
                Gtxn[4].amount() == Mul(App.globalGet(total), App.globalGet(coupon_value)),
                Gtxn[4].receiver() == Txn.accounts[2]
            ),
        ),
        # Increment `BondApp.epoch`
        App.globalPut(epoch, Add(App.globalGet(epoch), Int(1))),
        # set `BondApp.current_bond = B_{i+1}`.
        App.globalPut(current_bond, Gtxn[1].xfer_asset()),
        Return(Int(1))
    ])

    current_bond_balance_in_buyback = AssetHolding.balance(
        App.globalGet(Bytes("buyback")), App.globalGet(current_bond)
    )

    # Only delete if:
    # + maturity date is passed
    # + buyback holds all "current_bond" tokens
    on_delete = Seq([
        current_bond_balance_in_buyback, # load balance from store
        Assert(
            And(
                basic_checks,
                current_bond_balance_in_buyback.value() >= App.globalGet(total),
                # verify maturity date is passed
                Global.latest_timestamp() > Tmpl.Int("TMPL_MATURITY_DATE")
            ),
        ),
        Return(Int(1))
    ])

    program = Cond(
        # Verfies that the application_id is 0, jumps to on_initialize.
        [Txn.application_id() == Int(0), on_initialize],
        # Verifies Update transaction, rejects it.
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))],
        # Verifies delete transaction, rejects it.
        [Txn.on_completion() == OnComplete.DeleteApplication, on_delete],
        # Verifies closeout transaction, approves it.
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        # Verifies opt-in transaction, approves it.
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
        # Verifies update issuer address transaction, jumps to update_issuer branch.
        [Txn.application_args[0] == Bytes("update_issuer_address"), update_issuer],
        # Verifies update issue, jumps to on_issue branch.
        [Txn.application_args[0] == Bytes("issue"), on_issue],
        # Verifies buy transaction, jumps to on_buy branch.
        [Txn.application_args[0] == Bytes("buy"), on_buy],
        # Verifies create buyback transaction, jumps to set_buyback branch.
        [Txn.application_args[0] == Bytes("set_buyback"), set_buyback],
        # Verifies exit transaction, jumps to on_exit branch.
        [Txn.application_args[0] == Bytes("exit"), on_exit],
        # Verifies redeem coupon transaction, jumps to on_redeem_coupon branch.
        [Txn.application_args[0] == Bytes("redeem_coupon"), on_redeem_coupon],
        # Verifies update issue price transaction, jumps to on_update_issue_price branch.
        [Txn.application_args[0] == Bytes("update_issue_price"), on_update_issue_price],
        # Verifies create dex transaction, jumps to on_create_dex branch.
        [Txn.application_args[0] == Bytes("create_dex"), on_create_dex],
    )

    return program

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 5, optimize=optimize_options))
