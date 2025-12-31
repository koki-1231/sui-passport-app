/**
 * zkLogin Utility Module
 * 
 * Googleアカウントを使用したSuiブロックチェーンへのログイン機能を提供
 * MyauChain実装を参考に、Sui Passport App向けに最適化
 */

import { jwtToAddress } from '@mysten/sui/zklogin';
import { sha256 } from 'js-sha256';

// 環境変数から設定を読み込み
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SALT = import.meta.env.VITE_ZKLOGIN_SALT || 'sui_passport_default_salt_2024';

// zkLogin状態管理用インターフェース
export interface ZkLoginState {
  isAuthenticated: boolean;
  address: string | null;
  jwt: string | null;
  provider: 'google' | null;
}

// 初期状態
export const initialZkLoginState: ZkLoginState = {
  isAuthenticated: false,
  address: null,
  jwt: null,
  provider: null,
};

/**
 * Google OAuth URLを生成
 * ユーザーをGoogleログインページにリダイレクト
 */
export const getGoogleOAuthUrl = (): string => {
  if (!CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID is not configured');
    return '';
  }

  const redirectUri = window.location.origin;
  // Nonceはエポック + エフェメラル公開鍵から導出すべきだが、
  // MVP版では簡易的なランダムnonceを使用
  const nonce = generateNonce();

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * URLハッシュからJWTトークンを抽出
 * OAuth認証後のリダイレクト時に使用
 */
export const parseJwtFromUrl = (hash: string): string | null => {
  if (!hash) return null;
  
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const idToken = params.get('id_token');
  return idToken;
};

/**
 * JWTトークンからSuiアドレスを導出
 * zkLoginプロトコルに従ってアドレスを計算
 */
export const getSuiAddressFromJwt = (jwt: string): string => {
  if (!jwt) {
    throw new Error('JWT token is required');
  }

  // SALTをSHA256ハッシュ化してBigIntに変換
  // これによりzkLogin用の有効な数値ソルトを生成
  const saltHex = sha256(SALT);
  const saltBigInt = BigInt(`0x${saltHex}`);
  
  return jwtToAddress(jwt, saltBigInt);
};

/**
 * JWTトークンをデコード（署名検証なし）
 * ユーザー情報表示用
 */
export const decodeJwt = (jwt: string): JwtPayload | null => {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
};

export interface JwtPayload {
  iss: string;           // 発行者
  sub: string;           // サブジェクト（ユーザーID）
  aud: string;           // オーディエンス
  exp: number;           // 有効期限
  iat: number;           // 発行時刻
  email?: string;        // メールアドレス
  email_verified?: boolean;
  name?: string;         // 表示名
  picture?: string;      // プロフィール画像URL
  nonce?: string;        // Nonce
}

/**
 * Nonce生成（簡易版）
 * 本番環境ではエポックとエフェメラル公開鍵から導出すべき
 */
const generateNonce = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `sui_passport_${timestamp}_${random}`;
};

/**
 * zkLogin認証状態をローカルストレージに保存
 */
export const saveZkLoginState = (state: ZkLoginState): void => {
  try {
    localStorage.setItem('zklogin_state', JSON.stringify(state));
  } catch {
    console.warn('Failed to save zkLogin state');
  }
};

/**
 * zkLogin認証状態をローカルストレージから読み込み
 */
export const loadZkLoginState = (): ZkLoginState => {
  try {
    const saved = localStorage.getItem('zklogin_state');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    console.warn('Failed to load zkLogin state');
  }
  return initialZkLoginState;
};

/**
 * zkLogin認証状態をクリア
 */
export const clearZkLoginState = (): void => {
  try {
    localStorage.removeItem('zklogin_state');
  } catch {
    console.warn('Failed to clear zkLogin state');
  }
};

/**
 * zkLoginが設定されているかチェック
 */
export const isZkLoginConfigured = (): boolean => {
  return !!CLIENT_ID && CLIENT_ID.length > 0;
};
