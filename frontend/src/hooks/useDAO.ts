import { useSuiClient } from '@mysten/dapp-kit';
import { useCallback, useState } from 'react';
import { PACKAGE_ID } from '../utils/constants';

export interface ProposalData {
    id: string;
    title: string;
    description: string;
    creator: string;
    yesVotes: number;
    noVotes: number;
    status: number;
    createdAt: number;
    deadline: number;
}

export function useDAO() {
    const suiClient = useSuiClient();
    const [proposals, setProposals] = useState<ProposalData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProposals = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // イベントベースで提案IDを取得
            const events = await suiClient.queryEvents({
                query: {
                    MoveEventType: `${PACKAGE_ID}::dao::ProposalCreated`,
                },
                limit: 50,
                order: 'descending',
            });

            const proposalIds = events.data.map((event) => {
                const fields = event.parsedJson as any;
                return fields.proposal_id;
            });

            if (proposalIds.length === 0) {
                setProposals([]);
                return;
            }

            // ★改善: multiGetObjects で一括取得（N+1問題の解消）
            const objects = await suiClient.multiGetObjects({
                ids: proposalIds,
                options: { showContent: true },
            });

            const proposalDetails: ProposalData[] = [];

            for (const obj of objects) {
                if (obj.data?.content?.dataType === 'moveObject') {
                    const fields = (obj.data.content as any).fields;
                    if (fields) {
                        proposalDetails.push({
                            id: obj.data.objectId,
                            title: fields.title || '',
                            description: fields.description || '',
                            creator: fields.creator || '',
                            yesVotes: Number(fields.yes_votes) || 0,
                            noVotes: Number(fields.no_votes) || 0,
                            status: Number(fields.status) || 0,
                            createdAt: Number(fields.created_at) || 0,
                            deadline: Number(fields.deadline) || 0,
                        });
                    }
                }
            }

            setProposals(proposalDetails);
        } catch (err: any) {
            console.error('Error fetching proposals:', err);
            setError(err.message || 'Failed to fetch proposals');
        } finally {
            setIsLoading(false);
        }
    }, [suiClient]);

    return {
        proposals,
        isLoading,
        error,
        fetchProposals,
    };
}
