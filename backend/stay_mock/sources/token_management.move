module resident_nft::token_management {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};

    // ========================================
    // Constants
    // ========================================

    /// チェックインごとの報酬ポイント
    const CHECKIN_REWARD: u64 = 10;

    /// クールダウン時間（5分 = 300,000ミリ秒）
    const COOLDOWN_MS: u64 = 300000;

    /// エラーコード
    const E_NOT_OWNER: u64 = 1;
    const E_COOLDOWN_NOT_ELAPSED: u64 = 2;

    // ========================================
    // Structs
    // ========================================

    /// ユーザーのトークン残高を管理するオブジェクト
    /// 各ユーザーが1つだけ所有し、残高を蓄積していく
    public struct TokenBalance has key, store {
        id: UID,
        owner: address,
        balance: u64,
        total_checkins: u64,
        last_checkin_timestamp: u64,  // クールダウン用
    }

    /// GPS履歴を永続化するオブジェクト
    /// チェックインごとに1つ作成され、ユーザーが所有
    public struct StayProof has key, store {
        id: UID,
        owner: address,
        lat: u64,
        lng: u64,
        timestamp: u64,
        reward_earned: u64,
    }

    // ========================================
    // Events
    // ========================================

    /// 残高更新イベント
    public struct BalanceUpdatedEvent has copy, drop {
        user: address,
        reward_amount: u64,
        new_total: u64,
        total_checkins: u64,
    }

    /// 初期残高発行イベント
    public struct BalanceMintedEvent has copy, drop {
        user: address,
    }

    /// チェックイン完了イベント（StayProof作成時）
    public struct CheckinCompletedEvent has copy, drop {
        user: address,
        lat: u64,
        lng: u64,
        timestamp: u64,
        reward_earned: u64,
        new_balance: u64,
        next_checkin_available: u64,  // 次回チェックイン可能時刻
    }

    // ========================================
    // Entry Functions
    // ========================================

    /// 新規ユーザー用: 初期TokenBalanceオブジェクトを発行
    public entry fun mint_initial_balance(
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let balance_object = TokenBalance {
            id: object::new(ctx),
            owner: sender,
            balance: 0,
            total_checkins: 0,
            last_checkin_timestamp: 0,  // 初期値は0（すぐにチェックイン可能）
        };

        event::emit(BalanceMintedEvent {
            user: sender,
        });

        transfer::public_transfer(balance_object, sender);
    }

    /// チェックイン実行: ポイント加算 + StayProof発行（クールダウン付き）
    public entry fun checkin_with_proof(
        user_balance: &mut TokenBalance,
        lat: u64,
        lng: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // 所有者チェック
        assert!(user_balance.owner == sender, E_NOT_OWNER);

        // クールダウンチェック（5分経過していないとエラー）
        assert!(
            current_time >= user_balance.last_checkin_timestamp + COOLDOWN_MS,
            E_COOLDOWN_NOT_ELAPSED
        );

        // 1. ポイント加算
        user_balance.balance = user_balance.balance + CHECKIN_REWARD;
        user_balance.total_checkins = user_balance.total_checkins + 1;
        user_balance.last_checkin_timestamp = current_time;

        // 2. StayProofオブジェクト作成（GPS履歴の永続化）
        let stay_proof = StayProof {
            id: object::new(ctx),
            owner: sender,
            lat,
            lng,
            timestamp: current_time,
            reward_earned: CHECKIN_REWARD,
        };

        // 3. イベント発行
        event::emit(CheckinCompletedEvent {
            user: sender,
            lat,
            lng,
            timestamp: current_time,
            reward_earned: CHECKIN_REWARD,
            new_balance: user_balance.balance,
            next_checkin_available: current_time + COOLDOWN_MS,
        });

        event::emit(BalanceUpdatedEvent {
            user: sender,
            reward_amount: CHECKIN_REWARD,
            new_total: user_balance.balance,
            total_checkins: user_balance.total_checkins,
        });

        // 4. StayProofをユーザーに転送
        transfer::public_transfer(stay_proof, sender);
    }
    // NOTE: add_checkin_reward関数は削除されました
    // セキュリティ上の理由: クールダウンチェックがなく、不正利用可能だったため
    // チェックインには checkin_with_proof 関数を使用してください

    // ========================================
    // View Functions
    // ========================================

    public fun get_balance(token_balance: &TokenBalance): u64 {
        token_balance.balance
    }

    public fun get_owner(token_balance: &TokenBalance): address {
        token_balance.owner
    }

    public fun get_total_checkins(token_balance: &TokenBalance): u64 {
        token_balance.total_checkins
    }

    public fun get_last_checkin_timestamp(token_balance: &TokenBalance): u64 {
        token_balance.last_checkin_timestamp
    }

    public fun get_cooldown_remaining(token_balance: &TokenBalance, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock);
        let next_available = token_balance.last_checkin_timestamp + COOLDOWN_MS;
        if (current_time >= next_available) {
            0
        } else {
            next_available - current_time
        }
    }

    public fun get_stay_proof_location(stay_proof: &StayProof): (u64, u64) {
        (stay_proof.lat, stay_proof.lng)
    }

    public fun get_stay_proof_timestamp(stay_proof: &StayProof): u64 {
        stay_proof.timestamp
    }
}
