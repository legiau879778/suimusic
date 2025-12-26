module membership_contract::package {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    const EInsufficientBalance: u64 = 0;

    // ĐỊA CHỈ VÍ NHẬN TIỀN (Ví Gmail của bạn)
    const ADMIN_RECEIVER: address = @0x8bf44325ec3eb38577c3b805e25872199ce1577e3183893a5ae05216a9651a85;

    public struct MembershipPurchased has copy, drop {
        buyer: address,
        type_id: u8,
        amount: u64,
    }

    public fun buy_membership(
        payment: Coin<SUI>,
        type_id: u8,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        assert!(amount > 0, EInsufficientBalance);

        event::emit(MembershipPurchased {
            buyer: ctx.sender(),
            type_id,
            amount,
        });

        transfer::public_transfer(payment, ADMIN_RECEIVER);
    }
}