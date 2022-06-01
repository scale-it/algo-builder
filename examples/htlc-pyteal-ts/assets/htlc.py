# Hash Time Lock Contract Example in pyTeal

# Add parent directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *


def htlc(arg_bob, arg_alice, arg_secret, arg_timeout):

    common_fields = And(
        Txn.type_enum() == TxnType.Payment,
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.fee() <= Int(10000)
    )

    recv_cond = And(
        Txn.receiver() == arg_alice,
        Sha256(Arg(0)) == Bytes("base64", arg_secret)
    )

    esc_cond = And(
        Txn.receiver() == arg_bob,
        Txn.first_valid() > Int(arg_timeout)
    )

    return And(
        common_fields,
        Or(recv_cond, esc_cond)
    )


if __name__ == "__main__":
    params = {
        "bob": "2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
        "alice": "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
        "hash_image": "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=",
        "timeout": 3001
    }

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    optimize_options = OptimizeOptions(scratch_slots=True)
    print(compileTeal(htlc(
        Addr(params["bob"]),
        Addr(params["alice"]),
        params["hash_image"],
        params["timeout"]), Mode.Signature, version = 5, optimize=optimize_options))
