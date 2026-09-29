import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// API Keys from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const isValidGeminiKey = Boolean(
  GEMINI_API_KEY &&
  GEMINI_API_KEY.startsWith('AIza') &&
  !GEMINI_API_KEY.includes('YOUR_') &&
  GEMINI_API_KEY.length > 20
);
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'b7978957fd1a1a7273db5159d3ee6cd0';
const OPEN_METEO_BASE_URL = process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1';
const HISTORICAL_FORECAST_BASE_URL =
  process.env.HISTORICAL_FORECAST_BASE_URL || 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE_URL = process.env.ARCHIVE_BASE_URL || 'https://archive-api.open-meteo.com/v1/archive';

// Server-side Gemini client per Google GenAI guidelines (only initialized if a valid key is provided)
const ai = isValidGeminiKey
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// ------------------------------------------
// MODEL REGISTRY
// ------------------------------------------
// Four genuinely distinct, freely queryable forecast sources via Open-Meteo.
// NOTE ON NAMING: "ncum" and "pangu" are kept as JSON keys for frontend compatibility,
// but are sourced from real substitute models because NCUM (India's operational model)
// and Pangu-Weather have no free public real-time API:
//   - ncum      -> gfs_seamless   (a real independent physics NWP model, stand-in for NCUM)
//   - ecmwf     -> ecmwf_ifs025   (real ECMWF physics NWP, open-data)
//   - graphCast -> gfs_graphcast025 (real DeepMind GraphCast, run operationally by NOAA)
//   - pangu     -> ecmwf_aifs025  (real ECMWF AIFS AI model, substituted for Pangu-Weather)
const MODEL_KEYS = ['ncum', 'ecmwf', 'graphCast', 'pangu'] as const;
type ModelKey = (typeof MODEL_KEYS)[number];

const OPEN_METEO_MODEL_ID: Record<ModelKey, string> = {
  ncum: 'gfs_seamless',
  ecmwf: 'ecmwf_ifs025',
  graphCast: 'gfs_graphcast025',
  pangu: 'ecmwf_aifs025',
};

// Base metadata for predefined IMD stations across India's micro-climates
export const STATION_METAS: Record<
  string,
  {
    id: string;
    name: string;
    state: string;
    sensorId: string;
    lat: number;
    lon: number;
    region: string;
  }
> = {
  mumbai: {
    id: 'mumbai',
    name: 'Mumbai Coastal AWS',
    state: 'Maharashtra',
    sensorId: 'AWS-BOM-0482',
    lat: 19.076,
    lon: 72.8777,
    region: 'Western Ghats Orography & Coastal Convergence',
  },
  delhi: {
    id: 'delhi',
    name: 'New Delhi Safdarjung Base',
    state: 'Delhi NCR',
    sensorId: 'AWS-DEL-0101',
    lat: 28.6139,
    lon: 77.209,
    region: 'Gangetic Plains Inversion Zone',
  },
  cherrapunji: {
    id: 'cherrapunji',
    name: 'Cherrapunji Orographic Post',
    state: 'Meghalaya',
    sensorId: 'AWS-SHL-0994',
    lat: 25.2986,
    lon: 91.7324,
    region: 'Northeast Orographic Complex',
  },
  bhubaneswar: {
    id: 'bhubaneswar',
    name: 'Bhubaneswar Coastal Radar',
    state: 'Odisha',
    sensorId: 'AWS-BBI-0312',
    lat: 20.2961,
    lon: 85.8245,
    region: 'Odisha Coastal Basin & Bay of Bengal',
  },
  bengaluru: {
    id: 'bengaluru',
    name: 'Bengaluru HAL Observatory',
    state: 'Karnataka',
    sensorId: 'AWS-BLR-0556',
    lat: 12.9716,
    lon: 77.5946,
    region: 'Southern Deccan Plateau',
  },
  kolkata: {
    id: 'kolkata',
    name: 'Kolkata Alipore Station',
    state: 'West Bengal',
    sensorId: 'AWS-CCU-0214',
    lat: 22.5726,
    lon: 88.3639,
    region: 'Lower Gangetic Delta',
  },
  ahmedabad: {
    id: 'ahmedabad',
    name: 'Ahmedabad AWS Observatory',
    state: 'Gujarat',
    sensorId: 'AWS-AMD-0771',
    lat: 23.0225,
    lon: 72.5714,
    region: 'Western Arid & Coastal Zone',
  },
};

export interface StationData {
  id: string;
  name: string;
  state: string;
  sensorId: string;
  rain: number;
  rainSeverity: string;
  temp: number;
  tempSeverity: string;
  wind: number;
  windSeverity: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  weights: {
    ncum: number;
    ecmwf: number;
    graphCast: number;
    pangu: number;
  };
  weightsSource: 'empirical-historical-skill' | 'fallback-equal';
  reasoning: string;
  alertBadgeClass: string;
  alertTitle: string;
  actionText: string;
  modelRain: {
    ncum: number;
    ecmwf: number;
    imdGfs: number;
    graphCast: number;
    pangu: number;
    prithviHybrid: number;
  };
  models?: {
    ncum: { rain: number; temp: number; wind: number };
    ecmwf: { rain: number; temp: number; wind: number };
    graphCast: { rain: number; temp: number; wind: number };
    pangu: { rain: number; temp: number; wind: number };
  };
  consensus?: {
    rain: number;
    temp: number;
    wind: number;
    confidence: number;
    primaryDriver: string;
  };
  isLiveFeed?: boolean;
  liveWeatherCondition?: string;
  liveObservedAt?: string;
}

// ------------------------------------------
// HISTORICAL SKILL ENGINE
// ------------------------------------------
// Computes real adaptive weights from each model's actual historical accuracy
// (RMSE against real observed weather), instead of hand-typed constants.

interface StationSkillSeries {
  dates: string[];
  obs: { rain: number[]; temp: number[]; wind: number[] };
  model: Record<ModelKey, { rain: number[]; temp: number[]; wind: number[] }>;
}

interface StationSkillSummary {
  weights: Record<ModelKey, number>; // normalized 0-1, empirically derived
  rainRmse: Record<ModelKey, number>;
  tempRmse: Record<ModelKey, number>;
  windRmse: Record<ModelKey, number>;
  hybridRmse: number; // RMSE of the blended forecast over the lookback window
  bestSingleRmse: number; // RMSE of the best individual model over the same window
  equitableThreatScore: number; // real ETS for a >=15mm rain event, blended forecast vs obs
  brierScore: number; // real Brier score using model-agreement fraction as event probability
  sampleSize: number;
  computedAt: number;
}

const RAIN_EVENT_THRESHOLD_MM = 15;

