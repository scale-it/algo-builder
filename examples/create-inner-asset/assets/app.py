'''
Borrow logic from 
https://github.com/algorand-devrel/demo-avm1.1/blob/master/demos/trampoline/app.py
'''

from pyteal import *


min_bal = Int(int(1e5))
# This method is called by an account that wishes to fund another app address
# it ensures the group transaction is structured properly then pays the new app address enough to cover the min balance 
@Subroutine(TealType.none)
def fund():
    app_create, pay, pay_proxy = Gtxn[0], Gtxn[1], Gtxn[2]
    well_formed_fund = And(
        Global.group_size() == Int(3),
        app_create.type_enum() == TxnType.ApplicationCall,
        app_create.on_completion() == OnComplete.NoOp,
        app_create.application_id() == Int(0),
        pay.type_enum() == TxnType.Payment,
        pay.amount() > min_bal,  # min bal of 0.1A
        pay.close_remainder_to() == Global.zero_address(),
        pay_proxy.type_enum() == TxnType.ApplicationCall,
        pay_proxy.on_completion() == OnComplete.NoOp,
        pay_proxy.application_id() == Global.current_application_id(),
    )

    # Compute the newly created app address from the app id
    addr = AppParam.address(app_create.created_application_id())

    return Seq(
        addr,
        Assert(well_formed_fund),
        InnerTxnBuilder.Begin(),
        # Send pay transaction from trampoline app to newly created application
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.Payment,
                TxnField.amount: min_bal,
                TxnField.receiver: addr.value(),
                TxnField.fee: Int(0),  # make caller pay
            }
        ),
        InnerTxnBuilder.Submit(),
    )


def approval():
    # Define our abi handlers, route based on method selector defined above
    handlers = [
        [
            Txn.application_args[0] == Bytes("fund"),
            Return(Seq(fund(), Int(1))),
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
        *handlers,
    )


def get_approval():
    return compileTeal(approval(), mode=Mode.Application, version=6)


if __name__ == "__main__":
    print(get_approval())
