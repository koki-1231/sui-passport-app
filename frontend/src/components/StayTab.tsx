import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, 
  Clock, 
  Coins, 
  Play, 
  Square, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Navigation
} from 'lucide-react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { PACKAGE_ID, TOKEN_REGISTRY_ID } from '../utils/constants';

interface StayTabProps {
  userAddress: string;
}

// チェックインゾーンの定義
interface CheckinZone {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number;
  regionId: number;
}

// セッション状態
interface StaySession {
  zoneId: string;
  zoneName: string;
  checkinTime: number;
  checkinLat: number;
  checkinLng: number;
  accumulatedTokens: number;
  isActive: boolean;
}

// トークン報酬設定
const CHECKIN_REWARD = 0.1;          // チェックイン報酬
const STAY_REWARD_PER_MINUTE = 0.001; // 1分あたりの滞在報酬
const MAX_DAILY_REWARD = 1.0;         // 1日の最大報酬

// サンプルゾーン
const CHECKIN_ZONES: CheckinZone[] = [
  { id: 'tokyo-shibuya', name: '渋谷エリア', center: { lat: 35.6580, lng: 139.7016 }, radius: 500, regionId: 1 },
  { id: 'tokyo-shinjuku', name: '新宿エリア', center: { lat: 35.6896, lng: 139.6917 }, radius: 500, regionId: 1 },
  { id: 'osaka-namba', name: '難波エリア', center: { lat: 34.6659, lng: 135.5011 }, radius: 500, regionId: 2 },
];

