# GEOINT Vinh - OSINT source starter

Compatible with the `intelligence.Source` model in GEOINT Vinh OSINT Dashboard v3.

## Install

1. Back up the Django project and PostgreSQL database.
2. Copy `import_osint_sources.py` into `intelligence/management/commands/` (create directories if absent). Preserve existing files.
3. Copy `osint_sources.csv` next to `manage.py`.
4. Open PowerShell in the project root and run:

```powershell
python manage.py check
python manage.py import_osint_sources .\osint_sources.csv
python manage.py import_osint_sources .\osint_sources.csv --apply
```

The first import is a preview; the second creates sources **disabled**. This prevents unreviewed mass collection.

5. Review the source list in Django Admin. Enable individual verified RSS sources there. Alternatively, after checking each feed, run:

```powershell
python manage.py import_osint_sources .\osint_sources.csv --apply --enable-rss
python manage.py collect_osint
```

Note: the importer preserves existing records' enabled flags; the `--enable-rss` flag only applies to newly created rows. To enable already-imported sources, use Django Admin.

6. Open `/api/intelligence/dashboard/` to see collected items.

## Important limitations

- Source.kind supports `rss` and `html` only. `html` means a **single public page**, not a website-wide crawler. HTML references are intentionally disabled by default.
- Janes and other licensed publications require authorized access; this package does not bypass paywalls or authentication.
- Category and notes in the CSV are reference metadata, **not imported** into the current Source model. To use them as database fields requires a separate model migration.
- URLs are starter candidates, not live-tested endpoints. Some may have changed or block automated requests. Verify before enabling.
- The collector currently deduplicates on URL only and has no daily scheduler or AI analysis.
- Do not use this pipeline to build precise, current military target-location or movement tracking databases.
