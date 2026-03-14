-- Migration 071: Track what resource type a drone is mining
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS mined_resource VARCHAR(20) NOT NULL DEFAULT 'ore';
