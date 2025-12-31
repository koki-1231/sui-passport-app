import React, { useState, useEffect } from 'react';
import { 
  User, 
  IdCard, 
  LogOut, 
  Settings, 
  ChevronRight,
  Shield,
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy
} from 'lucide-react';
import { useSignAndExecuteTransaction, useSuiClientQuery, useDisconnectWallet } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { PACKAGE_ID, RESIDENT_CARD_REGISTRY_ID, RESIDENT_CARD_TYPE } from '../utils/constants';
import { useZkLogin } from '../hooks/useZkLogin';

interface ProfileTabProps {
  userAddress: string;
}

interface ResidentCard {
  id: string;
  regionId: number;
  regionName: string;
  issuedAt: number;
  expiresAt: number;
}

// 地方名マッピング
const REGION_NAMES: { [key: number]: string } = {
  1: '東京都',
  2: '大阪府',
  3: '愛知県',
  4: '福岡県',
  5: '北海道',
};

export const ProfileTab: React.FC<ProfileTabProps> = ({ userAddress }) => {
  const [residentCard, setResidentCard] = useState<ResidentCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(true);
  const [showMintModal, setShowMintModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const { mutate: disconnect } = useDisconnectWallet();
  const { logout: zkLogout, zkLoginState } = useZkLogin();

  // 住民票NFT取得
  const { data: ownedCards, refetch: refetchCards } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: userAddress,
      filter: { StructType: RESIDENT_CARD_TYPE },
      options: { showContent: true },
    }
  );

  // 住民票データ解析
  useEffect(() => {
    if (ownedCards) {
      const cards = ownedCards.data || [];
      if (cards.length > 0 && cards[0].data?.content && 'fields' in cards[0].data.content) {
        const fields = cards[0].data.content.fields as {
          id: { id: string };
          region_id: string;
          issued_at: string;
          expires_at: string;
        };
        
        const regionId = parseInt(fields.region_id || '1');
        setResidentCard({
          id: fields.id?.id || '',
          regionId: regionId,
          regionName: REGION_NAMES[regionId] || '不明',
          issuedAt: parseInt(fields.issued_at || '0'),
          expiresAt: parseInt(fields.expires_at || '0'),
        });
      } else {
        setResidentCard(null);
      }
      setIsLoadingCard(false);
    }
  }, [ownedCards]);

  // 住民票発行
  const handleMintCard = async () => {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::resident_card::mint_resident_card`,
      arguments: [
        tx.object(RESIDENT_CARD_REGISTRY_ID),
        tx.pure.u64(selectedRegion),
        tx.object('0x6'),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success('住民票を発行しました！');
          setShowMintModal(false);
          refetchCards();
        },
        onError: (error) => {
          toast.error('住民票の発行に失敗しました');
          console.error('Mint card error:', error);
        },
      }
    );
  };

  // ログアウト
  const handleLogout = () => {
    zkLogout();
    disconnect();
    toast.success('ログアウトしました');
  };

  // アドレスコピー
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(userAddress);
    setCopied(true);
    toast.success('アドレスをコピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  // アドレス省略
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // 日付フォーマット
  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '---';
    return new Date(timestamp).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* プロフィールヘッダー */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-white/70">ウォレットアドレス</p>
            <div className="flex items-center gap-2">
              <p className="font-mono font-medium">{shortenAddress(userAddress)}</p>
              <button
                onClick={handleCopyAddress}
                className="p-1 hover:bg-white/20 rounded"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-300" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* zkLogin情報 */}
        {zkLoginState.userAddress && (
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-300" />
              <span className="text-sm text-white/90">zkLoginで認証済み</span>
            </div>
          </div>
        )}
      </div>

      {/* 住民票セクション */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-100">
          <IdCard className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-slate-700">住民票NFT</span>
        </div>

        {isLoadingCard ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-slate-400">読み込み中...</p>
          </div>
        ) : residentCard ? (
          <div className="p-4">
            {/* 住民票カード */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-200 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">
                  デジタル住民票
                </span>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span className="text-slate-700">
                    <span className="text-xs text-slate-500">地方: </span>
                    <span className="font-medium">{residentCard.regionName}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-slate-700">
                    <span className="text-xs text-slate-500">発行日: </span>
                    <span className="font-medium">{formatDate(residentCard.issuedAt)}</span>
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs text-amber-600 font-mono truncate">
                  ID: {residentCard.id}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500 text-center">
              ✨ 地方DAOへの参加資格があります
            </p>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <IdCard className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 mb-2">住民票がありません</p>
            <p className="text-sm text-slate-400 mb-4">
              住民票を取得すると地方DAOに参加できます
            </p>
            <button
              onClick={() => setShowMintModal(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              住民票を取得
            </button>
          </div>
        )}
      </div>

      {/* 設定メニュー */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-100">
          <Settings className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-slate-700">設定</span>
        </div>

        <div className="divide-y divide-slate-100">
          <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
            <span className="text-slate-600">言語設定</span>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-sm">日本語</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
          
          <a
            href={`https://suiscan.xyz/testnet/account/${userAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <span className="text-slate-600">SuiScanで確認</span>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      </div>

      {/* ログアウトボタン */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        ログアウト
      </button>

      {/* 住民票発行モーダル */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4">住民票を取得</h3>
            
            <p className="text-sm text-slate-500 mb-4">
              登録する地方を選択してください。住民票があると地方DAOに参加できます。
            </p>

            {/* 地方選択 */}
            <div className="space-y-2 mb-6">
              {Object.entries(REGION_NAMES).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setSelectedRegion(parseInt(id))}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                    selectedRegion === parseInt(id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-700">{name}</span>
                  {selectedRegion === parseInt(id) && (
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowMintModal(false)}
                className="py-3 rounded-xl border border-slate-200 text-slate-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleMintCard}
                disabled={isPending}
                className="py-3 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    発行中...
                  </span>
                ) : (
                  '住民票を発行'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
