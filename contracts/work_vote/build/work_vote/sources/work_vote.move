module work_vote::work_vote {
    use std::string::String;

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    use sui::dynamic_field as df;

    /// Key của dynamic field: workId
    struct WorkKey has copy, drop, store {
        id: String,
    }

    /// Value lưu vote count
    struct VoteCount has copy, drop, store {
        value: u64,
    }

    /// Anti double vote: (workId, voter) -> bool
    struct VoterKey has copy, drop, store {
        work_id: String,
        voter: address,
    }

    struct WorkVoteBoard has key {
        id: UID,
        total_votes: u64,
    }

    const E_ALREADY_VOTED: u64 = 0;

    // ✅ Chọn 1 trong 2:
    // (A) entry fun (khuyến nghị cho gọi từ PTB/CLI)
    public entry fun create_board(ctx: &mut TxContext) {
        let board = WorkVoteBoard { id: object::new(ctx), total_votes: 0 };
        transfer::share_object(board);
    }

    public entry fun vote_work(board: &mut WorkVoteBoard, work_id: String, ctx: &mut TxContext) {
        let voter = tx_context::sender(ctx);

        // anti-double vote
        let vk = VoterKey { work_id: copy work_id, voter };
        assert!(!df::exists_(&board.id, vk), E_ALREADY_VOTED);
        df::add(&mut board.id, vk, true);

        // counter
        let wk = WorkKey { id: work_id };

        // exists_ consumes key => dùng copy wk
        if (df::exists_(&board.id, copy wk)) {
            let c = df::borrow_mut<WorkKey, VoteCount>(&mut board.id, wk);
            c.value = c.value + 1;
        } else {
            df::add(&mut board.id, wk, VoteCount { value: 1 });
        };

        board.total_votes = board.total_votes + 1;
    }

    /// View vote cho workId (dùng devInspect nếu cần)
    public fun get_votes(board: &WorkVoteBoard, work_id: String): u64 {
        let wk = WorkKey { id: work_id };
        if (df::exists_(&board.id, copy wk)) {
            df::borrow<WorkKey, VoteCount>(&board.id, wk).value
        } else {
            0
        }
    }

    public fun get_total_votes(board: &WorkVoteBoard): u64 {
        board.total_votes
    }
}
