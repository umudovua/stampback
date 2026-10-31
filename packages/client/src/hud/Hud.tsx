import { useEffect, useState } from 'preact/hooks';
import { colorCss } from '../game/players';
import { hudStore, type HudPlayer, type HudState } from '../game/hudStore';
import { t } from '../i18n';

const showDebug = new URLSearchParams(location.search).has('debug');

/** Sağdakı hündürlük nərdivanı: bütün oyunçular finişə nisbətən (GDD, bölmə 6). */
function HeightLadder({ players, finish }: { players: HudPlayer[]; finish: number }) {
  return (
    <div class="ladder" aria-hidden="true">
      <span class="ladder-finish">{t('hud.finish')}</span>
      <div class="ladder-track">
        {players.map((p) => {
          const ratio = Math.max(0, Math.min(1, p.height / finish));
          return (
            <div
              key={p.id}
              class={`ladder-player${p.isMe ? ' is-me' : ''}${p.isTarget ? ' is-target' : ''}`}
              style={{ bottom: `${ratio * 100}%`, '--player': colorCss(p.color) }}
            >
              <span class="ladder-dot" />
              <span class="ladder-name">
                {p.name}
                {p.isTarget && <small> · {t('hud.target')}</small>}
              </span>
            </div>
          );
        })}
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
        <span class="hud-pill">
          <small>{t('hud.next')}</small>
          <strong class="hud-next">{state.next ?? '–'}</strong>
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
