/// Enhanced DAO Module - 商用レベルのガバナンス機能
/// 
/// MyauChainの2段階DAO構造とSui Passport Appの強みを統合した
/// 次世代ガバナンスモジュール
/// 
/// v2.0 - 全体DAOトークンエコノミー統合版
module resident_nft::enhanced_dao {
    use std::string::{Self, String};
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::hash;
    use sui::bcs;
    use resident_nft::resident_card::ResidentNFT;

    // ========================================
    // Constants
    // ========================================

    /// 提案のステータス
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PASSED: u8 = 1;
    const STATUS_REJECTED: u8 = 2;
    const STATUS_EXECUTED: u8 = 3;
    const STATUS_CANCELLED: u8 = 4;

    /// 提案タイプ
    const PROPOSAL_TYPE_GENERAL: u8 = 0;       // 一般提案
    const PROPOSAL_TYPE_PARAMETER: u8 = 1;     // パラメータ変更
    const PROPOSAL_TYPE_BUDGET: u8 = 2;        // 予算配分
    const PROPOSAL_TYPE_ESCALATION: u8 = 3;    // 全体DAOへエスカレーション

    /// アクションタイプ（自動実行用）
    const ACTION_NONE: u8 = 0;
    const ACTION_UPDATE_REWARD_RATE: u8 = 1;
    const ACTION_UPDATE_COOLDOWN: u8 = 2;
    const ACTION_UPDATE_VOTING_PERIOD: u8 = 3;

    /// Time-lock期間（24時間 = 86,400,000 ms）
    const TIMELOCK_PERIOD_MS: u64 = 86400000;

    /// デフォルトの投票期間（1週間）
    const DEFAULT_VOTING_PERIOD_MS: u64 = 604800000;

    /// クォーラム（最低投票率）: 10%
    const QUORUM_PERCENT: u64 = 10;

    // ========================================
    // エラーコード
    // ========================================
    const E_ALREADY_VOTED: u64 = 1;
    const E_NOT_CREATOR: u64 = 2;
    const E_PROPOSAL_NOT_ACTIVE: u64 = 3;
    const E_PROPOSAL_EXPIRED: u64 = 4;
    const E_PROPOSAL_NOT_EXPIRED: u64 = 5;
    const E_NOT_ADMIN: u64 = 6;
    const E_TIMELOCK_NOT_PASSED: u64 = 7;
    const E_INVALID_ACTION: u64 = 8;
    const E_ALREADY_EXECUTED: u64 = 9;
    const E_QUORUM_NOT_MET: u64 = 10;
    const E_DELEGATE_NOT_FOUND: u64 = 11;
    const E_SELF_DELEGATION: u64 = 12;
    const E_INSUFFICIENT_VOTING_POWER: u64 = 13;
    const E_EMERGENCY_PAUSED: u64 = 14;
    const E_NO_GLOBAL_BALANCE: u64 = 15;
    const E_INSUFFICIENT_GLOBAL_BALANCE: u64 = 16;
    const E_REGION_NOT_FOUND: u64 = 17;
    const E_NO_METRICS: u64 = 18;
    const E_PROOF_ALREADY_USED: u64 = 19;
    const E_GLOBAL_GOV_NOT_INITIALIZED: u64 = 20;

    // ========================================
    // Capability Structs
    // ========================================

    /// プラットフォーム管理者権限
    public struct PlatformAdminCap has key, store {
        id: UID,
    }

    /// DAO運営者権限（Emergency操作用）
    public struct DAOOperatorCap has key, store {
        id: UID,
        region_id: u64,
    }

    // ========================================
    // 全体DAOトークンエコノミー（MyauChain統合）
    // ========================================

    /// 全体DAOガバナンス状態（MyauChain: GlobalGovState互換）
    public struct GlobalGovState has key {
        id: UID,
        /// 基本発行量
        base_mint: u64,
        /// 次の全体提案ID
        next_global_proposal_id: u64,
        /// 全体DAO提案
        global_proposals: Table<u64, GlobalProposal>,
        /// 全体DAOトークン残高
        global_balances: Table<address, u64>,
        /// 地域メトリクス（全体DAO用）
        region_metrics: Table<u64, GlobalRegionMetrics>,
        /// 使用済みproof_hash（二重報酬防止）
        used_proofs: Table<vector<u8>, bool>,
        /// 初期化済みフラグ
        initialized: bool,
    }

