# Sui Passport App 🛂

Suiブロックチェーンを活用した、フルオンチェーン・DBレス型の次世代チェックイン＆DAOプラットフォーム。
位置情報証明（GPS）と住民票NFTを組み合わせ、分散型まちづくりを実現します。

## 🌟 機能一覧 (Features)

### 1. GPSチェックイン & ポイント (StayFeature)
- **オンチェーンGPS履歴**: 緯度経度・時刻を `StayProof` オブジェクトとしてブロックチェーンに永続化。
- **ポイント獲得**: チェックインごとにトークンポイントが付与され、 `TokenBalance` オブジェクトに蓄積。
- **地図機能**: 過去のチェックイン履歴を地図上に可視化。
- **不正防止**: クールダウン機能（5分間）により、連続チェックイン（ファーミング）を防止。

### 2. デジタル住民票NFT (Resident Card)
- **3Dホログラムカード**: Framer MotionによるリッチなUI体験。
- **IPFS統合**: 画像とメタデータをPinata (IPFS) に分散保存。
- **Sui NFT**: 公式の `ResidentNFT` を発行し、DAOへの参加権を付与。

### 3. DAO投票システム (DaoVoting)
- **プロポーザル作成**: 住民票NFT保有者がまちづくりの提案を作成可能。
- **オンチェーン投票**: DBを使わず、SuiのShared Object (`Proposal`) だけで投票を集計。
- **リアルタイム反映**: 投票結果は即座にブロックチェーンに記録され、全員に共有されます。

## 🛠 技術スタック (Tech Stack)

### Backend (Move Smart Contract)
- **Language**: Sui Move
- **Design Pattern**: DB-less Architecture (Full On-Chain State)
- **Key Concepts**: Object Ownership, Shared Objects, Transfer Policy
- **Modules**:
  - `token_management`: ポイントとGPS履歴管理
  - `resident_card`: NFT発行ロジック
  - `dao`: 投票・プロポーザル管理

### Frontend
- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (v4), Glassmorphism UI
- **Map**: React Leaflet (OpenStreetMap)
- **Animations**: Framer Motion (3D Cards, Transisitons)
- **SDK**: @mysten/dapp-kit, @mysten/sui.js
- **Storage**: Pinata (IPFS)

## 🚀 開始方法 (Getting Started)

```bash
# インストール
npm install

# 開発サーバー起動
npm run dev
```

## 📜 ライセンス
MIT License
