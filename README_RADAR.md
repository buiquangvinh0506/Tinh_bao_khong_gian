# GEOINT OS - Radar 360 upgrade

Apply this package over GEOINT_Vinh (backup first). Replaces only index.html and ext/horizon.js. No migrations, no token changes.

Open Horizon Angle Lab, disable Google 3D, enable World Terrain, set observer/range/samples/directions, press "Quét radar 360°". After scan finishes, select azimuth and press "Phân tích một hướng".

Radar display shows one green sweep and trailing fan, concentric distance rings, and result marks on the perimeter. Progress advances only after DEM sample responses. Cancel interrupts after the current request.

Limits: radial DEM sampling, not continuous viewshed, no buildings/vegetation, curvature/refraction not modeled. Do not use for safety-critical or real-time targeting.
