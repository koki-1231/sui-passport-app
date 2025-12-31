/**
 * useZkLogin Hook
 * 
 * zkLogin認証機能を提供するReactフック
 * Google OAuth経由でSuiアドレスを取得
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  ZkLoginState,
  initialZkLoginState,
  getGoogleOAuthUrl,
  parseJwtFromUrl,
  getSuiAddressFromJwt,
  decodeJwt,
  saveZkLoginState,
  loadZkLoginState,
  clearZkLoginState,
  isZkLoginConfigured,
  JwtPayload,
} from '../utils/zkLogin';

export interface UseZkLoginReturn {
  // 状態
  zkLoginState: ZkLoginState;
  userInfo: JwtPayload | null;
  isLoading: boolean;
  error: string | null;
  
  // ウォレット/zkLogin統合アドレス
  effectiveAddress: string | null;
  authMethod: 'wallet' | 'zklogin' | null;
  
  // アクション
  loginWithGoogle: () => void;
  logout: () => void;
  
  // 設定状態
  isConfigured: boolean;
}

export const useZkLogin = (): UseZkLoginReturn => {
  const walletAccount = useCurrentAccount();
  const [zkLoginState, setZkLoginState] = useState<ZkLoginState>(initialZkLoginState);
  const [userInfo, setUserInfo] = useState<JwtPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初期化時にローカルストレージから状態を復元
  useEffect(() => {
    const savedState = loadZkLoginState();
    if (savedState.isAuthenticated && savedState.jwt) {
      try {
        // JWTの有効期限をチェック
        const payload = decodeJwt(savedState.jwt);
        if (payload && payload.exp * 1000 > Date.now()) {
          setZkLoginState(savedState);
          setUserInfo(payload);
        } else {
          // 期限切れの場合はクリア
          clearZkLoginState();
        }
      } catch {
        clearZkLoginState();
      }
    }
    setIsLoading(false);
  }, []);

  // URLハッシュからOAuth認証結果を処理
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('id_token')) {
      setIsLoading(true);
      setError(null);

      try {
        const idToken = parseJwtFromUrl(hash);
        if (idToken) {
          const address = getSuiAddressFromJwt(idToken);
          const payload = decodeJwt(idToken);

          const newState: ZkLoginState = {
            isAuthenticated: true,
            address,
            jwt: idToken,
            provider: 'google',
          };

          setZkLoginState(newState);
          setUserInfo(payload);
          saveZkLoginState(newState);

          // URLからトークンを削除（セキュリティ）
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {
        console.error('zkLogin error:', e);
        setError('ログインに失敗しました。もう一度お試しください。');
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  // Googleでログイン
  const loginWithGoogle = useCallback(() => {
    if (!isZkLoginConfigured()) {
      setError('zkLoginが設定されていません。管理者に連絡してください。');
      return;
    }

    const url = getGoogleOAuthUrl();
    if (url) {
      window.location.href = url;
    } else {
      setError('OAuth URLの生成に失敗しました。');
    }
  }, []);

  // ログアウト
  const logout = useCallback(() => {
    setZkLoginState(initialZkLoginState);
    setUserInfo(null);
    setError(null);
    clearZkLoginState();
  }, []);

  // 有効なアドレスを決定（ウォレット優先）
  const effectiveAddress = walletAccount?.address || zkLoginState.address;
  const authMethod: 'wallet' | 'zklogin' | null = 
    walletAccount?.address ? 'wallet' : 
    zkLoginState.address ? 'zklogin' : 
    null;

  return {
    zkLoginState,
    userInfo,
    isLoading,
    error,
    effectiveAddress,
    authMethod,
    loginWithGoogle,
    logout,
    isConfigured: isZkLoginConfigured(),
  };
};

export default useZkLogin;
