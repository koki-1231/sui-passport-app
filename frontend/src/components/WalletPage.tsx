import React, { useState } from 'react';
import { Wallet, Send, RefreshCw, Copy, CheckCircle, Loader2, ArrowUpRight } from 'lucide-react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import clsx from 'clsx';

export const WalletPage: React.FC = () => {
    const account = useCurrentAccount();
    const { balance, isLoading, refetch, address } = useWallet();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            toast.success('アドレスをコピーしました');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleTransfer = async () => {
        if (!account) {
            toast.error('ウォレットを接続してください');
            return;
        }

        if (!recipient || !amount) {
            toast.error('送金先と金額を入力してください');
            return;
        }

        const amountNumber = parseFloat(amount);
        if (isNaN(amountNumber) || amountNumber <= 0) {
            toast.error('有効な金額を入力してください');
            return;
        }

        // Check if recipient is a valid Sui address
        if (!recipient.startsWith('0x') || recipient.length !== 66) {
            toast.error('有効なSuiアドレスを入力してください');
            return;
        }

        setIsSending(true);
        const loadingToast = toast.loading('送金処理中...');

        try {
            const tx = new Transaction();

            // Convert SUI to MIST (1 SUI = 10^9 MIST)
            const amountInMist = Math.floor(amountNumber * 1e9);

            const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);
            tx.transferObjects([coin], tx.pure.address(recipient));

            await signAndExecuteTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        toast.success('送金が完了しました！', { id: loadingToast });
                        setRecipient('');
                        setAmount('');
                        refetch();
                    },
                    onError: (error) => {
                        throw error;
                    },
                }
            );
        } catch (error: any) {
            console.error('Transfer error:', error);
            toast.error(error.message || '送金に失敗しました', { id: loadingToast });
        } finally {
            setIsSending(false);
        }
    };

    if (!account) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 rounded-full"></div>
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
                        <Wallet className="w-16 h-16 text-purple-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                        ウォレットを接続
                    </h2>
                    <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
                        残高の確認や送金を行うには、ウォレットを接続してください。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full p-4 space-y-6 overflow-y-auto">
            {/* Balance Card */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-white/70 text-sm font-medium mb-1">残高</p>
                        <div className="flex items-baseline gap-2">
                            {isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <span className="text-4xl font-bold">{balance?.totalBalance || '0'}</span>
                                    <span className="text-lg opacity-80">SUI</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={refetch}
                        className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className={clsx("w-5 h-5", isLoading && "animate-spin")} />
                    </button>
                </div>

                {/* Address */}
                <div className="flex items-center gap-2 bg-white/10 rounded-lg p-3">
                    <span className="text-xs font-mono truncate flex-1">
                        {address}
                    </span>
                    <button
                        onClick={handleCopyAddress}
                        className="p-1.5 hover:bg-white/20 rounded transition-colors"
                    >
                        {copied ? (
                            <CheckCircle className="w-4 h-4 text-green-300" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* Transfer Section */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Send className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-bold text-slate-700">送金</h3>
                </div>

                <input
                    type="text"
                    placeholder="送金先アドレス (0x...)"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors text-sm font-mono"
                />

                <div className="relative">
                    <input
                        type="number"
                        placeholder="金額"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        step="0.0001"
                        min="0"
                        className="w-full px-4 py-3 pr-16 rounded-xl bg-white/50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                        SUI
                    </span>
                </div>

                {/* Quick amount buttons */}
                <div className="flex gap-2">
                    {['0.1', '0.5', '1.0', 'MAX'].map((val) => (
                        <button
                            key={val}
                            onClick={() => {
                                if (val === 'MAX' && balance) {
                                    // Leave some for gas
                                    const maxAmount = Math.max(0, parseFloat(balance.totalBalance) - 0.01);
                                    setAmount(maxAmount.toFixed(4));
                                } else {
                                    setAmount(val);
                                }
                            }}
                            className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-colors"
                        >
                            {val}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleTransfer}
                    disabled={!recipient || !amount || isSending}
                    className={clsx(
                        "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform flex items-center justify-center gap-2",
                        recipient && amount && !isSending
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:-translate-y-1 shadow-purple-900/30'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                >
                    {isSending ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            送金中...
                        </>
                    ) : (
                        <>
                            <ArrowUpRight className="w-5 h-5" />
                            送金する
                        </>
                    )}
                </button>
            </div>

            {/* Recent Transactions (placeholder) */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-bold text-slate-700 mb-4">取引履歴</h3>
                <p className="text-sm text-slate-500 text-center py-8">
                    取引履歴はまもなく利用可能になります
                </p>
            </div>
        </div>
    );
};
