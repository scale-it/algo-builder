from pyteal import *

def approval_program():
    """
    A stateful app to test inner transactions
    """

    # Pay 1ALGO from Contract -> Sender (aka txn.accounts[0])
    # Pay 2ALGO from Contract -> Txn.Accounts[1]
    pay = Seq([
        # txA
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.receiver: Txn.sender(),
                TxnField.amount: Int(1000000),
            }
        ),
        InnerTxnBuilder.Submit(),

        # txB
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.receiver: Txn.accounts[1],
                TxnField.amount: Int(2000000),
            }
        ),
        InnerTxnBuilder.Submit(),

        Return(Int(1))
    ])

    # empties application's account
    pay_with_close_rem_to = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.receiver: Txn.sender(),
                TxnField.amount: Int(0),
                TxnField.close_remainder_to: Txn.accounts[1]
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
        [Txn.application_args[0] == Bytes("pay"), pay],
        [Txn.application_args[0] == Bytes("pay_with_close_rem_to"), pay_with_close_rem_to],
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 5))