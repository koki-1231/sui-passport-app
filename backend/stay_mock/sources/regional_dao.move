/// Regional DAO Module - 地方DAO実装
/// 
/// MyauChainの2段階DAO構造を参考に、地方自治体レベルのガバナンスを実現
/// 
/// v2.0 - proof_hash二重報酬防止 + 全体DAO双方向連携
module resident_nft::regional_dao {
    use std::string::{Self, String};
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::hash;
    use sui::bcs;

    // ========================================
    // Constants
    // ========================================

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PASSED: u8 = 1;
    const STATUS_REJECTED: u8 = 2;
    const STATUS_ESCALATED: u8 = 3;

    /// 全体DAOへのエスカレーション閾値（60%以上の賛成でエスカレーション可能）
    const ESCALATION_THRESHOLD_PERCENT: u64 = 60;

    // ========================================
    // エラーコード
    // ========================================
    const E_NOT_REGION_ADMIN: u64 = 100;
    const E_NOT_MUNICIPALITY: u64 = 101;
    const E_REGION_NOT_FOUND: u64 = 102;
    const E_NOT_RESIDENT: u64 = 103;
    const E_ALREADY_VOTED: u64 = 104;
    const E_PROPOSAL_NOT_ACTIVE: u64 = 105;
    const E_INSUFFICIENT_BALANCE: u64 = 106;
    const E_ESCALATION_THRESHOLD_NOT_MET: u64 = 107;
    const E_PROOF_ALREADY_USED: u64 = 108;
    const E_COOLDOWN_NOT_ELAPSED: u64 = 109;

    // ========================================
    // Capability Structs
    // ========================================

    /// プラットフォーム管理者（地域登録権限）
    public struct PlatformAdminCap has key, store {
        id: UID,
    }

    /// 自治体発行権限（住民票NFT発行権限）
    public struct MunicipalityIssuerCap has key, store {
        id: UID,
        region_id: u64,
        municipality_name: String,
    }

    /// 地域管理者権限（トークン配布権限）
    public struct RegionAdminCap has key, store {
        id: UID,
        region_id: u64,
    }

    // ========================================
    // Core Structs
    // ========================================

    /// グローバルプラットフォーム状態
    public struct GlobalPlatformState has key {
        id: UID,
        next_region_id: u64,
        /// 登録済み地域のID一覧
        regions: Table<u64, ID>,
    }

    /// 地域DAO状態（Shared Object）
    public struct RegionDaoState has key {
        id: UID,
        region_id: u64,
        region_name: String,
        /// 次の提案ID
        next_proposal_id: u64,
        /// 提案一覧
        proposals: Table<u64, RegionalProposal>,
        /// 投票トークン残高
        balances: Table<address, u64>,
        /// 地域メトリクス
        metrics: RegionMetrics,
        /// 使用済みproof_hash（二重報酬防止）
        used_proofs: Table<vector<u8>, bool>,
        /// ユーザー別最終チェックイン時刻（クールダウン用）
        last_checkin: Table<address, u64>,
    }

    /// 地域提案
    public struct RegionalProposal has store, drop {
        id: u64,
        title: String,
        description: String,
        creator: address,
        yes_votes: u64,
        no_votes: u64,
        status: u8,
        created_at: u64,
        deadline: u64,
    }

    /// 地域メトリクス（動的発行計算用）
    public struct RegionMetrics has store, drop {
        /// 人口密度（低いほど過疎地域）
        population_density: u64,
        /// 最近のアクティブ行動数
        recent_active_actions: u64,
        /// 登録住民数
        registered_residents: u64,
        /// 最終更新時刻
        last_updated: u64,
    }

    /// 行動証明オブジェクト（MyauChain: ActionReceipt互換）
    public struct LocalActionReceipt has key, store {
        id: UID,
        region_id: u64,
        actor: address,
        proof_hash: vector<u8>,
        lat: u64,
        lng: u64,
        reward_amount: u64,
        timestamp: u64,
    }

