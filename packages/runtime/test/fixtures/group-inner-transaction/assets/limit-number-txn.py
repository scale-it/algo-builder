from pyteal import *


@Subroutine(TealType.none)
def group_inner_txns():
    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Next(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: Int(0)
        }),
        InnerTxnBuilder.Submit(),
    )


def approval_program():

    on_initialize = Seq(
        Return(Int(1))
    )

    on_payment_action = Seq(
        group_inner_txns(),
        group_inner_txns(),
        group_inner_txns(),
        group_inner_txns(),
        group_inner_txns(),
        Log(Itob(Global.opcode_budget())),
        Return(Int(1))
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_initialize],
        [Txn.application_args[0] == Bytes("exec"), on_payment_action]
    )

    return program


if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version=6))