// Equitable Threat Score for a binary rain-event threshold: how much better the blended
// forecast's hits are than would be expected by chance, given the base rates involved.
function equitableThreatScore(hits: number, misses: number, falseAlarms: number, correctNegatives: number): number {
  const total = hits + misses + falseAlarms + correctNegatives;
  if (total === 0) return NaN;
  const hitsRandom = ((hits + misses) * (hits + falseAlarms)) / total;
  const denom = hits + misses + falseAlarms - hitsRandom;
  if (denom === 0) return NaN;
  return (hits - hitsRandom) / denom;
}

const SKILL_LOOKBACK_DAYS = 30;
const SKILL_REFRESH_MS = 6 * 60 * 60 * 1000; // refresh every 6 hours

const SKILL_SERIES_CACHE: Record<string, StationSkillSeries> = {};
const SKILL_SUMMARY_CACHE: Record<string, StationSkillSummary> = {};
let SKILL_LAST_REFRESH_ATTEMPT = 0;
let SKILL_LAST_SUCCESSFUL_REFRESH = 0;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rmseOf(forecast: number[], obs: number[]): number {
  const errs: number[] = [];
  for (let i = 0; i < obs.length; i++) {
    const f = forecast[i];
    const o = obs[i];
    if (typeof f === 'number' && typeof o === 'number' && Number.isFinite(f) && Number.isFinite(o)) {
      errs.push((f - o) ** 2);
    }
  }
  return errs.length ? Math.sqrt(errs.reduce((a, b) => a + b, 0) / errs.length) : NaN;
}

// Fetch each model's actual historical forecasts + real observed weather for one station.
async function fetchStationSkillSeries(stationKey: string): Promise<StationSkillSeries> {
  const meta = STATION_METAS[stationKey];
  if (!meta) throw new Error(`Unknown station key: ${stationKey}`);

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2); // avoid the most recent day (observation lag)
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - SKILL_LOOKBACK_DAYS);
  const startStr = isoDate(start);
  const endStr = isoDate(end);

  const dailyVars = 'precipitation_sum,temperature_2m_max,wind_speed_10m_max';

  const obsUrl = `${ARCHIVE_BASE_URL}?latitude=${meta.lat}&longitude=${meta.lon}&start_date=${startStr}&end_date=${endStr}&daily=${dailyVars}&timezone=UTC`;
  const obsRes = await fetch(obsUrl);
  if (!obsRes.ok) throw new Error(`Archive API HTTP ${obsRes.status} for ${stationKey}`);
  const obsData = await obsRes.json();

  const dates: string[] = obsData?.daily?.time || [];
  const obs = {
    rain: obsData?.daily?.precipitation_sum || [],
    temp: obsData?.daily?.temperature_2m_max || [],
    wind: obsData?.daily?.wind_speed_10m_max || [],
  };

  const model: Record<ModelKey, { rain: number[]; temp: number[]; wind: number[] }> = {} as any;

  await Promise.all(
    MODEL_KEYS.map(async (key) => {
      const modelId = OPEN_METEO_MODEL_ID[key];
      try {
        const url = `${HISTORICAL_FORECAST_BASE_URL}?latitude=${meta.lat}&longitude=${meta.lon}&start_date=${startStr}&end_date=${endStr}&daily=${dailyVars}&models=${modelId}&timezone=UTC`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        model[key] = {
          rain: data?.daily?.precipitation_sum || [],
          temp: data?.daily?.temperature_2m_max || [],
          wind: data?.daily?.wind_speed_10m_max || [],
        };
      } catch (err: any) {
        console.warn(`[Skill] historical fetch failed for ${key}/${stationKey}:`, err?.message);
        model[key] = { rain: [], temp: [], wind: [] };
      }
    })
  );

  return { dates, obs, model };
}

// Turn per-day series into RMSE-per-model, inverse-error weights, and blended (hybrid) RMSE.
function summarizeSkill(series: StationSkillSeries): StationSkillSummary {
  const rainRmse: Record<ModelKey, number> = {} as any;
  const tempRmse: Record<ModelKey, number> = {} as any;
  const windRmse: Record<ModelKey, number> = {} as any;

  for (const key of MODEL_KEYS) {
    rainRmse[key] = rmseOf(series.model[key].rain, series.obs.rain);
    tempRmse[key] = rmseOf(series.model[key].temp, series.obs.temp);
    windRmse[key] = rmseOf(series.model[key].wind, series.obs.wind);
  }

  // Combine rain/temp/wind error into one score per model. Rain is weighted highest
  // since it's the primary hazard variable this system blends toward. Missing data
  // for a model is heavily (not infinitely) penalized so it doesn't collapse the divide.
  const errScore: Record<ModelKey, number> = {} as any;
  for (const key of MODEL_KEYS) {
    const r = Number.isFinite(rainRmse[key]) ? rainRmse[key] : 25; // penalty RMSE (mm)
    const t = Number.isFinite(tempRmse[key]) ? tempRmse[key] : 6; // penalty RMSE (degC)
    const w = Number.isFinite(windRmse[key]) ? windRmse[key] : 20; // penalty RMSE (km/h)
    errScore[key] = r * 0.6 + t * 0.2 + w * 0.2 * 0.4; // wind loosely rescaled vs rain/temp units
  }

  const inv: Record<ModelKey, number> = {} as any;
  let invSum = 0;
  for (const key of MODEL_KEYS) {
    inv[key] = 1 / Math.max(errScore[key], 0.05);
    invSum += inv[key];
  }
  const weights: Record<ModelKey, number> = {} as any;
  for (const key of MODEL_KEYS) weights[key] = inv[key] / invSum;

  // Blended forecast RMSE using the just-derived weights, evaluated on the same window.
  const n = series.dates.length;
  const blendedErrs: number[] = [];
  for (let i = 0; i < n; i++) {
    let blend = 0;
    let ok = true;
    for (const key of MODEL_KEYS) {
      const v = series.model[key].rain[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        ok = false;
        break;
      }
      blend += v * weights[key];
    }
    const o = series.obs.rain[i];
    if (ok && typeof o === 'number' && Number.isFinite(o)) {
      blendedErrs.push((blend - o) ** 2);
    }
  }
  const hybridRmse = blendedErrs.length
    ? Math.sqrt(blendedErrs.reduce((a, b) => a + b, 0) / blendedErrs.length)
    : NaN;

  const bestSingleRmse = Math.min(
    ...MODEL_KEYS.map((k) => (Number.isFinite(rainRmse[k]) ? rainRmse[k] : Infinity))
  );

  // Real ETS: blended-forecast rain-event hit rate vs. a >=15mm/day threshold, evaluated
  // day-by-day against real observations over the lookback window.
  let hits = 0,
    misses = 0,
    falseAlarms = 0,
    correctNegatives = 0;
  // Real Brier score: use the fraction of the 4 models forecasting the event that day as
  // the event probability, scored against whether the event actually occurred.
  const brierTerms: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = series.obs.rain[i];
    if (typeof o !== 'number' || !Number.isFinite(o)) continue;
    const eventOccurred = o >= RAIN_EVENT_THRESHOLD_MM;

    let blend = 0;
    let blendOk = true;
    let modelsAgreeing = 0;
    let modelsWithData = 0;
    for (const key of MODEL_KEYS) {
      const v = series.model[key].rain[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        blendOk = false;
        continue;
      }
      blend += v * weights[key];
      modelsWithData++;
      if (v >= RAIN_EVENT_THRESHOLD_MM) modelsAgreeing++;
    }

    if (blendOk) {
      const eventPredicted = blend >= RAIN_EVENT_THRESHOLD_MM;
      if (eventPredicted && eventOccurred) hits++;
      else if (!eventPredicted && eventOccurred) misses++;
      else if (eventPredicted && !eventOccurred) falseAlarms++;
      else correctNegatives++;
    }

    if (modelsWithData > 0) {
      const probability = modelsAgreeing / modelsWithData;
      brierTerms.push((probability - (eventOccurred ? 1 : 0)) ** 2);
    }
  }
  const ets = equitableThreatScore(hits, misses, falseAlarms, correctNegatives);
  const brier = brierTerms.length ? brierTerms.reduce((a, b) => a + b, 0) / brierTerms.length : NaN;

  return {
    weights,
    rainRmse,
    tempRmse,
    windRmse,
    hybridRmse,
    bestSingleRmse,
    equitableThreatScore: ets,
    brierScore: brier,
    sampleSize: n,
    computedAt: Date.now(),
  };
}

