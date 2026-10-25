# GEOINT Vinh OSINT v3 — Installation (Windows / PowerShell)

This is a Django add-on with a real dashboard. It does **not** modify your Cesium globe, GeoVision, GeoLab, or existing atlas logic. The OSINT dashboard is a separate route, and a launcher can be inserted in your current WebGIS page.

## Install
1. Back up the project and database. Never copy the bundled code over an existing `intelligence` app without reviewing differences.
2. Extract the ZIP. Copy its `intelligence/` folder beside `manage.py` (replace prior OSINT v2 only after backing it up).
3. In `geoint_site/settings.py`, add `"intelligence"` to the **existing** `INSTALLED_APPS` list (only once).
4. In `geoint_site/urls.py`, add `path("api/intelligence/", include("intelligence.urls"))` to the **existing** `urlpatterns` and import `include` if missing.
5. From PowerShell in the folder containing `manage.py`:

```powershell
python manage.py check
python manage.py makemigrations intelligence
python manage.py migrate
python manage.py test intelligence
python manage.py runserver
```

- `check`: validate Django config.
- `makemigrations`: generate database migration files for the intelligence models.
- `migrate`: apply migrations to the configured database (back up first).
- `test`: run automated Django tests.
- `runserver`: start the local development server.

Open **http://127.0.0.1:8000/api/intelligence/dashboard/** (login required). Add sources in **http://127.0.0.1:8000/admin/**.

## Show a new OSINT button inside the existing WebGIS

Open the existing Django template for the home page (often `atlas/templates/atlas/index.html`, but confirm in your project). Add the following **before the closing `</body>`**:

```html
<a href="/api/intelligence/dashboard/" target="_blank" rel="noopener noreferrer"
   style="position:fixed;bottom:24px;right:24px;z-index:99999;padding:12px 18px;border:1px solid #4cc9ff;border-radius:10px;background:#0d2940;color:#fff;font:600 14px Segoe UI,sans-serif;text-decoration:none;box-shadow:0 8px 25px #0008">
  🛰 OSINT Operations
</a>
```

This gives you a **visible** new entry point on the existing globe page without changing its layout or event handlers. Hard-refresh with Ctrl+F5.

## Collect from public sources

```powershell
python manage.py collect_osint
```

This is one collection run, not an automatic daily scheduler. Source URLs must be configured and enabled in Django Admin first. Do not point the HTML collector at arbitrary private or authenticated services.

## What is implemented
- Visual OSINT dashboard with six tabs: Inbox, Sources, Research Cases, Daily Brief, Runs, Decisions.
- Metrics, search, case creation, staff-only decisions, CSV export.
- Existing v2 RSS/Atom and public HTML collector, models, admin and tests.
- Login required for dashboard and APIs; CSRF-protected state-changing requests.

## Not yet implemented
- Autonomous AI analyst/advisor, LLM integration, cross-source claim verification, multi-source API connectors, scheduled jobs, automatic geolocation, or 3D map pinning.
- Daily Brief is a filtered view of collected articles, not an AI-authored intelligence assessment.
- Buttons for case decisions require Django `is_staff` privileges.

## Troubleshooting
- 404: URL inclusion missing or server not restarted.
- 302 to login: log in at `/admin/` then return to dashboard.
- 500: check database configuration and migrations.
- Empty dashboard: enable at least one public source and run `collect_osint`.