    /// 全体DAO提案（MyauChain: GlobalProposal互換）
    public struct GlobalProposal has store, drop {
        id: u64,
        title: String,
        description: String,
        creator: address,
        yes_votes: u64,
        no_votes: u64,
        status: u8,
        created_at: u64,
        deadline: u64,
        /// 提案タイプ
        proposal_type: u8,
        /// 自動実行アクション
        action_type: u8,
        /// アクションパラメータ
        action_payload: u64,
    }

    /// 地域メトリクス（全体DAO発行計算用）
    public struct GlobalRegionMetrics has store, drop {
        /// 人口密度
        population_density: u64,
        /// 最近のアクティブ行動数
        recent_active_actions: u64,
        /// 最終更新時刻
        last_updated: u64,
    }

    /// 行動証明オブジェクト（MyauChain: ActionReceipt互換）
    public struct GlobalActionReceipt has key, store {
        id: UID,
        region_id: u64,
        actor: address,
        proof_hash: vector<u8>,
        action_type: u8,
        reward_amount: u64,
        timestamp: u64,
    }

    // ========================================
    // Core Structs
    // ========================================

    /// グローバルDAOパラメータ（全体で共有）
    public struct GlobalDAOConfig has key {
        id: UID,
        /// チェックイン報酬の基準値
        base_reward_rate: u64,
        /// クールダウン時間（ms）
        cooldown_period_ms: u64,
        /// デフォルト投票期間（ms）
        default_voting_period_ms: u64,
        /// 緊急停止フラグ
        emergency_paused: bool,
        /// 登録済み住民の総数（クォーラム計算用）
        total_registered_residents: u64,
    }

    /// 実行可能提案（自動実行対応）
    public struct ExecutableProposal has key {
        id: UID,
        /// 提案タイトル
        title: String,
        /// 詳細説明
        description: String,
        /// 作成者
        creator: address,
        /// 賛成票（重み付き）
        yes_votes: u64,
        /// 反対票（重み付き）
        no_votes: u64,
        /// 投票済みアドレス記録
        voters: Table<address, VoteRecord>,
        /// ステータス
        status: u8,
        /// 提案タイプ
        proposal_type: u8,
        /// 自動実行アクション
        action_type: u8,
        /// アクションパラメータ
        action_payload: u64,
        /// 作成日時
        created_at: u64,
        /// 投票締め切り
        deadline: u64,
        /// Time-lock期限（可決後に実行可能になる時刻）
        execution_eta: u64,
    }

    /// 投票記録（重み付き投票対応）
    public struct VoteRecord has store, drop {
        choice: bool,
        voting_power: u64,
        voted_at: u64,
    }

    /// 委任レジストリ
    public struct DelegationRegistry has key {
        id: UID,
        /// 委任関係 (delegator -> delegate)
        delegations: Table<address, address>,
        /// 委任された投票力 (delegate -> total_power)
        delegated_power: Table<address, u64>,
    }

    /// ユーザーの投票力（貢献度ベース）
    public struct VotingPower has key, store {
        id: UID,
        owner: address,
        /// 基本投票力（1人1票）
        base_power: u64,
        /// 貢献度ボーナス
        contribution_bonus: u64,
        /// 滞在日数ボーナス
        tenure_bonus: u64,
        /// 最終更新時刻
        last_updated: u64,
    }

    // ========================================
    // Events
    // ========================================

    public struct ExecutableProposalCreated has copy, drop {
        proposal_id: ID,
        title: String,
        creator: address,
        proposal_type: u8,
        action_type: u8,
        deadline: u64,
    }

    public struct WeightedVoteCast has copy, drop {
        proposal_id: ID,
        voter: address,
        choice: bool,
        voting_power: u64,
        is_delegated: bool,
    }

    public struct ProposalExecuted has copy, drop {
        proposal_id: ID,
        action_type: u8,
        action_payload: u64,
        executed_by: address,
        executed_at: u64,
    }

    public struct DelegationSet has copy, drop {
        delegator: address,
        delegate: address,
    }

    public struct EmergencyPauseToggled has copy, drop {
        is_paused: bool,
        toggled_by: address,
        toggled_at: u64,
    }

    /// 全体DAOトークン発行イベント
    public struct GlobalTokenMinted has copy, drop {
        actor: address,
        region_id: u64,
        amount: u64,
        proof_hash: vector<u8>,
        timestamp: u64,
    }

