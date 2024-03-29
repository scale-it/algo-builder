# This example is provided for informational purposes only
import sys
from algobpy.parse import parse_params

from pyteal import *

def approval_program(asset_amt, ARG_sender):
  on_creation = Seq([
    Assert(Txn.asset_amount() <= asset_amt),
    Assert(Txn.sender() == ARG_sender),
    App.localPut(Int(0), Bytes("admin"), Int(1)),
    App.localPut(Int(0), Bytes("balance"), Int(0)),
    Return(Int(1))
  ])

  register = Seq([
    App.localPut(Int(0), Bytes("balance"), Int(0)),
    Return(Int(1))
  ])

  program = Cond(
    [Txn.application_id() == Int(0), on_creation],
    [Txn.on_completion() == OnComplete.OptIn, register]
  )

  return program

if __name__ == "__main__":

  #replace these values with your customized values or pass an external parameter
  scParam = {
    "ARG_SENDER": "M7VR2MGHI35EG2NMYOF3X337636PIOFVSP2HNIFUKAG7WW6BDWDCA3E2DA",
    "ASSET_AMT": Int(1000)
  }

  # Overwrite scParam if sys.argv[1] is passed
  if(len(sys.argv) > 1):
    scParam = parse_params(sys.argv[1], scParam)

  optimize_options = OptimizeOptions(scratch_slots=True)
  print(compileTeal(approval_program(scParam["ASSET_AMT"], Addr(scParam["ARG_SENDER"])), Mode.Application, optimize=optimize_options))
