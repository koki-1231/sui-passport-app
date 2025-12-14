// Pinata API Configuration
// NOTE: For production, move this to environment variables
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1ODE0YTViYi1lYjA0LTQ2ZTMtYjQ4ZC1jZWQ5ZjM3MmM2YTkiLCJlbWFpbCI6InlvZG9nYXdhY2hhcmdlQGhvdG1haWwuY28uanAiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiM2RkNWYyZjQzZDg3N2NiNGNmZDYiLCJzY29wZWRLZXlTZWNyZXQiOiI0NjQzOGFlYjBjNTM3NDdkMjhkYjUyOTM1MTQ5ZGI1NDA2MWJhOWRmYmJiYmEzNzgwMjRkMGFkYzdhMWZmY2E2IiwiZXhwIjoxNzk2MDU5OTIzfQ.PIZimQpd_prVf7IE_l4ca3L3PuFvUkbzzvxHujSFUY8';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning';

export interface UploadResult {
    success: boolean;
    ipfsHash?: string;
    url?: string;
    error?: string;
}

/**
 * 画像ファイルをPinata/IPFSにアップロード
 */
export async function uploadImageToIPFS(file: File): Promise<UploadResult> {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${PINATA_API_URL}/pinFileToIPFS`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PINATA_JWT}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
        }

        const result = await response.json();
        const ipfsHash = result.IpfsHash;
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

        return {
            success: true,
            ipfsHash,
            url,
        };
    } catch (error: any) {
        console.error('IPFS upload error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred',
        };
    }
}

/**
 * NFTメタデータをPinata/IPFSにアップロード
 */
export async function uploadMetadataToIPFS(metadata: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string }>;
}): Promise<UploadResult> {
    try {
        const response = await fetch(`${PINATA_API_URL}/pinJSONToIPFS`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PINATA_JWT}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metadata),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Metadata upload failed: ${error}`);
        }

        const result = await response.json();
        const ipfsHash = result.IpfsHash;
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

        return {
            success: true,
            ipfsHash,
            url,
        };
    } catch (error: any) {
        console.error('Metadata upload error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred',
        };
    }
}

/**
 * IPFSハッシュからURLを生成
 */
export function getIPFSUrl(ipfsHash: string): string {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
}