    /// 全体DAO提案作成イベント
    public struct GlobalProposalCreated has copy, drop {
        proposal_id: u64,
        title: String,
        creator: address,
        proposal_type: u8,
        deadline: u64,
    }

    /// 全体DAO投票イベント
    public struct GlobalVoteCast has copy, drop {
        proposal_id: u64,
        voter: address,
        amount: u64,
        choice: bool,
    }

    /// 全体DAO提案実行イベント
    public struct GlobalProposalExecuted has copy, drop {
        proposal_id: u64,
        action_type: u8,
        action_payload: u64,
        executed_by: address,
        executed_at: u64,
    }

    /// 地域メトリクス更新イベント
    public struct RegionMetricsUpdated has copy, drop {
        region_id: u64,
        population_density: u64,
        recent_active_actions: u64,
    }

    // ========================================
    // Initializer
    // ========================================

    fun init(ctx: &mut TxContext) {
        // 管理者権限を発行者に付与
        let admin = PlatformAdminCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(admin, tx_context::sender(ctx));

        // グローバル設定を初期化
        let config = GlobalDAOConfig {
            id: object::new(ctx),
            base_reward_rate: 10,
            cooldown_period_ms: 300000,
            default_voting_period_ms: 604800000,
            emergency_paused: false,
            total_registered_residents: 0,
        };
        transfer::share_object(config);

        // 委任レジストリを初期化
        let registry = DelegationRegistry {
            id: object::new(ctx),
            delegations: table::new(ctx),
            delegated_power: table::new(ctx),
        };
        transfer::share_object(registry);

        // 全体DAOガバナンス状態を初期化（MyauChain統合）
        let global_gov = GlobalGovState {
            id: object::new(ctx),
            base_mint: 10,
            next_global_proposal_id: 1,
            global_proposals: table::new(ctx),
            global_balances: table::new(ctx),
            region_metrics: table::new(ctx),
            used_proofs: table::new(ctx),
            initialized: true,
        };
        transfer::share_object(global_gov);
    }

    // ========================================
    // 投票力管理
    // ========================================

    /// 投票力オブジェクトを発行（ResidentNFT発行時に連動）
    public entry fun mint_voting_power(
        _nft: &ResidentNFT,
        config: &mut GlobalDAOConfig,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        let voting_power = VotingPower {
            id: object::new(ctx),
            owner: sender,
            base_power: 100,  // 基本投票力
            contribution_bonus: 0,
            tenure_bonus: 0,
            last_updated: clock::timestamp_ms(clock),
        };

        config.total_registered_residents = config.total_registered_residents + 1;

        transfer::public_transfer(voting_power, sender);
    }

    /// 貢献度に基づいて投票力を更新
    public entry fun update_voting_power(
        voting_power: &mut VotingPower,
        total_checkins: u64,
        tenure_days: u64,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(voting_power.owner == tx_context::sender(ctx), E_NOT_CREATOR);

        // チェックイン回数に基づくボーナス（10回ごとに+1）
        voting_power.contribution_bonus = total_checkins / 10;

        // 滞在日数に基づくボーナス（30日ごとに+5）
        voting_power.tenure_bonus = (tenure_days / 30) * 5;

        voting_power.last_updated = clock::timestamp_ms(clock);
    }

    /// 総投票力を計算
    public fun get_total_voting_power(voting_power: &VotingPower): u64 {
        voting_power.base_power + voting_power.contribution_bonus + voting_power.tenure_bonus
    }

    // ========================================
    // 委任投票
    // ========================================

    /// 投票権を委任
    public entry fun delegate_vote(
        registry: &mut DelegationRegistry,
        voting_power: &VotingPower,
        delegate_to: address,
        ctx: &TxContext,
    ) {
        let delegator = tx_context::sender(ctx);
        assert!(delegator != delegate_to, E_SELF_DELEGATION);

        let power = get_total_voting_power(voting_power);

        // 既存の委任を解除
        if (table::contains(&registry.delegations, delegator)) {
            let old_delegate = table::remove(&mut registry.delegations, delegator);
            if (table::contains(&registry.delegated_power, old_delegate)) {
                let old_power = table::remove(&mut registry.delegated_power, old_delegate);
                if (old_power > power) {
                    table::add(&mut registry.delegated_power, old_delegate, old_power - power);
                };
            };
        };

        // 新しい委任を設定
        table::add(&mut registry.delegations, delegator, delegate_to);

        // 委任先の投票力を更新
        if (table::contains(&registry.delegated_power, delegate_to)) {
            let current = table::remove(&mut registry.delegated_power, delegate_to);
            table::add(&mut registry.delegated_power, delegate_to, current + power);
        } else {
            table::add(&mut registry.delegated_power, delegate_to, power);
        };

        event::emit(DelegationSet {
            delegator,
            delegate: delegate_to,
        });
    }

