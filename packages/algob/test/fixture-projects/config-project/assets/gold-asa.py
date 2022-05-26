
from pyteal import *

"""GOLD Transfer"""
''' Accepts only if (transaction type is OPT-IN OR (transaction type is asset transfer, 
    sender is goldOwnerAccount and asset transfer amount is less than equal to 1000 ))'''

asset_amt = Int(1000)
arg_sender = Addr("M7VR2MGHI35EG2NMYOF3X337636PIOFVSP2HNIFUKAG7WW6BDWDCA3E2DA")

def gold_asc(asset_amt=asset_amt, arg_sender=arg_sender):

	asa_opt_in = And(
		Global.group_size() == Int(1),
		Txn.group_index() == Int(0),
		Txn.type_enum() == Int(4),
		Txn.asset_amount() == Int(0)
	)

	pay_gold = And(
		Txn.type_enum() == Int(4),
		Txn.sender() == arg_sender,
		Txn.asset_amount() <= asset_amt 
	)

	combine = Or(asa_opt_in, pay_gold)

	return combine

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
    print(compileTeal(gold_asc(), Mode.Signature, optimize=optimize_options))