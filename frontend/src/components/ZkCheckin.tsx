import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  MapPin, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Building2,
  Map,
  Navigation
} from 'lucide-react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useZkProof, PrivacyLevel } from '../hooks/useZkProof';
import { useZkLogin } from '../hooks/useZkLogin';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { PACKAGE_ID, ZK_PROOF_REGISTRY_ID } from '../utils/constants';

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

const PRIVACY_OPTIONS: Array<{ level: PrivacyLevel; label: string; icon: typeof Navigation; desc: string; bonus: string }> = [
  { level: 'exact', label: '正確な位置', icon: Navigation, desc: '座標を正確に共有', bonus: '1.0x' },
  { level: 'city', label: '市区町村', icon: Building2, desc: '市区町村レベルで共有', bonus: '1.1x' },
  { level: 'prefecture', label: '都道府県', icon: Map, desc: '都道府県レベルで共有', bonus: '1.25x' },
  { level: 'country', label: '国', icon: Globe, desc: '国レベルのみ共有', bonus: '1.5x' },
];

export const ZkCheckin: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { zkLoginState } = useZkLogin();
  const zkAuthenticated = zkLoginState.isAuthenticated;
  const zkAddress = zkLoginState.address;
  
  const { 
    lastProof: proof, 
    isGenerating, 
    generateLocationProof, 
    getProofHashForContract 
  } = useZkProof();
  
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [location, setLocation] = useState<LocationData | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('city');
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [step, setStep] = useState<'location' | 'proof' | 'submit' | 'done'>('location');

  // 位置情報取得
  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('このブラウザは位置情報をサポートしていません');
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
        setStep('proof');
        setIsGettingLocation(false);
        toast.success('位置情報を取得しました');
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('位置情報の許可が必要です');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('位置情報を取得できません');
            break;
          case error.TIMEOUT:
            toast.error('位置情報の取得がタイムアウトしました');
            break;
          default:
            toast.error('位置情報の取得に失敗しました');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // ZK証明生成
  const handleGenerateProof = async () => {
    if (!location || !currentAccount?.address) {
      toast.error('まず位置情報を取得してウォレットを接続してください');
      return;
    }

    try {
      await generateLocationProof(location.lat, location.lng, currentAccount.address, privacyLevel);
      setStep('submit');
      toast.success('ZK証明を生成しました');
    } catch (error) {
      toast.error('ZK証明の生成に失敗しました');
    }
  };

  // オンチェーン提出
  const handleSubmitOnChain = async () => {
    if (!proof || !currentAccount) {
      toast.error('ウォレットを接続してください');
      return;
    }

    const tx = new Transaction();
    
    // Convert hex strings to Uint8Array
    const hexToBytes = (hex: string): number[] => {
      const bytes: number[] = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
      }
      return bytes;
    };

    const commitmentBytes = hexToBytes(proof.commitment);
    const nullifierBytes = hexToBytes(proof.nullifier);
    const regionBytes = hexToBytes(proof.publicInputs.regionCommitment);
    const epochDay = proof.publicInputs.epochDay;
    
    // プライバシーレベルを数値に変換
    const privacyLevelNum = privacyLevel === 'exact' ? 0 : privacyLevel === 'city' ? 1 : privacyLevel === 'prefecture' ? 2 : 3;

    tx.moveCall({
      target: `${PACKAGE_ID}::zk_location_proof::verify_and_mint`,
      arguments: [
        tx.object(ZK_PROOF_REGISTRY_ID),
        tx.pure.vector('u8', commitmentBytes),
        tx.pure.vector('u8', nullifierBytes),
        tx.pure.vector('u8', regionBytes),
        tx.pure.u64(epochDay),
        tx.pure.u8(privacyLevelNum),
        tx.object('0x6'), // Clock object
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          toast.success('ZK証明チェックインが完了しました！');
          setStep('done');
          console.log('ZK Checkin success:', result);
        },
        onError: (error) => {
          toast.error('チェックインに失敗しました');
          console.error('ZK Checkin error:', error);
        },
      }
    );
  };

  // リセット
  const handleReset = () => {
    setLocation(null);
    setStep('location');
    setShowCoordinates(false);
  };

  // プライバシーレベルに応じた表示用座標
  const getDisplayCoordinates = () => {
    if (!location) return null;
    
    switch (privacyLevel) {
      case 'exact':
        return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
      case 'city':
        return `${location.lat.toFixed(2)}°, ${location.lng.toFixed(2)}°`;
      case 'prefecture':
        return `${location.lat.toFixed(1)}°, ${location.lng.toFixed(1)}°`;
      case 'country':
        return '日本国内';
      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 mb-3 shadow-lg">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">ZKプライバシーチェックイン</h2>
        <p className="text-sm text-slate-500 mt-1">
          位置情報を公開せずにチェックイン証明を生成
        </p>
      </div>

      {/* zkLogin Status */}
      {zkAuthenticated && zkAddress && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-xs text-green-700 font-medium">zkLogin認証済み</p>
            <p className="text-xs text-green-600 font-mono truncate">{zkAddress}</p>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {['location', 'proof', 'submit', 'done'].map((s, idx) => (
          <React.Fragment key={s}>
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step === s 
                  ? "bg-cyan-500 text-white shadow-lg" 
                  : ['location', 'proof', 'submit', 'done'].indexOf(step) > idx
                    ? "bg-green-500 text-white"
                    : "bg-slate-200 text-slate-400"
              )}
            >
              {['location', 'proof', 'submit', 'done'].indexOf(step) > idx ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                idx + 1
              )}
            </div>
            {idx < 3 && (
              <div className={clsx(
                "w-8 h-0.5 transition-all",
                ['location', 'proof', 'submit', 'done'].indexOf(step) > idx 
                  ? "bg-green-500" 
                  : "bg-slate-200"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      {step === 'location' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
                <MapPin className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            <p className="text-center text-slate-600 text-sm mb-4">
              位置情報を取得してZK証明を生成します。
              <br />
              座標データはブラウザ内でのみ処理されます。
            </p>
            <button
              onClick={getLocation}
              disabled={isGettingLocation}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isGettingLocation ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  取得中...
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" />
                  位置情報を取得
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'proof' && location && (
        <div className="space-y-4">
          {/* Location Display */}
          <div className="bg-gradient-to-br from-slate-50 to-green-50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">取得した位置</span>
              <button
                onClick={() => setShowCoordinates(!showCoordinates)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showCoordinates ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-white/80 rounded-lg p-3 font-mono text-sm">
              {showCoordinates ? (
                <span>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
              ) : (
                <span className="text-slate-400">●●●●●●, ●●●●●●</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              精度: {location.accuracy.toFixed(0)}m
            </p>
          </div>

          {/* Privacy Level Selection */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-500" />
              プライバシーレベル選択
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PRIVACY_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.level}
                    onClick={() => setPrivacyLevel(option.level)}
                    className={clsx(
                      "p-3 rounded-xl border-2 transition-all text-left",
                      privacyLevel === option.level
                        ? "border-cyan-500 bg-cyan-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={clsx(
                        "w-4 h-4",
                        privacyLevel === option.level ? "text-cyan-600" : "text-slate-400"
                      )} />
                      <span className={clsx(
                        "text-sm font-medium",
                        privacyLevel === option.level ? "text-cyan-700" : "text-slate-700"
                      )}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{option.desc}</p>
                    <span className={clsx(
                      "text-xs font-bold mt-1 inline-block",
                      privacyLevel === option.level ? "text-green-600" : "text-slate-400"
                    )}>
                      報酬: {option.bonus}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-100 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">公開される情報:</p>
            <p className="text-sm font-medium text-slate-700">{getDisplayCoordinates()}</p>
          </div>

          {/* Generate Proof Button */}
          <button
            onClick={handleGenerateProof}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                ZK証明生成中...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                ZK証明を生成
              </>
            )}
          </button>
        </div>
      )}

      {step === 'submit' && proof && (
        <div className="space-y-4">
          {/* Proof Generated */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-bold text-green-700">ZK証明が生成されました</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="bg-white/80 rounded-lg p-2">
                <p className="text-xs text-slate-500 mb-1">証明ハッシュ</p>
                <p className="font-mono text-xs text-slate-700 break-all">{proof.proofHash.slice(0, 32)}...</p>
              </div>
              <div className="bg-white/80 rounded-lg p-2">
                <p className="text-xs text-slate-500 mb-1">エポック日</p>
                <p className="font-mono text-xs text-slate-700 break-all">{proof.publicInputs.epochDay}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/80 rounded-lg p-2">
                  <p className="text-xs text-slate-500">プライバシー</p>
                  <p className="font-medium text-slate-700">
                    {PRIVACY_OPTIONS.find(o => o.level === privacyLevel)?.label}
                  </p>
                </div>
                <div className="bg-white/80 rounded-lg p-2">
                  <p className="text-xs text-slate-500">報酬ボーナス</p>
                  <p className="font-medium text-green-600">
                    {PRIVACY_OPTIONS.find(o => o.level === privacyLevel)?.bonus}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          {!currentAccount ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-amber-700">
                オンチェーン提出にはウォレット接続が必要です
              </span>
            </div>
          ) : (
            <button
              onClick={handleSubmitOnChain}
              disabled={isPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  提出中...
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  オンチェーンに提出
                </>
              )}
            </button>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-green-50 to-cyan-50 rounded-2xl p-6 border border-green-200 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-700 mb-2">
              ZKチェックイン完了！
            </h3>
            <p className="text-sm text-slate-600">
              プライバシーを保護しながら位置証明が記録されました
            </p>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-colors"
          >
            新しいチェックインを開始
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h4 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1">
          <Shield className="w-4 h-4" />
          ZK証明とは？
        </h4>
        <p className="text-xs text-blue-600 leading-relaxed">
          ゼロ知識証明（ZK Proof）を使用して、正確な位置情報を公開せずに
          「特定の地域にいた」ことを証明できます。プライバシーレベルが
          高いほど、報酬ボーナスが増加します。
        </p>
      </div>
    </div>
  );
};
