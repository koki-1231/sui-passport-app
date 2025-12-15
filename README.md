# 🛂 Sui Passport App

Suiブロックチェーンを活用した**フルオンチェーン・DBレス**の次世代チェックイン＆DAOプラットフォーム。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/koki-1231/sui-passport-app)

---

## 📚 ドキュメント

| ドキュメント | 対象 | 内容 |
|-------------|------|------|
| [📖 ユーザーガイド](docs/user_guide.md) | 一般ユーザー | ウォレット接続、チェックイン、NFT発行の手順 |
| [🚀 デプロイガイド](docs/deployment_guide.md) | 開発者 | Vercelへのデプロイ手順と設定方法 |
| [🛠️ 開発者ガイド](docs/developer_guide.md) | 開発者 | アーキテクチャ、技術スタック、セットアップ詳細 |
| [🔒 セキュリティ監査](docs/security_audit.md) | 監査人 | Sybil耐性、脆弱性分析、対策状況 |

---

## ✨ 特徴

- 🌍 **GPSチェックイン** - 位置情報をブロックチェーンに永続化
- 🪪 **デジタル住民票NFT** - IPFS + Sui NFTによる証明書発行
- 🗳️ **DAO投票** - NFT保有者による分散型意思決定
- 🔒 **Sybil耐性** - Registry パターン + zkLogin（計画中）による不正防止
- ⚡ **DBレス設計** - 外部データベース不要、全てオンチェーン

---

## 🛠️ 技術スタック

| フロントエンド | バックエンド (Sui Move) |
|---------------|-------------------|
| React + Vite | Sui Move (Testnet) |
| TypeScript | DB-less Architecture |
| Tailwind CSS v4 | Registry Pattern |
| React Query | Cooldown Protection |

---

## 🚀 クイックスタート

```bash
# 1. クローン
git clone https://github.com/koki-1231/sui-passport-app.git
cd sui-passport-app

# 2. 依存関係インストール
cd frontend
npm install

# 3. 環境変数設定（オプション）
cp .env.example .env

# 4. 起動
npm run dev
```

---

## 🔐 セキュリティ機能

| 攻撃ベクトル | 対策 | 状態 |
|-------------|------|------|
| NFT複製攻撃 | ResidentRegistry | ✅ Solved |
| TokenBalance複製 | TokenRegistry | ✅ Solved |
| 無限チェックイン | 5分クールダウン | ✅ Solved |
| GPSスプーフィング | zkLogin / 専用アプリ | ⚠️ Future Work |

---