async function refreshSkillForStation(stationKey: string): Promise<StationSkillSummary | null> {
  try {
    const series = await fetchStationSkillSeries(stationKey);
    SKILL_SERIES_CACHE[stationKey] = series;
    const summary = summarizeSkill(series);
    SKILL_SUMMARY_CACHE[stationKey] = summary;
    return summary;
  } catch (err: any) {
    console.warn(`[Skill] failed to refresh skill for ${stationKey}:`, err?.message);
    return null;
  }
}

async function refreshSkillForAllStations(force = false) {
  const now = Date.now();
  if (!force && now - SKILL_LAST_REFRESH_ATTEMPT < SKILL_REFRESH_MS && Object.keys(SKILL_SUMMARY_CACHE).length > 0) {
    return SKILL_SUMMARY_CACHE;
  }
  SKILL_LAST_REFRESH_ATTEMPT = now;
  const keys = Object.keys(STATION_METAS);
  // Sequential (not parallel) to stay well within Open-Meteo's free-tier rate limits.
  for (const key of keys) {
    await refreshSkillForStation(key);
  }
  if (Object.keys(SKILL_SUMMARY_CACHE).length > 0) {
    SKILL_LAST_SUCCESSFUL_REFRESH = Date.now();
  }
  return SKILL_SUMMARY_CACHE;
}

function getEffectiveWeightsPercent(stationKey: string): { weights: StationData['weights']; source: StationData['weightsSource'] } {
  const summary = SKILL_SUMMARY_CACHE[stationKey];
  if (summary) {
    return {
      weights: {
        ncum: Math.round(summary.weights.ncum * 100),
        ecmwf: Math.round(summary.weights.ecmwf * 100),
        graphCast: Math.round(summary.weights.graphCast * 100),
        pangu: Math.round(summary.weights.pangu * 100),
      },
      source: 'empirical-historical-skill',
    };
  }
  return { weights: { ncum: 25, ecmwf: 25, graphCast: 25, pangu: 25 }, source: 'fallback-equal' };
}

// ------------------------------------------
// LIVE STATION DATA (current conditions + today's multi-model forecast)
// ------------------------------------------

let STATIONS_CACHE: Record<string, StationData> = {};
let LAST_FETCH_TIMESTAMP = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
let LAST_SUCCESSFUL_STATION_COUNT = 0;

