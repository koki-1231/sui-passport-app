/// ZK Location Proof Module
/// 
/// GPS座標のプライバシー保護とZK証明検証機能を提供
/// Sui Framework の groth16 モジュールを活用
/// 
/// v1.0 - 初期実装（コミットメントベース + Groth16準備）
module resident_nft::zk_location_proof {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::hash;
    use sui::bcs;
    // Groth16 ZK証明検証（将来の本格実装用）
    // use sui::groth16;

    // ========================================
    // Constants
    // ========================================

    /// クールダウン時間（1時間）
    const COOLDOWN_MS: u64 = 3600000;

    /// 基本報酬
    const BASE_REWARD: u64 = 10;

    /// 最大nullifier数（ガベージコレクション閾値）
    const MAX_NULLIFIERS: u64 = 10000;

    // ========================================
    // エラーコード
    // ========================================

    const E_PROOF_ALREADY_USED: u64 = 1;
    const E_INVALID_PROOF: u64 = 2;
    const E_COOLDOWN_NOT_ELAPSED: u64 = 3;
    const E_NOT_ADMIN: u64 = 4;
    const E_INVALID_COMMITMENT: u64 = 5;
    const E_TIMESTAMP_TOO_OLD: u64 = 6;
    const E_TIMESTAMP_IN_FUTURE: u64 = 7;

    // ========================================
    // Capability Structs
    // ========================================

    /// ZK証明検証の管理者権限
    public struct ZkProofAdminCap has key, store {
        id: UID,
    }

    // ========================================
    // Core Structs
    // ========================================

    /// ZK証明レジストリ（Shared Object）
    public struct ZkProofRegistry has key {
        id: UID,
        /// 使用済みnullifier（二重使用防止）
        used_nullifiers: Table<vector<u8>, bool>,
        /// ユーザー別最終チェックイン時刻
        last_checkin: Table<address, u64>,
        /// 総証明数
        total_proofs_verified: u64,
        /// プライバシーレベル設定
        default_privacy_level: u8,  // 0: exact, 1: city, 2: prefecture, 3: country
    }

    /// ZK位置証明オブジェクト
    /// ユーザーが所有し、プライバシーを保護しながら位置を証明
    public struct ZkLocationProof has key, store {
        id: UID,
        /// 所有者アドレス
        owner: address,
        /// 証明ハッシュ（H(commitment || nullifier || timestamp)）
        proof_hash: vector<u8>,
        /// 地域コミットメント（公開可能）
        region_commitment: vector<u8>,
        /// エポック日（公開可能）
        epoch_day: u64,
        /// 作成タイムスタンプ
        timestamp: u64,
        /// 報酬額
        reward_amount: u64,
        /// プライバシーレベル
        privacy_level: u8,
    }

    /// Groth16証明データ（将来の本格ZK実装用）
    public struct Groth16ProofData has store, drop {
        /// 証明ポイント (a, b, c)
        proof_points: vector<u8>,
        /// 公開入力
        public_inputs: vector<u8>,
        /// 使用カーブ (0: BLS12-381, 1: BN254)
        curve_id: u8,
    }

    // ========================================
    // Events
    // ========================================

    public struct ZkProofVerified has copy, drop {
        user: address,
        proof_hash: vector<u8>,
        region_commitment: vector<u8>,
        epoch_day: u64,
        reward_amount: u64,
        privacy_level: u8,
        timestamp: u64,
    }

    public struct ZkRegistryCreated has copy, drop {
        registry_id: address,
    }

    public struct NullifierUsed has copy, drop {
        nullifier_hash: vector<u8>,
        user: address,
        epoch_day: u64,
    }

    // ========================================
    // Initializer
    // ========================================

