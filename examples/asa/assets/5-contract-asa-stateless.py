# Account Contract

# Add parent directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def contract_asa(app_id):
    '''
    This program is stateless part of conotract owned asa, ASA owned is associated
    with this contract address, This program checks if:
    - Creation: Stateful program is always called
    - Payment: Stateful program is always called, Payment type is AssetTransfer,
               Amount is <= 100 and fee is <= 10000
    '''
    # verify neither transaction
    # contains a rekey
    rekey_check = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address()
    )

    pay = And(
        # The first transaction must be 
        # an ApplicationCall (ie call stateful smart contract)
        Gtxn[0].type_enum() == TxnType.ApplicationCall,

        # The specific App ID must be called
        # This should be changed after creation
        Gtxn[0].application_id() == Int(app_id),

        Gtxn[1].type_enum() == TxnType.AssetTransfer,
        Gtxn[1].amount() <= Int(100),
        Gtxn[1].fee() <= Int(10000),
        rekey_check
    )

    create = And(
        # The first transaction must be 
        # an ApplicationCall (ie call stateful smart contract)
        Gtxn[0].type_enum() == TxnType.ApplicationCall,

        # The specific App ID must be called
        # This should be changed after creation
        Gtxn[0].application_id() == Int(app_id),
        rekey_check
    )

    program = Cond(
        [Global.group_size() == Int(2), pay],
        [Global.group_size() == Int(3), create],
    )

    return program


if __name__ == "__main__":
    params = {
        "APP_ID": 1    
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(contract_asa(params["APP_ID"]), Mode.Signature))
