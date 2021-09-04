from pyteal import *

def proposal_lsig():
    """
    Represents Proposal Lsig (a contract account owned by the proposer)
    """

    return Int(1)

if __name__ == "__main__":
    print(compileTeal(proposal_lsig(), Mode.Signature, version = 4))