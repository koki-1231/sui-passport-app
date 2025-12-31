import React from 'react';
import { Shield, LogIn, Loader2, AlertCircle } from 'lucide-react';

interface ZkLoginScreenProps {
  onLogin: () => void;
  isLoading: boolean;
  isConfigured: boolean;
}

export const ZkLoginScreen: React.FC<ZkLoginScreenProps> = ({
  onLogin,
  isLoading,
  isConfigured
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
          <Shield className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        Sui Passport
      </h1>
      <p className="text-slate-500 text-center mb-8 max-w-xs">
        位置証明でトークンを獲得し、<br />
        地域のガバナンスに参加しよう
      </p>

      {/* Features */}
      <div className="w-full max-w-xs space-y-3 mb-8">
        <FeatureItem 
          emoji="📍" 
          title="位置証明チェックイン" 
          desc="指定エリアでトークン獲得"
        />
        <FeatureItem 
          emoji="🗳️" 
          title="DAO投票" 
          desc="全体・地方DAOで意思決定に参加"
        />
        <FeatureItem 
          emoji="🔒" 
          title="プライバシー保護" 
          desc="ZK証明で位置情報を秘匿"
        />
      </div>

      {/* Login Button */}
      {!isConfigured ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 max-w-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-700 font-medium">設定が必要です</p>
            <p className="text-xs text-amber-600 mt-1">
              Google OAuth設定がされていません。管理者に連絡してください。
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={onLogin}
          disabled={isLoading}
          className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              ログイン中...
            </>
          ) : (
            <>
              <GoogleIcon />
              Googleでログイン
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <p className="text-xs text-slate-400 mt-6 text-center">
        ログインすることで利用規約に同意したものとみなされます
      </p>
    </div>
  );
};

// Feature Item Component
interface FeatureItemProps {
  emoji: string;
  title: string;
  desc: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ emoji, title, desc }) => (
  <div className="flex items-center gap-3 bg-white/50 rounded-xl p-3">
    <span className="text-2xl">{emoji}</span>
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  </div>
);

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);
