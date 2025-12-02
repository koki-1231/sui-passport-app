import React, { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { StayFeature } from './StayFeature';
import { ResidentCard } from './components/ResidentCard';
import { Toaster } from 'react-hot-toast';
import { MapPin, UserSquare2 } from 'lucide-react';
import clsx from 'clsx';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkin' | 'card'>('checkin');

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white h-[85vh] max-h-[900px] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative border border-slate-200">
        <header className="bg-blue-600 p-4 flex justify-between items-center shadow-md z-10">
          <h1 className="text-white font-bold text-lg tracking-wide">Sui Passport</h1>
          <div className="scale-90 origin-right">
            <ConnectButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 relative pb-20">
          {activeTab === 'checkin' ? <StayFeature /> : <ResidentCard />}
        </main>

        {/* Bottom Navigation Tab */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center h-16 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setActiveTab('checkin')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-colors",
              activeTab === 'checkin' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <MapPin className={clsx("w-6 h-6 mb-1", activeTab === 'checkin' && "fill-current")} />
            <span className="text-[10px] font-bold">Check-in</span>
          </button>

          <button
            onClick={() => setActiveTab('card')}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-colors",
              activeTab === 'card' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <UserSquare2 className={clsx("w-6 h-6 mb-1", activeTab === 'card' && "fill-current")} />
            <span className="text-[10px] font-bold">My Card</span>
          </button>
        </div>

        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </div>
    </div>
  );
};

export default App;