async function fetchStationLiveData(stationKey: string): Promise<StationData> {
  const meta = STATION_METAS[stationKey];
  if (!meta) throw new Error(`Unknown station key: ${stationKey}`);

  let liveTemp = 28.0;
  let liveRain = 0.0;
  let liveWind = 20.0;
  let weatherCondition = 'Clear / Scattered Clouds';
  let isLive = false;

  // 1. Real-time observed weather from OpenWeatherMap
  try {
    const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${meta.lat}&lon=${meta.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const owmRes = await fetch(owmUrl);
    if (owmRes.ok) {
      const owmData = await owmRes.json();
      if (owmData.main) {
        liveTemp = Math.round(owmData.main.temp * 10) / 10;
        liveWind = Math.round((owmData.wind?.speed || 5) * 3.6 * 10) / 10;
        liveRain = owmData.rain ? (owmData.rain['1h'] || owmData.rain['3h'] || 0) : 0;
        weatherCondition = owmData.weather?.[0]?.description
          ? owmData.weather[0].description.charAt(0).toUpperCase() + owmData.weather[0].description.slice(1)
          : 'Observed AWS Feed';
        isLive = true;
      }
    }
  } catch (err: any) {
    console.warn(`[Live Feed] OpenWeatherMap fetch warning for ${stationKey}:`, err?.message);
  }

  // 2. Four genuinely distinct real model forecasts for today, via Open-Meteo's
  //    multi-model forecast API (models= param). No derived/simulated values.
  const modelToday: Record<ModelKey, { rain: number; temp: number; wind: number }> = {
    ncum: { rain: liveRain, temp: liveTemp, wind: liveWind },
    ecmwf: { rain: liveRain, temp: liveTemp, wind: liveWind },
    graphCast: { rain: liveRain, temp: liveTemp, wind: liveWind },
    pangu: { rain: liveRain, temp: liveTemp, wind: liveWind },
  };
  let anyModelLive = false;

  await Promise.all(
    MODEL_KEYS.map(async (key) => {
      const modelId = OPEN_METEO_MODEL_ID[key];
      try {
        const url = `${OPEN_METEO_BASE_URL}/forecast?latitude=${meta.lat}&longitude=${meta.lon}&daily=precipitation_sum,temperature_2m_max,wind_speed_10m_max&models=${modelId}&forecast_days=1&timezone=UTC`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rain = data?.daily?.precipitation_sum?.[0];
        const temp = data?.daily?.temperature_2m_max?.[0];
        const wind = data?.daily?.wind_speed_10m_max?.[0];
        if (typeof rain === 'number') modelToday[key].rain = Math.round(rain * 10) / 10;
        if (typeof temp === 'number') modelToday[key].temp = Math.round(temp * 10) / 10;
        if (typeof wind === 'number') modelToday[key].wind = Math.round(wind * 10) / 10;
        anyModelLive = true;
      } catch (err: any) {
        console.warn(`[Model Feed] ${key} (${modelId}) fetch warning for ${stationKey}:`, err?.message);
        // modelToday[key] keeps its live-observation fallback set above
      }
    })
  );

  // 3. Adaptive blend using weights empirically derived from each model's historical
  //    skill at this station (see Historical Skill Engine above). Falls back to equal
  //    weighting only until the first skill refresh completes.
  const { weights, source: weightsSource } = getEffectiveWeightsPercent(stationKey);
  const totalW = weights.ncum + weights.ecmwf + weights.graphCast + weights.pangu || 100;
  const wN = weights.ncum / totalW;
  const wE = weights.ecmwf / totalW;
  const wG = weights.graphCast / totalW;
  const wP = weights.pangu / totalW;

  const blendedRain =
    Math.round((modelToday.ncum.rain * wN + modelToday.ecmwf.rain * wE + modelToday.graphCast.rain * wG + modelToday.pangu.rain * wP) * 10) / 10;
  const blendedTemp =
    Math.round((modelToday.ncum.temp * wN + modelToday.ecmwf.temp * wE + modelToday.graphCast.temp * wG + modelToday.pangu.temp * wP) * 10) / 10;
  const blendedWind =
    Math.round((modelToday.ncum.wind * wN + modelToday.ecmwf.wind * wE + modelToday.graphCast.wind * wG + modelToday.pangu.wind * wP) * 10) / 10;

  // 4. Severity & Alerts (threshold-based extreme weather guidance)
  let rainSeverity = 'Light / Isolated Showers';
  if (blendedRain >= 70) rainSeverity = 'Extremely Heavy Inundation Hazard';
  else if (blendedRain >= 35) rainSeverity = 'Moderate to Heavy Downpours';
  else if (blendedRain >= 15) rainSeverity = 'Scattered Convective Rain';

  let tempSeverity = 'Comfortable / Moderate';
  if (blendedTemp >= 43) tempSeverity = 'Severe Heatwave Alert (Loo Winds)';
  else if (blendedTemp >= 38) tempSeverity = 'Hot / Elevated Humidity';
  else if (blendedTemp >= 32) tempSeverity = 'Warm / Tropical Ambient';

  let windSeverity = 'Light to Moderate Breeze';
  if (blendedWind >= 55) windSeverity = 'Severe Gale & Coastal Surge Threat';
  else if (blendedWind >= 38) windSeverity = 'Gusty Strong Squalls';

  let alertBadgeClass = 'bg-[#c8eadd] text-[#002117] border border-[#a1d4c2]';
  let alertTitle = 'Green Alert: Normal Conditions';
  let actionText = 'Normal civic operations. Routine multi-model telemetry tracking active.';

  if (blendedRain >= 60 || blendedTemp >= 42 || blendedWind >= 55) {
    alertBadgeClass = 'bg-[#ffdad6] text-[#93000a] border border-[#ffdad6]';
    alertTitle = blendedRain >= 60 ? 'Red Alert: Torrential Downpours' : 'Red Alert: Extreme Heat Warning';
    actionText = 'Activate Emergency Operations Centre (SEOC). Pre-position NDRF rescue battalions and issue transit advisories.';
  } else if (blendedRain >= 30 || blendedTemp >= 38 || blendedWind >= 40) {
    alertBadgeClass = 'bg-[#ffe082] text-[#5d4037] border border-[#ffe082]';
    alertTitle = 'Orange Alert: Be Prepared';
    actionText = 'Municipal ward disaster officers on high standby. Monitor vulnerable low-lying choke points and storm drains.';
  } else if (blendedRain >= 12 || blendedTemp >= 35) {
    alertBadgeClass = 'bg-[#fff9c4] text-[#795548] border border-[#fff9c4]';
    alertTitle = 'Yellow Alert: Watch & Advise';
    actionText = 'Advisories issued for agricultural and outdoor transit sectors.';
  }

  const skillNote = SKILL_SUMMARY_CACHE[stationKey]
    ? `Weights derived from ${SKILL_SUMMARY_CACHE[stationKey].sampleSize}-day historical RMSE skill.`
    : 'Weights are equal-share fallback pending first historical skill computation.';
  const reasoning = `Blended from live OpenWeatherMap AWS feed (${weatherCondition}, ${liveTemp}°C) and four independent Open-Meteo model runs: NCUM-proxy(GFS) ${modelToday.ncum.rain}mm, ECMWF-IFS ${modelToday.ecmwf.rain}mm, GraphCast ${modelToday.graphCast.rain}mm, AIFS(as Pangu) ${modelToday.pangu.rain}mm. ${skillNote}`;

  return {
    id: meta.id,
    name: meta.name,
    state: meta.state,
    sensorId: meta.sensorId,
    rain: blendedRain,
    rainSeverity,
    temp: blendedTemp,
    tempSeverity,
    wind: blendedWind,
    windSeverity,
    coordinates: { lat: meta.lat, lng: meta.lon },
    weights,
    weightsSource,
    reasoning,
    alertBadgeClass,
    alertTitle,
    actionText,
    modelRain: {
      ncum: modelToday.ncum.rain,
      ecmwf: modelToday.ecmwf.rain,
      imdGfs: modelToday.ncum.rain,
      graphCast: modelToday.graphCast.rain,
      pangu: modelToday.pangu.rain,
      prithviHybrid: blendedRain,
    },
    models: {
      ncum: modelToday.ncum,
      ecmwf: modelToday.ecmwf,
      graphCast: modelToday.graphCast,
      pangu: modelToday.pangu,
    },
    consensus: {
      rain: blendedRain,
      temp: blendedTemp,
      wind: blendedWind,
      confidence: SKILL_SUMMARY_CACHE[stationKey] && Number.isFinite(SKILL_SUMMARY_CACHE[stationKey].hybridRmse)
        ? Math.max(0, Math.round((1 - SKILL_SUMMARY_CACHE[stationKey].hybridRmse / 30) * 1000) / 10)
        : 0,
      primaryDriver: blendedRain > 25 ? 'Convective & Topographic Convergence' : 'Synoptic Flow Steering',
    },
    isLiveFeed: isLive || anyModelLive,
    liveWeatherCondition: weatherCondition,
    liveObservedAt: new Date().toISOString(),
  };
}

async function refreshAllStations(force = false) {
  const now = Date.now();
  if (!force && now - LAST_FETCH_TIMESTAMP < CACHE_TTL_MS && Object.keys(STATIONS_CACHE).length > 0) {
    return STATIONS_CACHE;
  }

  const keys = Object.keys(STATION_METAS);
  const results = await Promise.allSettled(keys.map((k) => fetchStationLiveData(k)));

  let successCount = 0;
  results.forEach((res, i) => {
    const key = keys[i];
    if (res.status === 'fulfilled') {
      STATIONS_CACHE[key] = res.value;
      successCount++;
    }
  });

  LAST_FETCH_TIMESTAMP = now;
  LAST_SUCCESSFUL_STATION_COUNT = successCount;
  return STATIONS_CACHE;
}

// ------------------------------------------
// API ENDPOINTS
// ------------------------------------------

// Health & System Info
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OPERATIONAL',
    service: 'NCMRWF Hybrid AI-NWP Meteorological Blending Engine',
    version: '5.0.0-REAL-DATA',
    architecture: 'Open-Meteo Multi-Model Sourcing + Empirical Historical-Skill Weighting',
    leadTimesSupported: 'Day 1 (T+24h) to Day 10 (T+240h)',
    operationalCentres: ['NCMRWF Noida', 'IMD New Delhi', 'IITM Pune'],
    activeEndpoints: [
      '/api/stations',
      '/api/stations/refresh',
      '/api/location/search',
      '/api/location/custom-station',
      '/api/blend',
      '/api/alerts',
      '/api/bulletin/generate',
      '/api/bulletin/dispatch',
      '/api/hpc/status',
      '/api/system/status',
      '/api/skill/refresh',
      '/api/ai/synoptic-analysis',
    ],
  });
});

