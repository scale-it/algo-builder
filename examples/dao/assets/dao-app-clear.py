from pyteal import *

def clear_state_program():
    return Return(Int(1))

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(clear_state_program(), Mode.Application, version = 5, optimize=optimize_options))