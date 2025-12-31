import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Clock, Loader2 } from 'lucide-react';

interface HomeTabProps {
  userAddress: string;
}

// チェックインゾーンの定義
interface CheckinZone {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number; // メートル
  regionId: number;
}

// サンプルゾーン（実際は環境変数やAPIから取得）
const CHECKIN_ZONES: CheckinZone[] = [
  {
    id: 'tokyo-shibuya',
    name: '渋谷エリア',
    center: { lat: 35.6580, lng: 139.7016 },
    radius: 500,
    regionId: 1,
  },
  {
    id: 'tokyo-shinjuku',
    name: '新宿エリア',
    center: { lat: 35.6896, lng: 139.6917 },
    radius: 500,
    regionId: 1,
  },
  {
    id: 'osaka-namba',
    name: '難波エリア',
    center: { lat: 34.6659, lng: 135.5011 },
    radius: 500,
    regionId: 2,
  },
];

export const HomeTab: React.FC<HomeTabProps> = ({ userAddress }) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [nearbyZones, setNearbyZones] = useState<Array<CheckinZone & { distance: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Haversine公式で距離計算
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 地球の半径（メートル）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 位置情報取得
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('このブラウザは位置情報をサポートしていません');
      return;
    }

    setIsGettingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(newLocation);

        // 近くのゾーンを計算
        const zonesWithDistance = CHECKIN_ZONES.map(zone => ({
          ...zone,
          distance: calculateDistance(
            newLocation.lat,
            newLocation.lng,
            zone.center.lat,
            zone.center.lng
          ),
        })).sort((a, b) => a.distance - b.distance);

        setNearbyZones(zonesWithDistance);
        setIsGettingLocation(false);
      },
      (err) => {
        setIsGettingLocation(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('位置情報の許可が必要です');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('位置情報を取得できません');
            break;
          case err.TIMEOUT:
            setError('位置情報の取得がタイムアウトしました');
            break;
          default:
            setError('位置情報の取得に失敗しました');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // 初期読み込み時に位置情報取得
  useEffect(() => {
    getLocation();
  }, [getLocation]);

  return (
    <div className="p-4 space-y-4">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">ホーム</h2>
        <p className="text-sm text-slate-500">近くのチェックインスポットを探す</p>
      </div>

      {/* 現在位置カード */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-slate-700">現在位置</span>
          </div>
          <button
            onClick={getLocation}
            disabled={isGettingLocation}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            {isGettingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '更新'
            )}
          </button>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
            {error}
          </div>
        ) : location ? (
          <div className="bg-white/70 rounded-lg p-3">
            <p className="text-sm text-slate-600">
              緯度: {location.lat.toFixed(6)}
            </p>
            <p className="text-sm text-slate-600">
              経度: {location.lng.toFixed(6)}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {/* 近くのゾーン */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-500" />
          近くのチェックインスポット
        </h3>

        {nearbyZones.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500 text-sm">
            位置情報を取得中...
          </div>
        ) : (
          <div className="space-y-2">
            {nearbyZones.map((zone) => {
              const isInRange = zone.distance <= zone.radius;
              return (
                <div
                  key={zone.id}
                  className={`rounded-xl p-4 border-2 transition-all ${
                    isInRange
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${isInRange ? 'text-green-700' : 'text-slate-700'}`}>
                        {zone.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {zone.distance < 1000
                          ? `${Math.round(zone.distance)}m`
                          : `${(zone.distance / 1000).toFixed(1)}km`}
                        {' '}/ 範囲: {zone.radius}m
                      </p>
                    </div>
                    {isInRange ? (
                      <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                        範囲内 ✓
                      </span>
                    ) : (
                      <span className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full">
                        範囲外
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ヒント */}
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
        <p className="text-sm text-amber-700">
          💡 <strong>ヒント:</strong> 「範囲内」のスポットで「滞在」タブからチェックインするとトークンを獲得できます！
        </p>
      </div>
    </div>
  );
};
