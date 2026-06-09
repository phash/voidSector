-- 093: Relocate alien faction homes into the reachable 1000–5000 sector ring
-- (2–10 quadrants from origin). faction_config is the runtime source of alien
-- homes (read by ensureAlienHomeQuadrants). Idempotent UPDATEs to fixed coords.
UPDATE faction_config SET home_qx = 3,  home_qy = 1  WHERE faction_id = 'kthari';
UPDATE faction_config SET home_qx = -1, home_qy = 4  WHERE faction_id = 'archivists';
UPDATE faction_config SET home_qx = 5,  home_qy = -2 WHERE faction_id = 'consortium';
UPDATE faction_config SET home_qx = -6, home_qy = -3 WHERE faction_id = 'mycelians';
UPDATE faction_config SET home_qx = 2,  home_qy = 7  WHERE faction_id = 'mirror_minds';
UPDATE faction_config SET home_qx = -8, home_qy = 4  WHERE faction_id = 'silent_swarm';
UPDATE faction_config SET home_qx = 4,  home_qy = -9 WHERE faction_id = 'tourist_guild';
