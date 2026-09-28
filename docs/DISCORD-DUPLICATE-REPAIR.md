# Duplicate Discord delivery correction — 24 September 2026

## Confirmed cause

In VALK Development, personal package `33ff1c03-2afb-4183-acbc-355ec494f17c` (user ID 2) and tenant package `50a2dca9-cd77-4654-a0b6-220f4dd6ccb9` contained four enabled rules with matching conditions and severity. The decrypted personal webhook exactly matched the tenant BGS webhook. No webhook values or credentials were logged.

Delivery records confirmed two successful deliveries for the same system, conflict pair, and tick, from different rules and channels (`personal_discord` and `tenant_discord`). Examples on the 23 September tick (`2026-09-23T15:56:07.000Z`) included Pueloi VY-S d3-45, Greae Hype PI-I c26-5, and Synookoi JE-X b29-4. This was overlapping configuration, rather than a retry of one delivery record.

## Applied correction

At approximately 20:38 CEST, set `personal_discord=0` on the personal package's four enabled rules: conflict updates, influence loss, below 5% influence, and a 2 pp gap. Updated their `updated_at` timestamps. Their dashboard evaluation remains enabled, and the equivalent tenant rules retain Discord delivery. Tenant packages monitor the tenant faction globally, covering its systems on the personal watchlist.

All four rule pairs and the identical webhook were checked again within the write transaction. There were no pending, retrying, or processing deliveries for these personal rules. No alert history or delivered messages were modified. Post-change reads verified all eight settings, and SQLite `quick_check` returned `ok`. No Discord messages were sent for validation. The scheduler reads the settings from the database; a service restart was unnecessary.

## Backup and rollback

The SQLite online backup and original rule rows are stored in the restricted server directory:

`/home/valk/dashboard-v2/shared/discord-duplicate-repair-20260924T183858Z/`

Files: `bgs_data_valk.db` and `rules-before.json`.

To reverse only this correction, review the saved rule rows, then restore `personal_discord=1` for those four rule IDs in `/home/valk/db/bgs_data_valk.db` in a transaction and update their timestamps. This restores the duplicate destination behavior. Avoid restoring the full database over subsequent activity.

The correction does not add automatic deduplication across independently configured rules. Re-enabling both packages' Discord delivery to the same webhook can produce duplicates again.
