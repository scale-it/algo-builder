from pyteal import *

"""GOLD Transfer"""
''' Accepts only if (transaction type is OPT-IN OR (transaction type is asset transfer, 
    sender is goldOwnerAccount and asset transfer amount is less than equal to 1000 ))'''

asset_amt = Int(1000)
tmpl_sen = Addr("EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY")

def gold_asc(asset_amt=asset_amt, tmpl_sen=tmpl_sen):

	common_fields = And(
		Txn.type_enum() == Int(4),
		Txn.rekey_to() == Global.zero_address(),
		Txn.close_remainder_to() == Global.zero_address(),
		Txn.fee() <= Int(10000)
	)

	asa_opt_in = And(
		Global.group_size() == Int(1),
		Txn.group_index() == Int(0),
		Txn.asset_amount() == Int(0)
	)

	pay_gold = And(
		Txn.type_enum() == Int(4),
		Txn.sender() == tmpl_sen,
		Txn.asset_amount() <= asset_amt 
	)

	combine = And(Or(asa_opt_in, pay_gold), common_fields)

	return combine

if __name__ == "__main__":
    print(compileTeal(gold_asc(), Mode.Signature))