import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def dao_fund_lsig(ARG_DAO_APP_ID):
    """
    Represents DAO treasury (ALGO/ASA)
    """

    # check no rekeying, close remainder to, asset close to for a txn
    def basic_checks(txn: Txn): return And(
        txn.rekey_to() == Global.zero_address(),
        txn.close_remainder_to() == Global.zero_address(),
        txn.asset_close_to() == Global.zero_address(),
    )

    # verify funds are transfered only when paired with DAO app (during execute call)
    payment = And(
        # verify first transaction
        basic_checks(Gtxn[0]),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[0].application_id() == Int(ARG_DAO_APP_ID),
        Gtxn[0].application_args[0] == Bytes("execute"),
        # verify second transaction (either payment in asa or ALGO)
        basic_checks(Gtxn[1]),
        Or(
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[1].type_enum() == TxnType.Payment,
        ),
        Gtxn[1].fee() == Int(0)
    )

    # Opt-in transaction is allowed
    opt_in = And(
        basic_checks(Txn),
        Txn.type_enum() == TxnType.AssetTransfer,
        Txn.asset_amount() == Int(0),
        Txn.fee() <= Int(2000)
    )

    program = program = Cond(
        [Global.group_size() == Int(1), opt_in],
        [Global.group_size() == Int(2), payment]
    )

    return program

if __name__ == "__main__":
    params = {
        "ARG_DAO_APP_ID": 99
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    optimize_options = OptimizeOptions(scratch_slots=True)
    print(compileTeal(dao_fund_lsig(params["ARG_DAO_APP_ID"]), Mode.Signature, version = 6, optimize=optimize_options))