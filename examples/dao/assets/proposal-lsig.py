import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def proposal_lsig(ARG_OWNER):
    """
    Represents Proposal Lsig (a contract account owned by the proposer)
    """

    # check no rekeying and ensure sender is owner
    def basic_owner_checks(txn: Txn): return And(
        txn.rekey_to() == Global.zero_address(),

        # only owner can close ASA/ALGO
        txn.sender() == Addr(ARG_OWNER)
    )

    def basic_checks(txn: Txn): return And(
        txn.rekey_to() == Global.zero_address(),
        txn.close_remainder_to() == Global.zero_address(),
        txn.asset_close_to() == Global.zero_address()
    )

    # Opt-in transaction.
    opt_in = And(
        basic_checks(Txn),
        Txn.type_enum() == TxnType.AssetTransfer,
        Txn.asset_amount() == Int(0),
        Txn.sender() == Addr(ARG_OWNER)
    )

    # Only owner can withdraw ASA/ALGO
    withdraw = And(
        basic_owner_checks(Txn),
        Or(
            Txn.type_enum() == TxnType.AssetTransfer,
            Txn.type_enum() == TxnType.Payment
        )
    )

    deposit = basic_checks(Txn)

    program = Or(opt_in, withdraw, deposit)
    return program

if __name__ == "__main__":
    params = {
        "ARG_OWNER": "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY"
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(proposal_lsig(params["ARG_OWNER"]), Mode.Signature, version = 4))