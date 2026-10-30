import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { connectToMatch, type ConnectionStatus } from '../net/connect';

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>({ kind: 'connecting' });

  useEffect(() => {
    void connectToMatch(setStatus);
  }, []);

  return (
    <main>
      <div class="title-stamp">Stampback</div>
      <p class="status" aria-live="polite">
        {status.kind === 'connecting' && t('net.connecting')}
        {status.kind === 'error' && t('net.error')}
        {status.kind === 'connected' && (
          <>
            {t('net.connected')} · {t('net.players', { count: status.playerCount })}
            <small>{t('net.session', { id: status.sessionId })}</small>
          </>
        )}
      </p>
    </main>
  );
}
