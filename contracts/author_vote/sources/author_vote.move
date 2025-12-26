module author_vote::author_vote {
    use std::string::String;
    use std::vector;

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};

    /// Shared object lưu votes theo authorId + anti-double-vote theo (authorId -> (voter -> bool))
    struct AuthorVoteBoard has key {
        id: UID,
        votes: Table<String, u64>,                      // authorId -> totalVotes
        voted: Table<String, Table<address, bool>>,     // authorId -> (voter -> true)
        total_votes: u64,
    }

    /// Error codes
    const E_ALREADY_VOTED: u64 = 0;

    /// Khởi tạo board (owner nhận object, rồi share)
    public entry fun create_board(ctx: &mut TxContext) {
        let board = AuthorVoteBoard {
            id: object::new(ctx),
            votes: table::new(ctx),
            voted: table::new(ctx),
            total_votes: 0,
        };

        // share board để mọi người dùng chung
        transfer::share_object(board);
    }

    /// Vote cho 1 authorId.
    /// - Mỗi voter chỉ vote 1 lần / 1 authorId.
    public entry fun vote_author(board: &mut AuthorVoteBoard, author_id: String, ctx: &mut TxContext) {
        let voter = tx_context::sender(ctx);

        // lấy/khởi tạo bảng voted cho author_id
        if (!table::contains(&board.voted, author_id)) {
            let m = table::new(ctx);
            table::add(&mut board.voted, author_id, m);
        };

        let author_voted_map = table::borrow_mut(&mut board.voted, author_id);

        // chặn vote 2 lần
        assert!(!table::contains(author_voted_map, voter), E_ALREADY_VOTED);

        // mark đã vote
        table::add(author_voted_map, voter, true);

        // tăng counter votes
        let cur = if (table::contains(&board.votes, author_id)) {
            *table::borrow(&board.votes, author_id)
        } else {
            0
        };

        if (table::contains(&board.votes, author_id)) {
            let vref = table::borrow_mut(&mut board.votes, author_id);
            *vref = cur + 1;
        } else {
            table::add(&mut board.votes, author_id, 1);
        };

        board.total_votes = board.total_votes + 1;
    }

    /// View: lấy vote count cho authorId (không entry)
    public fun get_votes(board: &AuthorVoteBoard, author_id: String): u64 {
        if (table::contains(&board.votes, author_id)) *table::borrow(&board.votes, author_id) else 0
    }

    /// View: tổng votes toàn hệ
    public fun get_total_votes(board: &AuthorVoteBoard): u64 {
        board.total_votes
    }
}
