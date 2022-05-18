import os

from pyteal import *
# This may be provided as a constant in pyteal, for now just hardcode
prefix = Bytes("base16", "151f7c75")

# This method is called from off chain, it dispatches a call to the first argument treated as an application id
@Subroutine(TealType.bytes)
def call():

    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(1000),
        }),
        InnerTxnBuilder.Next(),  # This indicates we're moving to constructing the next txn in the group
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(1000),
            TxnField.fee: Int(2000)
        }),
        InnerTxnBuilder.Submit(),
        Bytes("finish")
    )


# Util to add length to string to make it abi compliant, will have better interface in pyteal
@Subroutine(TealType.bytes)
def string_encode(str: Expr):
    return Concat(Extract(Itob(Len(str)), Int(6), Int(2)), str)


# Util to log bytes with return prefix
@Subroutine(TealType.none)
def ret_log(value: Expr):
    return Log(Concat(prefix, string_encode(value)))


def approval():
    # Define our abi handlers, route based on method selector defined above
    handlers = [
        [
            Txn.application_args[0] == Bytes("call"),
            Return(Seq(ret_log(call()), Int(1))),
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
        # Add abi handlers to main router conditional
        *handlers,
    )


def clear():
    return Return(Int(1))

optimize_options = OptimizeOptions(scratch_slots=True)

def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6, optimize=optimize_options)


def get_clear():
    return compileTeal(clear(), mode=Mode.Application, version=6, optimize=optimize_options)


if __name__ == "__main__":
    print(get_approval())