    /// 全体DAOからの指令を受け取るオブジェクト
    public struct GlobalDirective has key, store {
        id: UID,
        directive_type: u8,  // 0: パラメータ変更, 1: 予算配分, 2: 緊急停止
        payload: u64,
        issued_at: u64,
        executed: bool,
    }

    /// 地域住民パス（地方DAOへの参加資格）
    public struct RegionalResidentPass has key, store {
        id: UID,
        region_id: u64,
        owner: address,
        issued_at: u64,
    }

    /// 全体DAOへのエスカレーション証明
    public struct EscalationReceipt has key, store {
        id: UID,
        region_id: u64,
        proposal_id: u64,
        title: String,
        description: String,
        yes_votes: u64,
        total_votes: u64,
        approval_rate: u64,
        escalated_at: u64,
    }

    // ========================================
    // Events
    // ========================================

    public struct RegionRegistered has copy, drop {
        region_id: u64,
        region_name: String,
        municipality_address: address,
        registered_at: u64,
    }

    public struct RegionalProposalCreated has copy, drop {
        region_id: u64,
        proposal_id: u64,
        title: String,
        creator: address,
    }

    public struct RegionalVoteCast has copy, drop {
        region_id: u64,
        proposal_id: u64,
        voter: address,
        amount: u64,
        choice: bool,
    }

    public struct ProposalEscalated has copy, drop {
        region_id: u64,
        proposal_id: u64,
        title: String,
        approval_rate: u64,
        escalated_at: u64,
    }

    public struct LocalTokensDistributed has copy, drop {
        region_id: u64,
        recipient: address,
        amount: u64,
        reason: String,
    }

    /// 地方トークン発行イベント（proof_hash付き）
    public struct LocalTokenMinted has copy, drop {
        region_id: u64,
        actor: address,
        amount: u64,
        proof_hash: vector<u8>,
        lat: u64,
        lng: u64,
        timestamp: u64,
    }

    /// 全体DAOからの指令受信イベント
    public struct GlobalDirectiveReceived has copy, drop {
        region_id: u64,
        directive_type: u8,
        payload: u64,
        received_at: u64,
    }

    /// 人口密度更新イベント
    public struct PopulationDensityUpdated has copy, drop {
        region_id: u64,
        old_density: u64,
        new_density: u64,
        updated_at: u64,
    }

    // ========================================
    // Initializer
    // ========================================

    fun init(ctx: &mut TxContext) {
        // プラットフォーム管理者権限を発行
        let admin = PlatformAdminCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(admin, tx_context::sender(ctx));

        // グローバル状態を初期化
        let platform = GlobalPlatformState {
            id: object::new(ctx),
            next_region_id: 1,
            regions: table::new(ctx),
        };
        transfer::share_object(platform);
    }

    // ========================================
    // 地域管理
    // ========================================

    /// 新しい地域を登録（プラットフォーム管理者のみ）
    public entry fun register_region(
        _admin: &PlatformAdminCap,
        platform: &mut GlobalPlatformState,
        region_name: vector<u8>,
        municipality_address: address,
        initial_population_density: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let region_id = platform.next_region_id;
        platform.next_region_id = region_id + 1;

        // 地域DAO状態を作成
        let region_state = RegionDaoState {
            id: object::new(ctx),
            region_id,
            region_name: string::utf8(region_name),
            next_proposal_id: 1,
            proposals: table::new(ctx),
            balances: table::new(ctx),
            metrics: RegionMetrics {
                population_density: initial_population_density,
                recent_active_actions: 0,
                registered_residents: 0,
                last_updated: clock::timestamp_ms(clock),
            },
            used_proofs: table::new(ctx),
            last_checkin: table::new(ctx),
        };

        let region_state_id = object::id(&region_state);
        table::add(&mut platform.regions, region_id, region_state_id);

        // 自治体発行権限を発行
        let issuer_cap = MunicipalityIssuerCap {
            id: object::new(ctx),
            region_id,
            municipality_name: string::utf8(region_name),
        };
        transfer::public_transfer(issuer_cap, municipality_address);

        // 地域管理者権限を事業主に発行
        let region_admin = RegionAdminCap {
            id: object::new(ctx),
            region_id,
        };
        transfer::public_transfer(region_admin, tx_context::sender(ctx));

        event::emit(RegionRegistered {
            region_id,
            region_name: string::utf8(region_name),
            municipality_address,
            registered_at: clock::timestamp_ms(clock),
        });

        transfer::share_object(region_state);
    }

