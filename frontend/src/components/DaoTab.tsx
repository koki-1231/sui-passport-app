import React, { useState, useEffect } from 'react';
import { 
  Vote, 
  Plus, 
  ThumbsUp, 
  ThumbsDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Users,
  Globe,
  MapPin,
  Loader2,
  Lock
} from 'lucide-react';
import { useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { PACKAGE_ID, DAO_ID, REGIONAL_DAO_ID, RESIDENT_CARD_TYPE } from '../utils/constants';

interface DaoTabProps {
  userAddress: string;
}

// 提案のステータス
type ProposalStatus = 'voting' | 'passed' | 'rejected' | 'pending';

// 提案の型定義
interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  votesFor: number;
  votesAgainst: number;
  status: ProposalStatus;
  deadline: number;
  daoType: 'global' | 'regional';
  regionId?: number;
}

// サンプル提案データ
const SAMPLE_PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: '渋谷エリアの新チェックインスポット追加',
    description: '渋谷駅周辺に新しいチェックインスポットを5箇所追加する提案です。',
    proposer: '0x1234...5678',
    votesFor: 12500,
    votesAgainst: 3200,
    status: 'voting',
    deadline: Date.now() + 86400000 * 3,
    daoType: 'global',
  },
  {
    id: '2',
    title: 'トークン報酬率の調整',
    description: '滞在報酬を0.001から0.002トークン/分に引き上げる提案。',
    proposer: '0xabcd...ef01',
    votesFor: 8900,
    votesAgainst: 7100,
    status: 'voting',
    deadline: Date.now() + 86400000 * 5,
    daoType: 'global',
  },
  {
    id: '3',
    title: '東京地方の住民イベント開催',
    description: '東京地方の住民限定イベントを開催。参加者にはボーナストークン配布。',
    proposer: '0x9876...5432',
    votesFor: 5600,
    votesAgainst: 1200,
    status: 'voting',
    deadline: Date.now() + 86400000 * 2,
    daoType: 'regional',
    regionId: 1,
  },
  {
    id: '4',
    title: '大阪地方のゾーン半径拡大',
    description: '難波エリアのチェックインゾーン半径を500mから750mに拡大。',
    proposer: '0xfedc...ba98',
    votesFor: 3400,
    votesAgainst: 2100,
    status: 'voting',
    deadline: Date.now() + 86400000 * 4,
    daoType: 'regional',
    regionId: 2,
  },
];

