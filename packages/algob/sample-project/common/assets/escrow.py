# Contract Account

# Add directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'.')

from algobpy.parse import parse_params
from pyteal import *

def escrow_contract(RECEIVER_ADDRESS):
    '''
    This contract represents an escrow account which only approves transfer to
    address "RECEIVER_ADDRESS"
    '''
    # verify neither transaction
    # contains a rekey and close remainder to is set to zero address
    commons_checks = And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
    )

    program = And(
        commons_checks,
        Txn.receiver() == Addr(RECEIVER_ADDRESS)
    )

    return program

if __name__ == "__main__":
    # this is the default value (globalZeroAddress) of RECEIVER_ADDRESS. If template parameter
    # via scripts is not passed then this value will be used.
    params = {
        "RECEIVER_ADDRESS": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(escrow_contract(params["RECEIVER_ADDRESS"]), Mode.Signature))