    // ========================================
    // 住民パス発行
    // ========================================

    /// 地域住民パスを発行（自治体のみ）
    public entry fun issue_resident_pass(
        issuer: &MunicipalityIssuerCap,
        region_state: &mut RegionDaoState,
        recipient: address,
        initial_token_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(issuer.region_id == region_state.region_id, E_NOT_MUNICIPALITY);

        let pass = RegionalResidentPass {
            id: object::new(ctx),
            region_id: region_state.region_id,
            owner: recipient,
            issued_at: clock::timestamp_ms(clock),
        };

        // 初期トークンを付与
        if (table::contains(&region_state.balances, recipient)) {
            let current = table::remove(&mut region_state.balances, recipient);
            table::add(&mut region_state.balances, recipient, current + initial_token_amount);
        } else {
            table::add(&mut region_state.balances, recipient, initial_token_amount);
        };

        region_state.metrics.registered_residents = region_state.metrics.registered_residents + 1;

        transfer::public_transfer(pass, recipient);
    }

    // ========================================
    // トークン管理
    // ========================================

    /// 地域トークンを配布（地域管理者のみ）
    public entry fun distribute_local_tokens(
        admin: &RegionAdminCap,
        region_state: &mut RegionDaoState,
        recipient: address,
        amount: u64,
        reason: vector<u8>,
    ) {
        assert!(admin.region_id == region_state.region_id, E_NOT_REGION_ADMIN);

        if (table::contains(&region_state.balances, recipient)) {
            let current = table::remove(&mut region_state.balances, recipient);
            table::add(&mut region_state.balances, recipient, current + amount);
        } else {
            table::add(&mut region_state.balances, recipient, amount);
        };

        event::emit(LocalTokensDistributed {
            region_id: region_state.region_id,
            recipient,
            amount,
            reason: string::utf8(reason),
        });
    }

    /// チェックインによる動的トークン報酬
    public entry fun reward_for_checkin(
        region_state: &mut RegionDaoState,
        pass: &RegionalResidentPass,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(pass.region_id == region_state.region_id, E_NOT_RESIDENT);
        assert!(pass.owner == sender, E_NOT_RESIDENT);

        // 動的報酬計算
        let reward = calculate_dynamic_reward(
            10,  // base_reward
            region_state.metrics.population_density,
            region_state.metrics.recent_active_actions,
        );

        // トークン付与
        if (table::contains(&region_state.balances, sender)) {
            let current = table::remove(&mut region_state.balances, sender);
            table::add(&mut region_state.balances, sender, current + reward);
        } else {
            table::add(&mut region_state.balances, sender, reward);
        };

        // メトリクス更新
        region_state.metrics.recent_active_actions = region_state.metrics.recent_active_actions + 1;
        region_state.metrics.last_updated = clock::timestamp_ms(clock);
    }

    /// 動的報酬計算（MyauChainのアルゴリズムを改良）
    fun calculate_dynamic_reward(
        base_reward: u64,
        population_density: u64,
        recent_actions: u64,
    ): u64 {
        // 過疎地域ほど高い報酬
        let density_factor = if (population_density == 0) {
            200  // 2.0x
        } else if (population_density < 100) {
            150  // 1.5x
        } else if (population_density < 500) {
            120  // 1.2x
        } else {
            100  // 1.0x
        };

        // 活動が少ない地域ほど高い報酬（活性化促進）
        let activity_factor = if (recent_actions < 10) {
            150  // 1.5x
        } else if (recent_actions < 100) {
            120  // 1.2x
        } else {
            100  // 1.0x
        };

        // 最終報酬
        (base_reward * density_factor * activity_factor) / 10000
    }