    // ========================================
    // 提案作成・投票
    // ========================================

    /// 実行可能提案を作成
    public entry fun create_executable_proposal(
        _nft: &ResidentNFT,
        config: &GlobalDAOConfig,
        title: vector<u8>,
        description: vector<u8>,
        proposal_type: u8,
        action_type: u8,
        action_payload: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!config.emergency_paused, E_EMERGENCY_PAUSED);

        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        let proposal_uid = object::new(ctx);
        let proposal_id = object::uid_to_inner(&proposal_uid);
        let deadline = current_time + config.default_voting_period_ms;

        let proposal = ExecutableProposal {
            id: proposal_uid,
            title: string::utf8(title),
            description: string::utf8(description),
            creator: sender,
            yes_votes: 0,
            no_votes: 0,
            voters: table::new(ctx),
            status: STATUS_ACTIVE,
            proposal_type,
            action_type,
            action_payload,
            created_at: current_time,
            deadline,
            execution_eta: 0,
        };

        event::emit(ExecutableProposalCreated {
            proposal_id,
            title: string::utf8(title),
            creator: sender,
            proposal_type,
            action_type,
            deadline,
        });

        transfer::share_object(proposal);
    }

    /// 重み付き投票（委任を含む）
    public entry fun vote_with_power(
        proposal: &mut ExecutableProposal,
        config: &GlobalDAOConfig,
        _nft: &ResidentNFT,
        voting_power: &VotingPower,
        registry: &DelegationRegistry,
        choice: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!config.emergency_paused, E_EMERGENCY_PAUSED);

        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // 提案がアクティブかチェック
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        assert!(current_time < proposal.deadline, E_PROPOSAL_EXPIRED);

        // 二重投票チェック
        assert!(!table::contains(&proposal.voters, sender), E_ALREADY_VOTED);

        // 投票力を計算（自身 + 委任された分）
        let own_power = get_total_voting_power(voting_power);
        let delegated = if (table::contains(&registry.delegated_power, sender)) {
            *table::borrow(&registry.delegated_power, sender)
        } else {
            0
        };
        let total_power = own_power + delegated;

        assert!(total_power > 0, E_INSUFFICIENT_VOTING_POWER);

        // 投票を記録
        if (choice) {
            proposal.yes_votes = proposal.yes_votes + total_power;
        } else {
            proposal.no_votes = proposal.no_votes + total_power;
        };

        let record = VoteRecord {
            choice,
            voting_power: total_power,
            voted_at: current_time,
        };
        table::add(&mut proposal.voters, sender, record);

        event::emit(WeightedVoteCast {
            proposal_id: object::uid_to_inner(&proposal.id),
            voter: sender,
            choice,
            voting_power: total_power,
            is_delegated: delegated > 0,
        });
    }

    // ========================================
    // 提案終了・実行
    // ========================================

    /// 期限切れ提案を解決しTime-lockを設定
    public entry fun resolve_proposal(
        proposal: &mut ExecutableProposal,
        config: &GlobalDAOConfig,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        assert!(current_time >= proposal.deadline, E_PROPOSAL_NOT_EXPIRED);

        // クォーラムチェック
        let total_votes = proposal.yes_votes + proposal.no_votes;
        let required_quorum = (config.total_registered_residents * 100 * QUORUM_PERCENT) / 100;

        if (total_votes < required_quorum) {
            proposal.status = STATUS_REJECTED;
            return
        };

        // 結果を判定
        if (proposal.yes_votes > proposal.no_votes) {
            proposal.status = STATUS_PASSED;
            // Time-lockを設定（24時間後に実行可能）
            proposal.execution_eta = current_time + TIMELOCK_PERIOD_MS;
        } else {
            proposal.status = STATUS_REJECTED;
        };

        let _ = ctx;
    }

    /// Time-lock経過後に提案を実行
    public entry fun execute_proposal(
        proposal: &mut ExecutableProposal,
        config: &mut GlobalDAOConfig,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(proposal.status == STATUS_PASSED, E_PROPOSAL_NOT_ACTIVE);
        assert!(current_time >= proposal.execution_eta, E_TIMELOCK_NOT_PASSED);

        // アクションを実行
        if (proposal.action_type == ACTION_UPDATE_REWARD_RATE) {
            config.base_reward_rate = proposal.action_payload;
        } else if (proposal.action_type == ACTION_UPDATE_COOLDOWN) {
            config.cooldown_period_ms = proposal.action_payload;
        } else if (proposal.action_type == ACTION_UPDATE_VOTING_PERIOD) {
            config.default_voting_period_ms = proposal.action_payload;
        };
        // ACTION_NONE の場合は何もしない

        proposal.status = STATUS_EXECUTED;

        event::emit(ProposalExecuted {
            proposal_id: object::uid_to_inner(&proposal.id),
            action_type: proposal.action_type,
            action_payload: proposal.action_payload,
            executed_by: tx_context::sender(ctx),
            executed_at: current_time,
        });
    }

    // ========================================
    // Emergency Functions
    // ========================================

    /// 緊急停止（Admin または Operator のみ）
    public entry fun toggle_emergency_pause(
        _admin: &PlatformAdminCap,
        config: &mut GlobalDAOConfig,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        config.emergency_paused = !config.emergency_paused;

        event::emit(EmergencyPauseToggled {
            is_paused: config.emergency_paused,
            toggled_by: tx_context::sender(ctx),
            toggled_at: clock::timestamp_ms(clock),
        });
    }

    // ========================================
    // View Functions
    // ========================================

    public fun get_proposal_status(proposal: &ExecutableProposal): u8 {
        proposal.status
    }

    public fun get_yes_votes(proposal: &ExecutableProposal): u64 {
        proposal.yes_votes
    }

    public fun get_no_votes(proposal: &ExecutableProposal): u64 {
        proposal.no_votes
    }

    public fun is_quorum_met(proposal: &ExecutableProposal, config: &GlobalDAOConfig): bool {
        let total_votes = proposal.yes_votes + proposal.no_votes;
        let required_quorum = (config.total_registered_residents * 100 * QUORUM_PERCENT) / 100;
        total_votes >= required_quorum
    }

    public fun get_execution_eta(proposal: &ExecutableProposal): u64 {
        proposal.execution_eta
    }

    public fun is_emergency_paused(config: &GlobalDAOConfig): bool {
        config.emergency_paused
    }

    // ========================================
    // 全体DAOトークンエコノミー（MyauChain統合）
    // ========================================

    /// 地域の人口密度を設定（管理者のみ）
    public entry fun set_region_population_density(
        _admin: &PlatformAdminCap,
        gov: &mut GlobalGovState,
        region_id: u64,
        population_density: u64,
        clock: &Clock,
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        if (table::contains(&gov.region_metrics, region_id)) {
            let old = table::remove(&mut gov.region_metrics, region_id);
            let updated = GlobalRegionMetrics {
                population_density,
                recent_active_actions: old.recent_active_actions,
                last_updated: current_time,
            };
            table::add(&mut gov.region_metrics, region_id, updated);
        } else {
            let metrics = GlobalRegionMetrics {
                population_density,
                recent_active_actions: 0,
                last_updated: current_time,
            };
            table::add(&mut gov.region_metrics, region_id, metrics);
        };

        event::emit(RegionMetricsUpdated {
            region_id,
            population_density,
            recent_active_actions: 0,
        });
    }

    /// 全体DAOトークン発行（MyauChain: record_global_action互換）
    /// GPS証明などの行動に対して動的にトークンを発行
    public entry fun record_global_action(
        gov: &mut GlobalGovState,
        region_id: u64,
        lat: u64,
        lng: u64,
        action_weight: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);
        let actor = tx_context::sender(ctx);

        // proof_hash生成（GPS座標 + タイムスタンプ + 送信者）
        let proof_hash = generate_proof_hash(lat, lng, current_time, actor);

        // 二重報酬防止チェック
        assert!(!table::contains(&gov.used_proofs, proof_hash), E_PROOF_ALREADY_USED);

        // 証明を記録
        table::add(&mut gov.used_proofs, proof_hash, true);

        // メトリクスを取得または作成
        let (density, old_actions) = if (table::contains(&gov.region_metrics, region_id)) {
            let old = table::remove(&mut gov.region_metrics, region_id);
            let d = old.population_density;
            let a = old.recent_active_actions;
            (d, a)
        } else {
            (100, 0)  // デフォルト値
        };

        // アクティビティ更新
        let new_actions = old_actions + action_weight;
        let updated_metrics = GlobalRegionMetrics {
            population_density: density,
            recent_active_actions: new_actions,
            last_updated: current_time,
        };
        table::add(&mut gov.region_metrics, region_id, updated_metrics);

        // 動的発行量計算（MyauChainアルゴリズム）
        let mint_amount = calculate_global_mint(gov.base_mint, density, new_actions);

        // トークン付与
        if (table::contains(&gov.global_balances, actor)) {
            let cur = table::remove(&mut gov.global_balances, actor);
            table::add(&mut gov.global_balances, actor, cur + mint_amount);
        } else {
            table::add(&mut gov.global_balances, actor, mint_amount);
        };

        // 行動証明オブジェクトを発行
        let receipt = GlobalActionReceipt {
            id: object::new(ctx),
            region_id,
            actor,
            proof_hash,
            action_type: 0,  // GPS証明
            reward_amount: mint_amount,
            timestamp: current_time,
        };
        transfer::public_transfer(receipt, actor);

        event::emit(GlobalTokenMinted {
            actor,
            region_id,
            amount: mint_amount,
            proof_hash,
            timestamp: current_time,
        });
    }

    /// proof_hash生成（二重報酬防止用）
    fun generate_proof_hash(lat: u64, lng: u64, timestamp: u64, actor: address): vector<u8> {
        let mut data = vector::empty<u8>();
        vector::append(&mut data, bcs::to_bytes(&lat));
        vector::append(&mut data, bcs::to_bytes(&lng));
        vector::append(&mut data, bcs::to_bytes(&timestamp));
        vector::append(&mut data, bcs::to_bytes(&actor));
        hash::keccak256(&data)
    }

    /// 動的発行量計算（MyauChainアルゴリズム）
    fun calculate_global_mint(base_mint: u64, population_density: u64, recent_actions: u64): u64 {
        // 密度係数：過疎地域ほど高い
        let density = if (population_density == 0) { 1 } else { population_density };
        let density_factor = 1000 / density;

        // 活動係数：活動が少ないほど高い（活性化促進）
        let action_factor = 1000 / (recent_actions + 10);

        // 最終発行量
        let raw_mint = base_mint * density_factor * action_factor / 1000;
        if (raw_mint == 0) { 1 } else { raw_mint }
    }

    /// GPSトークン手動同期（デモ用）
    public entry fun sync_global_token(
        gov: &mut GlobalGovState,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        if (table::contains(&gov.global_balances, sender)) {
            let cur = table::remove(&mut gov.global_balances, sender);
            table::add(&mut gov.global_balances, sender, cur + amount);
        } else {
            table::add(&mut gov.global_balances, sender, amount);
        };
    }

    /// 全体DAOトークン配布（管理者のみ）
    public entry fun airdrop_global_votes(
        _admin: &PlatformAdminCap,
        gov: &mut GlobalGovState,
        recipient: address,
        amount: u64,
    ) {
        if (table::contains(&gov.global_balances, recipient)) {
            let cur = table::remove(&mut gov.global_balances, recipient);
            table::add(&mut gov.global_balances, recipient, cur + amount);
        } else {
            table::add(&mut gov.global_balances, recipient, amount);
        };
    }

    /// 全体DAO提案作成
    public entry fun create_global_proposal(
        gov: &mut GlobalGovState,
        config: &GlobalDAOConfig,
        title: vector<u8>,
        description: vector<u8>,
        proposal_type: u8,
        action_type: u8,
        action_payload: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!config.emergency_paused, E_EMERGENCY_PAUSED);
        
        let sender = tx_context::sender(ctx);
        
        // 全体DAOトークン保有者のみ起票可能
        assert!(table::contains(&gov.global_balances, sender), E_NO_GLOBAL_BALANCE);

        let current_time = clock::timestamp_ms(clock);
        let proposal_id = gov.next_global_proposal_id;
        gov.next_global_proposal_id = proposal_id + 1;

        let proposal = GlobalProposal {
            id: proposal_id,
            title: string::utf8(title),
            description: string::utf8(description),
            creator: sender,
            yes_votes: 0,
            no_votes: 0,
            status: STATUS_ACTIVE,
            created_at: current_time,
            deadline: current_time + config.default_voting_period_ms,
            proposal_type,
            action_type,
            action_payload,
        };

        table::add(&mut gov.global_proposals, proposal_id, proposal);

        event::emit(GlobalProposalCreated {
            proposal_id,
            title: string::utf8(title),
            creator: sender,
            proposal_type,
            deadline: current_time + config.default_voting_period_ms,
        });
    }

    /// 全体DAO投票（トークン消費型）
    public entry fun vote_global(
        gov: &mut GlobalGovState,
        config: &GlobalDAOConfig,
        proposal_id: u64,
        amount: u64,
        choice: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!config.emergency_paused, E_EMERGENCY_PAUSED);
        
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // 残高チェック
        assert!(table::contains(&gov.global_balances, sender), E_NO_GLOBAL_BALANCE);
        let balance = table::remove(&mut gov.global_balances, sender);
        assert!(balance >= amount, E_INSUFFICIENT_GLOBAL_BALANCE);
        table::add(&mut gov.global_balances, sender, balance - amount);

        // 提案を取得して更新
        let proposal = table::borrow_mut(&mut gov.global_proposals, proposal_id);
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        assert!(current_time < proposal.deadline, E_PROPOSAL_EXPIRED);

        if (choice) {
            proposal.yes_votes = proposal.yes_votes + amount;
        } else {
            proposal.no_votes = proposal.no_votes + amount;
        };

        event::emit(GlobalVoteCast {
            proposal_id,
            voter: sender,
            amount,
            choice,
        });
    }

    /// 全体DAO提案解決
    public entry fun resolve_global_proposal(
        gov: &mut GlobalGovState,
        proposal_id: u64,
        clock: &Clock,
        _ctx: &TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);
        let proposal = table::borrow_mut(&mut gov.global_proposals, proposal_id);
        
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        assert!(current_time >= proposal.deadline, E_PROPOSAL_NOT_EXPIRED);

        // 結果を判定
        if (proposal.yes_votes > proposal.no_votes) {
            proposal.status = STATUS_PASSED;
        } else {
            proposal.status = STATUS_REJECTED;
        };
    }

    /// 全体DAO提案実行
    public entry fun execute_global_proposal(
        gov: &mut GlobalGovState,
        config: &mut GlobalDAOConfig,
        proposal_id: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);
        let proposal = table::borrow_mut(&mut gov.global_proposals, proposal_id);
        
        assert!(proposal.status == STATUS_PASSED, E_PROPOSAL_NOT_ACTIVE);

        // アクションを実行
        if (proposal.action_type == ACTION_UPDATE_REWARD_RATE) {
            config.base_reward_rate = proposal.action_payload;
            gov.base_mint = proposal.action_payload;
        } else if (proposal.action_type == ACTION_UPDATE_COOLDOWN) {
            config.cooldown_period_ms = proposal.action_payload;
        } else if (proposal.action_type == ACTION_UPDATE_VOTING_PERIOD) {
            config.default_voting_period_ms = proposal.action_payload;
        };

        proposal.status = STATUS_EXECUTED;

        event::emit(GlobalProposalExecuted {
            proposal_id,
            action_type: proposal.action_type,
            action_payload: proposal.action_payload,
            executed_by: tx_context::sender(ctx),
            executed_at: current_time,
        });
    }

    // ========================================
    // 全体DAO View Functions
    // ========================================

    public fun get_global_balance(gov: &GlobalGovState, addr: address): u64 {
        if (table::contains(&gov.global_balances, addr)) {
            *table::borrow(&gov.global_balances, addr)
        } else {
            0
        }
    }

    public fun get_global_proposal_status(gov: &GlobalGovState, proposal_id: u64): u8 {
        let proposal = table::borrow(&gov.global_proposals, proposal_id);
        proposal.status
    }

    public fun is_proof_used(gov: &GlobalGovState, proof_hash: vector<u8>): bool {
        table::contains(&gov.used_proofs, proof_hash)
    }

    public fun get_region_metrics_global(gov: &GlobalGovState, region_id: u64): (u64, u64) {
        if (table::contains(&gov.region_metrics, region_id)) {
            let m = table::borrow(&gov.region_metrics, region_id);
            (m.population_density, m.recent_active_actions)
        } else {
            (0, 0)
        }
    }

    // ========================================
    // Test Functions
    // ========================================

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
