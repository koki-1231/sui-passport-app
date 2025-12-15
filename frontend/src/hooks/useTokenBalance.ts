import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PACKAGE_ID } from '../utils/constants';

export interface TokenBalanceData {
    id: string;
    owner: string;
    balance: number;
    totalCheckins: number;
    lastCheckinTimestamp: number;
}

// キャッシュ設定
const STALE_TIME = 30 * 1000; // 30秒間はキャッシュを新鮮とみなす
const CACHE_TIME = 5 * 60 * 1000; // 5分間キャッシュを保持

export function useTokenBalance() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();

    const { data: tokenBalance, isLoading, error } = useQuery<TokenBalanceData | null>({
        queryKey: ['tokenBalance', account?.address],
        queryFn: async () => {
            if (!account?.address) return null;

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
                return {
                    id: objects.data[0].data.objectId,
                    owner: fields.owner,
                    balance: Number(fields.balance) || 0,
                    totalCheckins: Number(fields.total_checkins) || 0,
                    lastCheckinTimestamp: Number(fields.last_checkin_timestamp) || 0,
                };
            }
            return null;
        },
        enabled: !!account?.address,
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
    });

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ['tokenBalance', account?.address] });
    };

    return {
        tokenBalance: tokenBalance ?? null,
        hasTokenBalance: tokenBalance !== null,
        isLoading,
        error: error?.message || null,
        refetch,
    };
}
