from pyteal import *

# int 1; return
APPROVAL_PROGRAM = "BoEBQw==" 
CLEAR_PROGRAM = "BoEBQw=="

def replicate():
    return Seq(
        # Create the app
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.ApplicationCall,
                TxnField.approval_program: Bytes("base64", APPROVAL_PROGRAM),
                TxnField.clear_state_program: Bytes("base64", CLEAR_PROGRAM),
                TxnField.fee: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
    )


def approval():
    return Cond(
        [Txn.application_id() == Int(0), Approve()],
        [Txn.application_id() != Int(0), Return(Seq(replicate(), Int(1)))],
    )


def clear():
    return Approve()

optimize_options = OptimizeOptions(scratch_slots=True)

def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6, optimize=optimize_options)


def get_clear():
    return compileTeal(clear(), mode=Mode.Application, version=6, optimize=optimize_options)


if __name__ == "__main__":
    print(get_approval())
