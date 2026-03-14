import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  sessionId: string = '';
  userId: string = '';
  username: string = '';
  x: number = 0;
  y: number = 0;
  connected: boolean = true;
  mining: boolean = false;
  acepTotal: number = 0;
}

defineTypes(PlayerSchema, {
  sessionId: 'string',
  userId: 'string',
  username: 'string',
  x: 'int32',
  y: 'int32',
  connected: 'boolean',
  mining: 'boolean',
  acepTotal: 'uint16',
});

export class SectorSchema extends Schema {
  x: number = 0;
  y: number = 0;
  sectorType: string = 'empty';
  seed: number = 0;
}

defineTypes(SectorSchema, {
  x: 'int32',
  y: 'int32',
  sectorType: 'string',
  seed: 'int32',
});

export class SectorRoomState extends Schema {
  sector = new SectorSchema();
  players = new MapSchema<PlayerSchema>();
  playerCount: number = 0;
}

defineTypes(SectorRoomState, {
  sector: SectorSchema,
  players: { map: PlayerSchema },
  playerCount: 'uint16',
});
