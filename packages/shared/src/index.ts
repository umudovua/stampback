/**
 * Client və serverin birlikdə istifadə etdiyi ortaq kod.
 * Qayda: bu paket Phaser-ə, DOM-a və ya Colyseus-a asılı ola bilməz.
 */

export const GAME_NAME = 'Stampback';

/**
 * Client ilə server arasındakı mesaj müqaviləsi dəyişəndə artırılır.
 * Versiyalar fərqli olduqda client və server birlikdə oynamır.
 */
export const PROTOCOL_VERSION = 1;

/** Matçı saxlayan Colyseus otağının adı. */
export const MATCH_ROOM_NAME = 'match';

/** Local development-də oyun serverinin standart portu. */
export const DEFAULT_SERVER_PORT = 2567;

export interface BuildInfo {
  game: string;
  protocolVersion: number;
}

export function getBuildInfo(): BuildInfo {
  return { game: GAME_NAME, protocolVersion: PROTOCOL_VERSION };
}

export * from './physics';
export * from './parcels/normal';
export * from './maps';
export * from './rules';
