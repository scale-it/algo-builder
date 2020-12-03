import sys
# Add parent directory to path so that algobpy can be imported
sys.path.insert(0,'..')
from algobpy.parse import parseArgs

from pyteal import *

def dynamic_fee(TMPL_TO, TMPL_AMT, TMPL_CLS, TMPL_FV, TMPL_LV, TMPL_LEASE):
    """
    The contract works by approving a group of two transactions (meaning the two transactions will occur together or not at all). 

    - Suppose the owner of account A wants to send a payment to account TMPL_TO, but does not want 
    to pay a transaction fee. If account A signs the following contract with the appropriate parameters 
    (specifying all of the necessary details of the payment transaction), then anyone can cover a fee 
    for that payment on account A's behalf.

    - The first transaction must spend the transaction fee into account A, and the second transaction 
    must be the specified payment transaction from account A to account TMPL_TO.  

    Parameters:
    TMPL_TO: the recipient of the payment from account A
    TMPL_AMT: the amount to send from account A to TMPL_TO in microAlgos
    TMPL_CLS: the account to close out the remainder of account A's funds to after paying TMPL_AMT to TMPL_TO
    TMPL_FV: the required first valid round of the payment from account A
    TMPL_LV: the required last valid round of the payment from account A
    TMPL_LEASE: the string to use for the transaction lease in the payment from account A (to avoid replay attacks) 
    """

    # First, check that the transaction group contains exactly two transactions. 
    grp_check = Global.group_size() == Int(2)

    # Next, check that the first transaction is a payment, which is required 
    # since the first transaction should be paying the fee for the second.
    firstTxn_pay_check = Gtxn[0].type_enum() == TxnType.Payment

    # Next, specify that the receiver of funds from the first transaction is equal to the sender 
    # of the second transaction (since the first transaction is paying the second transaction's fee)
    address_check = Gtxn[0].receiver() == Gtxn[1].sender()

    # Next, check that the first transaction's amount is equal to the fee of the second transaction.
    amount_check = Gtxn[0].amount() == Gtxn[1].fee()

    #Check that the second transaction is a payment.
    secondTxn_pay_check = Gtxn[1].type_enum() == TxnType.Payment

    common_fields = And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.fee() <= Int(10000)
    )

    # fold all the above checks into a single boolean.
    required_condition = And(
        grp_check,
        firstTxn_pay_check,
        address_check,
        amount_check,
        secondTxn_pay_check
    )

    # Finally, check that all of the fields in the second transaction are equal to their corresponding contract parameters.
    # Check that the Receiver field is set to be the TMPL_TO address.
    recv_field_check = Gtxn[1].receiver() == TMPL_TO

    # Check that the CloseRemainderTo field is set to be the TMPL_CLS address.
    cls_field_check = Gtxn[1].close_remainder_to() == TMPL_CLS

    # Check that the Amount field is set to be the TMPL_TO address.
    amount_field_check = Gtxn[1].amount() == Int(TMPL_AMT)

    # Check that the FirstValid field is set to be the TMPL_FV.
    fv_field_check = Gtxn[1].first_valid() == Int(TMPL_FV)

    # Check that the LastValid field is set to be the TMPL_LV.
    lv_field_check = Gtxn[1].last_valid() == Int(TMPL_LV)

    # check that the lease field is exactly TMPL_LEASE.
    lease_field_check = Gtxn[1].lease() == TMPL_LEASE

    params_condition = And(
        common_fields,
        recv_field_check,
        cls_field_check,
        amount_field_check,
        #fv_field_check,
        #lv_field_check,
        #lease_field_check
    )

    # whether or not it has been approved by this contract.
    return And(required_condition, params_condition)
    
if __name__ == "__main__":

    #replace these values with your customized values or pass an external parameter
    scParam = {
        "TMPL_TO": "2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA",
        "TMPL_AMT": 700000,
        "TMPL_CLS": "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
        "TMPL_FV": 10,
        "TMPL_LV": 1000000,
        "TMPL_LEASE": "023sdDE2"
    }

    # Overwrite scParam if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        scParam = parseArgs(sys.argv[1], scParam)

    print(compileTeal(dynamic_fee(
        Addr(scParam["TMPL_TO"]), 
        scParam["TMPL_AMT"], 
        Addr(scParam["TMPL_CLS"]), 
        scParam["TMPL_FV"], 
        scParam["TMPL_LV"], 
        Bytes("base64", scParam["TMPL_LEASE"])), Mode.Signature))
    
