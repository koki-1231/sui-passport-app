import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useCallback, useState, useEffect } from 'react';
import { PACKAGE_ID } from '../utils/constants';

export interface StayProofData {
    id: string;
    owner: string;
    lat: number;
    lng: number;
    timestamp: number;
    rewardEarned: number;
}

export function useStayProofs() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const [stayProofs, setStayProofs] = useState<StayProofData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStayProofs = useCallback(async () => {
        if (!account?.address) {
            setStayProofs([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // ユーザーが持っているStayProofオブジェクトを検索
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
                            lat: Number(fields.lat) / 1000000, // u64から小数に変換
                            lng: Number(fields.lng) / 1000000,
                            timestamp: Number(fields.timestamp),
                            rewardEarned: Number(fields.reward_earned),
                        });
                    }
                }
            }

            // タイムスタンプでソート（新しい順）
            proofs.sort((a, b) => b.timestamp - a.timestamp);
            setStayProofs(proofs);
        } catch (err: any) {
            console.error('Error fetching stay proofs:', err);
            setError(err.message || 'Failed to fetch stay proofs');
        } finally {
            setIsLoading(false);
        }
    }, [account, suiClient]);

    useEffect(() => {
        fetchStayProofs();
    }, [fetchStayProofs]);

    return {
        stayProofs,
        isLoading,
        error,
        refetch: fetchStayProofs,
    };
}
