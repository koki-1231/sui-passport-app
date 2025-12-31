import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PACKAGE_ID } from '../utils/constants';

export interface StayProofData {
    id: string;
    owner: string;
    lat: number;
    lng: number;
    timestamp: number;
    rewardEarned: number;
}

// キャッシュ設定
const STALE_TIME = 30 * 1000; // 30秒間はキャッシュを新鮮とみなす
const CACHE_TIME = 5 * 60 * 1000; // 5分間キャッシュを保持

export function useStayProofs() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();

    const { data: stayProofs = [], isLoading, error } = useQuery<StayProofData[]>({
        queryKey: ['stayProofs', account?.address],
        queryFn: async () => {
            if (!account?.address) return [];

            const objects = await suiClient.getOwnedObjects({
                owner: account.address,
                filter: {
                    StructType: `${PACKAGE_ID}::token_management::StayProof`,
                },
                options: {
                    showContent: true,
                },
            });

            const proofs: StayProofData[] = [];

            for (const obj of objects.data) {
                if (obj.data?.content?.dataType === 'moveObject') {
                    const fields = (obj.data.content as any).fields;
                    if (fields) {
                        proofs.push({
                            id: obj.data.objectId,
                            owner: fields.owner,
                            lat: Number(fields.lat) / 1000000,
                            lng: Number(fields.lng) / 1000000,
                            timestamp: Number(fields.timestamp),
                            rewardEarned: Number(fields.reward_earned),
                        });
                    }
                }
            }

            // タイムスタンプでソート（新しい順）
            proofs.sort((a, b) => b.timestamp - a.timestamp);
            return proofs;
        },
        enabled: !!account?.address,
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
    });

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ['stayProofs', account?.address] });
    };

    return {
        stayProofs,
        isLoading,
        error: error?.message || null,
        refetch,
    };
}
