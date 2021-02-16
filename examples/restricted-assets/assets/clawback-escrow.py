# Escrow Clawback Example in pyTeal

# Add parent directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'..')

from algobpy.parse import parseArgs
from pyteal import *

# source: https://github.com/algorand/smart-contracts/blob/master/devrel/poi/clawback-escrow.teal
def clawback_escrow(ASSET_ID, APP_ID):

	# check properties of txGroup passed
    group_tx_checks = And(
        Global.group_size() == Int(3),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[2].type_enum() == TxnType.Payment,
        # this tx should be 2nd in group
        Txn.group_index() == Int(1)
    )

	# check no rekeying etc
    common_fields = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address(),
        Gtxn[2].rekey_to() == Global.zero_address(),
        Gtxn[0].close_remainder_to() == Global.zero_address(),
        Gtxn[1].close_remainder_to() == Global.zero_address(),
        Gtxn[2].close_remainder_to() == Global.zero_address(),
        Gtxn[0].asset_close_to() == Global.zero_address(),
        Gtxn[1].asset_close_to() == Global.zero_address(),
        Gtxn[2].asset_close_to() == Global.zero_address()
    )

    # verify first transaction
    # check level smart contract call - signed by asset sender
    first_transaction_checks = And(
        # check app_id passed through params
        Gtxn[0].application_id() == Int(APP_ID),
        Gtxn[0].sender() == Gtxn[2].sender(),
        Gtxn[0].sender() == Gtxn[1].asset_sender()
    )

    # verify second transaction
    # tx 1 - clawback transactions that moves the frozen asset from sender to receiver - signed by clawback-escrow
    # verify the account sent in the accounts array is
    # actually the receiver of the asset in asset xfer
    second_transaction_checks = And(
        Gtxn[0].accounts[1] == Gtxn[1].asset_receiver(),
        # check asset_id passed through params
        Gtxn[1].xfer_asset() == Int(ASSET_ID)
    )

    # verify third transaction
    # tx 2 - payment transaction from sender to clawback-escrow to pay for the fee of the clawback
    third_transaction_checks = And(
        Gtxn[1].sender() == Gtxn[2].receiver(),
        # verify the fee amount is good
        Gtxn[2].amount() >= Gtxn[1].fee()
    )

    return And(
        group_tx_checks,
        common_fields,
        first_transaction_checks,
        second_transaction_checks,
        third_transaction_checks
    )


if __name__ == "__main__":
    params = {
        "ASSET_ID": 11,
        "APP_ID": 22,
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(clawback_escrow(params["ASSET_ID"], params["APP_ID"]), Mode.Signature))
