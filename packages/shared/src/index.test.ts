import { describe, expect, it } from 'vitest';
import { getBuildInfo, PROTOCOL_VERSION } from './index';

describe('getBuildInfo', () => {
  it('reports the game name and protocol version', () => {
    expect(getBuildInfo()).toEqual({ game: 'Stampback', protocolVersion: PROTOCOL_VERSION });
  });
});
