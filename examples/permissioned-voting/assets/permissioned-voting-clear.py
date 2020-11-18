from pyteal import *

def clear_state_program():
    get_vote_of_sender = App.localGetEx(Int(0), App.id(), Bytes("voted"))
    program = Seq([
        get_vote_of_sender,
        If(And(Global.round() <= App.globalGet(Bytes("VoteEnd")), get_vote_of_sender.hasValue()),
            App.globalPut(get_vote_of_sender.value(), App.globalGet(get_vote_of_sender.value()) - Int(1))
        ),
        Return(Int(1))
    ])

    return program

if __name__ == "__main__":
    print(compileTeal(clear_state_program(), Mode.Application))