    // ========================================
    // 地方提案・投票
    // ========================================

    /// 地方提案を作成
    public entry fun create_regional_proposal(
        region_state: &mut RegionDaoState,
        pass: &RegionalResidentPass,
        title: vector<u8>,
        description: vector<u8>,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(pass.region_id == region_state.region_id, E_NOT_RESIDENT);
        assert!(pass.owner == sender, E_NOT_RESIDENT);

        let proposal_id = region_state.next_proposal_id;
        region_state.next_proposal_id = proposal_id + 1;

        let current_time = clock::timestamp_ms(clock);

        let proposal = RegionalProposal {
            id: proposal_id,
            title: string::utf8(title),
            description: string::utf8(description),
            creator: sender,
            yes_votes: 0,
            no_votes: 0,
            status: STATUS_ACTIVE,
            created_at: current_time,
            deadline: current_time + duration_ms,
        };

        event::emit(RegionalProposalCreated {
            region_id: region_state.region_id,
            proposal_id,
            title: string::utf8(title),
            creator: sender,
        });

        table::add(&mut region_state.proposals, proposal_id, proposal);
    }

    /// 地方提案に投票（トークン消費型）
    public entry fun vote_regional(
        region_state: &mut RegionDaoState,
        pass: &RegionalResidentPass,
        proposal_id: u64,
        amount: u64,
        choice: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        assert!(pass.region_id == region_state.region_id, E_NOT_RESIDENT);
        assert!(pass.owner == sender, E_NOT_RESIDENT);

        // 残高チェック
        assert!(table::contains(&region_state.balances, sender), E_INSUFFICIENT_BALANCE);
        let balance = table::remove(&mut region_state.balances, sender);
        assert!(balance >= amount, E_INSUFFICIENT_BALANCE);
        table::add(&mut region_state.balances, sender, balance - amount);

        // 提案を取得して更新
        let proposal = table::borrow_mut(&mut region_state.proposals, proposal_id);
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        assert!(current_time < proposal.deadline, E_PROPOSAL_NOT_ACTIVE);

        if (choice) {
            proposal.yes_votes = proposal.yes_votes + amount;
        } else {
            proposal.no_votes = proposal.no_votes + amount;
        };

        event::emit(RegionalVoteCast {
            region_id: region_state.region_id,
            proposal_id,
            voter: sender,
            amount,
            choice,
        });
    }

    // ========================================
    // エスカレーション（地方 → 全体）
    // ========================================

    /// 可決された提案を全体DAOへエスカレーション
    public entry fun escalate_to_global(
        region_state: &mut RegionDaoState,
        proposal_id: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let proposal = table::borrow_mut(&mut region_state.proposals, proposal_id);
        
        assert!(proposal.status == STATUS_PASSED, E_PROPOSAL_NOT_ACTIVE);

        let total_votes = proposal.yes_votes + proposal.no_votes;
        let approval_rate = if (total_votes > 0) {
            (proposal.yes_votes * 100) / total_votes
        } else {
            0
        };

        // エスカレーション閾値チェック
        assert!(approval_rate >= ESCALATION_THRESHOLD_PERCENT, E_ESCALATION_THRESHOLD_NOT_MET);

        let current_time = clock::timestamp_ms(clock);

        // エスカレーション証明を発行
        let receipt = EscalationReceipt {
            id: object::new(ctx),
            region_id: region_state.region_id,
            proposal_id,
            title: proposal.title,
            description: proposal.description,
            yes_votes: proposal.yes_votes,
            total_votes,
            approval_rate,
            escalated_at: current_time,
        };

        proposal.status = STATUS_ESCALATED;

        event::emit(ProposalEscalated {
            region_id: region_state.region_id,
            proposal_id,
            title: proposal.title,
            approval_rate,
            escalated_at: current_time,
        });

        // 証明書を全体DAOに送信（または管理者に転送）
        transfer::public_transfer(receipt, tx_context::sender(ctx));
    }

