import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';
import { MapContainer, TileLayer, Marker, Circle, useMap, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Award, CheckCircle, Loader2, Sparkles, History, Clock } from 'lucide-react';
import { useTokenBalance } from './hooks/useTokenBalance';
import { useStayProofs } from './hooks/useStayProofs';
import { PACKAGE_ID, TOKEN_MODULE, CLOCK_OBJECT_ID } from './utils/constants';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GPS_TIMEOUT_MS = 10000;
const COOLDOWN_MS = 300000; // 5分

// エラーコード → 日本語メッセージのマッピング
const ERROR_MESSAGES: Record<string, string> = {
  '1': 'このポイント通帳の所有者ではありません',
  '2': 'クールダウン中です。5分後に再度お試しください',
};

// Sound effects
const playSuccessSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
  audio.volume = 0.5;
  audio.play().catch(e => console.log('Audio play failed', e));
};

// Component to center map on position update
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

export const StayFeature: React.FC = () => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { tokenBalance, hasTokenBalance, isLoading: isLoadingBalance, refetch: refetchBalance } = useTokenBalance();
  const { stayProofs, isLoading: isLoadingProofs, refetch: refetchProofs } = useStayProofs();

  const [status, setStatus] = useState<'idle' | 'locating' | 'signing' | 'submitting' | 'success'>('idle');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isMintingBalance, setIsMintingBalance] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Initial default location (Tokyo Station) for map before GPS
  const defaultLocation = { lat: 35.6812, lng: 139.7671 };

  // 残り時間を更新するためのタイマー
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // クールダウン計算
  const lastCheckinTime = tokenBalance?.lastCheckinTimestamp || 0;
  const nextCheckinTime = lastCheckinTime + COOLDOWN_MS;
  const remainingCooldown = Math.max(0, nextCheckinTime - now);
  const isOnCooldown = remainingCooldown > 0;

  // 残り時間をフォーマット
  const formatCooldown = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(new Error(`GPS Error: ${err.message}`)),
        { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
      );
    });
  };

  // ポイント通帳を作成
  const handleMintBalance = async () => {
    if (!account) {
      toast.error('ウォレットを接続してください');
      return;
    }

    setIsMintingBalance(true);
    const loadingToast = toast.loading('利用登録中...');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${TOKEN_MODULE}::mint_initial_balance`,
        arguments: [],
      });

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success('利用登録が完了しました！', { id: loadingToast });
            setTimeout(refetchBalance, 2000);
          },
          onError: (error) => {
            throw error;
          },
        }
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '利用登録に失敗しました', { id: loadingToast });
    } finally {
      setIsMintingBalance(false);
    }
  };

  // チェックイン実行（ポイント加算 + StayProof発行）
  const handleCheckIn = async () => {
    if (!account) {
      toast.error('ウォレットを接続してください');
      return;
    }

    if (!tokenBalance) {
      toast.error('まず利用登録を行ってください');
      return;
    }

    if (isOnCooldown) {
      toast.error(`クールダウン中です。残り${formatCooldown(remainingCooldown)}`);
      return;
    }

    try {
      setStatus('locating');

      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });

      await new Promise(resolve => setTimeout(resolve, 800));

      setStatus('signing');
      const tx = new Transaction();
      const latInt = Math.floor(latitude * 1000000);
      const lngInt = Math.floor(longitude * 1000000);

      tx.moveCall({
        target: `${PACKAGE_ID}::${TOKEN_MODULE}::checkin_with_proof`,
        arguments: [
          tx.object(tokenBalance.id),
          tx.pure.u64(latInt),
          tx.pure.u64(lngInt),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      setStatus('submitting');

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => {
            setStatus('success');
            setShowConfetti(true);
            playSuccessSound();
            toast.success('チェックイン成功！ +10ポイント獲得！', {
              duration: 5000,
              icon: '🏅',
            });
            setTimeout(() => {
              setShowConfetti(false);
              refetchBalance();
              refetchProofs();
            }, 3000);
            setTimeout(() => setStatus('idle'), 3000);
          },
          onError: (error: any) => {
            console.error(error);
            if (error.message?.includes('E_COOLDOWN_NOT_ELAPSED') || error.message?.includes('2,')) {
              toast.error('クールダウン中です。5分後に再チャレンジしてください。');
            } else {
              throw error;
            }
          },
        },
      );
    } catch (error: any) {
      console.error(error);
      setStatus('idle');

      // エラーメッセージの解析と変換
      let userMessage = 'チェックインに失敗しました';

      // Moveエラーコードを解析（例: "MoveAbort... 2" または "Aborted with code 2"）
      const match = error.message?.match(/(?:MoveAbort|Aborted|code)[^0-9]*(\d+)/i);
      if (match && ERROR_MESSAGES[match[1]]) {
        userMessage = ERROR_MESSAGES[match[1]];
      } else if (error.message?.includes('E_COOLDOWN') || error.message?.includes('2,')) {
        userMessage = 'クールダウン中です。5分後に再度お試しください';
      } else if (error.message?.includes('E_NOT_OWNER') || error.message?.includes('1,')) {
        userMessage = 'このポイント通帳の所有者ではありません';
      } else if (error.message?.includes('rejected') || error.message?.includes('cancelled')) {
        userMessage = 'トランザクションがキャンセルされました';
      } else if (error.message?.includes('insufficient')) {
        userMessage = 'ガス代が不足しています';
      }

      toast.error(userMessage);
    }
  };

  // ウォレット未接続時
  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full"></div>
          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
            <MapPin className="w-16 h-16 text-blue-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            GPS チェックイン
          </h2>
          <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
            ウォレットを接続して、位置情報をブロックチェーンに記録しましょう。
          </p>
        </div>
      </div>
    );
  }

  // ポイント通帳未作成時
  if (!hasTokenBalance && !isLoadingBalance) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 rounded-full"></div>
          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
            <Sparkles className="w-16 h-16 text-amber-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
            利用登録が必要です
          </h2>
          <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
            チェックインを開始するには、まずポイント通帳を作成してください。
          </p>
        </div>
        <button
          onClick={handleMintBalance}
          disabled={isMintingBalance}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isMintingBalance ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              登録中...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              利用登録をする
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {showConfetti && <Confetti numberOfPieces={200} recycle={false} />}

      {/* Stats Card */}
      <div className="p-4 z-10">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium mb-1">チェックインポイント</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{tokenBalance?.balance || 0}</span>
                <span className="text-sm opacity-80">PT</span>
              </div>
              <p className="text-blue-200 text-xs mt-1">
                累計{tokenBalance?.totalCheckins || 0}回チェックイン
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2.5 rounded-full transition-colors ${showHistory ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'}`}
              >
                <History className="w-5 h-5" />
              </button>
              <div className="bg-white/20 p-2.5 rounded-full">
                <Award className="w-6 h-6 text-yellow-300" />
              </div>
            </div>
          </div>

          {/* クールダウン表示 */}
          {isOnCooldown && (
            <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-200" />
              <span className="text-sm text-blue-100">
                次回チェックインまで: <span className="font-bold">{formatCooldown(remainingCooldown)}</span>
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-200 min-h-[250px]">
        <MapContainer
          center={[defaultLocation.lat, defaultLocation.lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* 現在位置 */}
          {location && (
            <>
              <RecenterMap lat={location.lat} lng={location.lng} />
              <Marker position={[location.lat, location.lng]} />
              <Circle
                center={[location.lat, location.lng]}
                radius={50}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }}
              />
            </>
          )}

          {/* 過去のチェックイン履歴（StayProof） */}
          {showHistory && stayProofs.map((proof) => (
            <CircleMarker
              key={proof.id}
              center={[proof.lat, proof.lng]}
              radius={8}
              pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.7 }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">+{proof.rewardEarned}PT</p>
                  <p className="text-xs text-gray-500">
                    {new Date(proof.timestamp).toLocaleString('ja-JP')}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Overlay Gradient */}
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-slate-50 to-transparent z-[400] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-white via-white/80 to-transparent z-[400] pointer-events-none"></div>

        {/* History count badge */}
        {showHistory && stayProofs.length > 0 && (
          <div className="absolute top-2 right-2 z-[500] bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-bold">
            履歴: {stayProofs.length}件
          </div>
        )}
      </div>

      {/* Action Area */}
      <div className="p-4 bg-white z-10 pb-20">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.button
              key="idle"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCheckIn}
              disabled={isOnCooldown}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all ${isOnCooldown
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                }`}
            >
              {isOnCooldown ? (
                <>
                  <Clock className="w-6 h-6" />
                  クールダウン中 ({formatCooldown(remainingCooldown)})
                </>
              ) : (
                <>
                  <MapPin className="w-6 h-6" />
                  チェックイン
                </>
              )}
            </motion.button>
          )}

          {status !== 'idle' && status !== 'success' && (
            <motion.div
              key="loading"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full bg-slate-100 rounded-2xl p-4 border border-slate-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="font-semibold text-slate-700">
                  {status === 'locating' && 'GPS取得中...'}
                  {status === 'signing' && 'ウォレット承認待ち...'}
                  {status === 'submitting' && 'ブロックチェーンに記録中...'}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: '0%' }}
                  animate={{
                    width: status === 'locating' ? '30%' :
                      status === 'signing' ? '60%' : '90%'
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full py-4 bg-green-50 text-green-700 rounded-2xl font-bold text-lg border border-green-200 flex items-center justify-center gap-3"
            >
              <CheckCircle className="w-6 h-6" />
              チェックイン完了！
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
