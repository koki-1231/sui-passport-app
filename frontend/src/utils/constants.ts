// ========================================
// 環境変数から設定を読み込み
// ローカル開発: .env ファイルを使用
// Vercel: 環境変数設定で管理
// ========================================

// Contract Package ID
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0xb055fd8885acb1809540fe22b2ed5a282c8f5be86251954a35f2a8614811058b';

// Registry Object IDs
export const RESIDENT_REGISTRY_ID = import.meta.env.VITE_RESIDENT_REGISTRY_ID || '0x99a8dc2df00b6892f6d097ea3b710447b71b9ad79c578af9bed9fa689d2f03cf';
export const TOKEN_REGISTRY_ID = import.meta.env.VITE_TOKEN_REGISTRY_ID || '0x671eaa16a4e4d2a39fb86cbf1a3ac5cc4e70a84b8ff740604a38a36daa0977ae';

// Module names (これらは変更されないためハードコード)
export const STAY_MODULE = 'stay_feature';
export const RESIDENT_CARD_MODULE = 'resident_card';
export const DAO_MODULE = 'dao';
export const TOKEN_MODULE = 'token_management';

// Function names
export const MINT_RESIDENT_CARD = 'mint_resident_card';
export const STAY_FUNCTION = 'stay';

// Sui system objects
export const CLOCK_OBJECT_ID = '0x6';

// Network
export const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || 'testnet';

// Pinata IPFS Gateway
export const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