export const DaoTab: React.FC<DaoTabProps> = ({ userAddress }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'regional'>('global');
  const [proposals, setProposals] = useState<Proposal[]>(SAMPLE_PROPOSALS);
  const [hasResidentCard, setHasResidentCard] = useState(false);
  const [isCheckingCard, setIsCheckingCard] = useState(true);
  const [votingPower, setVotingPower] = useState(1234);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: '', description: '' });

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  // 住民票確認
  const { data: ownedObjects } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: userAddress,
      filter: { StructType: RESIDENT_CARD_TYPE },
      options: { showContent: true },
    }
  );

  useEffect(() => {
    if (ownedObjects) {
      const hasCard = (ownedObjects.data?.length ?? 0) > 0;
      setHasResidentCard(hasCard);
      setIsCheckingCard(false);
    }
  }, [ownedObjects]);

  // 投票処理
  const handleVote = async (proposalId: string, voteFor: boolean) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    // 地方DAOの場合、住民票チェック
    if (proposal.daoType === 'regional' && !hasResidentCard) {
      toast.error('地方DAOへの投票には住民票が必要です');
      return;
    }

    const tx = new Transaction();
    const daoId = proposal.daoType === 'global' ? DAO_ID : REGIONAL_DAO_ID;

    tx.moveCall({
      target: `${PACKAGE_ID}::dao::vote`,
      arguments: [
        tx.object(daoId),
        tx.pure.string(proposalId),
        tx.pure.bool(voteFor),
        tx.pure.u64(votingPower),
        tx.object('0x6'),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success(voteFor ? '賛成票を投じました' : '反対票を投じました');
          
          // ローカル状態更新
          setProposals(prev => prev.map(p => {
            if (p.id === proposalId) {
              return {
                ...p,
                votesFor: voteFor ? p.votesFor + votingPower : p.votesFor,
                votesAgainst: !voteFor ? p.votesAgainst + votingPower : p.votesAgainst,
              };
            }
            return p;
          }));
        },
        onError: (error) => {
          toast.error('投票に失敗しました');
          console.error('Vote error:', error);
        },
      }
    );
  };

  // 提案作成
  const handleCreateProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      toast.error('タイトルと説明を入力してください');
      return;
    }

    // 地方DAOの場合、住民票チェック
    if (activeTab === 'regional' && !hasResidentCard) {
      toast.error('地方DAOへの提案には住民票が必要です');
      return;
    }

    const tx = new Transaction();
    const daoId = activeTab === 'global' ? DAO_ID : REGIONAL_DAO_ID;

    tx.moveCall({
      target: `${PACKAGE_ID}::dao::create_proposal`,
      arguments: [
        tx.object(daoId),
        tx.pure.string(newProposal.title),
        tx.pure.string(newProposal.description),
        tx.object('0x6'),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success('提案を作成しました');
          setShowCreateModal(false);
          setNewProposal({ title: '', description: '' });
          
          // ローカル状態に追加
          const newP: Proposal = {
            id: Date.now().toString(),
            title: newProposal.title,
            description: newProposal.description,
            proposer: userAddress.slice(0, 6) + '...' + userAddress.slice(-4),
            votesFor: 0,
            votesAgainst: 0,
            status: 'voting',
            deadline: Date.now() + 86400000 * 7,
            daoType: activeTab,
          };
          setProposals(prev => [newP, ...prev]);
        },
        onError: (error) => {
          toast.error('提案の作成に失敗しました');
          console.error('Create proposal error:', error);
        },
      }
    );
  };

  // フィルター済み提案
  const filteredProposals = proposals.filter(p => p.daoType === activeTab);

  // 残り時間フォーマット
  const formatTimeRemaining = (deadline: number): string => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return '終了';
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    return `あと${days}日${hours}時間`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">DAO投票</h2>
          <p className="text-sm text-slate-500">コミュニティの意思決定に参加</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          提案作成
        </button>
      </div>

      {/* 投票力表示 */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-700">あなたの投票力</span>
          </div>
          <span className="text-2xl font-bold text-purple-700">{votingPower.toLocaleString()}</span>
        </div>
        <p className="text-xs text-purple-500 mt-1">
          ※ 保有トークン × 1000 = 投票力
        </p>
      </div>

      {/* タブ切り替え */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'global'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          <Globe className="w-4 h-4" />
          全体DAO
        </button>
        <button
          onClick={() => setActiveTab('regional')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'regional'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          <MapPin className="w-4 h-4" />
          地方DAO
          {!hasResidentCard && <Lock className="w-3 h-3" />}
        </button>
      </div>

      {/* 住民票警告（地方DAOの場合） */}
      {activeTab === 'regional' && !hasResidentCard && !isCheckingCard && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700">住民票が必要です</p>
              <p className="text-sm text-amber-600 mt-1">
                地方DAOの投票・提案には住民票NFTが必要です。
                プロフィールタブから住民票を取得してください。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 提案リスト */}
      <div className="space-y-3">
        {filteredProposals.length > 0 ? (
          filteredProposals.map((proposal) => (
            <div
              key={proposal.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* 提案ヘッダー */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-800">{proposal.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    proposal.status === 'voting' 
                      ? 'bg-blue-100 text-blue-700'
                      : proposal.status === 'passed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {proposal.status === 'voting' ? '投票中' : 
                     proposal.status === 'passed' ? '可決' : '否決'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{proposal.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>提案者: {proposal.proposer}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeRemaining(proposal.deadline)}
                  </span>
                </div>
              </div>

              {/* 投票状況 */}
              <div className="p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="flex items-center gap-1 text-green-600">
                    <ThumbsUp className="w-4 h-4" />
                    賛成: {proposal.votesFor.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    反対: {proposal.votesAgainst.toLocaleString()}
                    <ThumbsDown className="w-4 h-4" />
                  </span>
                </div>

                {/* 投票バー */}
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400"
                    style={{
                      width: `${(proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100}%`,
                    }}
                  />
                </div>

                {/* 投票ボタン */}
                {proposal.status === 'voting' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleVote(proposal.id, true)}
                      disabled={isPending || (activeTab === 'regional' && !hasResidentCard)}
                      className="flex items-center justify-center gap-2 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      賛成
                    </button>
                    <button
                      onClick={() => handleVote(proposal.id, false)}
                      disabled={isPending || (activeTab === 'regional' && !hasResidentCard)}
                      className="flex items-center justify-center gap-2 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      反対
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Vote className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>提案がありません</p>
          </div>
        )}
      </div>

      {/* 提案作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              新しい提案を作成
            </h3>

            {/* 住民票警告 */}
            {activeTab === 'regional' && !hasResidentCard && (
              <div className="bg-amber-50 rounded-lg p-3 mb-4 text-sm text-amber-700">
                地方DAOへの提案には住民票が必要です
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-500 mb-1 block">タイトル</label>
                <input
                  type="text"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="提案のタイトル"
                  className="w-full py-3 px-4 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 mb-1 block">説明</label>
                <textarea
                  value={newProposal.description}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="提案の詳細な説明"
                  rows={4}
                  className="w-full py-3 px-4 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="py-3 rounded-xl border border-slate-200 text-slate-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateProposal}
                disabled={isPending || (activeTab === 'regional' && !hasResidentCard)}
                className="py-3 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50"
              >
                {isPending ? '作成中...' : '提案を作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
