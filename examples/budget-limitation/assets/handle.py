from pyteal import *


@Subroutine(TealType.none)
def payment_txn(): 
    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.amount: Int(5000),
            TxnField.receiver: Txn.sender()
        }),
        InnerTxnBuilder.Submit(),
    )


def approval_program():
    
    on_initialize = Seq(
        Return(Int(1))
    )

    on_payment_action = Seq(
        payment_txn(), 
        Return(Int(1))
    )
    program = Cond(
        [Txn.application_args[0] == Bytes("initialize"), on_initialize],
        [Txn.application_args[0] == Bytes("call"), on_payment_action] 
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 6))
