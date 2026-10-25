# GEOINT OS — Horizon 360 two-stage upgrade

This package upgrades the existing v0.6 Horizon Angle Lab (and the same extension in v0.7).

## Install
1. Back up your GEOINT_Vinh folder.
2. Extract UPGRADE zip over `C:\Users\Admin\Documents\GEOINT_Vinh`.
3. Restart Django if needed and press Ctrl+Shift+R in Edge.
4. Turn off Google 3D, leave World Terrain on.
5. Select observer, set distance, eye height, samples, and 12–72 azimuth directions.
6. Click `Quét 360°`. After it finishes, enter azimuth and click `Phân tích một hướng`.
7. Export selected ray as CSV.

No migrations, token, or backend changes. The upgrade only changes `atlas/templates/atlas/index.html` and `atlas/static/atlas/ext/horizon.js`.

## Important limits
- The 360 scan is a *radial sample experiment*, not a continuous area viewshed.
- A 24 x 75 scan makes 1,800 DEM samples across 24 terrain service calls, and may take time and consume service quota.
- Each ray uses a simple local angle comparison. Earth curvature, atmospheric refraction, vertical DEM error, vegetation and buildings are not modeled.
- A ray with missing DEM data is marked uncertain downstream.
- Do not use for safety-critical decisions or real-time operational targeting.
