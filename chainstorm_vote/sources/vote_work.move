module vote::work_vote {
    use sui::dynamic_field;
    use sui::event;
    use sui::object::{Self, UID, uid_to_address};
    use sui::transfer;
    use sui::tx_context::TxContext;

    struct Board has key {
        id: UID,
        total: u64,
    }

    struct VoteEvent has copy, drop, store {
        work: address,
        total: u64,
        board: address,
    }

    /// Create and share a new vote board (shared object).
    entry public fun init_board(ctx: &mut TxContext) {
        let board = Board { id: object::new(ctx), total: 0 };
        transfer::share_object(board);
    }

    /// Vote for a work id (address). Stored as dynamic field <address => u64>.
    entry public fun vote_work(board: &mut Board, work_id: address, _ctx: &mut TxContext) {
        if (dynamic_field::exists_with_type<address, u64>(&board.id, work_id)) {
            let v = dynamic_field::borrow_mut<address, u64>(&mut board.id, work_id);
            *v = *v + 1;
        } else {
            dynamic_field::add<address, u64>(&mut board.id, work_id, 1);
        };
        board.total = board.total + 1;
        event::emit(VoteEvent { work: work_id, total: board.total, board: uid_to_address(&board.id) });
    }

    /// Read vote count; returns 0 if not set.
    public fun get_count(board: &Board, work_id: address): u64 {
        if (!dynamic_field::exists_with_type<address, u64>(&board.id, work_id)) return 0;
        let v = dynamic_field::borrow<address, u64>(&board.id, work_id);
        *v
    }
}
