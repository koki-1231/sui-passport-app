import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Toaster } from 'react-hot-toast';
import { Home, MapPin, Coins, Vote, User, LogOut, Shield } from 'lucide-react';
import clsx from 'clsx';

// Components
import { ZkLoginScreen } from './components/ZkLoginScreen';
import { HomeTab } from './components/HomeTab';
import { StayTab } from './components/StayTab';
import { WalletTab } from './components/WalletTab';
import { DaoTab } from './components/DaoTab';
import { ProfileTab } from './components/ProfileTab';

// Hooks
import { useZkLogin } from './hooks/useZkLogin';
import { useStaySession } from './hooks/useStaySession';

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

  // 認証状態
  const isAuthenticated = zkLoginState.isAuthenticated || !!currentAccount?.address;
  const effectiveAddress = currentAccount?.address || zkLoginState.address;

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
          <ZkLoginScreen 
            onLogin={loginWithGoogle}
            isLoading={zkLoading}
            isConfigured={isConfigured}
          />
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab userAddress={effectiveAddress!} />;
      case 'stay':
        return <StayTab userAddress={effectiveAddress!} />;
      case 'wallet':
        return <WalletTab userAddress={effectiveAddress!} />;
      case 'dao':
        return <DaoTab userAddress={effectiveAddress!} />;
      case 'profile':
        return <ProfileTab 
          userAddress={effectiveAddress!} 
          authMethod={currentAccount ? 'wallet' : 'zklogin'}
          onLogout={zkLogout}
        />;
      default:
        return <HomeTab userAddress={effectiveAddress!} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-mesh flex items-center justify-center font-sans text-slate-800">
      <div className="w-full max-w-[390px] sm:max-w-[420px] h-[85vh] sm:h-[90vh] max-h-[850px] glass-panel rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border border-white/50">
        
        {/* Header */}
        <header className="bg-white/40 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/50 z-10">
          <h1 className="text-slate-800 font-bold text-lg tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            Sui Passport
          </h1>
          <div className="flex items-center gap-2">
            {/* 認証状態表示 */}
            <div className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
              <Shield className="w-3 h-3" />
              {truncateAddress(effectiveAddress || '')}
            </div>
            {/* ウォレット接続（オプション） */}
            {!currentAccount && (
              <div className="scale-75 origin-right">
                <ConnectButton />
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative pb-20">
          {renderContent()}
        </main>

        {/* Bottom Navigation - 5 tabs */}
        <div className="absolute bottom-0 left-0 w-full glass-tab flex justify-around items-center h-16 z-20">
          <NavButton 
            icon={Home} 
            label="ホーム" 
            isActive={activeTab === 'home'}
            onClick={() => setActiveTab('home')}
            color="blue"
          />
          <NavButton 
            icon={MapPin} 
            label="滞在" 
            isActive={activeTab === 'stay'}
            onClick={() => setActiveTab('stay')}
            color="green"
          />
          <NavButton 
            icon={Coins} 
            label="残高" 
            isActive={activeTab === 'wallet'}
            onClick={() => setActiveTab('wallet')}
            color="yellow"
          />
          <NavButton 
            icon={Vote} 
            label="DAO" 
            isActive={activeTab === 'dao'}
            onClick={() => setActiveTab('dao')}
            color="purple"
          />
          <NavButton 
            icon={User} 
            label="設定" 
            isActive={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            color="slate"
          />
        </div>

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

// Navigation Button Component
interface NavButtonProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'slate' | 'orange';
}

const NavButton: React.FC<NavButtonProps> = ({ icon: Icon, label, isActive, onClick, color }) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    slate: 'text-slate-600',
    orange: 'text-orange-600',
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-300",
        isActive ? `${colorClasses[color]} scale-110` : "text-slate-400 hover:text-slate-600"
      )}
    >
      <Icon className={clsx("w-5 h-5 mb-1", isActive && "fill-current drop-shadow-sm")} />
      <span className="text-[9px] font-bold tracking-wider">{label}</span>
    </button>
  );
};

export default App;
