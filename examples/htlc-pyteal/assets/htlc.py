# Hash Time Lock Contract Example in pyTeal

from pyteal import *

john = Addr("2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA")
bob = Addr("2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ")
secret = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc="
timeout = 3000

def htlc(tmpl_seller, tmpl_buyer, tmpl_secret, tmpl_hash_fn, tmpl_timeout):
    
    common_fields = And(
        Txn.type_enum() == TxnType.Payment,
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.fee() <= Int(10000)
    )

    recv_cond = And(
        Txn.receiver() == tmpl_seller,
        tmpl_hash_fn(Arg(0)) == Bytes("base64", tmpl_secret)
    )
  
    esc_cond = And(
        Txn.receiver() == tmpl_buyer,
        Txn.first_valid() > Int(tmpl_timeout)
    )

    return And(
        common_fields,
        Or(recv_cond, esc_cond)
    )

if __name__ == "__main__":
    print(compileTeal(htlc(john, bob, secret, Sha256, timeout), Mode.Signature))