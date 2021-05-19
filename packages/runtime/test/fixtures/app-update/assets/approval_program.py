from pyteal import *

def app():
    '''
    - An app with 2 global variables: `total: int` and `counter: int`.
        - (on app creation), `counter = 0, total = 10`
    - The app update accepts exactly one argument: `n: int`
    - On update call the app verifies that: `n >= 1`,  increments `app.counter += 1` and:
        * when `app.counter % 2 == 0` then update `app.total += n`
        * otherwise, subtract: `app.total -= n`
    '''
    total = Bytes("total")
    counter = Bytes("counter")

    on_creation = Seq([
        App.globalPut(counter, Int(0)),
        App.globalPut(total, Int(10)),
        Return(Int(1))
    ])

    common_checks = Assert(And(
        Txn.application_args.length() == Int(1),
        Btoi(Txn.application_args[0]) >= Int(1)
    ))

    on_success = Seq([
        common_checks,
        App.globalPut(total, App.globalGet(total) + Btoi(Txn.application_args[0])),
        App.globalPut(counter, App.globalGet(counter) + Int(1)),
    ])

    on_fail = Seq([
        common_checks,
        App.globalPut(total, App.globalGet(total) - Btoi(Txn.application_args[0])),
        App.globalPut(counter, App.globalGet(counter) + Int(1)),
    ])

    on_update = Cond(
        [(App.globalGet(counter) % Int(2)) == Int(0), on_success],
        [(App.globalGet(counter) % Int(2)) != Int(0), on_fail]
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_creation],  # on creation
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(1))],
        [Txn.on_completion() == OnComplete.UpdateApplication, on_update],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
        [Txn.on_completion() == OnComplete.NoOp, Return(Int(1))]
    )
    return program

if __name__ == "__main__":
    print(compileTeal(app(), Mode.Application))
