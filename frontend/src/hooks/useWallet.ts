import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface WalletBalance {
    totalBalance: string;
    totalBalanceRaw: bigint;
    coins: Array<{
        coinType: string;
        balance: string;
    }>;
}

// キャッシュ設定
const STALE_TIME = 15 * 1000; // 15秒間はキャッシュを新鮮とみなす
const CACHE_TIME = 5 * 60 * 1000; // 5分間キャッシュを保持
const REFETCH_INTERVAL = 30 * 1000; // 30秒ごとに自動更新

export function useWallet() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();

    const { data: balance, isLoading, error } = useQuery<WalletBalance | null>({
        queryKey: ['walletBalance', account?.address],
        queryFn: async () => {
            if (!account?.address) return null;

            const coins = await suiClient.getCoins({
                owner: account.address,
                coinType: '0x2::sui::SUI',
            });

            const totalRaw = coins.data.reduce(
                (sum, coin) => sum + BigInt(coin.balance),
                BigInt(0)
            );

            // Convert from MIST to SUI (1 SUI = 10^9 MIST)
            const totalSUI = Number(totalRaw) / 1e9;

            return {
                totalBalance: totalSUI.toFixed(4),
                totalBalanceRaw: totalRaw,
                coins: coins.data.map((coin) => ({
                    coinType: coin.coinType,
                    balance: (Number(coin.balance) / 1e9).toFixed(4),
                })),
            };
        },
        enabled: !!account?.address,
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
        refetchInterval: REFETCH_INTERVAL, // 残高は定期的に更新
    });

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ['walletBalance', account?.address] });
    };

    return {
        balance: balance ?? null,
        isLoading,
        error: error?.message || null,
        refetch,
        address: account?.address || null,
    };
}
