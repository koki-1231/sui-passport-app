// ========================================
// 環境変数から設定を読み込み
// ローカル開発: .env ファイルを使用
// Vercel: 環境変数設定で管理
// ========================================

// Contract Package ID
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x8f4b11363161bace284d0bc0392418b79515c5c1623ddd3b1d2ba9ea7b20a86f';

// Registry Object IDs
export const RESIDENT_REGISTRY_ID = import.meta.env.VITE_RESIDENT_REGISTRY_ID || '0xd0a19c1f738431050fd0e42484ea1c39183d89358f6c34cc40fbfd66968cfc6c';
export const TOKEN_REGISTRY_ID = import.meta.env.VITE_TOKEN_REGISTRY_ID || '0x09770c8b37e055c3385bb072620054addcc2eb9a81f16eae3fc7495251f709cc';

// Enhanced DAO Object IDs
export const GLOBAL_DAO_CONFIG_ID = import.meta.env.VITE_GLOBAL_DAO_CONFIG_ID || '0x73075c3b019b87a8f657ff05a6fa9ff94500f613277a6fdb2d3fb6f742174ec3';
export const DELEGATION_REGISTRY_ID = import.meta.env.VITE_DELEGATION_REGISTRY_ID || '0x92ef2215139ecbcdde1b2698064b314685f10c877f680c5cfad087ff1447d37c';

// Regional DAO Object IDs
export const GLOBAL_PLATFORM_STATE_ID = import.meta.env.VITE_GLOBAL_PLATFORM_STATE_ID || '0x1160e82eedfae677b7eace58bf6d8af0efbe6e5169ccff1a920271f5bff31f5f';

// Module names (これらは変更されないためハードコード)
export const STAY_MODULE = 'stay_feature';
export const RESIDENT_CARD_MODULE = 'resident_card';
export const DAO_MODULE = 'dao';
export const TOKEN_MODULE = 'token_management';
export const ENHANCED_DAO_MODULE = 'enhanced_dao';
export const REGIONAL_DAO_MODULE = 'regional_dao';

// Function names
export const MINT_RESIDENT_CARD = 'mint_resident_card';
export const STAY_FUNCTION = 'stay';

// Sui system objects
export const CLOCK_OBJECT_ID = '0x6';

// Network
export const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || 'testnet';

// Pinata IPFS Gateway
export const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