    fun init(ctx: &mut TxContext) {
        // 管理者権限を発行
        let admin = ZkProofAdminCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(admin, tx_context::sender(ctx));

        // レジストリを作成
        let registry = ZkProofRegistry {
            id: object::new(ctx),
            used_nullifiers: table::new(ctx),
            last_checkin: table::new(ctx),
            total_proofs_verified: 0,
            default_privacy_level: 1,  // city level by default
        };

        event::emit(ZkRegistryCreated {
            registry_id: object::uid_to_address(&registry.id),
        });

        transfer::share_object(registry);
    }

    // ========================================
    // Core Functions
    // ========================================

    /// ZK位置証明を検証してトークンを付与
    /// 
    /// # Arguments
    /// * `registry` - ZK証明レジストリ
    /// * `commitment` - 位置コミットメント H(lat || lng || salt)
    /// * `nullifier` - 二重使用防止 H(address || epoch_day || region_id)
    /// * `region_commitment` - 地域コミットメント H(region_id || epoch_day)
    /// * `epoch_day` - エポック日
    /// * `privacy_level` - プライバシーレベル
    /// * `clock` - システムクロック
    public entry fun verify_and_mint(
        registry: &mut ZkProofRegistry,
        commitment: vector<u8>,
        nullifier: vector<u8>,
        region_commitment: vector<u8>,
        epoch_day: u64,
        privacy_level: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // タイムスタンプ検証（24時間以内のエポック日のみ有効）
        let current_epoch_day = current_time / 86400000;  // ms to days
        assert!(epoch_day <= current_epoch_day, E_TIMESTAMP_IN_FUTURE);
        assert!(epoch_day >= current_epoch_day - 1, E_TIMESTAMP_TOO_OLD);

        // クールダウンチェック
        if (table::contains(&registry.last_checkin, sender)) {
            let last_time = *table::borrow(&registry.last_checkin, sender);
            assert!(current_time >= last_time + COOLDOWN_MS, E_COOLDOWN_NOT_ELAPSED);
        };

        // Nullifier重複チェック（二重使用防止）
        assert!(!table::contains(&registry.used_nullifiers, nullifier), E_PROOF_ALREADY_USED);

        // コミットメント検証（基本的な長さチェック）
        assert!(vector::length(&commitment) == 32, E_INVALID_COMMITMENT);
        assert!(vector::length(&nullifier) == 32, E_INVALID_PROOF);

        // 証明ハッシュを生成
        let proof_hash = generate_proof_hash(&commitment, &nullifier, current_time);

        // Nullifierを使用済みに記録
        table::add(&mut registry.used_nullifiers, nullifier, true);

        // 最終チェックイン時刻を更新
        if (table::contains(&registry.last_checkin, sender)) {
            let _ = table::remove(&mut registry.last_checkin, sender);
        };
        table::add(&mut registry.last_checkin, sender, current_time);

        // カウンターを更新
        registry.total_proofs_verified = registry.total_proofs_verified + 1;

        // 報酬計算（プライバシーレベルに応じたボーナス）
        let reward = calculate_privacy_bonus(BASE_REWARD, privacy_level);

        // ZkLocationProofを発行
        let zk_proof = ZkLocationProof {
            id: object::new(ctx),
            owner: sender,
            proof_hash,
            region_commitment,
            epoch_day,
            timestamp: current_time,
            reward_amount: reward,
            privacy_level,
        };

        event::emit(ZkProofVerified {
            user: sender,
            proof_hash,
            region_commitment,
            epoch_day,
            reward_amount: reward,
            privacy_level,
            timestamp: current_time,
        });

        event::emit(NullifierUsed {
            nullifier_hash: nullifier,
            user: sender,
            epoch_day,
        });

        transfer::public_transfer(zk_proof, sender);
    }

