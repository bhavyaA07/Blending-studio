# Changes made to move server.ts from simulated to real

Only `server.ts` was modified. Nothing in `src/` (the UI) was touched, so the app
looks and behaves the same -- the numbers underneath are now real.

## 1. Real multi-model sourcing
Previously GraphCast/Pangu/NCUM were derived by multiplying two live fields by made-up
coefficients. Now four genuinely independent forecasts are pulled per station from
Open-Meteo's free multi-model API:
- `ncum`      -> `gfs_seamless`     (real physics NWP, stand-in for NCUM -- NCUM itself
                                      has no free public real-time API)
- `ecmwf`     -> `ecmwf_ifs025`     (real ECMWF physics NWP, open-data)
- `graphCast` -> `gfs_graphcast025` (real DeepMind GraphCast, run operationally by NOAA)
- `pangu`     -> `ecmwf_aifs025`    (real ECMWF AIFS AI model, substituted for
                                      Pangu-Weather -- no free hosted Pangu API exists)

No GPU needed: NOAA/ECMWF already run these models and publish the output as open data.

## 2. Real historical-skill engine (new)
On boot, and every 6 hours after, the server pulls each model's real historical
forecasts (Open-Meteo Historical Forecast API) and real observed weather (Open-Meteo
Archive API) for the last 30 days per station, and computes real RMSE per model for
rain/temp/wind.

## 3. Real adaptive weights
Station weights are now `1/RMSE` inverse-error weights derived from step 2, not
hand-typed constants. They update automatically as the skill engine refreshes.
Until the first computation finishes (a few seconds to ~1 minute after boot), stations
use an equal-share (25/25/25/25) fallback -- the API marks this via `weightsSource` /
`empirical` fields so it's never silently presented as learned.

## 4. Real skill metrics in POST /api/blend
`hybridRmse`, `baselineRmse`, `improvementPercent` are now computed from the same
real historical series (blended forecast vs. real observations), not hardcoded
constants. `equitableThreatScore` and `brierScore` are real verification metrics
computed against a >=15mm/day rain-event threshold, also from real data.

## 5. Operational pipeline actually runs
`GET /api/pipeline/script` now actually executes the historical-skill weighting engine
server-side and returns the real computed weights (`realComputedWeights`), in addition
to a reference Python script showing how the same logic would run as an offline HPC
batch job on native GRIB2/NetCDF fields.

## 6. Honest system status
`GET /api/system/status` (new) reports real internal metrics only: last successful
fetch timestamps per data source, cache age, and station/skill refresh counts.

`GET /api/hpc/status` is kept (same response shape) because `ArchitectureView.tsx`
renders it directly and wasn't modified -- but it's now clearly labeled
`ILLUSTRATIVE` / `N/A` for anything that isn't real (there is no supercomputer, no
GPUs; the AI models are consumed as precomputed data, not run locally). The one field
wired to something real is `lastExecutionCycle`, sourced from the actual skill engine.

## New endpoints
- `POST /api/skill/refresh` -- manually trigger the historical-skill recomputation
  (`{ "stationId": "mumbai" }` for one station, or no body for all stations)
- `GET /api/system/status` -- honest internal telemetry

## Known limitation
The lead-time transition (physics-dominant near-term, AI-competitive further out) and
the seasonal conditioning multipliers in `/api/blend` are still a documented
meteorological heuristic layered on top of the real base weights, not themselves
learned -- evaluating true per-lead-time skill would need archived multi-run forecast
data beyond what the free Open-Meteo historical API exposes. This is called out
directly in the code comments and in the API's `note` field.
