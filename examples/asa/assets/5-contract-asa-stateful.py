from pyteal import *

def contract_owned_asa():
    '''
    This program is stateful part of contract owned ASA, This program keeps track of
    number of ASA created by the contract, It also checks for
    : While payment only creator can receive the payments
    : While asset creation only creator can create assets
    Owner can also be changed using this program
    '''

    on_creation = Seq([
        App.globalPut(Bytes("Creator"), Txn.sender()),
        App.globalPut(Bytes("ASACounter"), Int(0)),
        Return(Int(1))
    ])

    # verify neither transaction
    # contains a rekey
    rekey_check = And(
        Gtxn[0].rekey_to() == Global.zero_address(),
        Gtxn[1].rekey_to() == Global.zero_address()
    )

    on_asa_create = Seq([
        Assert(And(
            App.globalGet(Bytes("Creator")) == Txn.sender(),
            # limit no of asa from here: currently set to max 1 ASA, It is set to 0 because
            # it indicates already deployed ASA
            App.globalGet(Bytes("ASACounter")) <= Int(0),
            Global.group_size() == Int(3),
            Gtxn[1].type_enum() == TxnType.AssetConfig,
            Gtxn[2].type_enum() == TxnType.Payment,
            rekey_check,
            Gtxn[2].rekey_to() == Global.zero_address(),
            Gtxn[2].amount() == Int(1000000)
        )),
        App.globalPut(Bytes("ASACounter"), App.globalGet(Bytes("ASACounter")) + Int(1)),
        Return(Int(1))
    ])

    on_pay = Seq([
        Assert(And(
            App.globalGet(Bytes("Creator")) == Txn.sender(),
            rekey_check,
        )),
        Return(Int(1))
    ])

    # Change owner of the contract if called by current owner
    change_owner = Seq([
        Assert(And(
            Txn.application_args[0] == Bytes("change_owner"),
            App.globalGet(Bytes("Creator")) == Txn.sender()
        )),
        App.globalPut(Bytes("Creator"), Txn.application_args[1]),
        Return(Int(1))
    ])

    # Check if current transaction is asset creation of asset transfer
    on_call = Cond(
        [Global.group_size() == Int(3), on_asa_create],
        [Global.group_size() == Int(2), on_pay]
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.application_args.length() == Int(2), change_owner],
        # Block delete application
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))],
        # Block update application
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
        [Txn.on_completion() == OnComplete.NoOp, on_call],
    )

    return program

if __name__ == "__main__":
    print(compileTeal(contract_owned_asa(), Mode.Application))