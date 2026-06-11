# DB Migrations

## Numbering scheme

Migrations are tracked by **filename** in an `applied_migrations` table.
The loader runs every file exactly once — keyed on the full filename, not the numeric prefix.

**Never rename or renumber an existing migration file.**
Renaming breaks the applied record: the old filename is still marked applied but the new
filename looks unseen, so the migration runs again on next startup.

## Adding new migrations

Name new files `NNN_description.sql` where `NNN` is the next free three-digit number.
All `CREATE TABLE` / `CREATE INDEX` statements must use `IF NOT EXISTS` so they are
idempotent if re-run against an already-migrated database.

**Next free number: 097**

## Known cosmetic anomalies — do not fix

The history contains some duplicate prefixes and one gap:

| Numbers | Files | Note |
|---------|-------|-------|
| 044 | `044_unified_inventory.sql`, `044_wissen_typed_artefacts.sql` | duplicate prefix |
| 045 | `045_mining_ticks.sql`, `045_username_case_insensitive.sql` | duplicate prefix |
| 051 | `051_faction_recruiting.sql`, `051_quadrant_visits.sql` | duplicate prefix |
| 052 | `052_module_source.sql`, `052_station_production.sql` | duplicate prefix |
| 059 | `059_drop_legacy_columns.sql`, `059_player_tech_tree.sql` | duplicate prefix |
| 077 | *(absent)* | gap — 076 jumps to 078 |

Because the loader keys on the full filename these are harmless cosmetic artifacts.
Renaming them to "fix" the numbers would re-run those migrations on every existing
database instance.
