from pyteal import *


def replicate():
    return Seq(
        # Create the app
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.ApplicationCall,
                TxnField.approval_program: Bytes("base64", "BiACAQAmAQtlY2hvX21ldGhvZDEYIxJAAFwxGYEFEkAATjEZgQQSQABAMRmBAhJAADYxGSISQAAtNhoAgAtjYWxsX21ldGhvZBJAABE2GgAoEkAAAQCIADqIAF0iQ4gAF4gAVSJDIkMiQzEAMgkSQzEAMgkSQyJDsYEGshA2GgEXwDKyGCiyGiOyAbO1OgBXBgCJgBZDYWxsIGZyb20gYXBwbGljYXRpdG9uiTUBNAEVFlcGAjQBUIk1AIAEFR98dTQAiP/mULCJ"),
                TxnField.clear_state_program: Bytes("base64", "BoEBQw=="),
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


def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6)


def get_clear():
    return compileTeal(clear(), mode=Mode.Application, version=6)


if __name__ == "__main__":
    print(get_approval())