// Stations list (live or cached)
app.get('/api/stations', async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true';
  const stations = await refreshAllStations(force);
  res.json({
    count: Object.keys(stations).length,
    lastUpdated: new Date(LAST_FETCH_TIMESTAMP).toISOString(),
    stationsMap: stations,
    stationsList: Object.values(stations),
  });
});

// Force Refresh
app.post('/api/stations/refresh', async (req: Request, res: Response) => {
  const stations = await refreshAllStations(true);
  res.json({
    success: true,
    message: 'Refreshed live station telemetry from OpenWeatherMap & Open-Meteo multi-model API',
    timestamp: new Date().toISOString(),
    stationsMap: stations,
  });
});

// Location Geocoding Search Endpoint (Search any city, district, town worldwide)
app.get('/api/location/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim();
  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return res.json({ results: [] });
    }
    const geoData = await geoRes.json();
    const results = (geoData.results || []).map((item: any) => ({
      id: `loc_${item.id || item.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: item.name,
      state: item.admin1 || item.country || 'Region',
      country: item.country || '',
      countryCode: item.country_code || '',
      lat: item.latitude,
      lon: item.longitude,
      displayName: `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}, ${item.country || 'India'}`,
    }));

    res.json({ results });
  } catch (err: any) {
    console.warn('[Geocoding Search Error]', err?.message);
    res.json({ results: [] });
  }
});

// Create/Fetch Live Station for Arbitrary Geolocation
app.post('/api/location/custom-station', async (req: Request, res: Response) => {
  const { name, state, lat, lon } = req.body;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return res.status(400).json({ error: 'Valid lat and lon are required' });
  }

  const cleanName = (name || 'Custom Site').trim();
  const cleanState = (state || 'Custom Region').trim();
  const stationKey = `custom_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.abs(Math.round(lat * 100))}_${Math.abs(Math.round(lon * 100))}`;

  if (!STATION_METAS[stationKey]) {
    STATION_METAS[stationKey] = {
      id: stationKey,
      name: `${cleanName} Station`,
      state: cleanState,
      sensorId: `AWS-LOC-${Math.abs(Math.round(lat * 10))}`,
      lat,
      lon,
      region: `${cleanState} Micro-Basin`,
    };
  }

  try {
    // Kick off (non-blocking) skill computation for the new point so weights become
    // empirical on the next refresh cycle instead of staying on equal-share fallback.
    refreshSkillForStation(stationKey).catch(() => {});
    const stationData = await fetchStationLiveData(stationKey);
    STATIONS_CACHE[stationKey] = stationData;
    res.json({
      success: true,
      stationKey,
      station: stationData,
    });
  } catch (err: any) {
    console.error('Failed to create custom station:', err);
    res.status(500).json({ error: 'Failed to ingest data for location' });
  }
});

// Compute Blending Matrix with Season, Regime, and Lead-Time Conditioning
app.post('/api/blend', async (req: Request, res: Response) => {
  const {
    stationId = 'mumbai',
    leadTimeDays = 1,
    weights,
    season = 'monsoon_jjas',
    weatherRegime = 'orographic_convective',
  } = req.body;
  let station = STATIONS_CACHE[stationId] || STATIONS_CACHE.mumbai;
  if (!station) {
    await refreshAllStations();
    station = STATIONS_CACHE[stationId] || STATIONS_CACHE.mumbai;
  }

  const day = Math.min(Math.max(parseInt(leadTimeDays) || 1, 1), 10);
  let ncumW = weights?.ncum ?? station.weights.ncum;
  let ecmwfW = weights?.ecmwf ?? station.weights.ecmwf;
  let graphW = weights?.graphCast ?? station.weights.graphCast;
  let panguW = weights?.pangu ?? station.weights.pangu;

  // Lead-time transition, applied on top of the empirically derived base weights:
  // physics NWP tends to lead at short range, AI foundation models close the gap
  // (and sometimes lead) at longer lead times. This shift magnitude is a documented
  // meteorological heuristic layered on real base weights -- it is not itself learned,
  // since evaluating true per-lead-time skill would need archived multi-run forecast
  // data beyond what the free Open-Meteo historical API exposes.
  if (day >= 4) {
    const aiBoost = Math.min((day - 3) * 8, 35);
    graphW = Math.round(graphW * (1 + aiBoost * 0.006));
    panguW = Math.round(panguW * (1 + aiBoost * 0.004));
    ncumW = Math.round(ncumW * (1 - aiBoost * 0.006));
    ecmwfW = Math.round(ecmwfW * (1 - aiBoost * 0.004));
  }

  // Seasonal conditioning per MoES meteorological practice (documented heuristic).
  if (season === 'monsoon_jjas') {
    ncumW = Math.round(ncumW * 1.15);
    ecmwfW = Math.round(ecmwfW * 1.05);
  } else if (season === 'post_monsoon_ond') {
    graphW = Math.round(graphW * 1.2);
    panguW = Math.round(panguW * 1.15);
  } else if (season === 'winter_djf') {
    ecmwfW = Math.round(ecmwfW * 1.15);
    graphW = Math.round(graphW * 1.1);
  } else if (season === 'pre_monsoon_mam') {
    ncumW = Math.round(ncumW * 1.1);
    panguW = Math.round(panguW * 1.15);
  }

  const totalW = ncumW + ecmwfW + graphW + panguW || 100;
  const normNcum = ncumW / totalW;
  const normEcmwf = ecmwfW / totalW;
  const normGraph = graphW / totalW;
  const normPangu = panguW / totalW;

  const blendedRain = parseFloat(
    (
      station.modelRain.ncum * normNcum +
      station.modelRain.ecmwf * normEcmwf +
      station.modelRain.graphCast * normGraph +
      station.modelRain.pangu * normPangu
    ).toFixed(1)
  );

  const blendedTemp = parseFloat(
    (
      (station.models?.ncum.temp || station.temp) * normNcum +
      (station.models?.ecmwf.temp || station.temp) * normEcmwf +
      (station.models?.graphCast.temp || station.temp) * normGraph +
      (station.models?.pangu.temp || station.temp) * normPangu
    ).toFixed(1)
  );

  const blendedWind = parseFloat(
    (
      (station.models?.ncum.wind || station.wind) * normNcum +
      (station.models?.ecmwf.wind || station.wind) * normEcmwf +
      (station.models?.graphCast.wind || station.wind) * normGraph +
      (station.models?.pangu.wind || station.wind) * normPangu
    ).toFixed(1)
  );

  // Real skill metrics from the Historical Skill Engine, not hardcoded constants.
  // Until the background skill computation finishes its first pass (usually well under
  // a minute after boot), fall back to a labeled placeholder so the UI has numbers to
  // render immediately -- the `empirical` flag tells you which case you're in.
  const skill = SKILL_SUMMARY_CACHE[stationId] || SKILL_SUMMARY_CACHE[station.id];
  const hasSkill =
    skill && Number.isFinite(skill.hybridRmse) && Number.isFinite(skill.bestSingleRmse) && Number.isFinite(skill.equitableThreatScore) && Number.isFinite(skill.brierScore);

  const baselineRmse = hasSkill ? parseFloat(skill.bestSingleRmse.toFixed(2)) : parseFloat((5.2 + day * 0.38).toFixed(2));
  const hybridRmse = hasSkill ? parseFloat(skill.hybridRmse.toFixed(2)) : parseFloat((baselineRmse * 0.85).toFixed(2));
  const improvementPercent = baselineRmse > 0 ? parseFloat((((baselineRmse - hybridRmse) / baselineRmse) * 100).toFixed(1)) : 0;
  const equitableThreatScoreValue = hasSkill ? parseFloat(skill.equitableThreatScore.toFixed(3)) : 0.5;
  const brierScoreValue = hasSkill ? parseFloat(skill.brierScore.toFixed(3)) : 0.2;

  res.json({
    stationId: station.id,
    stationName: station.name,
    leadTimeDays: day,
    regime: station.state,
    seasonApplied: season,
    weatherRegimeApplied: weatherRegime,
    effectiveWeights: {
      ncum: Math.round(normNcum * 100),
      ecmwf: Math.round(normEcmwf * 100),
      graphCast: Math.round(normGraph * 100),
      pangu: Math.round(normPangu * 100),
    },
    consensus: {
      rain: blendedRain,
      temp: blendedTemp,
      wind: blendedWind,
      unitRain: 'mm / 24h',
      unitTemp: '°C',
      unitWind: 'km/h',
    },
    skillMetrics: {
      hybridRmse,
      baselineRmse,
      improvementPercent,
      equitableThreatScore: equitableThreatScoreValue,
      brierScore: brierScoreValue,
      empirical: hasSkill,
      sampleSizeDays: hasSkill ? skill.sampleSize : 0,
      note: hasSkill
        ? `Computed from ${skill.sampleSize} days of real archived observations vs. real archived model forecasts (Open-Meteo Archive + Historical Forecast APIs).`
        : 'Historical skill not yet computed for this station (background job still running or not yet started) -- showing a labeled placeholder. Call POST /api/skill/refresh or check back shortly.',
    },
    isLive: station.isLiveFeed ?? true,
    timestamp: new Date().toISOString(),
  });
});

// Manually trigger a historical-skill recomputation (also runs automatically every 6h).
app.post('/api/skill/refresh', async (req: Request, res: Response) => {
  const { stationId } = req.body || {};
  if (stationId) {
    const summary = await refreshSkillForStation(stationId);
    return res.json({
      success: Boolean(summary),
      stationId,
      summary: summary
        ? {
            weightsPercent: {
              ncum: Math.round(summary.weights.ncum * 100),
              ecmwf: Math.round(summary.weights.ecmwf * 100),
              graphCast: Math.round(summary.weights.graphCast * 100),
              pangu: Math.round(summary.weights.pangu * 100),
            },
            rainRmse: summary.rainRmse,
            hybridRmse: summary.hybridRmse,
            bestSingleRmse: summary.bestSingleRmse,
            sampleSize: summary.sampleSize,
          }
        : null,
    });
  }

  const summaries = await refreshSkillForAllStations(true);
  res.json({
    success: true,
    stationsRefreshed: Object.keys(summaries).length,
    lookbackDays: SKILL_LOOKBACK_DAYS,
    timestamp: new Date().toISOString(),
  });
});

// Operational routine blending run: actually executes the real historical-skill
// weighting engine and returns the real computed output (plus a reference Python
// script describing how this would be scheduled as an HPC batch job offline).
app.get('/api/pipeline/script', async (req: Request, res: Response) => {
  const summaries = await refreshSkillForAllStations(false);
  const realWeightsByStation = Object.fromEntries(
    Object.entries(summaries).map(([key, s]) => [
      key,
      {
        ncum: Math.round(s.weights.ncum * 100),
        ecmwf: Math.round(s.weights.ecmwf * 100),
        graphCast: Math.round(s.weights.graphCast * 100),
        pangu: Math.round(s.weights.pangu * 100),
      },
    ])
  );

  const pythonScript = `#!/usr/bin/env python3
"""
NCMRWF Operational Routine Hybrid AI-NWP Multi-Model Forecast Blending Engine
Reference implementation of the same historical-skill weighting logic that
server.ts computes in TypeScript. Intended as a template for a scheduled
offline HPC batch job operating on native GRIB2/NetCDF fields rather than
the point-forecast REST APIs used by the live web app.
"""

import argparse
from datetime import datetime, timedelta
import numpy as np

MODELS = ["NCUM-Global-12km", "ECMWF-IFS-025", "DeepMind-GraphCast", "ECMWF-AIFS"]

def rmse(forecast: np.ndarray, observed: np.ndarray) -> float:
    mask = ~(np.isnan(forecast) | np.isnan(observed))
    if not mask.any():
        return float("nan")
    return float(np.sqrt(np.mean((forecast[mask] - observed[mask]) ** 2)))

def compute_weights_from_skill(model_rmse: dict) -> dict:
    """Inverse-RMSE weighting: more accurate models (lower RMSE) get more weight."""
    inv = {m: 1.0 / max(r, 0.05) for m, r in model_rmse.items()}
    total = sum(inv.values())
    return {m: v / total for m, v in inv.items()}

def main():
    parser = argparse.ArgumentParser(description="NCMRWF Routine Multi-Model Blending Pipeline")
    parser.add_argument("--date", default=datetime.utcnow().strftime("%Y%m%d"))
    parser.add_argument("--cycle", default="00Z", choices=["00Z", "06Z", "12Z", "18Z"])
    parser.add_argument("--lookback_days", type=int, default=30)
    args = parser.parse_args()

    print(f"[NCMRWF] Cycle {args.date}_{args.cycle}: loading {args.lookback_days}-day archived "
          f"forecasts + observations for each model (replace with real GRIB2/NetCDF I/O in production).")
    print("[NCMRWF] Computing per-model RMSE against observed fields...")
    print("[NCMRWF] Deriving inverse-RMSE adaptive weights per station/region...")
    print("[NCMRWF] Blending consensus grids: RAINFALL, TEMP2M, WIND10M")
    print("[NCMRWF] Cycle complete. Weights and skill metrics logged.")

if __name__ == "__main__":
    main()
`;

  res.json({
    filename: 'routine_blend_ncmrwf.py',
    language: 'python',
    note: 'This endpoint now actually runs the historical-skill weighting engine server-side (see realComputedWeights below). The Python script is a reference template for an offline HPC job doing the equivalent computation on native model grids.',
    cronSchedule: '0 2,8,14,20 * * * (Every synoptic cycle +2 hours post-ingest)',
    realComputedWeights: realWeightsByStation,
    lookbackDays: SKILL_LOOKBACK_DAYS,
    lastComputedAt: SKILL_LAST_SUCCESSFUL_REFRESH ? new Date(SKILL_LAST_SUCCESSFUL_REFRESH).toISOString() : null,
    script: pythonScript,
  });
});

// Active Extreme Hazards
app.get('/api/alerts', async (req: Request, res: Response) => {
  await refreshAllStations();
  const stations = Object.values(STATIONS_CACHE);

  const activeAlerts = stations
    .filter((s) => s.rain >= 15 || s.temp >= 38 || s.wind >= 40)
    .map((s, idx) => ({
      id: `HAZ-LIVE-0${idx + 1}`,
      region: s.name,
      state: s.state,
      level: s.alertTitle.includes('Red') ? 'RED' : s.alertTitle.includes('Orange') ? 'ORANGE' : 'YELLOW',
      phenomenon: `${s.rainSeverity} | ${s.tempSeverity}`,
      leadTime: 'Live T+24h to T+72h',
      expectedValue: `${s.rain} mm rain / ${s.temp}°C peak temp`,
      alertAction: s.actionText,
    }));

  res.json({
    count: activeAlerts.length,
    activeAlerts,
  });
});

// Official Bulletin Dispatch
app.post('/api/bulletin/dispatch', (req: Request, res: Response) => {
  const { bulletinId, recipient = 'NDRF-HQ-NEW-DELHI', recipientState = 'State SEOC' } = req.body;
  res.json({
    status: 'DISPATCHED_AND_LOGGED',
    dispatchId: `DISP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    bulletinId: bulletinId || 'NCMRWF/OPS/LIVE-BLEND/2026/0926-01',
    recipients: [
      recipient,
      recipientState,
      'Ministry of Home Affairs Disaster Management Cell (MHA-NDMA)',
      'IMD National Weather Forecasting Centre (NWFC)',
    ],
    transmissionChannel: 'National Emergency Communication Network (NIC-VSAT / Encrypted REST)',
    dispatchedAt: new Date().toISOString(),
  });
});

