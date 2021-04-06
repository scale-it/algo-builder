from pyteal import *

john = Addr("2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA")
master = Addr("WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE")
fee = 10000
hash_image = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc="
timeout = 2000

def htlc(TMPL_RCV,
        TMPL_OWN,
        TMPL_FEE,
        TMPL_HASHIMG,
        TMPL_HASHFN,
        TMPL_TIMEOUT):
    """This contract implements a "hash time lock".
    The contract will approve transactions spending algos from itself under two circumstances:

    - If an argument arg_0 is passed to the script such that TMPL_HASHFN(arg_0) is equal to TMPL_HASHIMG,
    then funds may be closed out to TMPL_RCV.
    - If txn.FirstValid is greater than TMPL_TIMEOUT, then funds may be closed out to TMPL_OWN.

    The idea is that by knowing the preimage to TMPL_HASHIMG, funds may be released to
    TMPL_RCV (Scenario 1). Alternatively, after some timeout round TMPL_TIMEOUT,
    funds may be closed back to their original owner, TMPL_OWN (Scenario 2).
    Note that Scenario 1 may occur up until Scenario 2 occurs, even if TMPL_TIMEOUT has already passed.

    Parameters:
    TMPL_RCV: the address to send funds to when the preimage is supplied
    TMPL_HASHFN: the specific hash function (sha256 or keccak256) to use (sha256 in this example)
    TMPL_HASHIMG: the image of the hash function for which knowing the preimage under TMPL_HASHFN will release funds
    TMPL_TIMEOUT: the round after which funds may be closed out to TMPL_OWN
    TMPL_OWN: the address to refund funds to on timeout
    TMPL_FEE: maximum fee of any transactions approved by this contract """

    # First, check that the fee of this transaction is less than or equal to TMPL_FEE
    fee_check = Txn.fee() < Int(TMPL_FEE)

    # Next, check that this is a payment transaction.
    pay_check = Txn.type_enum() == TxnType.Payment

    # Next, check that the Receiver field for this transaction is empty
    # Because this contract can approve transactions that close out its entire balance,
    # it should never have a receiver.
    rec_field_check = Txn.receiver() == Global.zero_address()

    # Next, check that the Amount of algos transferred is 0. This is for the same reason as
    # above: we only allow transactions that close out this account completely, which
    # having a non-zero-address CloseRemainderTo will handle for us.
    amount_check = Txn.amount() == Int(0)

    # Always verify that the RekeyTo property of any transaction is set to the ZeroAddress
    # unless the contract is specifically involved ina rekeying operation.
    rekey_check = Txn.rekey_to() == Global.zero_address()

    # fold all the above checks into a single boolean.
    common_checks = And(
        fee_check,
        pay_check,
        rec_field_check,
        amount_check,
        rekey_check
    )

    # Payout scenarios : At this point in the execution, there is one boolean variable on the
    # stack that must be true in order for the transaction to be valid. The checks we have done
    # above apply to any transaction that may be approved by this script.We will now check if we
    # are in one of the two payment scenarios described in the functionality section."""

    # Scenario 1: Hash preimage has been revealed
    # First, check that the CloseRemainderTo field is set to be the TMPL_RCV address.
    recv_field_check = Txn.close_remainder_to() == TMPL_RCV

    # Next, we will check that arg_0 is the correct preimage for TMPL_HASHIMG under TMPL_HASHFN.
    preimage_check = TMPL_HASHFN(Arg(0)) == Bytes("base64", TMPL_HASHIMG)

    #Fold the "Scenario 1" checks into a single boolean.
    scenario_1 = And(recv_field_check, preimage_check)


    # Scenario 2: Contract has timed out
    # First, check that the CloseRemainderTo field is set to be the TMPL_OWN address
    # (presumably initialized to be the original owner of the funds).
    owner_field_check = Txn.close_remainder_to() == TMPL_OWN

    # Next, check that this transaction has only occurred after the TMPL_TIMEOUT round.
    timeout_check = Txn.first_valid() > Int(TMPL_TIMEOUT)

    #Fold the "Scenario 2" checks into a single boolean.
    scenario_2 = And(owner_field_check, timeout_check)

    # At this point in the program's execution, the stack has three values. At the base of the
    # stack is a boolean holding the results of the initial transaction validity checks.
    # This is followed by two booleans indicating the results of the scenario 1 and 2 checks.

    # We want to approve this transaction if we are in scenario 1 or 2.
    # So we logically OR the results of those checks together.
    # Finally, we logically AND the scenario checks with the initial checks.
    # At this point, the stack contains just one value: a boolean indicating
    # whether or not it has been approved by this contract.
    return And(Or(scenario_1, scenario_2), common_checks)

if __name__ == "__main__":
    print(compileTeal(htlc(john, master, fee, hash_image, Sha256, timeout), Mode.Signature))
