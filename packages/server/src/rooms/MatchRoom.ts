import { Room, type Client } from 'colyseus';
import { MatchState } from './MatchState';

/** Bir otaqda maksimum oyunçu sayı (GDD, bölmə 7). */
const MAX_PLAYERS = 6;

/**
 * Matç otağının M0 skeleti: neçə oyunçunun qoşulduğunu izləyir.
 * Oyun qaydaları (draft, hədiyyələr, markalar, raundlar) M2–M4-də əlavə olunur.
 */
export class MatchRoom extends Room<{ state: MatchState }> {
  override maxClients = MAX_PLAYERS;
  override state = new MatchState();

  override onJoin(client: Client): void {
    this.state.playerCount = this.clients.length;
    console.log(`[match ${this.roomId}] joined: ${client.sessionId} (${this.state.playerCount})`);
  }

  override onLeave(client: Client): void {
    this.state.playerCount = this.clients.length;
    console.log(`[match ${this.roomId}] left: ${client.sessionId} (${this.state.playerCount})`);
  }
}
