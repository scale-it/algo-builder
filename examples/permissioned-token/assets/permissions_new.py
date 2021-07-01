# add new permissions contract logic here (eg. KYC)
import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def approval_program():
    program =  Return(Int(1))
    return program

if __name__ == "__main__":
    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(approval_program(), Mode.Application, version=3))