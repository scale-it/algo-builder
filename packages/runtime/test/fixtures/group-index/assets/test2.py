from pyteal import *

def contract():
    program = Cond(
        [Txn.application_id() == Int(0), Int(1)],  # on creation
        [Txn.on_completion() == OnComplete.DeleteApplication, Int(0)],
        [Txn.on_completion() == OnComplete.UpdateApplication, Int(0)],
        [Txn.on_completion() == OnComplete.CloseOut, Int(0)],
        [Txn.on_completion() == OnComplete.OptIn, Int(0)],
        [Txn.on_completion() == OnComplete.NoOp, Txn.group_index() == Int(1)]
    )
    return program

if __name__ == "__main__":
    print(compileTeal(contract(), Mode.Application))
