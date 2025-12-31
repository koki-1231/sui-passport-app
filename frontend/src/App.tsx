import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Toaster } from 'react-hot-toast';
import { 
  Home, 
  MapPin, 
  Wallet, 
  Vote, 
  User,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import clsx from 'clsx';
import { useZkLogin } from './hooks/useZkLogin';

// Tab Components
import { ZkLoginScreen } from './components/ZkLoginScreen';
import { HomeTab } from './components/HomeTab';
import { StayTab } from './components/StayTab';
import { WalletTab } from './components/WalletTab';
import { DaoTab } from './components/DaoTab';
import { ProfileTab } from './components/ProfileTab';

type TabType = 'home' | 'stay' | 'wallet' | 'dao' | 'profile';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const currentAccount = useCurrentAccount();
  const { 
    zkLoginState,
    isLoading: zkLoading,
    loginWithGoogle,
    logout: zkLogout,
    isConfigured
  } = useZkLogin();

  // 認証状態: zkLoginまたはウォレット接続のいずれか
  const isAuthenticated = zkLoginState.isAuthenticated || !!currentAccount;
  const userAddress = zkLoginState.userAddress || currentAccount?.address || '';

  // アドレス短縮表示
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 未認証の場合はログイン画面を表示
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-mesh flex items-center justify-center font-sans text-slate-800">
        <div className="w-full max-w-[390px] sm:max-w-[420px] h-[85vh] sm:h-[90vh] max-h-[850px] glass-panel rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border border-white/50">
          <ZkLoginScreen />
          <Toaster position="top-center" />
        </div>
      </div>
    );
  }

  // タブコンテンツをレンダリング
  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab />;
      case 'stay':
        return <StayTab userAddress={userAddress} />;
      case 'wallet':
        return <WalletTab userAddress={userAddress} />;
      case 'dao':
        return <DaoTab userAddress={userAddress} />;
      case 'profile':
        return <ProfileTab userAddress={userAddress} />;
      default:
        return <HomeTab />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-mesh flex items-center justify-center font-sans text-slate-800">
      <div className="w-full max-w-[390px] sm:max-w-[420px] h-[85vh] sm:h-[90vh] max-h-[850px] glass-panel rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border border-white/50">
        {/* ヘッダー */}
        <header className="bg-white/40 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/50 z-10">
          <h1 className="text-slate-800 font-bold text-lg tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            Sui Passport
          </h1>
          <div className="flex items-center gap-2">
            {/* 認証状態表示 */}
            {zkLoginState.isAuthenticated ? (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                zkLogin
              </span>
            ) : currentAccount ? (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                {truncateAddress(currentAccount.address)}
              </span>
            ) : null}
            
            {/* ウォレット未接続時のみConnectButtonを表示 */}
            {!currentAccount && !zkLoginState.isAuthenticated && (
              <div className="scale-90 origin-right">
                <ConnectButton />
              </div>
            )}
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto relative pb-20">
          {renderContent()}
        </main>

        {/* ボトムナビゲーション - 5タブ */}
        <div className="absolute bottom-0 left-0 w-full glass-tab flex justify-around items-center h-16 z-20">
          <button
            onClick={() => setActiveTab('home')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'home' ? "text-blue-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Home className={clsx("w-5 h-5 mb-1", activeTab === 'home' && "fill-current drop-shadow-sm")} />
            <span className="text-[9px] font-bold tracking-wider">ホーム</span>
          </button>

          <button
            onClick={() => setActiveTab('stay')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'stay' ? "text-green-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <MapPin className={clsx("w-5 h-5 mb-1", activeTab === 'stay' && "fill-current drop-shadow-sm")} />
            <span className="text-[9px] font-bold tracking-wider">滞在</span>
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'wallet' ? "text-yellow-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Wallet className={clsx("w-5 h-5 mb-1", activeTab === 'wallet' && "fill-current drop-shadow-sm")} />
            <span className="text-[9px] font-bold tracking-wider">トークン</span>
          </button>

          <button
            onClick={() => setActiveTab('dao')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'dao' ? "text-purple-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Vote className={clsx("w-5 h-5 mb-1", activeTab === 'dao' && "fill-current drop-shadow-sm")} />
            <span className="text-[9px] font-bold tracking-wider">DAO</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
              activeTab === 'profile' ? "text-orange-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <User className={clsx("w-5 h-5 mb-1", activeTab === 'profile' && "fill-current drop-shadow-sm")} />
            <span className="text-[9px] font-bold tracking-wider">設定</span>
          </button>
        </div>

        {/* トースト通知 */}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#1e293b',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
          }}
        />
      </div>
    </div>
  );
};

export default App;
