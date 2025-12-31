import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCcw,
  Vote,
  Copy,
  CheckCircle,
  History
} from 'lucide-react';
import { useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { PACKAGE_ID, TOKEN_REGISTRY_ID, DAO_ID, REGIONAL_DAO_ID } from '../utils/constants';

interface WalletTabProps {
  userAddress: string;
}

interface TokenBalance {
  balance: number;
  pendingRewards: number;
}

interface TransactionHistory {
  id: string;
  type: 'checkin' | 'checkout' | 'dao_deposit' | 'receive';
  amount: number;
  timestamp: number;
  description: string;
}

export const WalletTab: React.FC<WalletTabProps> = ({ userAddress }) => {
  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    balance: 0,
    pendingRewards: 0,
  });
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [copied, setCopied] = useState(false);
  const [selectedDao, setSelectedDao] = useState<'global' | 'regional'>('global');
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  // トークン残高取得
  const { data: balanceData, refetch: refetchBalance } = useSuiClientQuery(
    'getObject',
    {
      id: TOKEN_REGISTRY_ID,
      options: { showContent: true }
    }
  );

  // 残高更新
  useEffect(() => {
    if (balanceData?.data?.content && 'fields' in balanceData.data.content) {
      // 実際のコントラクトからバランスを取得
      // ここはコントラクトの構造に合わせて調整
      setTokenBalance(prev => ({
        ...prev,
        balance: 1.234, // モック値、実際はコントラクトから取得
      }));
    }
  }, [balanceData]);

  // ローカルの取引履歴を復元
  useEffect(() => {
    const savedHistory = localStorage.getItem(`tx_history_${userAddress}`);
    if (savedHistory) {
      setTransactions(JSON.parse(savedHistory));
    }
  }, [userAddress]);

  // アドレスコピー
  const handleCopy = () => {
    navigator.clipboard.writeText(userAddress);
    setCopied(true);
    toast.success('アドレスをコピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  // DAOへトークン送信
  const handleDaoDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('有効な金額を入力してください');
      return;
    }

    if (amount > tokenBalance.balance) {
      toast.error('残高が不足しています');
      return;
    }

    const tx = new Transaction();
    const daoId = selectedDao === 'global' ? DAO_ID : REGIONAL_DAO_ID;
    const tokenAmountInUnits = Math.floor(amount * 1000);

    tx.moveCall({
      target: `${PACKAGE_ID}::dao::deposit_to_treasury`,
      arguments: [
        tx.object(daoId),
        tx.object(TOKEN_REGISTRY_ID),
        tx.pure.u64(tokenAmountInUnits),
        tx.object('0x6'), // Clock
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          toast.success(`${amount}トークンをDAOに送金しました`);
          setShowDepositModal(false);
          setDepositAmount('');
          
          // 取引履歴追加
          const newTx: TransactionHistory = {
            id: result.digest,
            type: 'dao_deposit',
            amount: amount,
            timestamp: Date.now(),
            description: `${selectedDao === 'global' ? '全体' : '地方'}DAOへ送金`,
          };
          const updatedTxs = [newTx, ...transactions].slice(0, 50);
          setTransactions(updatedTxs);
          localStorage.setItem(`tx_history_${userAddress}`, JSON.stringify(updatedTxs));
          
          refetchBalance();
        },
        onError: (error) => {
          toast.error('送金に失敗しました');
          console.error('Deposit error:', error);
        },
      }
    );
  };

  // アドレス省略表示
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* ウォレットカード */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="font-medium">マイウォレット</span>
          </div>
          <button
            onClick={() => refetchBalance()}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {/* 残高表示 */}
        <div className="text-center mb-4">
          <p className="text-sm text-white/70 mb-1">トークン残高</p>
          <p className="text-4xl font-bold">{tokenBalance.balance.toFixed(3)}</p>
          <p className="text-sm text-white/70 mt-1">STAY</p>
        </div>

        {/* アドレス */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-white/80 font-mono">
            {shortenAddress(userAddress)}
          </span>
          <button onClick={handleCopy} className="p-1 hover:bg-white/20 rounded">
            {copied ? (
              <CheckCircle className="w-4 h-4 text-green-300" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 投票力情報 */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Vote className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-amber-700">DAO投票力</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="text-xs text-slate-500">全体DAO</p>
            <p className="text-xl font-bold text-slate-800">
              {(tokenBalance.balance * 1000).toFixed(0)}
            </p>
            <p className="text-xs text-slate-400">票</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="text-xs text-slate-500">地方DAO</p>
            <p className="text-xl font-bold text-slate-800">
              {(tokenBalance.balance * 1000).toFixed(0)}
            </p>
            <p className="text-xs text-slate-400">票（住民票必要）</p>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowDepositModal(true)}
          className="flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          <ArrowUpRight className="w-5 h-5" />
          DAOに送金
        </button>
        <button
          disabled
          className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-400 rounded-xl font-medium cursor-not-allowed"
        >
          <ArrowDownLeft className="w-5 h-5" />
          受取（近日実装）
        </button>
      </div>

      {/* 取引履歴 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-100">
          <History className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-slate-700">取引履歴</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === 'checkout' ? 'bg-green-100' :
                    tx.type === 'dao_deposit' ? 'bg-blue-100' :
                    'bg-slate-100'
                  }`}>
                    {tx.type === 'checkout' ? (
                      <Coins className="w-4 h-4 text-green-600" />
                    ) : tx.type === 'dao_deposit' ? (
                      <ArrowUpRight className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{tx.description}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(tx.timestamp).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>
                <span className={`font-medium ${
                  tx.type === 'dao_deposit' ? 'text-red-500' : 'text-green-500'
                }`}>
                  {tx.type === 'dao_deposit' ? '-' : '+'}{tx.amount.toFixed(3)}
                </span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>取引履歴がありません</p>
            </div>
          )}
        </div>
      </div>

      {/* DAO送金モーダル */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4">DAOに送金</h3>
            
            {/* DAO選択 */}
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">送金先DAO</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedDao('global')}
                  className={`py-3 rounded-xl border-2 font-medium transition-colors ${
                    selectedDao === 'global'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  全体DAO
                </button>
                <button
                  onClick={() => setSelectedDao('regional')}
                  className={`py-3 rounded-xl border-2 font-medium transition-colors ${
                    selectedDao === 'regional'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  地方DAO
                </button>
              </div>
            </div>

            {/* 金額入力 */}
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">送金額</p>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.000"
                  step="0.001"
                  min="0"
                  max={tokenBalance.balance}
                  className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-lg font-medium focus:border-blue-500 focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  STAY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                残高: {tokenBalance.balance.toFixed(3)} STAY
              </p>
            </div>

            {/* ボタン */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDepositModal(false)}
                className="py-3 rounded-xl border border-slate-200 text-slate-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleDaoDeposit}
                disabled={isPending || !depositAmount}
                className="py-3 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50"
              >
                {isPending ? '処理中...' : '送金する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