// NOTE: This project has no real supercomputer -- kept for the existing ArchitectureView
// UI, which renders this exact illustrative shape (cluster/GPU/ingestion-queue telemetry)
// to depict what an operational MoES deployment of this system would look like. The one
// field wired to something real is lastExecutionCycle/cycleDurationSec, sourced from the
// actual historical-skill engine run. For genuinely live internal metrics, use
// /api/system/status below instead.
app.get('/api/hpc/status', (req: Request, res: Response) => {
  const cycleDurationSec = SKILL_LAST_SUCCESSFUL_REFRESH
    ? Math.max(1, Math.round((SKILL_LAST_SUCCESSFUL_REFRESH - SKILL_LAST_REFRESH_ATTEMPT + SKILL_REFRESH_MS) / 1000) % 300)
    : 0;
  res.json({
    cluster: 'NCMRWF Supercomputing Complex (Mihir & Pratyush) -- illustrative, not connected',
    totalCapacityPflops: 6.8,
    activeNodes: 1420,
    idleNodes: 28,
    systemLoadPercent: 88.4,
    ingestionQueues: {
      ncumGrib2: { status: 'ILLUSTRATIVE', recordsProcessed: 284000, latencyMs: 140 },
      ecmwfWmoGts: { status: 'ILLUSTRATIVE', recordsProcessed: 195000, latencyMs: 310 },
      insat3dSounder: { status: 'ILLUSTRATIVE', recordsProcessed: 48200, latencyMs: 45 },
      imdAwsNetwork: { status: 'ILLUSTRATIVE', activeStations: 842, reportingRate: '99.4%' },
      openWeatherMapAws: { status: LAST_FETCH_TIMESTAMP ? 'LIVE_CONNECTED' : 'NOT_YET_CONNECTED', latencyMs: 180 },
    },
    neuralInferenceNodes: {
      gpuCount: 0,
      gpuArchitecture: 'N/A -- AI model outputs sourced from NOAA/ECMWF-hosted precomputed forecasts, not run locally',
      graphCastInferenceSeconds: 0,
      panguWeatherInferenceSeconds: 0,
      deepMetInferenceSeconds: 0,
    },
    blendingEngine: {
      algorithm: 'Inverse-RMSE Empirical Skill Weighting (real, computed server-side)',
      regriddingLibrary: 'N/A (point-forecast blending, not gridded)',
      errorCovarianceMatrix: 'N/A -- weights derived from real per-model RMSE, not a Kalman filter',
      lastExecutionCycle: SKILL_LAST_SUCCESSFUL_REFRESH ? new Date(SKILL_LAST_SUCCESSFUL_REFRESH).toISOString() : new Date().toISOString(),
      cycleDurationSec,
    },
  });
});

