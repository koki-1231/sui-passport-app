import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Vote, ThumbsUp, ThumbsDown, Plus, Loader2, ShieldCheck, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDAO, ProposalData } from '../hooks/useDAO';
import { useResidentNFT } from '../hooks/useResidentNFT';
import { PACKAGE_ID, DAO_MODULE, CLOCK_OBJECT_ID } from '../utils/constants';

export const DaoVoting: React.FC = () => {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const { proposals, isLoading, fetchProposals } = useDAO();
    const { nfts } = useResidentNFT();

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [now, setNow] = useState(Date.now());

    // 残り時間を更新するためのタイマー
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    const hasResidentNFT = nfts.length > 0;
    const residentNFTId = hasResidentNFT ? nfts[0].id : null;

    // 残り時間を人間が読める形式に変換
    const formatRemainingTime = (deadline: number): string => {
        const remaining = deadline - now;
        if (remaining <= 0) return '期限切れ';

        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `残り ${days}日 ${hours}時間`;
        if (hours > 0) return `残り ${hours}時間 ${minutes}分`;
        return `残り ${minutes}分`;
    };

    const isExpired = (deadline: number): boolean => {
        return now >= deadline;
    };

    const handleCreateProposal = async () => {
        if (!account || !residentNFTId) {
            toast.error('ResidentNFTが必要です');
            return;
        }

        if (!title || !description) {
            toast.error('タイトルと説明を入力してください');
            return;
        }

        setIsCreating(true);
        const loadingToast = toast.loading('提案を作成中...');

        try {
            const tx = new Transaction();

            tx.moveCall({
                target: `${PACKAGE_ID}::${DAO_MODULE}::create_proposal`,
                arguments: [
                    tx.object(residentNFTId),
                    tx.pure.vector('u8', Array.from(new TextEncoder().encode(title))),
                    tx.pure.vector('u8', Array.from(new TextEncoder().encode(description))),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            await signAndExecuteTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        toast.success('提案が作成されました！（期限: 1週間後）', { id: loadingToast });
                        setTitle('');
                        setDescription('');
                        setShowCreateForm(false);
                        setTimeout(fetchProposals, 2000);
                    },
                    onError: (error) => {
                        throw error;
                    },
                }
            );
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '提案の作成に失敗しました', { id: loadingToast });
        } finally {
            setIsCreating(false);
        }
    };

    const handleVote = async (proposalId: string, choice: boolean) => {
        if (!account || !residentNFTId) {
            toast.error('ResidentNFTが必要です');
            return;
        }

        const loadingToast = toast.loading('投票中...');

        try {
            const tx = new Transaction();

            tx.moveCall({
                target: `${PACKAGE_ID}::${DAO_MODULE}::vote`,
                arguments: [
                    tx.object(proposalId),
                    tx.object(residentNFTId),
                    tx.pure.bool(choice),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            await signAndExecuteTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        toast.success(choice ? '賛成票を投じました！' : '反対票を投じました！', {
                            id: loadingToast,
                        });
                        setTimeout(fetchProposals, 2000);
                    },
                    onError: (error) => {
                        throw error;
                    },
                }
            );
        } catch (error: any) {
            console.error(error);
            if (error.message?.includes('E_ALREADY_VOTED') || error.message?.includes('1,')) {
                toast.error('既に投票済みです', { id: loadingToast });
            } else if (error.message?.includes('E_PROPOSAL_EXPIRED') || error.message?.includes('4,')) {
                toast.error('この提案は期限切れです', { id: loadingToast });
            } else if (error.message?.includes('E_PROPOSAL_NOT_ACTIVE') || error.message?.includes('3,')) {
                toast.error('この提案は終了しています', { id: loadingToast });
            } else {
                toast.error(error.message || '投票に失敗しました', { id: loadingToast });
            }
        }
    };

    // 期限切れ提案を解決（誰でも実行可能）
    const handleResolveExpired = async (proposalId: string) => {
        const loadingToast = toast.loading('提案を集計中...');

        try {
            const tx = new Transaction();

            tx.moveCall({
                target: `${PACKAGE_ID}::${DAO_MODULE}::resolve_expired_proposal`,
                arguments: [
                    tx.object(proposalId),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            await signAndExecuteTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        toast.success('提案が集計されました！', { id: loadingToast });
                        setTimeout(fetchProposals, 2000);
                    },
                    onError: (error) => {
                        throw error;
                    },
                }
            );
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '集計に失敗しました', { id: loadingToast });
        }
    };

    if (!account) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full"></div>
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
                        <Vote className="w-16 h-16 text-blue-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        DAO投票
                    </h2>
                    <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
                        ウォレットを接続してください
                    </p>
                </div>
            </div>
        );
    }

    if (!hasResidentNFT) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 rounded-full"></div>
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
                        <ShieldCheck className="w-16 h-16 text-amber-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                        住民票NFTが必要
                    </h2>
                    <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
                        投票するには<br />My Cardタブで住民票NFTを発行してください
                    </p>
                </div>
            </div>
        );
    }

    const renderProposalCard = (proposal: ProposalData) => {
        const total = proposal.yesVotes + proposal.noVotes;
        const yesPercent = total > 0 ? (proposal.yesVotes / total) * 100 : 50;
        const expired = isExpired(proposal.deadline);
        const canResolve = expired && proposal.status === 0;

        const getStatusBadge = () => {
            if (proposal.status === 1) {
                return (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        可決
                    </span>
                );
            }
            if (proposal.status === 2) {
                return (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                        ✗ 否決
                    </span>
                );
            }
            if (expired) {
                return (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        期限切れ
                    </span>
                );
            }
            return (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRemainingTime(proposal.deadline)}
                </span>
            );
        };

        return (
            <div
                key={proposal.id}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/50 space-y-3 shadow-md hover:shadow-lg transition-shadow"
            >
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-sm">{proposal.title}</h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{proposal.description}</p>
                    </div>
                    {getStatusBadge()}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-green-600">賛成 {proposal.yesVotes}</span>
                        <span className="text-red-600">反対 {proposal.noVotes}</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                            style={{ width: `${yesPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{yesPercent.toFixed(1)}% が賛成</span>
                        <span>合計 {total} 票</span>
                    </div>
                </div>

                {/* Action Buttons */}
                {proposal.status === 0 && !expired && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleVote(proposal.id, true)}
                            className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <ThumbsUp className="w-4 h-4" />
                            賛成
                        </button>
                        <button
                            onClick={() => handleVote(proposal.id, false)}
                            className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <ThumbsDown className="w-4 h-4" />
                            反対
                        </button>
                    </div>
                )}

                {/* Resolve Button for Expired Proposals */}
                {canResolve && (
                    <button
                        onClick={() => handleResolveExpired(proposal.id)}
                        className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <CheckCircle className="w-4 h-4" />
                        集計して終了
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">DAO投票</h2>
                    <p className="text-xs text-slate-500">まちづくりの提案に投票</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/50 space-y-3 shadow-lg">
                    <h3 className="font-semibold text-slate-700">新しい提案を作成</h3>
                    <p className="text-xs text-slate-500">投票期間: 1週間</p>
                    <input
                        type="text"
                        placeholder="提案タイトル"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors text-sm"
                    />
                    <textarea
                        placeholder="詳細説明"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-white/50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors text-sm resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCreateForm(false)}
                            className="flex-1 py-2 bg-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-300 transition-colors text-sm"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleCreateProposal}
                            disabled={isCreating || !title || !description}
                            className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    作成中...
                                </>
                            ) : (
                                '提案を作成'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Proposals List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
            ) : proposals.length === 0 ? (
                <div className="text-center py-12">
                    <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">提案がまだありません</p>
                    <p className="text-slate-400 text-xs mt-1">右上の + ボタンから作成できます</p>
                </div>
            ) : (
                proposals.map(renderProposalCard)
            )}
        </div>
    );
};
