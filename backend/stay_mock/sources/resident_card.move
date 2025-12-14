module resident_nft::resident_card {
    use std::string::{Self, String};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};
    use sui::clock::{Self, Clock};

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

    /// NFT発行イベント
    public struct ResidentCardMinted has copy, drop {
        nft_id: address,
        owner: address,
        name: String,
        issued_at: u64,
    }

    /// 住民票NFTをミント
    public entry fun mint_resident_card(
        name: vector<u8>,
        image_url: vector<u8>,
        metadata_url: vector<u8>,
        address_info: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
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
}