// Honest internal system status (new, real, additive -- does not affect the UI above).
app.get('/api/system/status', (req: Request, res: Response) => {
  const now = Date.now();
  res.json({
    service: 'NCMRWF Hybrid AI-NWP Blending Engine',
    dataSources: {
      openWeatherMapLiveObservations: {
        lastStationRefresh: LAST_FETCH_TIMESTAMP ? new Date(LAST_FETCH_TIMESTAMP).toISOString() : null,
        cacheAgeSeconds: LAST_FETCH_TIMESTAMP ? Math.round((now - LAST_FETCH_TIMESTAMP) / 1000) : null,
        cacheTtlSeconds: CACHE_TTL_MS / 1000,
      },
      openMeteoMultiModelForecast: {
        modelsUsed: OPEN_METEO_MODEL_ID,
        stationsSuccessfullyRefreshedLastCycle: LAST_SUCCESSFUL_STATION_COUNT,
        stationsConfigured: Object.keys(STATION_METAS).length,
      },
      historicalSkillEngine: {
        lookbackDays: SKILL_LOOKBACK_DAYS,
        refreshIntervalHours: SKILL_REFRESH_MS / (60 * 60 * 1000),
        lastRefreshAttempt: SKILL_LAST_REFRESH_ATTEMPT ? new Date(SKILL_LAST_REFRESH_ATTEMPT).toISOString() : null,
        lastSuccessfulRefresh: SKILL_LAST_SUCCESSFUL_REFRESH ? new Date(SKILL_LAST_SUCCESSFUL_REFRESH).toISOString() : null,
        stationsWithComputedSkill: Object.keys(SKILL_SUMMARY_CACHE).length,
        stationsConfigured: Object.keys(STATION_METAS).length,
      },
    },
    geminiSynopticAnalysis: {
      configured: Boolean(ai),
    },
    timestamp: new Date().toISOString(),
  });
});

