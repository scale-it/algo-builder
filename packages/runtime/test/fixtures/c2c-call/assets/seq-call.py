from pyteal import *

# This may be provided as a constant in pyteal, for now just hardcode
prefix = Bytes("base16", "151f7c75")

def mk_next_args():
    return [
        # decrease position by one - move to next app
        Itob(Btoi(Txn.application_args[0]) - Int(1)),
        Txn.application_args[1],
        Txn.application_args[2],
        Txn.application_args[3],
        Txn.application_args[4],
        Txn.application_args[5],
        Txn.application_args[6],
        Txn.application_args[7],
        Txn.application_args[8],
    ]


# This method is called from off chain, it dispatches a call to the first argument treated as an application id
@Subroutine(TealType.bytes)
def call():

    # Get the reference into the applications array
    next_app_id = Btoi(Txn.application_args[Btoi(Txn.application_args[0])])

    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.ApplicationCall,
                # next app id
                TxnField.application_id: next_app_id,
                # Pass the selector as the first arg to trigger the `echo` method
                TxnField.application_args: mk_next_args(),
                # Set fee to 0 so caller has to cover it
                TxnField.fee: Int(1000),
            }
        ),
        InnerTxnBuilder.Submit(),
        Bytes("Finished")
    )


# This is called from the other application, just echos some stats
@Subroutine(TealType.bytes)
def echo():
    return Concat(
        Bytes("Call from applicatiton"),
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
    return Cond(
        [Txn.application_id() == Int(0), Return(Int(1))],
        [
            Txn.on_completion() == OnComplete.DeleteApplication,
            Return(Txn.sender() == Global.creator_address()),
        ],
        [
            Txn.on_completion() == OnComplete.UpdateApplication,
            Return(Txn.sender() == Global.creator_address()),
        ],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
        [
            Btoi(Txn.application_args[0]) == Int(0),
            Return(Int(1))
        ],
        [
            Btoi(Txn.application_args[0]) > Int(0),
            Return(Seq(ret_log(call()), Int(1))),
        ]
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

