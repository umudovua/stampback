# Stampback

Brauzerdə oynanılan, dostlarla multiplayer fizika qüllə oyunu. Bağlama qülləsi yığ, ən yaxın rəqibinə ən
pis bağlamanı hədiyyə göndər; o isə onu daha da pisləşmiş halda sənə qaytara bilər.

## Tələblər

- Node.js 22 və ya daha yeni
- pnpm 9 (`npm install -g pnpm@9` və ya `corepack enable`)

## Başlamaq

```bash
pnpm install
pnpm dev
```

- Client: http://localhost:5173 (eyni Wi-Fi-dakı telefondan `http://<kompüterin-IP-si>:5173`)
- Server: ws://localhost:2567

İki brauzer tabı açın: hər ikisində "Otaqda oyunçu: 2" görünməlidir.

## Əmrlər

| Əmr              | Nə edir                                  |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Client və serveri birlikdə işə salır     |
| `pnpm test`      | Unit testlər (Vitest)                    |
| `pnpm lint`      | ESLint, o cümlədən determinizm qaydaları |
| `pnpm typecheck` | TypeScript yoxlaması                     |
| `pnpm build`     | Production build                         |
| `pnpm format`    | Prettier ilə formatlama                  |

## Struktur

```text
packages/
  shared/   oyun qaydaları, fizika, protokol (client və server üçün ortaq)
  client/   Phaser 4 + Preact, Vite
  server/   Colyseus
docs/       GDD, arxitektura, development planı
```

Claude Code ilə işləmək qaydaları üçün `CLAUDE.md`-yə baxın.
