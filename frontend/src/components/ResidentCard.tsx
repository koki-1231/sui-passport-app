import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { User, QrCode, ShieldCheck, Sparkles, Camera, Loader2, CheckCircle } from 'lucide-react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { uploadImageToIPFS, uploadMetadataToIPFS } from '../utils/pinata';
import { PACKAGE_ID, RESIDENT_CARD_MODULE, MINT_RESIDENT_CARD, CLOCK_OBJECT_ID } from '../utils/constants';
import { useResidentNFT } from '../hooks/useResidentNFT';

type MintStatus = 'idle' | 'uploading_image' | 'uploading_metadata' | 'minting' | 'success';

export const ResidentCard: React.FC = () => {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const { nfts, hasNFT, isLoading: isLoadingNFTs, refetch } = useResidentNFT();

    const [residentImage, setResidentImage] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [addressInfo, setAddressInfo] = useState('');
    const [mintStatus, setMintStatus] = useState<MintStatus>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 3D Tilt Logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(useTransform(y, [-100, 100], [10, -10]), { stiffness: 150, damping: 20 });
    const rotateY = useSpring(useTransform(x, [-100, 100], [-10, 10]), { stiffness: 150, damping: 20 });

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set(event.clientX - centerX);
        y.set(event.clientY - centerY);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setResidentImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMintNFT = async () => {
        if (!account) {
            toast.error('ウォレットを接続してください');
            return;
        }

        if (!imageFile || !name || !addressInfo) {
            toast.error('すべての項目を入力してください');
            return;
        }

        const loadingToast = toast.loading('処理中...');

        try {
            // Step 1: Upload image to IPFS
            setMintStatus('uploading_image');
            toast.loading('画像をアップロード中...', { id: loadingToast });

            const imageResult = await uploadImageToIPFS(imageFile);
            if (!imageResult.success || !imageResult.url) {
                throw new Error(imageResult.error || '画像のアップロードに失敗しました');
            }

            // Step 2: Upload metadata to IPFS
            setMintStatus('uploading_metadata');
            toast.loading('メタデータをアップロード中...', { id: loadingToast });

            const metadata = {
                name: name,
                description: 'デジタル住民票NFT - Sui Passport',
                image: imageResult.url,
                attributes: [
                    { trait_type: 'address', value: addressInfo },
                    { trait_type: 'issued_date', value: new Date().toISOString() },
                ],
            };

            const metadataResult = await uploadMetadataToIPFS(metadata);
            if (!metadataResult.success || !metadataResult.url) {
                throw new Error(metadataResult.error || 'メタデータのアップロードに失敗しました');
            }

            // Step 3: Mint NFT on Sui
            setMintStatus('minting');
            toast.loading('NFTを発行中...', { id: loadingToast });

            const tx = new Transaction();

            tx.moveCall({
                target: `${PACKAGE_ID}::${RESIDENT_CARD_MODULE}::${MINT_RESIDENT_CARD}`,
                arguments: [
                    tx.pure.vector('u8', Array.from(new TextEncoder().encode(name))),
                    tx.pure.vector('u8', Array.from(new TextEncoder().encode(imageResult.url))),
                    tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadataResult.url))),
                    tx.pure.vector('u8', Array.from(new TextEncoder().encode(addressInfo))),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            await signAndExecuteTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        setMintStatus('success');
                        toast.success('住民票NFTの発行が完了しました！', { id: loadingToast });

                        // Refresh NFT list
                        setTimeout(() => {
                            refetch();
                            setMintStatus('idle');
                            setName('');
                            setAddressInfo('');
                            setResidentImage(null);
                            setImageFile(null);
                        }, 2000);
                    },
                    onError: (error) => {
                        throw error;
                    },
                }
            );
        } catch (error: any) {
            console.error('Mint error:', error);
            toast.error(error.message || 'エラーが発生しました', { id: loadingToast });
            setMintStatus('idle');
        }
    };

    const getStatusText = () => {
        switch (mintStatus) {
            case 'uploading_image': return '画像をIPFSにアップロード中...';
            case 'uploading_metadata': return 'メタデータをアップロード中...';
            case 'minting': return 'ブロックチェーンに記録中...';
            case 'success': return '発行完了！';
            default: return '';
        }
    };

    // Show existing NFT if user has one
    if (hasNFT && nfts.length > 0) {
        const nft = nfts[0]; // Show the first NFT
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 perspective-1000">
                <motion.div
                    style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className="relative w-full max-w-[340px] aspect-[1.58/1] rounded-2xl shadow-2xl cursor-pointer group"
                >
                    {/* Card Background */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
                        {/* Neon Gradients */}
                        <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-blue-600/30 rounded-full blur-[80px]" />
                        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[100%] bg-purple-600/30 rounded-full blur-[80px]" />

                        {/* Holographic Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" />

                        {/* Card Content */}
                        <div className="relative h-full p-6 flex flex-col justify-between text-white z-10">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
                                        <Sparkles className="w-4 h-4 text-blue-300" />
                                    </div>
                                    <span className="font-bold tracking-[0.2em] text-[10px] text-blue-200">SUI PASSPORT</span>
                                </div>
                                <div className="px-2 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded text-[10px] font-mono border border-blue-400/30 text-blue-300">
                                    RESIDENT
                                </div>
                            </div>

                            {/* Main Info */}
                            <div className="flex items-center gap-5 mt-2">
                                <div className="w-20 h-20 rounded-xl bg-slate-800 border-2 border-white/10 shadow-lg overflow-hidden relative group-hover:border-blue-400/50 transition-colors">
                                    {nft.imageUrl ? (
                                        <img src={nft.imageUrl} alt="Resident" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-full h-full p-4 text-slate-600" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Name</p>
                                    <h3 className="text-xl font-bold tracking-wide text-white drop-shadow-md">{nft.name}</h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-3 mb-1">Address</p>
                                    <p className="font-mono text-xs tracking-wide text-blue-200 truncate max-w-[150px]">{nft.addressInfo}</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-slate-500 mb-0.5">ISSUED DATE</p>
                                    <p className="text-xs font-medium text-slate-300">
                                        {new Date(nft.issuedAt).toLocaleDateString('ja-JP')}
                                    </p>
                                </div>
                                <div className="p-1 bg-white rounded-lg">
                                    <QrCode className="w-8 h-8 text-black" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="mt-12 text-center space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Status</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        <span className="text-xs font-medium text-green-400">Active Resident</span>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoadingNFTs) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="mt-4 text-slate-500">住民票を読み込み中...</p>
            </div>
        );
    }

    // Mint form
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6 overflow-y-auto">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full"></div>
                <div className="bg-white/5 backdrop-blur-xl p-8 rounded-full border border-white/10 relative z-10">
                    <ShieldCheck className="w-16 h-16 text-blue-400" />
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    住民票を発行する
                </h2>
                <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">
                    デジタル住民票NFTを発行して、DAO機能にアクセスしましょう。
                </p>
            </div>

            <div className="w-full max-w-xs space-y-4">
                {/* Image Upload Area */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-square rounded-2xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 group overflow-hidden"
                >
                    {residentImage ? (
                        <img src={residentImage} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <>
                            <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform">
                                <Camera className="w-6 h-6 text-slate-400" />
                            </div>
                            <span className="text-xs text-slate-500 font-medium">写真をアップロード</span>
                        </>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />
                </div>

                {/* Name Input */}
                <input
                    type="text"
                    placeholder="氏名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors"
                />

                {/* Address Input */}
                <input
                    type="text"
                    placeholder="住所"
                    value={addressInfo}
                    onChange={(e) => setAddressInfo(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors"
                />

                {/* Status Display */}
                {mintStatus !== 'idle' && mintStatus !== 'success' && (
                    <div className="flex items-center justify-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        <span className="text-sm text-slate-500">{getStatusText()}</span>
                    </div>
                )}

                {mintStatus === 'success' && (
                    <div className="flex items-center justify-center gap-2 py-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-500">{getStatusText()}</span>
                    </div>
                )}

                {/* Mint Button */}
                <button
                    onClick={handleMintNFT}
                    disabled={!residentImage || !name || !addressInfo || mintStatus !== 'idle' || !account}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 ${residentImage && name && addressInfo && mintStatus === 'idle' && account
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-blue-900/50'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    <Sparkles className="w-5 h-5" />
                    住民票NFTを発行
                </button>

                {!account && (
                    <p className="text-xs text-amber-500 mt-2">
                        ウォレットを接続してください
                    </p>
                )}
            </div>
        </div>
    );
};
