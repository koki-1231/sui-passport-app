import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useCallback, useEffect, useState } from 'react';
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

export function useResidentNFT() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const [nfts, setNfts] = useState<ResidentNFT[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMyNFTs = useCallback(async () => {
        if (!account?.address) {
            setNfts([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
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

            setNfts(nftList);
        } catch (err: any) {
            console.error('Error fetching NFTs:', err);
            setError(err.message || 'Failed to fetch NFTs');
        } finally {
            setIsLoading(false);
        }
    }, [account?.address, suiClient]);

    // Auto-fetch when account changes
    useEffect(() => {
        fetchMyNFTs();
    }, [fetchMyNFTs]);

    return {
        nfts,
        isLoading,
        error,
        refetch: fetchMyNFTs,
        hasNFT: nfts.length > 0,
    };
}
