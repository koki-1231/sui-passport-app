# 📱 Vercelデプロイ手順書 (v2 - Registry対応版)

**更新日:** 2025-12-15
**対象バージョン:** Registry Pattern 実装済み

---

## 📦 現在のコントラクト情報

| 項目 | 値 |
|------|-----|
| **Package ID** | `0xb055fd8885acb1809540fe22b2ed5a282c8f5be86251954a35f2a8614811058b` |
| **ResidentRegistry ID** | `0x99a8dc2df00b6892f6d097ea3b710447b71b9ad79c578af9bed9fa689d2f03cf` |
| **TokenRegistry ID** | `0x671eaa16a4e4d2a39fb86cbf1a3ac5cc4e70a84b8ff740604a38a36daa0977ae` |
| **Network** | Sui Testnet |

---

## 🚀 デプロイ手順

### ステップ1: GitHubへのプッシュ

```bash
cd "/Users/koki/Desktop/sui app"

git add .
git commit -m "feat(security): implement Registry pattern for Sybil prevention"
git push origin feature/dao-implementation:main --force
```

### ステップ2: Vercelプロジェクト設定

| 項目 | 値 |
|------|-----|
| **Framework** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### ステップ3: 環境変数（オプション）

Vercelダッシュボード → Settings → Environment Variables:

```
VITE_PACKAGE_ID=0xb055fd8885acb1809540fe22b2ed5a282c8f5be86251954a35f2a8614811058b
VITE_RESIDENT_REGISTRY_ID=0x99a8dc2df00b6892f6d097ea3b710447b71b9ad79c578af9bed9fa689d2f03cf
VITE_TOKEN_REGISTRY_ID=0x671eaa16a4e4d2a39fb86cbf1a3ac5cc4e70a84b8ff740604a38a36daa0977ae
```

> [!NOTE]
> 現在は `constants.ts` に直接記載されているため、環境変数設定は必須ではありません。

---

## 🔄 コントラクト再デプロイ時の手順

Registry パターンを使用しているため、再デプロイ時は以下の手順が必要です。

### 1. コントラクトのデプロイ

```bash
cd "/Users/koki/Desktop/sui app/backend/stay_mock"
sui client publish --gas-budget 100000000
```

### 2. Object IDの取得

デプロイログから以下を取得:
- **Package ID**: `Published Objects` セクション
- **ResidentRegistry ID**: `RegistryCreated` イベント
- **TokenRegistry ID**: `TokenRegistryCreated` イベント

### 3. constants.ts の更新

```typescript
// frontend/src/utils/constants.ts
export const PACKAGE_ID = '新しいPackage ID';
export const RESIDENT_REGISTRY_ID = '新しいResidentRegistry ID';
export const TOKEN_REGISTRY_ID = '新しいTokenRegistry ID';
```

### 4. GitHub プッシュ（自動デプロイ）

```bash
git add frontend/src/utils/constants.ts
git commit -m "chore: update contract IDs"
git push origin main
```

---

## ✅ デプロイ後の確認事項

| 確認項目 | 方法 |
|----------|------|
| 住民票NFT発行 | 1回目成功 / 2回目「既に発行済み」エラー |
| ポイント通帳作成 | 1回目成功 / 2回目「既に作成済み」エラー |
| チェックイン | クールダウン5分が機能 |
| DAO投票 | NFT保有者のみ投票可能 |

---

## 🛡️ セキュリティ機能

| 機能 | 状態 |
|------|------|
| ResidentNFT 1人1枚制限 | ✅ Registry |
| TokenBalance 1人1つ制限 | ✅ Registry |
| チェックイン クールダウン | ✅ 5分間隔 |
| 脆弱関数 削除済み | ✅ add_checkin_reward |

---

## 📱 公開URL

デプロイ成功後:
```
https://sui-passport-app.vercel.app
```
