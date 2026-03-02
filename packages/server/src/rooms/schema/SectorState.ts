import { Schema, MapSchema, type } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') sessionId: string = '';
  @type('string') userId: string = '';
  @type('string') username: string = '';
  @type('int32') x: number = 0;
  @type('int32') y: number = 0;
  @type('boolean') connected: boolean = true;
}

export class SectorSchema extends Schema {
  @type('int32') x: number = 0;
  @type('int32') y: number = 0;
  @type('string') sectorType: string = 'empty';
  @type('int32') seed: number = 0;
}

export class SectorRoomState extends Schema {
  @type(SectorSchema) sector = new SectorSchema();
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type('uint16') playerCount: number = 0;
}
