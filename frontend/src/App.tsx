import React from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { StayFeature } from './StayFeature';
import { Toaster } from 'react-hot-toast';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white h-[85vh] max-h-[900px] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative border border-slate-200">
        <header className="bg-blue-600 p-4 flex justify-between items-center shadow-md z-10">
          <h1 className="text-white font-bold text-lg tracking-wide">Sui Passport</h1>
          <div className="scale-90 origin-right">
            <ConnectButton />
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          <StayFeature />
        </main>
        
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


