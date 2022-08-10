import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def c_p_lsig(ARG_P, ARG_NFT_APP_ID):
    """
    - has `p` hardcoded as a constant;
    - requires any transaction from `C_p` (this) to be in a group of transactions with an
    App call.
    """

    def basic_checks(txn: Txn): return And(
        txn.rekey_to() == Global.zero_address(),
        txn.close_remainder_to() == Global.zero_address(),
        txn.asset_close_to() == Global.zero_address()
    )

    # we take payment in this lsig only when paired with App call
    nft_creation = And(
        # verify first transaction (Payment)
        basic_checks(Gtxn[0]),
        Gtxn[0].type_enum() == TxnType.Payment,
        Gtxn[0].amount() == Int(10 ** 6), # 1 Algo

        # verify second transaction (OPT-IN)
        basic_checks(Gtxn[1]),
        Gtxn[1].type_enum() == TxnType.ApplicationCall,
        Gtxn[1].application_id() == Int(ARG_NFT_APP_ID),
        Btoi(Gtxn[1].application_args[0]) == Int(ARG_P),

        # verify third transaction (NFT creation)
        basic_checks(Gtxn[2]),
        Gtxn[2].type_enum() == TxnType.AssetConfig,
    )

    nft_transfer = And(
        basic_checks(Gtxn[0]),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[0].application_id() == Int(ARG_NFT_APP_ID),

        basic_checks(Gtxn[1]),
        Gtxn[1].type_enum() == TxnType.AssetTransfer
    )

    program = Cond(
        [Global.group_size() == Int(3), nft_creation],
        [Global.group_size() == Int(2), nft_transfer]
    )

    return program

if __name__ == "__main__":
    params = {
        "ARG_P": 133,
        "ARG_NFT_APP_ID": 99
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    optimize_options = OptimizeOptions(scratch_slots=True)
    print(compileTeal(c_p_lsig(params["ARG_P"], params["ARG_NFT_APP_ID"]), Mode.Signature, version = 4, optimize=optimize_options))