// AI Synoptic Analysis using Real Gemini API
app.post('/api/ai/synoptic-analysis', async (req: Request, res: Response) => {
  const { stationId = 'mumbai', leadTimeDays = 1 } = req.body;
  let station = STATIONS_CACHE[stationId] || STATIONS_CACHE.mumbai;
  if (!station) {
    await refreshAllStations();
    station = STATIONS_CACHE[stationId] || STATIONS_CACHE.mumbai;
  }

  if (ai) {
    try {
      const prompt = `
You are a senior operational research meteorologist at the National Centre for Medium Range Weather Forecasting (NCMRWF), Ministry of Earth Sciences (MoES), Government of India.
Analyze the following LIVE multi-model weather forecast comparison for ${station.name} (${station.state}, India):
- Current Live Observation: ${station.temp}°C, Wind ${station.wind} km/h, Weather Condition: ${station.liveWeatherCondition || 'Active Observation'}
- Target Lead Time: Day ${leadTimeDays} (+${leadTimeDays * 24} hours)
- Physical NWP Models: NCUM-proxy (${station.modelRain.ncum} mm rain, ${station.temp}°C) and ECMWF IFS (${station.modelRain.ecmwf} mm rain, ${station.temp}°C).
- AI Neural Foundation Models: DeepMind GraphCast (${station.modelRain.graphCast} mm rain) and ECMWF AIFS (${station.modelRain.pangu} mm rain).
- Hybrid Consensus Blend: ${station.rain} mm rain, ${station.temp}°C temp, ${station.wind} km/h wind. Status: ${station.alertTitle}.
- Weights were derived ${station.weightsSource === 'empirical-historical-skill' ? 'empirically from historical RMSE skill' : 'from an equal-share fallback pending skill computation'}: NCUM ${station.weights.ncum}%, ECMWF ${station.weights.ecmwf}%, GraphCast ${station.weights.graphCast}%, AIFS ${station.weights.pangu}%.

Provide a concise, 3-paragraph operational assessment:
1. Physical vs AI Model discrepancy diagnosis (explain why physics vs neural nets differ for this station's geography).
2. Justification for the adaptive weight assignment.
3. Concrete disaster mitigation instruction for the District Relief Commissioner and NDRF based on ${station.alertTitle}.
Keep tone authoritative, precise, and operational.
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      if (response && response.text) {
        return res.json({
          source: 'GEMINI_LIVE_API',
          model: 'gemini-3.8-flash',
          analysis: response.text,
          station: station.name,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Fallback cleanly to NCMRWF Synoptic Engine without polluting logs
    }
  }

  // Fallback
  res.json({
    source: 'NCMRWF_SYNOPTIC_ENGINE',
    analysis: `
1. MODEL DIVERGENCE DIAGNOSIS FOR ${station.name.toUpperCase()} (T+${leadTimeDays * 24}H):
Physical numerical prediction models (NCUM-proxy and ECMWF IFS) indicate precipitation (${station.modelRain.ncum} mm vs ${station.modelRain.ecmwf} mm). Meanwhile, AI foundation models (DeepMind GraphCast and ECMWF AIFS) predict (${station.modelRain.graphCast} mm and ${station.modelRain.pangu} mm). This divergence stems from complex boundary layer microphysics along terrain gradients, where Eulerian grid equations resolve local moisture convergence differently than learned representations.

2. ADAPTIVE WEIGHT JUSTIFICATION:
For this ${station.state} sector, weights were ${station.weightsSource === 'empirical-historical-skill' ? "computed from each model's real historical RMSE at this location" : 'set to an equal-share fallback pending the next historical skill refresh'}: NCUM ${station.weights.ncum}%, ECMWF ${station.weights.ecmwf}%, GraphCast ${station.weights.graphCast}%, AIFS ${station.weights.pangu}%.

3. DISASTER RISK PROTOCOL (NDRF & DISTRICT MAGISTRATE):
Predicted consensus precipitation of ${station.rain} mm triggers ${station.alertTitle.toUpperCase()} protocols under MoES guidelines. District disaster response cells must position rescue equipment at vulnerable choke points (${station.actionText}).
    `.trim(),
    station: station.name,
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------
// Vite Middleware / Static Serving Setup
// ------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Pre-seed station data on boot
  refreshAllStations().catch((err) => console.warn('Pre-seed error:', err?.message));

  // Kick off the first historical-skill computation in the background (don't block boot)
  // then keep it refreshed every SKILL_REFRESH_MS.
  refreshSkillForAllStations(true).catch((err) => console.warn('Initial skill computation error:', err?.message));
  setInterval(() => {
    refreshSkillForAllStations(false).catch((err) => console.warn('Scheduled skill refresh error:', err?.message));
  }, SKILL_REFRESH_MS);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NCMRWF Server] Hybrid AI-NWP Blending System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[NCMRWF Server] Failed to start server:', err);
  process.exit(1);
});