    // ========================================
    // proof_hash付きチェックイン報酬（MyauChain統合）
    // ========================================

    /// proof_hash付きチェックイン報酬（二重報酬防止）
    /// MyauChainのrecord_checkin相当
    public entry fun reward_for_checkin_with_proof(
        region_state: &mut RegionDaoState,
        pass: &RegionalResidentPass,
        lat: u64,
        lng: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // 所有確認
        assert!(pass.region_id == region_state.region_id, E_NOT_RESIDENT);
        assert!(pass.owner == sender, E_NOT_RESIDENT);

        // クールダウンチェック（1時間 = 3600000ms）
        if (table::contains(&region_state.last_checkin, sender)) {
            let last_time = *table::borrow(&region_state.last_checkin, sender);
            assert!(current_time >= last_time + 3600000, E_COOLDOWN_NOT_ELAPSED);
        };

        // proof_hash生成
        let proof_hash = generate_local_proof_hash(
            region_state.region_id,
            lat,
            lng,
            current_time,
            sender,
        );

        // 二重報酬チェック
        assert!(!table::contains(&region_state.used_proofs, proof_hash), E_PROOF_ALREADY_USED);

        // 動的報酬計算（MyauChainアルゴリズム）
        let reward = calculate_dynamic_reward(
            10,  // base_reward
            region_state.metrics.population_density,
            region_state.metrics.recent_active_actions,
        );

        // proof_hashを使用済みに
        table::add(&mut region_state.used_proofs, proof_hash, true);

        // 最終チェックイン時刻を更新
        if (table::contains(&region_state.last_checkin, sender)) {
            let _ = table::remove(&mut region_state.last_checkin, sender);
        };
        table::add(&mut region_state.last_checkin, sender, current_time);

        // トークン付与
        if (table::contains(&region_state.balances, sender)) {
            let current = table::remove(&mut region_state.balances, sender);
            table::add(&mut region_state.balances, sender, current + reward);
        } else {
            table::add(&mut region_state.balances, sender, reward);
        };

        // メトリクス更新
        region_state.metrics.recent_active_actions = region_state.metrics.recent_active_actions + 1;
        region_state.metrics.last_updated = current_time;

        // LocalActionReceiptを発行
        let receipt = LocalActionReceipt {
            id: object::new(ctx),
            region_id: region_state.region_id,
            actor: sender,
            proof_hash,
            lat,
            lng,
            reward_amount: reward,
            timestamp: current_time,
        };
        transfer::public_transfer(receipt, sender);

        // イベント発火
        event::emit(LocalTokenMinted {
            region_id: region_state.region_id,
            actor: sender,
            amount: reward,
            proof_hash,
            lat,
            lng,
            timestamp: current_time,
        });
    }

