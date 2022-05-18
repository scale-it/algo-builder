from pyteal import *

def approval_program():
    """
    A stateful app to test inner transactions (payment with rekey account to contract)
    """

    transfer_algo = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.sender: Txn.accounts[1],
                TxnField.receiver: Txn.accounts[2],
                TxnField.amount: Btoi(Txn.application_args[1]),
                TxnField.fee: Int(1000)
            }
        ),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])


    program = Cond(
        # Verfies that the application_id is 0, accepts it
        [Txn.application_id() == Int(0), Return(Int(1))],
        # Verifies Update or delete transaction, rejects it.
        [
            Or(
                Txn.on_completion() == OnComplete.UpdateApplication,
                Txn.on_completion() == OnComplete.DeleteApplication
            ),
            Return(Int(0))
        ],
        # Verifies closeout or OptIn transaction, approves it.
        [
            Or(
                Txn.on_completion() == OnComplete.CloseOut,
                Txn.on_completion() == OnComplete.OptIn
            ),
            Return(Int(1))
        ],
        [Txn.application_args[0] == Bytes("transfer_algo"), transfer_algo],
    )

    return program

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 5, optimize=optimize_options))