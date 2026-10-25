# GEOINT Vinh v4 - Ollama local, category inbox, sourced reports

## What is included
- Additive Django patch for the existing intelligence v3 application.
- ArticleAnalysis and DailyReport tables (created by Django migrations).
- Deterministic category labels; local Ollama article summaries.
- Daily Markdown report from stored article analyses (no extra LLM report inference).
- New report workspace at `/api/intelligence/analysis/workspace/`, linked from existing dashboard.
- No edits to atlas/CesiumJS or PostgreSQL connection settings.

## Installation on Windows PowerShell
1. BACK UP your entire project and PostgreSQL database first.
2. Extract this ZIP to `C:\Users\Admin\Documents\GEOINT_Vinh\geoint_ollama_v4`.
3. Open PowerShell and run:

```powershell
cd "C:\Users\Admin\Documents\GEOINT_Vinh"
python .\geoint_ollama_v4\install_patch.py
python manage.py check
python manage.py makemigrations intelligence
# Review migration before applying it. Back up database first.
python manage.py migrate
```

4. Install and start Ollama for Windows from the official distribution. In a NEW PowerShell window:

```powershell
ollama --version
ollama pull qwen2.5:7b
ollama list
```

`ollama --version` checks installation; `ollama pull` downloads the local model; `ollama list` verifies model availability. On some Windows installations Ollama runs as a background app. If it is not running, launch the Ollama app or `ollama serve` in another window.

5. In project PowerShell:

```powershell
$env:GEOINT_OLLAMA_MODEL = 'qwen2.5:7b'
python manage.py analyze_osint --limit 5
python manage.py analyze_osint --limit 50
python manage.py build_osint_report
python manage.py runserver
```

`analyze_osint` processes NEW articles, maximum `--limit 500` per invocation. Use `--rules-only` to classify without Ollama. `--force` reprocesses newest articles. `build_osint_report` creates a report for the current local date; for an earlier date, use `--date 2026-10-25`.

6. Open `http://127.0.0.1:8000/api/intelligence/dashboard/` and click `Phân loại & Báo cáo AI (Ollama)`.

## Security and limits
- Ollama requests are hard-restricted to `127.0.0.1:11434`.
- Only article titles and stored excerpts are sent to Ollama, not entire webpages.
- If the collector stored short summaries, the report cannot claim full-article coverage.
- The report is a sourced draft, not a verified intelligence conclusion.
- Classification is heuristic; human review remains necessary.
- No scheduled background job is installed. Use Windows Task Scheduler later after manual verification.
- If errors occur, inspect output and the backup folder created by install_patch.py.
- Running `makemigrations` generates a migration from current schema; inspect it before running `migrate`.
