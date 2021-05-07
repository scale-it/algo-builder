# Escrow Clawback for permissioned-token in pyTeal

# Add parent directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'..')

from algobpy.parse import parseArgs
from pyteal import *

def clawback_escrow(TOKEN_ID, CONTROLLER_APP_ID):

	# check properties of txGroup passed
    group_tx_checks = And(
        Global.group_size() >= Int(3), # following 3 transactions must exist in every group
        Gtxn[0].type_enum() == TxnType.ApplicationCall, # call to controller smart contract
        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[2].type_enum() == TxnType.Payment, # paying fees for escrow
        # this tx should be 2nd in the group
        Txn.group_index() == Int(1)
    )

	# check no rekeying etc
    common_fields = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address(),
        Gtxn[0].close_remainder_to() == Global.zero_address(),
        Gtxn[1].close_remainder_to() == Global.zero_address(),
        Gtxn[0].asset_close_to() == Global.zero_address(),
        Gtxn[1].asset_close_to() == Global.zero_address(),
    )

    # verify first transaction - signed by asset sender
    # tx 1 - check app_id passed through params
    first_transaction_check = Gtxn[0].application_id() == Int(CONTROLLER_APP_ID)

    # verify second transaction
    # tx 2 - clawback transactions that moves the frozen asset from sender to receiver - signed by clawback
    # check asset_id passed through params
    second_transaction_check = Gtxn[1].xfer_asset() == Int(TOKEN_ID)

    # verify third transaction
    # tx 3 - payment transaction from sender to clawback to pay for the fee of the clawback
    third_transaction_checks = And(
        # verify sender of asset transfer is the receiver of payment tx
        Gtxn[1].sender() == Gtxn[2].receiver(),

        # verify the fee amount is good
        Gtxn[2].amount() >= Gtxn[1].fee(),

        # common checks
        Gtxn[2].rekey_to() == Global.zero_address(),
        Gtxn[2].close_remainder_to() == Global.zero_address(),
        Gtxn[2].asset_close_to() == Global.zero_address()
    )

    # transfer of token between non-reserve accounts
    # this must be passed with rule checks
    token_transfer = And(
        group_tx_checks,
        common_fields,
        first_transaction_check,
        second_transaction_check,
        third_transaction_checks
    )

    # issue new token (asset transfer tx from asset reserve to receiver)
    # since issuer creates the rules, this transaction can bypass rule(s) checks
    # NOTE: Controller needs to be called to make sure that asset_sender is the
    # asset_reserve and to check that token is not killed.
    issuance_tx = And(
        common_fields,
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Gtxn[0].application_id() == Int(CONTROLLER_APP_ID),
        Gtxn[0].sender() == Gtxn[1].asset_sender(),

        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].xfer_asset() == Int(TOKEN_ID), # verify token index
    )

    return If(
        Global.group_size() == Int(2),
        issuance_tx,
        token_transfer
    )

if __name__ == "__main__":
    params = {
        "TOKEN_ID": 11,
        "CONTROLLER_APP_ID": 22
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(clawback_escrow(params["TOKEN_ID"], params["CONTROLLER_APP_ID"]), Mode.Signature))
