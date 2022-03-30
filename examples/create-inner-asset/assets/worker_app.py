from pyteal import *

@Subroutine(TealType.none)
def logs():
    return Log(Concat(Txn.application_args[1], Bytes(" "), Txn.application_args[2]))

def approval():
    handlers = [
        [
            Txn.application_args[0] == Bytes("logs"),
            Return(Seq(logs(), Int(1))),
        ]
    ]

    return Cond(
        [Txn.application_id() == Int(0), Approve()],
        [
            Txn.on_completion() == OnComplete.DeleteApplication,
            Return(Txn.sender() == Global.creator_address()),
        ],
        [
            Txn.on_completion() == OnComplete.UpdateApplication,
            Return(Txn.sender() == Global.creator_address()),
        ],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        *handlers,
    )

def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6)


if __name__ == "__main__":
    print(get_approval())
