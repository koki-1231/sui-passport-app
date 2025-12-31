/**
 * useZkProof Hook
 * 
 * ZK証明生成・検証機能を提供するReactフック
 * GPS座標のプライバシー保護証明を生成
 */

import { useState, useCallback } from 'react';
import { sha256 } from 'js-sha256';

// ZK証明の構造
export interface ZkLocationProof {
  proofHash: string;          // 証明ハッシュ（オンチェーン用）
  commitment: string;         // コミットメント
  nullifier: string;          // 二重使用防止用
  timestamp: number;          // タイムスタンプ
  regionId: number;           // 地域ID（プライベート）
  // 公開入力（検証用）
  publicInputs: {
    epochDay: number;         // エポック日
    regionCommitment: string; // 地域コミットメント
  };
}

// 位置情報のプライバシーレベル
export type PrivacyLevel = 'exact' | 'city' | 'prefecture' | 'country';

export interface UseZkProofReturn {
  // 状態
  isGenerating: boolean;
  lastProof: ZkLocationProof | null;
  error: string | null;
  
  // アクション
  generateLocationProof: (
    lat: number,
    lng: number,
    userAddress: string,
    privacyLevel?: PrivacyLevel
  ) => Promise<ZkLocationProof>;
  
  verifyProof: (proof: ZkLocationProof) => boolean;
  
  // ユーティリティ
  getProofHashForContract: () => Uint8Array | null;
}

/**
 * 座標を指定精度に丸める
 */
const roundCoordinate = (coord: number, privacyLevel: PrivacyLevel): number => {
  switch (privacyLevel) {
    case 'exact':
      return Math.round(coord * 1000000) / 1000000; // 6桁精度
    case 'city':
      return Math.round(coord * 100) / 100;         // 2桁精度（約1km）
    case 'prefecture':
      return Math.round(coord * 10) / 10;           // 1桁精度（約10km）
    case 'country':
      return Math.round(coord);                      // 整数（約100km）
    default:
      return Math.round(coord * 100) / 100;
  }
};

/**
 * 座標から地域IDを推定（簡易版）
 */
const estimateRegionId = (lat: number, lng: number): number => {
  // 日本の主要都市の簡易判定
  // 東京: 35.6762, 139.6503
  // 大阪: 34.6937, 135.5023
  // 名古屋: 35.1815, 136.9066
  // 福岡: 33.5904, 130.4017
  
  if (lat >= 35.5 && lat <= 36.0 && lng >= 139.0 && lng <= 140.0) return 1; // 東京
  if (lat >= 34.5 && lat <= 35.0 && lng >= 135.0 && lng <= 136.0) return 2; // 大阪
  if (lat >= 35.0 && lat <= 35.5 && lng >= 136.5 && lng <= 137.5) return 3; // 名古屋
  if (lat >= 33.0 && lat <= 34.0 && lng >= 130.0 && lng <= 131.0) return 4; // 福岡
  
  // その他の地域はグリッドベースで計算
  const latGrid = Math.floor((lat - 24) / 2);  // 緯度24度から2度刻み
  const lngGrid = Math.floor((lng - 122) / 2); // 経度122度から2度刻み
  return 100 + latGrid * 10 + lngGrid;
};

/**
 * エポック日を計算（UTC日付）
 */
const getEpochDay = (): number => {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
};

export const useZkProof = (): UseZkProofReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastProof, setLastProof] = useState<ZkLocationProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 位置情報のZK証明を生成
   * 
   * 注: 本番環境ではGroth16などの本格的なZK回路を使用すべき
   * これはMVP用の簡易実装（コミットメント方式）
   */
  const generateLocationProof = useCallback(async (
    lat: number,
    lng: number,
    userAddress: string,
    privacyLevel: PrivacyLevel = 'city'
  ): Promise<ZkLocationProof> => {
    setIsGenerating(true);
    setError(null);

    try {
      // 座標を指定精度に丸める
      const roundedLat = roundCoordinate(lat, privacyLevel);
      const roundedLng = roundCoordinate(lng, privacyLevel);
      
      // タイムスタンプとエポック日
      const timestamp = Date.now();
      const epochDay = getEpochDay();
      
      // 地域IDを推定
      const regionId = estimateRegionId(lat, lng);
      
      // ランダムソルトを生成（ブラインド用）
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // コミットメント生成: H(lat || lng || salt)
      const commitmentInput = `${roundedLat}:${roundedLng}:${saltHex}`;
      const commitment = sha256(commitmentInput);
      
      // Nullifier生成: H(address || epochDay || regionId)
      // 同じユーザーが同じ日に同じ地域で二重チェックインできないようにする
      const nullifierInput = `${userAddress}:${epochDay}:${regionId}`;
      const nullifier = sha256(nullifierInput);
      
      // 地域コミットメント: H(regionId || epochDay)
      const regionCommitment = sha256(`${regionId}:${epochDay}`);
      
      // 証明ハッシュ（オンチェーン用）: H(commitment || nullifier || timestamp)
      const proofHash = sha256(`${commitment}:${nullifier}:${timestamp}`);
      
      const proof: ZkLocationProof = {
        proofHash,
        commitment,
        nullifier,
        timestamp,
        regionId,
        publicInputs: {
          epochDay,
          regionCommitment,
        },
      };

      setLastProof(proof);
      return proof;
      
    } catch (e) {
      const message = e instanceof Error ? e.message : '証明生成に失敗しました';
      setError(message);
      throw new Error(message);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * 証明を検証（クライアントサイド簡易検証）
   */
  const verifyProof = useCallback((proof: ZkLocationProof): boolean => {
    try {
      // タイムスタンプが妥当か（24時間以内）
      const now = Date.now();
      if (proof.timestamp > now || proof.timestamp < now - 24 * 60 * 60 * 1000) {
        return false;
      }
      
      // proofHashが空でないか
      if (!proof.proofHash || proof.proofHash.length !== 64) {
        return false;
      }
      
      // nullifierが空でないか
      if (!proof.nullifier || proof.nullifier.length !== 64) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * コントラクト用のproof_hashを取得
   */
  const getProofHashForContract = useCallback((): Uint8Array | null => {
    if (!lastProof) return null;
    
    // hex文字列をUint8Arrayに変換
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(lastProof.proofHash.substr(i * 2, 2), 16);
    }
    return bytes;
  }, [lastProof]);

  return {
    isGenerating,
    lastProof,
    error,
    generateLocationProof,
    verifyProof,
    getProofHashForContract,
  };
};

export default useZkProof;
