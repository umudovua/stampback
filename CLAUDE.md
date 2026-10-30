# Stampback

Brauzerdə oynanılan, 2–6 oyunçulu fizika əsaslı rəqabətli qüllə oyunu: oyunçular bağlama qülləsi yığır,
ən yaxın rəqibə pis bağlama "hədiyyə" göndərir, rəqib onu marka ilə geri qaytara bilər.

## Sənədlər (ehtiyac olanda oxu, hamısını birdən yükləmə)

- `docs/gdd.md` — oyun dizaynı: qaydalar, bağlamalar, rejimlər, MVP həcmi
- `docs/architecture.md` — texniki arxitektura: şəbəkə modeli, determinizm, protokol
- `docs/dev-plan.md` — milestone-lar və tapşırıqlar (M0–M6)

## Əmrlər

- `pnpm dev` — client (http://localhost:5173) və server (ws://localhost:2567) birlikdə
- `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm format`
- Tapşırığı bitirməzdən əvvəl: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`

## Struktur

- `packages/shared` — oyun qaydaları, fizika (Rapier, deterministik), protokol. Client və server istifadə edir.
- `packages/client` — Phaser 4 (oyun səhnələri) + Preact (menyular, lobby), Vite
- `packages/server` — Colyseus 0.18 (otaqlar, matchmaking, botlar)

## Məcburi qaydalar

1. `shared` Phaser, DOM, Preact və Colyseus-dan asılı ola bilməz (ESLint yoxlayır).
2. `shared/src/physics` və `shared/src/rules`-da `Math.random`, `Math.sin/cos/tan` və digər transendent
   funksiyalar, `Date`, `performance`, `**` qadağandır. Vaxt = tam ədədli tick. Təsadüfilik = seed-li PRNG.
3. Fizika 60 Hz sabit addımla işləyir; render tezliyindən asılı deyil.
4. Oyun qaydalarının hakimi serverdir; client yalnız öz qülləsinin fizikasını hesablayır.
5. Oyunçunun gördüyü bütün mətnlər i18n açarları ilədir (`packages/client/src/i18n`, 4 dil: az, en, tr, ru).
6. Kod adları (dəyişən, funksiya, fayl) ingiliscə; şərhlər və sənədlər Azərbaycan dilində.
7. Phaser 4 istifadə olunur, Phaser 3 deyil. API-dən əmin deyilsənsə,
   `packages/client/node_modules/phaser/skills/` (xüsusilə `v3-to-v4-migration`) fayllarına bax.
8. Yeni asılılıq əlavə etməzdən əvvəl soruş; versiyalar dəqiq sabitlənir (`^` yox).

## İş qaydası

- Bir tapşırıq = bir sessiya. Tapşırıqdakı "Nəyi etmə" siyahısından kənara çıxma.
- Hər tapşırıq ayrıca commit-dir: `M1-T3: qısa təsvir`.
