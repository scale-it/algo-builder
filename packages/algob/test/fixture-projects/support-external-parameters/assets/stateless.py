# This example is provided for informational purposes only
import sys
from algobpy.parse import parse_params

from pyteal import *

"""GOLD Transfer"""
''' Accepts only if (transaction type is OPT-IN OR (transaction type is asset transfer,
    sender is goldOwnerAccount and asset transfer amount is less than equal to 1000 ))'''

def gold_asc(asset_amt, tmpl_sender):

	asa_opt_in = And(
		Global.group_size() == Int(1),
		Txn.group_index() == Int(0),
		Txn.type_enum() == Int(4),
		Txn.asset_amount() == Int(0)
	)

	pay_gold = And(
		Txn.type_enum() == Int(4),
		Txn.sender() == tmpl_sender,
		Txn.asset_amount() <= asset_amt
	)

	combine = Or(asa_opt_in, pay_gold)

	return combine

if __name__ == "__main__":

  #replace these values with your customized values or pass an external parameter
  scParam = {
    "TMPL_SENDER": "M7VR2MGHI35EG2NMYOF3X337636PIOFVSP2HNIFUKAG7WW6BDWDCA3E2DA",
    "ASSET_AMT": Int(1000)
  }

  # Overwrite scParam if sys.argv[1] is passed
  if(len(sys.argv) > 1):
    scParam = parse_params(sys.argv[1], scParam)

  print(compileTeal(gold_asc(scParam["ASSET_AMT"], Addr(scParam["TMPL_SENDER"])), Mode.Signature))