module resident_nft::dao {
    use std::string::{Self, String};
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use resident_nft::resident_card::ResidentNFT;

    // ========================================
    // Constants
    // ========================================

    /// 提案のステータス
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PASSED: u8 = 1;
    const STATUS_REJECTED: u8 = 2;

    /// デフォルトの投票期間（1週間 = 604,800,000 ms）
    const DEFAULT_VOTING_PERIOD_MS: u64 = 604800000;

    /// エラーコード
    const E_ALREADY_VOTED: u64 = 1;
    const E_NOT_CREATOR: u64 = 2;
    const E_PROPOSAL_NOT_ACTIVE: u64 = 3;
    const E_PROPOSAL_EXPIRED: u64 = 4;
    const E_PROPOSAL_NOT_EXPIRED: u64 = 5;

    // ========================================
    // Structs
    // ========================================

    /// 提案（Shared Object）
    public struct Proposal has key {
        id: UID,
        /// 提案タイトル
        title: String,
        /// 詳細説明
        description: String,
        /// 作成者
        creator: address,
        /// 賛成票
        yes_votes: u64,
        /// 反対票
        no_votes: u64,
        /// 投票済みアドレス記録
        voters: Table<address, bool>,
        /// ステータス (0: Active, 1: Passed, 2: Rejected)
        status: u8,
        /// 作成日時 (ms)
        created_at: u64,
        /// 投票締め切り (ms)
        deadline: u64,
    }

    // ========================================
    // Events
    // ========================================

    /// 提案作成イベント
    public struct ProposalCreated has copy, drop {
        proposal_id: ID,
        title: String,
        creator: address,
        deadline: u64,
    }

    /// 投票イベント
    public struct VoteCast has copy, drop {
        proposal_id: ID,
        voter: address,
        choice: bool, // true = yes, false = no
    }

    /// 提案終了イベント
    public struct ProposalResolved has copy, drop {
        proposal_id: ID,
        status: u8,
        yes_votes: u64,
        no_votes: u64,
        resolved_by: address,
    }

    // ========================================
    // Entry Functions
    // ========================================

    /// 提案を作成（ResidentNFT保有者のみ）
    /// デフォルトで1週間の投票期間
    public entry fun create_proposal(
        _nft: &ResidentNFT,
        title: vector<u8>,
        description: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        create_proposal_with_duration(_nft, title, description, DEFAULT_VOTING_PERIOD_MS, clock, ctx)
    }

    /// 提案を作成（投票期間を指定）
    public entry fun create_proposal_with_duration(
        _nft: &ResidentNFT,
        title: vector<u8>,
        description: vector<u8>,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        let proposal_uid = object::new(ctx);
        let proposal_id = object::uid_to_inner(&proposal_uid);
        let deadline = current_time + duration_ms;

        let proposal = Proposal {
            id: proposal_uid,
            title: string::utf8(title),
            description: string::utf8(description),
            creator: sender,
            yes_votes: 0,
            no_votes: 0,
            voters: table::new(ctx),
            status: STATUS_ACTIVE,
            created_at: current_time,
            deadline,
        };

        event::emit(ProposalCreated {
            proposal_id,
            title: string::utf8(title),
            creator: sender,
            deadline,
        });

        transfer::share_object(proposal);
    }

    /// 投票（ResidentNFT保有者のみ、1回のみ、期限内のみ）
    public entry fun vote(
        proposal: &mut Proposal,
        _nft: &ResidentNFT,
        choice: bool, // true = yes, false = no
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // 提案がアクティブかチェック
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);

        // 期限チェック
        assert!(current_time < proposal.deadline, E_PROPOSAL_EXPIRED);

        // 二重投票チェック
        assert!(!table::contains(&proposal.voters, sender), E_ALREADY_VOTED);

        // 投票を記録
        if (choice) {
            proposal.yes_votes = proposal.yes_votes + 1;
        } else {
            proposal.no_votes = proposal.no_votes + 1;
        };

        table::add(&mut proposal.voters, sender, choice);

        event::emit(VoteCast {
            proposal_id: object::uid_to_inner(&proposal.id),
            voter: sender,
            choice,
        });
    }

    /// 提案をクローズ（作成者のみ、期限前でも可能）
    public entry fun close_proposal(
        proposal: &mut Proposal,
        ctx: &TxContext,
    ) {
        assert!(proposal.creator == tx_context::sender(ctx), E_NOT_CREATOR);
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        
        resolve_proposal_internal(proposal, tx_context::sender(ctx));
    }

    /// 期限切れ提案を解決（誰でも実行可能）
    /// DoS対策: 作成者が放置しても、誰でも終了処理を実行できる
    public entry fun resolve_expired_proposal(
        proposal: &mut Proposal,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        // 提案がアクティブかチェック
        assert!(proposal.status == STATUS_ACTIVE, E_PROPOSAL_NOT_ACTIVE);
        
        // 期限切れかチェック
        assert!(current_time >= proposal.deadline, E_PROPOSAL_NOT_EXPIRED);
        
        resolve_proposal_internal(proposal, tx_context::sender(ctx));
    }

    // ========================================
    // Internal Functions
    // ========================================

    /// 提案の集計・終了処理（内部関数）
    fun resolve_proposal_internal(proposal: &mut Proposal, resolved_by: address) {
        // 結果を判定
        if (proposal.yes_votes > proposal.no_votes) {
            proposal.status = STATUS_PASSED;
        } else {
            proposal.status = STATUS_REJECTED;
        };

        event::emit(ProposalResolved {
            proposal_id: object::uid_to_inner(&proposal.id),
            status: proposal.status,
            yes_votes: proposal.yes_votes,
            no_votes: proposal.no_votes,
            resolved_by,
        });
    }

    // ========================================
    // View Functions
    // ========================================

    public fun get_yes_votes(proposal: &Proposal): u64 {
        proposal.yes_votes
    }

    public fun get_no_votes(proposal: &Proposal): u64 {
        proposal.no_votes
    }

    public fun get_status(proposal: &Proposal): u8 {
        proposal.status
    }

    public fun has_voted(proposal: &Proposal, addr: address): bool {
        table::contains(&proposal.voters, addr)
    }

    public fun get_title(proposal: &Proposal): &String {
        &proposal.title
    }

    public fun get_description(proposal: &Proposal): &String {
        &proposal.description
    }

    public fun get_creator(proposal: &Proposal): address {
        proposal.creator
    }

    public fun get_created_at(proposal: &Proposal): u64 {
        proposal.created_at
    }

    public fun get_deadline(proposal: &Proposal): u64 {
        proposal.deadline
    }

    public fun is_expired(proposal: &Proposal, clock: &Clock): bool {
        clock::timestamp_ms(clock) >= proposal.deadline
    }

    public fun get_remaining_time_ms(proposal: &Proposal, clock: &Clock): u64 {
        let current = clock::timestamp_ms(clock);
        if (current >= proposal.deadline) {
            0
        } else {
            proposal.deadline - current
        }
    }
}
