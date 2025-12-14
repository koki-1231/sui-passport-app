import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useCallback, useState, useEffect } from 'react';
import { PACKAGE_ID } from '../utils/constants';

export interface TokenBalanceData {
    id: string;
    owner: string;
    balance: number;
    totalCheckins: number;
    lastCheckinTimestamp: number;
}

export function useTokenBalance() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const [tokenBalance, setTokenBalance] = useState<TokenBalanceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTokenBalance = useCallback(async () => {
        if (!account?.address) {
            setTokenBalance(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // ユーザーが持っているTokenBalanceオブジェクトを検索
            const objects = await suiClient.getOwnedObjects({
                owner: account.address,
                filter: {
                    StructType: `${PACKAGE_ID}::token_management::TokenBalance`,
                },
                options: {
                    showContent: true,
                },
            });

            if (objects.data.length > 0 && objects.data[0].data?.content?.dataType === 'moveObject') {
                const fields = (objects.data[0].data.content as any).fields;
                setTokenBalance({
                    id: objects.data[0].data.objectId,
                    owner: fields.owner,
                    balance: Number(fields.balance) || 0,
                    totalCheckins: Number(fields.total_checkins) || 0,
                    lastCheckinTimestamp: Number(fields.last_checkin_timestamp) || 0,
                });
            } else {
                setTokenBalance(null);
            }
        } catch (err: any) {
            console.error('Error fetching token balance:', err);
            setError(err.message || 'Failed to fetch token balance');
        } finally {
            setIsLoading(false);
        }
    }, [account, suiClient]);

    useEffect(() => {
        fetchTokenBalance();
    }, [fetchTokenBalance]);

    return {
        tokenBalance,
        hasTokenBalance: tokenBalance !== null,
        isLoading,
        error,
        refetch: fetchTokenBalance,
    };
}