export const StayTab: React.FC<StayTabProps> = ({ userAddress }) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [session, setSession] = useState<StaySession | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentZone, setCurrentZone] = useState<CheckinZone | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  // 距離計算
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 範囲内のゾーンを見つける
  const findZoneInRange = useCallback((lat: number, lng: number): CheckinZone | null => {
    for (const zone of CHECKIN_ZONES) {
      const distance = calculateDistance(lat, lng, zone.center.lat, zone.center.lng);
      if (distance <= zone.radius) {
        return zone;
      }
    }
    return null;
  }, []);

  // 位置情報を取得して更新
  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('このブラウザは位置情報をサポートしていません');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(newLocation);
        
        const zone = findZoneInRange(newLocation.lat, newLocation.lng);
        setCurrentZone(zone);
        setIsGettingLocation(false);
        setError(null);
      },
      (err) => {
        setIsGettingLocation(false);
        setError('位置情報の取得に失敗しました');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [findZoneInRange]);

  // 初期読み込み
  useEffect(() => {
    updateLocation();
    
    // セッション復元
    const savedSession = localStorage.getItem(`stay_session_${userAddress}`);
    if (savedSession) {
      const parsed = JSON.parse(savedSession) as StaySession;
      if (parsed.isActive) {
        setSession(parsed);
      }
    }
  }, [updateLocation, userAddress]);

  // タイマー処理
  useEffect(() => {
    if (session?.isActive) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - session.checkinTime) / 1000);
        setElapsedTime(elapsed);
        
        // トークン蓄積更新
        const minutes = elapsed / 60;
        const stayReward = Math.min(minutes * STAY_REWARD_PER_MINUTE, MAX_DAILY_REWARD - CHECKIN_REWARD);
        const totalTokens = CHECKIN_REWARD + stayReward;
        
        setSession(prev => prev ? {
          ...prev,
          accumulatedTokens: totalTokens
        } : null);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session?.isActive, session?.checkinTime]);

  // セッション保存
  useEffect(() => {
    if (session) {
      localStorage.setItem(`stay_session_${userAddress}`, JSON.stringify(session));
    }
  }, [session, userAddress]);

  // チェックイン
  const handleCheckin = () => {
    if (!location || !currentZone) {
      toast.error('範囲内のスポットがありません');
      return;
    }

    const newSession: StaySession = {
      zoneId: currentZone.id,
      zoneName: currentZone.name,
      checkinTime: Date.now(),
      checkinLat: location.lat,
      checkinLng: location.lng,
      accumulatedTokens: CHECKIN_REWARD,
      isActive: true,
    };

    setSession(newSession);
    toast.success(`${currentZone.name}にチェックインしました！ +${CHECKIN_REWARD}トークン`);
  };

  // チェックアウト（オンチェーン）
  const handleCheckout = async () => {
    if (!session) return;

    // トークン量を計算（0.001単位 → 整数に変換）
    const tokenAmount = Math.floor(session.accumulatedTokens * 1000);
    const stayMinutes = Math.floor(elapsedTime / 60);

    const tx = new Transaction();

    // チェックアウト関数を呼び出し
    tx.moveCall({
      target: `${PACKAGE_ID}::token_management::checkout_with_stay`,
      arguments: [
        tx.object(TOKEN_REGISTRY_ID),
        tx.pure.u64(tokenAmount),
        tx.pure.u64(stayMinutes),
        tx.object('0x6'), // Clock
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          toast.success(`チェックアウト完了！ ${session.accumulatedTokens.toFixed(3)}トークン獲得`);
          
          // セッションクリア
          setSession(null);
          setElapsedTime(0);
          localStorage.removeItem(`stay_session_${userAddress}`);
          
          console.log('Checkout success:', result);
        },
        onError: (error) => {
          toast.error('チェックアウトに失敗しました');
          console.error('Checkout error:', error);
        },
      }
    );
  };

  // 時間フォーマット
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">滞在証明</h2>
        <p className="text-sm text-slate-500">チェックイン/アウトでトークンを獲得</p>
      </div>

      {/* 現在位置ステータス */}
      <div className={`rounded-2xl p-4 border-2 ${
        currentZone 
          ? 'bg-green-50 border-green-300' 
          : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Navigation className={`w-5 h-5 ${currentZone ? 'text-green-600' : 'text-slate-400'}`} />
            <span className="font-medium text-slate-700">現在位置</span>
          </div>
          <button
            onClick={updateLocation}
            disabled={isGettingLocation}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : '更新'}
          </button>
        </div>
        
        {currentZone ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-green-700 font-medium">{currentZone.name} - 範囲内</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-slate-400" />
            <span className="text-slate-500">チェックイン可能なスポットがありません</span>
          </div>
        )}
      </div>

      {/* セッション状態 */}
      {session?.isActive ? (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
          {/* アクティブセッション */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              滞在中
            </div>
            <p className="text-lg font-bold text-slate-800">{session.zoneName}</p>
          </div>

          {/* 経過時間 */}
          <div className="bg-white/70 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-slate-600">滞在時間</span>
            </div>
            <p className="text-3xl font-mono font-bold text-center text-slate-800">
              {formatTime(elapsedTime)}
            </p>
          </div>

          {/* 蓄積トークン */}
          <div className="bg-white/70 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-yellow-600" />
              <span className="text-slate-600">獲得予定トークン</span>
            </div>
            <p className="text-3xl font-bold text-center text-yellow-600">
              {session.accumulatedTokens.toFixed(3)}
            </p>
            <p className="text-xs text-center text-slate-500 mt-1">
              チェックイン: {CHECKIN_REWARD} + 滞在: {(session.accumulatedTokens - CHECKIN_REWARD).toFixed(3)}
            </p>
          </div>

          {/* チェックアウトボタン */}
          <button
            onClick={handleCheckout}
            disabled={isPending}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <Square className="w-5 h-5" />
                チェックアウト（トークン確定）
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-200">
          {/* 未チェックイン状態 */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-slate-600 mb-2">
              チェックインしてトークンを獲得しよう
            </p>
            <p className="text-xs text-slate-400">
              チェックイン: +{CHECKIN_REWARD}トークン / 滞在: +{STAY_REWARD_PER_MINUTE}/分
            </p>
          </div>

          {/* チェックインボタン */}
          <button
            onClick={handleCheckin}
            disabled={!currentZone || isGettingLocation}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              currentZone
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5" />
            {currentZone ? 'チェックイン' : '範囲内に移動してください'}
          </button>
        </div>
      )}

      {/* 報酬説明 */}
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
        <h4 className="font-medium text-amber-700 mb-2">💰 トークン報酬</h4>
        <ul className="text-sm text-amber-600 space-y-1">
          <li>• チェックイン: +{CHECKIN_REWARD}トークン（即時）</li>
          <li>• 滞在報酬: +{STAY_REWARD_PER_MINUTE}トークン/分</li>
          <li>• 1日最大: {MAX_DAILY_REWARD}トークン</li>
          <li>• チェックアウト時にオンチェーン反映</li>
        </ul>
      </div>
    </div>
  );
};
