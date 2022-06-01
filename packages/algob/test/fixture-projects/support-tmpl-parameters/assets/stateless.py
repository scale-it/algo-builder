# This example is provided for informational purposes only
import sys
from algobpy.parse import parse_params

from pyteal import *

"""GOLD Transfer"""
''' Accepts only if (transaction type is OPT-IN OR (transaction type is asset transfer,
    sender is goldOwnerAccount and asset transfer amount is less than equal to 1000 ))'''

def gold_asc():

	asa_opt_in = And(
		Global.group_size() == Int(1),
		Txn.group_index() == Int(0),
		Txn.type_enum() == Int(4),
		Txn.asset_amount() == Int(0)
	)

	pay_gold = And(
		Txn.type_enum() == Int(4),
		Txn.sender() == Tmpl.Addr("TMPL_SENDER"),
		Txn.asset_amount() <= Tmpl.Int("TMPL_AMOUNT")
	)

	combine = Or(asa_opt_in, pay_gold)

	return combine

optimize_options = OptimizeOptions(scratch_slots=True)
if __name__ == "__main__":
  print(compileTeal(gold_asc(), Mode.Signature, optimize=optimize_options))