    /// 証明ハッシュを生成
    fun generate_proof_hash(
        commitment: &vector<u8>,
        nullifier: &vector<u8>,
        timestamp: u64,
    ): vector<u8> {
        let mut data = vector::empty<u8>();
        
        // commitment追加
        let mut i = 0;
        while (i < vector::length(commitment)) {
            vector::push_back(&mut data, *vector::borrow(commitment, i));
            i = i + 1;
        };
        
        // nullifier追加
        i = 0;
        while (i < vector::length(nullifier)) {
            vector::push_back(&mut data, *vector::borrow(nullifier, i));
            i = i + 1;
        };
        
        // timestamp追加
        let ts_bytes = bcs::to_bytes(&timestamp);
        i = 0;
        while (i < vector::length(&ts_bytes)) {
            vector::push_back(&mut data, *vector::borrow(&ts_bytes, i));
            i = i + 1;
        };
        
        hash::keccak256(&data)
    }

    /// プライバシーレベルに応じたボーナス計算
    /// より高いプライバシー = より高い報酬
    fun calculate_privacy_bonus(base_reward: u64, privacy_level: u8): u64 {
        if (privacy_level == 0) {
            base_reward  // exact: 1.0x
        } else if (privacy_level == 1) {
            base_reward * 110 / 100  // city: 1.1x
        } else if (privacy_level == 2) {
            base_reward * 125 / 100  // prefecture: 1.25x
        } else {
            base_reward * 150 / 100  // country: 1.5x
        }
    }

    // ========================================
    // Groth16 ZK証明検証（将来実装）
    // ========================================

    /// Groth16証明を検証
    /// 
    /// 注: この関数は将来の本格ZK実装用のプレースホルダー
    /// 実装時は sui::groth16 モジュールを使用
    public fun verify_groth16_proof(
        _proof_data: &Groth16ProofData,
        _verifying_key: &vector<u8>,
    ): bool {
        // TODO: 本格実装
        // let curve = if (proof_data.curve_id == 0) {
        //     groth16::bls12381()
        // } else {
        //     groth16::bn254()
        // };
        // 
        // let pvk = groth16::prepare_verifying_key(&curve, verifying_key);
        // let public_inputs = groth16::public_proof_inputs_from_bytes(proof_data.public_inputs);
        // let proof_points = groth16::proof_points_from_bytes(proof_data.proof_points);
        // 
        // groth16::verify_groth16_proof(&curve, &pvk, &public_inputs, &proof_points)
        
        true  // プレースホルダー: 常にtrue
    }

    // ========================================
    // Admin Functions
    // ========================================

    /// デフォルトプライバシーレベルを設定
    public entry fun set_default_privacy_level(
        _admin: &ZkProofAdminCap,
        registry: &mut ZkProofRegistry,
        level: u8,
    ) {
        registry.default_privacy_level = level;
    }

    // ========================================
    // View Functions
    // ========================================

    /// Nullifierが使用済みかチェック
    public fun is_nullifier_used(registry: &ZkProofRegistry, nullifier: vector<u8>): bool {
        table::contains(&registry.used_nullifiers, nullifier)
    }

    /// 総証明数を取得
    public fun get_total_proofs(registry: &ZkProofRegistry): u64 {
        registry.total_proofs_verified
    }

    /// クールダウン残り時間を取得
    public fun get_cooldown_remaining(
        registry: &ZkProofRegistry, 
        user: address,
        clock: &Clock
    ): u64 {
        if (!table::contains(&registry.last_checkin, user)) {
            return 0
        };
        
        let last_time = *table::borrow(&registry.last_checkin, user);
        let current_time = clock::timestamp_ms(clock);
        let next_available = last_time + COOLDOWN_MS;
        
        if (current_time >= next_available) {
            0
        } else {
            next_available - current_time
        }
    }

    /// ZkLocationProofの情報を取得
    public fun get_proof_info(proof: &ZkLocationProof): (address, vector<u8>, u64, u64, u8) {
        (
            proof.owner,
            proof.proof_hash,
            proof.epoch_day,
            proof.reward_amount,
            proof.privacy_level,
        )
    }

    // ========================================
    // Test Functions
    // ========================================

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
