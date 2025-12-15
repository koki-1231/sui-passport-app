import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// キャッシュ設定
const STALE_TIME = 15 * 1000; // 15秒間はキャッシュを新鮮とみなす（投票は比較的頻繁に更新される）
const CACHE_TIME = 5 * 60 * 1000; // 5分間キャッシュを保持

export function useDAO() {
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();

    const { data: proposals = [], isLoading, error } = useQuery<ProposalData[]>({
        queryKey: ['daoProposals'],
        queryFn: async () => {
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
                return [];
            }

            // multiGetObjects で一括取得（N+1問題の解消）
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

            return proposalDetails;
        },
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
    });

    const fetchProposals = () => {
        queryClient.invalidateQueries({ queryKey: ['daoProposals'] });
    };

    return {
        proposals,
        isLoading,
        error: error?.message || null,
        fetchProposals,
    };
}
