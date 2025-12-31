module resident_nft::resident_card {
    use std::string::{Self, String};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};

    // ========================================
    // エラーコード
    // ========================================

    /// ユーザーは既に住民票NFTを発行済み
    const E_ALREADY_MINTED: u64 = 1;

    // ========================================
    // Structs
    // ========================================

    /// 住民票NFT発行の台帳（Shared Object）
    /// デプロイ時に1つだけ作成され、全ユーザーで共有
    public struct ResidentRegistry has key {
        id: UID,
        /// 発行済みアドレスの記録 (address -> true)
        record: Table<address, bool>,
    }

    /// 住民票NFT - デジタル住民証明書
    public struct ResidentNFT has key, store {
        id: UID,
        /// 氏名
        name: String,
        /// IPFS画像URL
        image_url: Url,
        /// IPFSメタデータURL
        metadata_url: Url,
        /// 住所情報
        address_info: String,
        /// 発行日時（ミリ秒）
        issued_at: u64,
        /// 発行者アドレス
        issuer: address,
    }

    // ========================================
    // Events
    // ========================================

    /// NFT発行イベント
    public struct ResidentCardMinted has copy, drop {
        nft_id: address,
        owner: address,
        name: String,
        issued_at: u64,
    }

    /// Registry作成イベント
    public struct RegistryCreated has copy, drop {
        registry_id: address,
    }

    // ========================================
    // Module Initializer
    // ========================================

    /// モジュールデプロイ時に自動実行される初期化関数
    /// ResidentRegistryを作成し、共有オブジェクトとして公開
    fun init(ctx: &mut TxContext) {
        let registry = ResidentRegistry {
            id: object::new(ctx),
            record: table::new(ctx),
        };

        let registry_id = object::uid_to_address(&registry.id);

        event::emit(RegistryCreated {
            registry_id,
        });

        // Shared Objectとして公開（全ユーザーがアクセス可能）
        transfer::share_object(registry);
    }

    // ========================================
    // Entry Functions
    // ========================================

    /// 住民票NFTをミント（Registry登録による重複防止付き）
    /// 
    /// # Arguments
    /// * `registry` - 発行済みユーザーの台帳（Shared Object）
    /// * `name` - 氏名（UTF-8バイト列）
    /// * `image_url` - IPFS画像URL（UTF-8バイト列）
    /// * `metadata_url` - IPFSメタデータURL（UTF-8バイト列）
    /// * `address_info` - 住所情報（UTF-8バイト列）
    /// * `clock` - システムクロック
    /// 
    /// # Errors
    /// * `E_ALREADY_MINTED` - 既に住民票NFTを発行済みの場合
    public entry fun mint_resident_card(
        registry: &mut ResidentRegistry,
        name: vector<u8>,
        image_url: vector<u8>,
        metadata_url: vector<u8>,
        address_info: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        // 重複発行チェック: 既に発行済みならエラー
        assert!(!table::contains(&registry.record, sender), E_ALREADY_MINTED);

        // 発行済みとして台帳に記録
        table::add(&mut registry.record, sender, true);

        let timestamp = clock::timestamp_ms(clock);

        let nft = ResidentNFT {
            id: object::new(ctx),
            name: string::utf8(name),
            image_url: url::new_unsafe_from_bytes(image_url),
            metadata_url: url::new_unsafe_from_bytes(metadata_url),
            address_info: string::utf8(address_info),
            issued_at: timestamp,
            issuer: sender,
        };

        let nft_id = object::uid_to_address(&nft.id);

        event::emit(ResidentCardMinted {
            nft_id,
            owner: sender,
            name: string::utf8(name),
            issued_at: timestamp,
        });

        transfer::public_transfer(nft, sender);
    }

    // ========================================
    // View Functions
    // ========================================

    /// 指定アドレスが既に住民票NFTを持っているかチェック
    public fun has_resident_card(registry: &ResidentRegistry, addr: address): bool {
        table::contains(&registry.record, addr)
    }

    /// NFT情報を取得
    public fun get_name(nft: &ResidentNFT): &String {
        &nft.name
    }

    public fun get_image_url(nft: &ResidentNFT): &Url {
        &nft.image_url
    }

    public fun get_address_info(nft: &ResidentNFT): &String {
        &nft.address_info
    }

    public fun get_issued_at(nft: &ResidentNFT): u64 {
        nft.issued_at
    }

    public fun get_issuer(nft: &ResidentNFT): address {
        nft.issuer
    }

    // ========================================
    // Test Functions (テスト用)
    // ========================================

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
