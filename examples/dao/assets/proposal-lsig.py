import sys

sys.path.insert(0, "..")

from algobpy.parse import parse_params
from pyteal import *


def proposal_lsig(ARG_OWNER, ARG_DAO_APP_ID):
    """
    Represents Proposal Lsig (a contract account owned by the proposer)
    """

    # check no rekeying and ensure sender is owner
    def basic_owner_checks(txn: Txn): return And(
        txn.rekey_to() == Global.zero_address(),

        # only owner can close ASA/ALGO
        Or(
            txn.asset_receiver() == Addr(ARG_OWNER),
            txn.receiver() == Addr(ARG_OWNER)
        )
    )

    def basic_checks(txn: Txn):
        return And(
            txn.rekey_to() == Global.zero_address(),
            txn.close_remainder_to() == Global.zero_address(),
            txn.asset_close_to() == Global.zero_address(),
        )

    # Opt-in transaction
    # Note: we are checking that first transaction is payment with amount 0
    # and sent by proposer account, because we don't want another
    # user to opt-in too many asa/app and block this address
    opt_in = And(
        basic_checks(Gtxn[0]),
        basic_checks(Gtxn[1]),
        Gtxn[0].type_enum() == TxnType.Payment,
        Gtxn[0].amount() == Int(0),
        Gtxn[0].sender() == Addr(ARG_OWNER),
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].asset_amount() == Int(0),
    )

    # Allow app call to DAO (eg. OptInToApp, add_proposal, etc)
    allow_app_call = And(
        Global.group_size() <= Int(2),
        basic_checks(Gtxn[0]),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[0].application_id() == Int(ARG_DAO_APP_ID),
    )

    # Only owner can withdraw ASA/ALGO
    withdraw = And(
        basic_owner_checks(Txn),
        Or(
            # ASA or Algo transfer
            Txn.type_enum() == TxnType.AssetTransfer,
            Txn.type_enum() == TxnType.Payment,
        ),
    )

    # we accept transfer from this lsig only when paired with App call
    deposit = And(
        # verify first transaction
        basic_checks(Gtxn[0]),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[0].application_id() == Int(ARG_DAO_APP_ID),
        # assert the second transaction is ASA transfer (deposit)
        basic_checks(Gtxn[1]),
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
    )

    program = Cond(
        [Global.group_size() == Int(1), Or(allow_app_call, withdraw)],
        [Global.group_size() == Int(2), Or(allow_app_call, opt_in, deposit)],
    )

    return program


if __name__ == "__main__":
    params = {
        "ARG_OWNER": "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
        "ARG_DAO_APP_ID": 99,
    }

    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parse_params(sys.argv[1], params)

    optimize_options = OptimizeOptions(scratch_slots=True)
    print(
        compileTeal(
            proposal_lsig(params["ARG_OWNER"], params["ARG_DAO_APP_ID"]),
            Mode.Signature,
            version=5,
            optimize=optimize_options,
        )
    )
