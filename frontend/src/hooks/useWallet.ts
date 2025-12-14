import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useCallback, useEffect, useState } from 'react';

export interface WalletBalance {
    totalBalance: string;
    totalBalanceRaw: bigint;
    coins: Array<{
        coinType: string;
        balance: string;
    }>;
}

export function useWallet() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const [balance, setBalance] = useState<WalletBalance | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = useCallback(async () => {
        if (!account?.address) {
            setBalance(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
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

            setBalance({
                totalBalance: totalSUI.toFixed(4),
                totalBalanceRaw: totalRaw,
                coins: coins.data.map((coin) => ({
                    coinType: coin.coinType,
                    balance: (Number(coin.balance) / 1e9).toFixed(4),
                })),
            });
        } catch (err: any) {
            console.error('Error fetching balance:', err);
            setError(err.message || 'Failed to fetch balance');
        } finally {
            setIsLoading(false);
        }
    }, [account?.address, suiClient]);

    // Auto-fetch when account changes
    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Refetch on interval (every 30 seconds)
    useEffect(() => {
        const interval = setInterval(fetchBalance, 30000);
        return () => clearInterval(interval);
    }, [fetchBalance]);

    return {
        balance,
        isLoading,
        error,
        refetch: fetchBalance,
        address: account?.address || null,
    };
}
