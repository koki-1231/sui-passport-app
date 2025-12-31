import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PACKAGE_ID, RESIDENT_CARD_MODULE } from '../utils/constants';

export interface ResidentNFT {
    id: string;
    name: string;
    imageUrl: string;
    metadataUrl: string;
    addressInfo: string;
    issuedAt: number;
    issuer: string;
}

// キャッシュ設定
const STALE_TIME = 60 * 1000; // 1分間はキャッシュを新鮮とみなす（NFTは頻繁に変わらない）
const CACHE_TIME = 10 * 60 * 1000; // 10分間キャッシュを保持

export function useResidentNFT() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();

    const { data: nfts = [], isLoading, error } = useQuery<ResidentNFT[]>({
        queryKey: ['residentNFT', account?.address],
        queryFn: async () => {
            if (!account?.address) return [];

            const objects = await suiClient.getOwnedObjects({
                owner: account.address,
                filter: {
                    StructType: `${PACKAGE_ID}::${RESIDENT_CARD_MODULE}::ResidentNFT`,
                },
                options: {
                    showContent: true,
                    showDisplay: true,
                },
            });

            const nftList: ResidentNFT[] = [];

            for (const obj of objects.data) {
                if (obj.data?.content?.dataType === 'moveObject') {
                    const fields = (obj.data.content as any).fields;
                    if (fields) {
                        nftList.push({
                            id: obj.data.objectId,
                            name: fields.name || '',
                            imageUrl: fields.image_url || '',
                            metadataUrl: fields.metadata_url || '',
                            addressInfo: fields.address_info || '',
                            issuedAt: Number(fields.issued_at) || 0,
                            issuer: fields.issuer || '',
                        });
                    }
                }
            }

            return nftList;
        },
        enabled: !!account?.address,
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
    });

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ['residentNFT', account?.address] });
    };

    return {
        nfts,
        isLoading,
        error: error?.message || null,
        refetch,
        hasNFT: nfts.length > 0,
    };
}
