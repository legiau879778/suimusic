module chainstorm_nft::chainstorm_nft {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::address;

    /* =========================
       GLOBAL REGISTRY
    ========================= */

    public struct Registry has key {
        id: UID,
        // Key phải copyable => dùng address (hash 32 bytes)
        hashes: Table<address, bool>,
    }

    /// init ONCE
    entry fun init_registry(ctx: &mut TxContext) {
        let reg = Registry {
            id: object::new(ctx),
            hashes: table::new(ctx),
        };
        transfer::share_object(reg);
    }

    /* =========================
       WORK NFT
    ========================= */

    public struct WorkNFT has key, store {
        id: UID,
        author: address,
        // hash file/meta dạng address (32 bytes)
        file_hash: address,
        meta_hash: address,
        // Walrus blob ids (string bytes)
        walrus_file_id: vector<u8>,
        walrus_meta_id: vector<u8>,
        // off-chain signatures (string bytes)
        author_sig: vector<u8>,
        tsa_id: vector<u8>,
        tsa_sig: vector<u8>,
        tsa_time: u64,
        approval_sig: vector<u8>,
        proof_id: vector<u8>,
        sell_type: u8, // 1 = exclusive, 2 = license
        royalty: u8,
    }

    /* =========================
       LICENSE NFT
    ========================= */

    public struct LicenseNFT has key, store {
        id: UID,
        work_id: address,
        licensee: address,
        royalty: u8,
        issued_epoch: u64,
    }

    /* =========================
       MINT (ANTI DUPLICATE)
    ========================= */

    /// file_hash_bytes/meta_hash_bytes phải đúng 32 bytes (address::from_bytes)
    entry fun mint(
        registry: &mut Registry,
        file_hash_bytes: vector<u8>,
        meta_hash_bytes: vector<u8>,
        walrus_file_id: vector<u8>,
        walrus_meta_id: vector<u8>,
        author_sig: vector<u8>,
        tsa_id: vector<u8>,
        tsa_sig: vector<u8>,
        tsa_time: u64,
        approval_sig: vector<u8>,
        proof_id: vector<u8>,
        sell_type: u8,
        royalty: u8,
        ctx: &mut TxContext
    ) {
        // Convert hash bytes -> address (consume vector)
        let file_h = address::from_bytes(file_hash_bytes);
        let meta_h = address::from_bytes(meta_hash_bytes);

        assert!(
            !table::contains(&registry.hashes, file_h),
            100 // DUPLICATE_HASH
        );

        table::add(&mut registry.hashes, file_h, true);

        let sender = tx_context::sender(ctx);

        let nft = WorkNFT {
            id: object::new(ctx),
            author: sender,
            file_hash: file_h,
            meta_hash: meta_h,
            walrus_file_id,
            walrus_meta_id,
            author_sig,
            tsa_id,
            tsa_sig,
            tsa_time,
            approval_sig,
            proof_id,
            sell_type,
            royalty,
        };

        transfer::public_transfer(nft, sender);
    }

    /* =========================
       SELL EXCLUSIVE
    ========================= */

    entry fun sell_nft(
        nft: WorkNFT,
        mut payment: Coin<SUI>,
        price: u64,
        buyer: address,
        ctx: &mut TxContext
    ) {
        let seller = tx_context::sender(ctx);
        assert!(seller == nft.author, 101);

        let seller_coin = coin::split(&mut payment, price, ctx);
        transfer::public_transfer(seller_coin, seller);

        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };

        transfer::public_transfer(nft, buyer);
    }

    /* =========================
       ISSUE LICENSE
    ========================= */

    entry fun issue_license(
        work_id: address,
        licensee: address,
        royalty: u8,
        ctx: &mut TxContext
    ) {
        let lic = LicenseNFT {
            id: object::new(ctx),
            work_id,
            licensee,
            royalty,
            issued_epoch: tx_context::epoch(ctx),
        };

        transfer::public_transfer(lic, licensee);
    }
}
