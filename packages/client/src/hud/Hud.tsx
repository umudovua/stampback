import { useEffect, useState } from 'preact/hooks';
import { colorCss } from '../game/players';
import { hudStore, type HudPlayer, type HudState } from '../game/hudStore';
import { t } from '../i18n';

const showDebug = new URLSearchParams(location.search).has('debug');

/** Adların üst-üstə düşməməsi üçün iki etiket arasında minimum məsafə (trekin hissəsi). */
const LABEL_GAP = 0.08;

/** Sağdakı hündürlük nərdivanı: bütün oyunçular finişə nisbətən (GDD, bölmə 6). */
function HeightLadder({ players, finish }: { players: HudPlayer[]; finish: number }) {
  const ratio = (p: HudPlayer) => Math.max(0, Math.min(1, p.height / finish));
  // Nöqtələr dəqiq yerdə qalır; yaxın olan adlar isə aşağıya sürüşdürülür.
  const sorted = [...players].sort((a, b) => b.height - a.height || a.id - b.id);
  const labelAt = new Map<number, number>();
  let previous = Infinity;
  for (const p of sorted) {
    const at = Math.min(ratio(p), previous - LABEL_GAP);
    labelAt.set(p.id, at);
    previous = at;
  }
  return (
    <div class="ladder" aria-hidden="true">
      <span class="ladder-finish">{t('hud.finish')}</span>
      <div class="ladder-track">
        {players.map((p) => (
          <span
            key={`dot-${p.id}`}
            class={`ladder-dot${p.isMe ? ' is-me' : ''}`}
            style={{ bottom: `${ratio(p) * 100}%`, '--player': colorCss(p.color) }}
          />
        ))}
        {players.map((p) => (
          <span
            key={`name-${p.id}`}
            class="ladder-name"
            style={{ bottom: `${(labelAt.get(p.id) ?? 0) * 100}%`, '--player': colorCss(p.color) }}
          >
            {p.name}
            {p.isTarget && <small> · {t('hud.target')}</small>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** HUD: hündürlük, mükəmməl, itirilən, növbəti bağlama, nərdivan və qalib ekranı. */
export function Hud() {
  const [state, setState] = useState<HudState>(hudStore.get());
  useEffect(() => hudStore.subscribe(setState), []);

  if (!state.ready) return <p class="hud-loading">{t('hud.loading')}</p>;

  return (
    <div class="hud">
      <div class="hud-stats">
        <span class="hud-pill">
          <small>{t('hud.height')}</small>
          <strong>{state.height.toFixed(1)}</strong>
        </span>
        <span class="hud-pill">
          <small>{t('hud.perfect')}</small>
          <strong>{state.perfect}</strong>
        </span>
        <span class="hud-pill">
          <small>{t('hud.lost')}</small>
          <strong>{state.lost}</strong>
        </span>
      </div>
      <button class="hud-restart" type="button" onClick={() => hudStore.requestRestart()}>
        {t('hud.restart')}
      </button>
      <HeightLadder players={state.players} finish={state.finishHeight} />
      <p class="hud-hint">{t('hud.hint')}</p>
      {showDebug && (
        <p class="hud-debug">
          FPS {state.fps.toFixed(0)} · fizika {state.physicsMs.toFixed(2)} ms
        </p>
      )}
      {state.winner && (
        <div class="winner">
          <div class="winner-card">
            <div class="winner-stamp">
              {state.winner.isMe ? t('hud.youWin') : t('hud.winner', { name: state.winner.name })}
            </div>
            <button type="button" onClick={() => hudStore.requestRestart()}>
              {t('hud.playAgain')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
