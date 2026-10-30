import { defineRoom, defineServer } from 'colyseus';
import { DEFAULT_SERVER_PORT, getBuildInfo, MATCH_ROOM_NAME } from '@stampback/shared';
import { MatchRoom } from './rooms/MatchRoom';

const port = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);

const server = defineServer({
  rooms: {
    [MATCH_ROOM_NAME]: defineRoom(MatchRoom),
  },
  greet: false,
});

await server.listen(port);

const info = getBuildInfo();
console.log(`${info.game} server (protocol v${info.protocolVersion}) listening on :${port}`);
