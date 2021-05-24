# Escrow Account Contract

# Add parent directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def escrow(app_id):

    group_fields = And(
        # This contract only spends out
        # if two transactions are grouped
        Global.group_size() == Int(2),

        # The first transaction must be 
        # an ApplicationCall (ie call stateful smart contract)
        Gtxn[0].type_enum() == TxnType.ApplicationCall,

        # The specific App ID must be called
        # This should be changed after creation
        Gtxn[0].application_id() == Int(app_id)
    )

    # The applicaiton call must either be
    # A general applicaiton call or a delete call
    call_check = Or(
        Gtxn[0].on_completion() == OnComplete.NoOp,
        Gtxn[0].on_completion() == OnComplete.DeleteApplication
    )

    # verify neither transaction
    # contains a rekey
    rekey_check = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address()
    )

    return And(
        group_fields,
        call_check,
        rekey_check
    )


if __name__ == "__main__":
    params = {
        "APP_ID": 1    
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(escrow(params["APP_ID"]), Mode.Signature))
