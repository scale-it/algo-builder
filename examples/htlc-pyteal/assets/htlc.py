# Hash Time Lock Contract Example in pyTeal

# Add parent directory to path so that algobpy can be imported
import sys
sys.path.insert(0,'..')

from algobpy.parse import parseArgs
from pyteal import *


def htlc(tmpl_bob, tmpl_alice, tmpl_secret, tmpl_timeout):

    common_fields = And(
        Txn.type_enum() == TxnType.Payment,
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.fee() <= Int(10000)
    )

    recv_cond = And(
        Txn.receiver() == tmpl_alice,
        Sha256(Arg(0)) == Bytes("base64", tmpl_secret)
    )

    esc_cond = And(
        Txn.receiver() == tmpl_bob,
        Txn.first_valid() > Int(tmpl_timeout)
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
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(htlc(
        Addr(params["bob"]),
        Addr(params["alice"]),
        params["hash_image"],
        params["timeout"]), Mode.Signature))