    /// proof_hash生成（keccak256ベース）
    fun generate_local_proof_hash(
        region_id: u64,
        lat: u64,
        lng: u64,
        timestamp: u64,
        actor: address,
    ): vector<u8> {
        let mut data = vector::empty<u8>();
        
        // region_idをバイト列に
        let region_bytes = bcs::to_bytes(&region_id);
        let mut i = 0;
        while (i < vector::length(&region_bytes)) {
            vector::push_back(&mut data, *vector::borrow(&region_bytes, i));
            i = i + 1;
        };
        
        // lat/lngをバイト列に
        let lat_bytes = bcs::to_bytes(&lat);
        i = 0;
        while (i < vector::length(&lat_bytes)) {
            vector::push_back(&mut data, *vector::borrow(&lat_bytes, i));
            i = i + 1;
        };
        
        let lng_bytes = bcs::to_bytes(&lng);
        i = 0;
        while (i < vector::length(&lng_bytes)) {
            vector::push_back(&mut data, *vector::borrow(&lng_bytes, i));
            i = i + 1;
        };
        
        // timestampをバイト列に
        let ts_bytes = bcs::to_bytes(&timestamp);
        i = 0;
        while (i < vector::length(&ts_bytes)) {
            vector::push_back(&mut data, *vector::borrow(&ts_bytes, i));
            i = i + 1;
        };
        
        // actorをバイト列に
        let actor_bytes = bcs::to_bytes(&actor);
        i = 0;
        while (i < vector::length(&actor_bytes)) {
            vector::push_back(&mut data, *vector::borrow(&actor_bytes, i));
            i = i + 1;
        };
        
        hash::keccak256(&data)
    }

    // ========================================
    // 全体DAO双方向連携
    // ========================================

    /// 人口密度を更新（管理者のみ）
    public entry fun update_population_density(
        admin: &RegionAdminCap,
        region_state: &mut RegionDaoState,
        new_density: u64,
        clock: &Clock,
    ) {
        assert!(admin.region_id == region_state.region_id, E_NOT_REGION_ADMIN);

        let old_density = region_state.metrics.population_density;
        region_state.metrics.population_density = new_density;
        region_state.metrics.last_updated = clock::timestamp_ms(clock);

        event::emit(PopulationDensityUpdated {
            region_id: region_state.region_id,
            old_density,
            new_density,
            updated_at: clock::timestamp_ms(clock),
        });
    }

    /// 全体DAOからの指令を受信（デモ用手動実行）
    public entry fun receive_global_directive(
        admin: &RegionAdminCap,
        region_state: &mut RegionDaoState,
        directive_type: u8,
        payload: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(admin.region_id == region_state.region_id, E_NOT_REGION_ADMIN);

        let current_time = clock::timestamp_ms(clock);

        // 指令を適用
        if (directive_type == 0) {
            // パラメータ変更: payloadを新しい人口密度として設定
            region_state.metrics.population_density = payload;
        } else if (directive_type == 1) {
            // 予算配分: payloadをアクティブ行動数にリセット
            region_state.metrics.recent_active_actions = payload;
        };
        // directive_type == 2 は緊急停止（将来実装）

        let directive = GlobalDirective {
            id: object::new(ctx),
            directive_type,
            payload,
            issued_at: current_time,
            executed: true,
        };
        transfer::public_transfer(directive, tx_context::sender(ctx));

        event::emit(GlobalDirectiveReceived {
            region_id: region_state.region_id,
            directive_type,
            payload,
            received_at: current_time,
        });
    }

    /// 地方トークンを手動同期（デモ用）
    /// 全体DAOのGlobalGovStateと連携するためのエントリポイント
    public entry fun sync_local_token_to_global(
        region_state: &RegionDaoState,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let balance = get_region_balance(region_state, sender);
        
        // イベントで通知（実際の連携はオフチェーン or 全体DAOが監視）
        event::emit(LocalTokensDistributed {
            region_id: region_state.region_id,
            recipient: sender,
            amount: balance,
            reason: string::utf8(b"sync_to_global"),
        });

        // Note: 実際の全体DAOへの反映は enhanced_dao.move の
        // record_global_action を呼び出すことで行う
        let _ = clock::timestamp_ms(clock);
    }

    // ========================================
    // View Functions
    // ========================================

    public fun get_region_balance(region_state: &RegionDaoState, addr: address): u64 {
        if (table::contains(&region_state.balances, addr)) {
            *table::borrow(&region_state.balances, addr)
        } else {
            0
        }
    }

    public fun get_region_metrics(region_state: &RegionDaoState): (u64, u64, u64) {
        (
            region_state.metrics.population_density,
            region_state.metrics.recent_active_actions,
            region_state.metrics.registered_residents,
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
