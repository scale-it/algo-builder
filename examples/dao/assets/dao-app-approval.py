import sys
sys.path.insert(0,'..')

from algobpy.parse import parse_params
from pyteal import *

def approval_program():
    """
    A stateful app with governance rules. Stores
    deposit, min_support, min_duration, max_duration, url.

    Commands:
        add_proposal            Save proposal record in lsig
        deposit_vote            records deposited votes in voter.account
        register_vote           register user votes in proposal_lsig
        execute                 executes a proposal
        withdraw_vote_deposit   unlock the deposit and withdraw tokens back to the user
        clear_vote_record       clears Sender local state by removing a record of vote cast from a not active proposal
        clear_proposal          clears proposal record and returns back the deposit
    """

    # Verfies deposit of gov_token to an address for a transaction. Args:
    # * tx_index (index of deposit transaction)
    # * receiver (receiver of gov_token)
    def verify_deposit(tx_index: Int, receiver: Addr):
        return Assert(And(
            Global.group_size() >= tx_index,
            Gtxn[tx_index].type_enum() == TxnType.AssetTransfer,
            Gtxn[tx_index].xfer_asset() == Tmpl.Int("TMPL_GOV_TOKEN"),
            Gtxn[tx_index].asset_receiver() == receiver,
            Gtxn[tx_index].asset_amount() >= Int(0)
        ))

    # scratch vars to save result() & is_proposal_active()
    scratchvar_result = ScratchVar(TealType.uint64)
    scratchvar_is_proposal_active = ScratchVar(TealType.uint64)

    # Fetch key(s) from Txn.Accounts[1] (passed as proposalLsig), for current app
    # these are used throughout the application
    voting_start = App.localGet(Int(1), Bytes("voting_start"))
    voting_end = App.localGet(Int(1), Bytes("voting_end"))
    proposal_id = App.localGet(Int(1), Bytes("id"))
    yes_count = App.localGet(Int(1), Bytes("yes"))
    no_count = App.localGet(Int(1), Bytes("no"))
    execute_before = App.localGet(Int(1), Bytes("execute_before"))
    executed = App.localGet(Int(1), Bytes("executed"))
    proposal_type = App.localGet(Int(1), Bytes("type"))
    proposal_from = App.localGet(Int(1), Bytes("from"))
    asa_id = App.localGet(Int(1), Bytes("asa_id"))
    recipient = App.localGet(Int(1), Bytes("recipient"))
    amount = App.localGet(Int(1), Bytes("amount"))

    # Computes result of proposal. Saves result in scratch. Args:
    # * idx - index of account where proposal_lsig.address() is passed
    # NOTE: idx == Int(0) means proposalLsig is Txn.sender()
    def compute_result(idx: Int):
        return Seq([
            Cond(
                # 1 if voting is over and proposal.yes >= min_support and proposal.yes > proposal.no
                [
                    And(
                        Global.latest_timestamp() > App.localGet(idx, Bytes("voting_end")),
                        App.localGet(idx, Bytes("yes")) >= App.globalGet(min_support),
                        App.localGet(idx, Bytes("yes")) > App.localGet(idx, Bytes("no"))
                    ) == Int(1),
                    scratchvar_result.store(Int(1))
                ],
                # 2 if voting is over and proposal.yes < min_support  or proposal.yes <= proposal.no
                [   And(
                        Global.latest_timestamp() > voting_end,
                        Or(
                            App.localGet(idx, Bytes("yes")) < App.globalGet(min_support),
                            App.localGet(idx, Bytes("yes")) <= App.localGet(idx, Bytes("no"))
                        )
                    ) == Int(1),
                    scratchvar_result.store(Int(2))
                ],
                # 3 if voting is still in progress (now <= voting_end)
                [Global.latest_timestamp() <= App.localGet(idx, Bytes("voting_end")), scratchvar_result.store(Int(3))],
                # 4 if proposal expired (now > proposal.execute_before())
                [Global.latest_timestamp() > App.localGet(idx, Bytes("execute_before")), scratchvar_result.store(Int(4))],
            ),
        ])

    # Checks if the proposal is active or not. Saves result in scratchvar_is_proposal_active. Args:
    # * idx - index of account where proposal_lsig.address() is passed
    # NOTE: idx == Int(0) means proposalLsig is Txn.sender()
    def is_proposal_active(idx: Int):
        return Seq([
            compute_result(idx),
            If(
                Or(
                    # still in voting (now <= voting_end)
                    Global.latest_timestamp() <= App.localGet(idx, Bytes("voting_end")),
                    # OR succeeded but not executed (now <= execute_before && result() == 1 && executed == 0)
                    And (
                        Global.latest_timestamp() <= App.localGet(idx, Bytes("execute_before")),
                        scratchvar_result.load() == Int(1),
                        App.localGet(idx, Bytes("executed")) == Int(0)
                    )
                ),
                scratchvar_is_proposal_active.store(Int(1)),
                # NOTE: we store Int(2) as "NO" because Int(0) can also be default value
                scratchvar_is_proposal_active.store(Int(2)),
            )
        ])

    # global DAO parameters
    # minimum deposit in gov_tokens required to make a proposal
    deposit = Bytes("deposit")
    # minimum number of yes power votes to validate the proposal
    min_support = Bytes("min_support")
    # minimum voting time (in number of seconds) for a new proposal
    min_duration = Bytes("min_duration")
    # maximum voting time (in number of seconds) for a new proposal
    max_duration = Bytes("max_duration")
    # a url with more information about the DAO
    url = Bytes("url")
    # a logic signature account which holds gov_tokens for a proposal
    deposit_lsig = Bytes("deposit_lsig")


    # initialization
    # Expected arguments:
    #   [deposit, min_support, min_duration, max_duration, url]
    on_initialize = Seq([
        Assert(
            And(
                # min_duration must be > 0
                Btoi(Txn.application_args[2]) > Int(0),
                # min_duration < max_duration
                Btoi(Txn.application_args[2]) < Btoi(Txn.application_args[3]),
            )
        ),
        App.globalPut(deposit, Btoi(Txn.application_args[0])),
        App.globalPut(min_support, Btoi(Txn.application_args[1])),
        App.globalPut(min_duration, Btoi(Txn.application_args[2])),
        App.globalPut(max_duration, Btoi(Txn.application_args[3])),
        App.globalPut(url, Txn.application_args[4]),
        Return(Int(1))
    ])

    # Saves deposit lsig account addresses in app global state
    # Expected arguments: [deposit_lsig]
    add_deposit_accounts = Seq([
        Assert(Global.creator_address() == Txn.sender()),
        App.globalPut(deposit_lsig, Txn.application_args[1]),
        Return(Int(1))
    ])

    # A proposal is submitted using an lsig and recorded into that lsig using add_proposal.
    # Expected arguments: proposal_config (url, url_hash, voting_start ..etc)
    add_proposal = Seq([
        # When recording a proposal, we fail if there is a proposal recorded in the account
        # User should call close_proposal use-case to remove a not active proposal record and withdraw deposit.
        Assert(App.localGet(Int(0), Bytes("type")) == Int(0)),
        # Verify deposit to deposit_lsig equals global.deposit
        verify_deposit(Int(1), App.globalGet(deposit_lsig)),
        Assert(Gtxn[1].asset_amount() == App.globalGet(deposit)),

        # if everything goes well, start recording proposal info
        App.localPut(Int(0), Bytes("name"), Txn.application_args[1]),
        App.localPut(Int(0), Bytes("url"), Txn.application_args[2]),
        App.localPut(Int(0), Bytes("url_hash"), Txn.application_args[3]),
        If(
            Txn.application_args[4] == Bytes(""),
            App.localPut(Int(0), Bytes("hash_algo"), Bytes("sha256")), # default hash_algo
            App.localPut(Int(0), Bytes("hash_algo"), Txn.application_args[4])
        ),
        # voting_start must be after now
        Assert(Btoi(Txn.application_args[5]) > Global.latest_timestamp()),
        App.localPut(Int(0), Bytes("voting_start"), Btoi(Txn.application_args[5])),
        Assert(And(
            # voting_end must be > voting_start
            Btoi(Txn.application_args[6]) > Btoi(Txn.application_args[5]),
            # min_duration <= voting_end - voting_start <= max_duration
            App.globalGet(min_duration) <= Btoi(Txn.application_args[6]) - Btoi(Txn.application_args[5]),
            App.globalGet(max_duration) >= Btoi(Txn.application_args[6]) - Btoi(Txn.application_args[5])
        )),
        App.localPut(Int(0), Bytes("voting_end"), Btoi(Txn.application_args[6])),
        # execute_before must be after voting_end
        Assert(Btoi(Txn.application_args[7]) > Btoi(Txn.application_args[6])),
        App.localPut(Int(0), Bytes("execute_before"), Btoi(Txn.application_args[7])),
        # type must be 1, 2 OR 3
        Assert(
            Or(
                Btoi(Txn.application_args[8]) == Int(1),
                Btoi(Txn.application_args[8]) == Int(2),
                Btoi(Txn.application_args[8]) == Int(3)
            )
        ),
        App.localPut(Int(0), Bytes("type"), Btoi(Txn.application_args[8])),

        # Depending on the type, we will have a variable list of last arguments:
        # 1: ALGO transfer
        # 2: ASA transfer
        # 3: msg
        # NOTE: We start from Int(1) because Int(0) is a default value (it could also mean local state does not exist)
        Cond(
            [App.localGet(Int(0), Bytes("type")) == Int(1), Seq([
                App.localPut(Int(0), Bytes("from"), Txn.application_args[9]),
                App.localPut(Int(0), Bytes("recipient"), Txn.application_args[10]),
                App.localPut(Int(0), Bytes("amount"), Btoi(Txn.application_args[11])),
            ])],
            [App.localGet(Int(0), Bytes("type")) == Int(2), Seq([
                App.localPut(Int(0), Bytes("from"), Txn.application_args[9]),
                App.localPut(Int(0), Bytes("asa_id"), Btoi(Txn.application_args[10])),
                App.localPut(Int(0), Bytes("recipient"), Txn.application_args[11]),
                App.localPut(Int(0), Bytes("amount"), Btoi(Txn.application_args[12])),
            ])],
            [App.localGet(Int(0), Bytes("type")) == Int(3), Seq([
                App.localPut(Int(0), Bytes("msg"), Txn.application_args[9])
            ])],
        ),
        # Finally record the following special attributes: id (the TxID field) and executed = 0
        App.localPut(Int(0), Bytes("id"), Txn.tx_id()),
        App.localPut(Int(0), Bytes("executed"), Int(0)),
        Return(Int(1))
    ])

    # sender.deposit
    deposit = App.localGet(Int(0), Bytes("deposit"))

    # Records gov tokens deposited by user (sender)
    deposit_vote = Seq([
        # Verify deposit of votes to deposit_lsig account (with atleast 1 vote)
        # Ques: do we care if sender is voter here?
        verify_deposit(Int(1), App.globalGet(deposit_lsig)),
        # Sender.deposit += amount
        App.localPut(Int(0), Bytes("deposit"), deposit + Gtxn[1].asset_amount()),
        Return(Int(1))
    ])

    # This is used to unlock the deposit and withdraw tokens back to the user.
    # To protect against double vote, user can only withdraw the deposit after the
    # latest voting he participated has ended.
    withdraw_vote_deposit = Seq([
        Assert(And(
            Global.latest_timestamp() > App.localGet(Int(0), Bytes("deposit_lock")),
            # fees must be paid by tx0 (voter)
            Gtxn[1].fee() == Int(0)
        )),
        App.localPut(Int(0), Bytes("deposit"), deposit - Gtxn[1].asset_amount()),
        Return(Int(1))
    ])

    # p_<proposal> is a concatenation of p_ with the proposal address to avoid some weird attacks.
    byte_p_proposal = Concat(Bytes("p_"), Txn.accounts[1])
    p_proposal = App.localGetEx(Int(0), Int(0), byte_p_proposal)  # value = proposal.id when a user voted or 0
    yes = Bytes("yes")
    no = Bytes("no")
    abstain = Bytes("abstain")

    # Register user votes in proposal_lsig by saving Sender.p_<proposal>. Arguments:
    # * proposal : lsig account address with the proposal record (provided as the first external account).
    # * vote (bytes): abstain, yes, no
    register_vote = Seq([
        p_proposal,
        Assert(
            And(
                Global.group_size() == Int(1),
                # voting_start <= now <= voting_end
                # voting_start <= Global.latest_timestamp(),
                # Global.latest_timestamp() <= voting_end,
                # Sender.deposit >= 0 (i.e user "deposited" his votes using deposit_vote)
                App.localGet(Int(0), Bytes("deposit")) > Int(0)
            )
        ),
        If(
            p_proposal.hasValue() == Int(0),
            # If Sender.p_<proposal> is not set then set p_<proposal> := proposal.id
            App.localPut(Int(0), byte_p_proposal, proposal_id),
            # if Sender.p_<proposal> != proposal.id then overwrite by setting the new proposal.id, fail otherwise
            If(p_proposal.value() != proposal_id, 
                App.localPut(Int(0), byte_p_proposal, proposal_id), 
                Err()),
        ),
        # record vote in proposal_lsig local state (proposal.<counter> += Sender.deposit)
        Cond(
            [Gtxn[0].application_args[1] == yes, App.localPut(Int(1), yes, App.localGet(Int(1), yes) + deposit)],
            [Gtxn[0].application_args[1] == no, App.localPut(Int(1), no, App.localGet(Int(1), no) + deposit)],
            [Gtxn[0].application_args[1] == abstain, App.localPut(Int(1), abstain, App.localGet(Int(1), abstain) + deposit)]
        ),
        # Update Sender.deposit_lock := max(Sender.deposit_lock, proposal.voting_end)
        If(
            App.localGet(Int(0), Bytes("deposit_lock")) <= voting_end,
            App.localPut(Int(0), Bytes("deposit_lock"), voting_end)
        ),
        Return(Int(1))
    ])

    # Clears Sender local state by removing a record of vote cast from a not active proposal. Args:
    # * proposal : lsig account address with the proposal record (provided as the first external account).
    clear_vote_record = Seq([
        p_proposal,
        is_proposal_active(Int(1)),
        Assert(Global.group_size() == Int(1)),
        # fail if proposal is active (can’t remove proposal record of an active proposal)
        If(
            p_proposal.hasValue() == Int(1),
            If(
                And(
                    p_proposal.value() == proposal_id,
                    scratchvar_is_proposal_active.load() == Int(1)
                ) == Int(1),
                Err()
            )
        ),
        # remove record (Sender.p_<proposal>)
        App.localDel(Int(0), byte_p_proposal),
        Return(Int(1))
    ])

    # Executes a proposal (note: anyone can execute a proposal). Args:
    # * proposal : lsig account address with the proposal record (provided as the first external account)
    execute = Seq([
        compute_result(Int(1)), # save result in scratch
        # Assert that the proposal.result() == 1 and proposal.executed == 0
        Assert(
            And(scratchvar_result.load() == Int(1), executed == Int(0))
        ),
        Cond(
            [
                # Int(1) == ALGO transfer
                proposal_type == Int(1),
                Assert(
                    And(
                        Global.group_size() == Int(2),
                        Gtxn[1].type_enum() == TxnType.Payment,
                        Gtxn[1].sender() == proposal_from,
                        Gtxn[1].receiver() == recipient,
                        Gtxn[1].amount() == amount,
                    )
                )
            ],
            [
                # Int(2) == ASA transfer
                proposal_type == Int(2),
                Assert(
                    And(
                        Global.group_size() == Int(2),
                        Gtxn[1].type_enum() == TxnType.AssetTransfer,
                        Gtxn[1].asset_sender() == proposal_from,
                        Gtxn[1].asset_receiver() == recipient,
                        Gtxn[1].asset_amount() == amount,
                        Gtxn[1].xfer_asset() == asa_id,
                    )
                )
            ],
            [
                # Int(3) == Message (no extra transaction)
                proposal_type == Int(3),
                Assert(Global.group_size() == Int(1))
            ]
        ),
        # set proposal.executed := 1
        App.localPut(Int(1), Bytes("executed"), Int(1)),
        Return(Int(1))
    ])

    # load proposal.id
    proposal_id = App.localGetEx(Int(0), Int(0), Bytes("id"))

    # Clears proposal record and returns back the deposit. Arguments:
    # NOTE: proposalLsig is Txn.sender
    clear_proposal = Seq([
        compute_result(Int(0)), # int(0) as proposal_lsig is txn.sender()
        proposal_id,
        # assert that there is a recorded proposal
        Assert(proposal_id.hasValue() == Int(1)),
        Assert(
            And(
                # Assert amount of withdrawal is proposal.deposit & receiver is sender
                Global.group_size() == Int(2),
                Gtxn[1].asset_amount() == App.globalGet(deposit),
                Gtxn[0].sender() == Gtxn[1].asset_receiver(),
                # fees must be paid by tx0(proposer) and not the deposit_lsig
                Gtxn[1].fee() == Int(0),

                # assert that the voting is not active
                Or(
                    # it’s past execution: proposal.executed == 1  || proposal.execute_before < now
                    Or(executed == Int(1), execute_before < Global.latest_timestamp()) == Int(1),
                    # OR voting failed result() != 1 && proposal.voting_end < now.
                    And(scratchvar_result.load() != Int(1), voting_end < Global.latest_timestamp()) == Int(1)
                )
            )
        ),
        # clear proposal record (sender == proposer_lsig)
        App.localDel(Int(0), Bytes("name")),
        App.localDel(Int(0), Bytes("url")),
        App.localDel(Int(0), Bytes("url_hash")),
        App.localDel(Int(0), Bytes("hash_algo")),
        App.localDel(Int(0), Bytes("voting_start")),
        App.localDel(Int(0), Bytes("voting_end")),
        App.localDel(Int(0), Bytes("execute_before")),
        App.localDel(Int(0), Bytes("type")),
        App.localDel(Int(0), Bytes("from")),
        App.localDel(Int(0), Bytes("recipient")),
        App.localDel(Int(0), Bytes("asa_id")),
        App.localDel(Int(0), Bytes("amount")),
        App.localDel(Int(0), Bytes("msg")),
        App.localDel(Int(0), Bytes("id")),
        App.localDel(Int(0), Bytes("executed")),
        App.localDel(Int(0), Bytes("yes")),
        App.localDel(Int(0), Bytes("no")),
        App.localDel(Int(0), Bytes("abstain")),
        Return(Int(1))
    ])

    program = Cond(
        # Verfies that the application_id is 0, jumps to on_initialize.
        [Txn.application_id() == Int(0), on_initialize],
        # Verifies Update or delete transaction, rejects it.
        [
            Or(
                Txn.on_completion() == OnComplete.UpdateApplication,
                Txn.on_completion() == OnComplete.DeleteApplication
            ),
            Return(Int(0))
        ],
        # Verifies closeout or OptIn transaction, approves it.
        [
            Or(
                Txn.on_completion() == OnComplete.CloseOut,
                Txn.on_completion() == OnComplete.OptIn
            ),
            Return(Int(1))
        ],
        # Verifies add accounts call, jumps to add_deposit_accounts branch.
        [Txn.application_args[0] == Bytes("add_deposit_accounts"), add_deposit_accounts],
        # Verifies add proposal call, jumps to add_proposal branch.
        [Txn.application_args[0] == Bytes("add_proposal"), add_proposal],
        # Verifies deposit_vote call, jumps to deposit_vote branch.
        [Txn.application_args[0] == Bytes("deposit_vote"), deposit_vote],
        # Verifies register_vote call, jumps to register_vote branch.
        [Txn.application_args[0] == Bytes("register_vote"), register_vote],
        # Verifies execute call, jumps to execute branch.
        [Txn.application_args[0] == Bytes("execute"), execute],
        # Verifies withdraw_vote_deposit call, jumps to withdraw_vote_deposit branch.
        [Txn.application_args[0] == Bytes("withdraw_vote_deposit"), withdraw_vote_deposit],
        # Verifies clear_vote_record call, jumps to clear_vote_record branch.
        [Txn.application_args[0] == Bytes("clear_vote_record"), clear_vote_record],
        # Verifies clear_proposal call, jumps to clear_proposal branch.
        [Txn.application_args[0] == Bytes("clear_proposal"), clear_proposal]
    )

    return program

if __name__ == "__main__":
    print(compileTeal(approval_program(), Mode.Application, version = 4))