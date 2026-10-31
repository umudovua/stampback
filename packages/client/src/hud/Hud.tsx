import { useEffect, useState } from 'preact/hooks';
import { hudStore, type HudState } from '../game/hudStore';
import { t } from '../i18n';

const showDebug = new URLSearchParams(location.search).has('debug');

/** M1 HUD: hündürlük, mükəmməl yerləşdirmə, itirilən bağlamalar, növbəti bağlama (GDD, bölmə 3). */
export function Hud() {
  const [state, setState] = useState<HudState>(hudStore.get());
  useEffect(() => hudStore.subscribe(setState), []);

  if (!state.ready) return <p class="hud-loading">{t('hud.loading')}</p>;

  return (
    <div class="hud">
      <div class="hud-stats">
        <span>
          <small>{t('hud.height')}</small>
          <strong>{state.height.toFixed(1)}</strong>
        </span>
        <span>
          <small>{t('hud.perfect')}</small>
          <strong>{state.perfect}</strong>
        </span>
        <span>
          <small>{t('hud.lost')}</small>
          <strong>{state.lost}</strong>
        </span>
        <span>
          <small>{t('hud.next')}</small>
          <strong class="hud-next">{state.next ?? '–'}</strong>
        </span>
      </div>
      <button class="hud-restart" type="button" onClick={() => hudStore.requestRestart()}>
        {t('hud.restart')}
      </button>
      <p class="hud-hint">{t('hud.hint')}</p>
      {showDebug && (
        <p class="hud-debug">
          FPS {state.fps.toFixed(0)} · fizika {state.physicsMs.toFixed(2)} ms
        </p>
      )}
    </div>
  );
}
