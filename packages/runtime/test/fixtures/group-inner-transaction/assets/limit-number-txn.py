from pyteal import *


def inner_tx(n):
    """
    Create inner txn
    """
    inner_txn_config = [InnerTxnBuilder.SetFields({
        TxnField.type_enum: TxnType.Payment,
        TxnField.receiver: Txn.sender(),
        TxnField.amount: Int(0)
    })]
    # begin group inner txn
    if n == 0:
        return [InnerTxnBuilder.Begin()] + inner_txn_config
    # next inner txn
    return [InnerTxnBuilder.Next()] + inner_txn_config


def generate_inner_tx(n):
    # please ensures n > 0
    return Seq([t for i in range(n) for t in inner_tx(i)] + [InnerTxnBuilder.Submit()])


def approval_program():

    on_initialize = Seq(
        Return(Int(1))
    )

    on_payment_action = Seq(
        generate_inner_tx(16),
        generate_inner_tx(16),
        generate_inner_tx(16),
        generate_inner_tx(16),
        generate_inner_tx(16),
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
