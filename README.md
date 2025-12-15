# 🛂 Sui Passport App

Suiブロックチェーンを活用した**フルオンチェーン・DBレス**の次世代チェックイン＆DAOプラットフォーム。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/koki-1231/sui-passport-app)

---

## ✨ 特徴

- 🌍 **GPSチェックイン** - 位置情報をブロックチェーンに永続化
- 🪪 **デジタル住民票NFT** - IPFS + Sui NFTによる証明書発行
- 🗳️ **DAO投票** - NFT保有者による分散型意思決定
- 🔒 **Sybil耐性** - Registry パターンによる1人1NFT制限
- ⚡ **DBレス設計** - 外部データベース不要、全てオンチェーン

---

## 🛠️ 技術スタック

### Backend (Move Smart Contract)
| 項目 | 技術 |
|------|------|
| 言語 | Sui Move |
| 設計 | DB-less Architecture (Full On-Chain) |
| セキュリティ | Registry Pattern, Cooldown Protection |

### Frontend
| 項目 | 技術 |
|------|------|
| フレームワーク | React + Vite |
| 言語 | TypeScript |
| スタイル | Tailwind CSS v4 |
| 地図 | React Leaflet (OpenStreetMap) |
| アニメーション | Framer Motion |
| SDK | @mysten/dapp-kit, @mysten/sui |
| ストレージ | Pinata (IPFS) |

---

## 📦 モジュール構成

```
backend/stay_mock/sources/
├── resident_card.move   # 住民票NFT + ResidentRegistry
├── token_management.move # ポイント管理 + TokenRegistry  
├── dao.move              # DAO投票システム
└── resident_nft.move     # 滞在証明
```

---

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/koki-1231/sui-passport-app.git
cd sui-passport-app
```

### 2. フロントエンドの起動

```bash
cd frontend
npm install
npm run dev
```

### 3. コントラクトのデプロイ（オプション）

```bash
cd backend/stay_mock
sui client publish --gas-budget 100000000
```

---

## 🔐 セキュリティ機能

| 攻撃ベクトル | 対策 | 状態 |
|-------------|------|------|
| NFT複製攻撃 | ResidentRegistry | ✅ |
| TokenBalance複製 | TokenRegistry | ✅ |
| 無限チェックイン | 5分クールダウン | ✅ |
| 脆弱関数 | 削除済み | ✅ |

---

## 📱 デモ

🌐 **Live Demo**: https://sui-passport-app.vercel.app

---

## 📄 ドキュメント

- [操作ガイド](docs/user_guide.md)
- [デプロイ手順](docs/deployment_guide.md)

---

## 🤝 コントリビューション

Issue、Pull Request歓迎です！

---

## 📜 ライセンス

MIT License

---

## 👨‍💻 開発者

Built on Sui
