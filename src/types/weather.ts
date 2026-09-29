export type ModelCategory = 'physical_nwp' | 'ai_ml' | 'ensemble' | 'hybrid';

export interface ModelSource {
  id: string;
  name: string;
  category: ModelCategory;
  provider: string;
  resolution: string;
  updateFreq: string;
  description: string;
  keyStrengths: string[];
  color: string;
}

export type LeadTimeHours = 24 | 48 | 72 | 96 | 120 | 144 | 168 | 192 | 216 | 240;

export type WeatherVariable = 'rainfall' | 'temperature' | 'wind' | 'hazard';

export type WeatherRegime = 
  | 'monsoon_trough' 
  | 'cyclone_system' 
  | 'heatwave' 
  | 'western_disturbance' 
  | 'break_monsoon';

export type HazardLevel = 'green' | 'yellow' | 'orange' | 'red';

export interface RegionData {
  id: string;
  name: string;
  shortName: string;
  terrain: 'orographic' | 'plains' | 'plateau' | 'coastal' | 'himalayan';
  center: [number, number]; // [lat, lon]
  description: string;
}

export interface StationData {
  id: string;
  name: string;
  subdivision: string;
  state: string;
  lat: number;
  lon: number;
  elevation: number;
  forecasts: Record<string, {
    rainfall: number;      // mm / 24h
    tempMax: number;       // °C
    tempMin: number;       // °C
    windSpeed: number;     // km/h
    windDir: number;       // degrees
    hazardLevel: HazardLevel;
  }>;
  blended: {
    rainfall: number;
    tempMax: number;
    tempMin: number;
    windSpeed: number;
    windDir: number;
    hazardLevel: HazardLevel;
    confidence: number;    // %
    weights: Record<string, number>;
  };
  observed?: {
    rainfall: number;
    tempMax: number;
    windSpeed: number;
  };
}

export interface GridPoint {
  id: string;
  lat: number;
  lon: number;
  regionId: string;
  terrain: string;
  rainfall: Record<string, number>; // modelId -> mm
  tempMax: Record<string, number>;  // modelId -> °C
  windSpeed: Record<string, number>;// modelId -> km/h
  blendedRain: number;
  blendedTemp: number;
  blendedWind: number;
  hazard: HazardLevel;
  weights: Record<string, number>;
}

export interface VerificationMetrics {
  modelId: string;
  modelName: string;
  category: ModelCategory;
  color: string;
  rmseRain: number;        // Root Mean Square Error (mm) - lower is better
  rmseTemp: number;        // RMSE (°C) - lower is better
  rmseWind: number;        // RMSE (km/h) - lower is better
  etsHeavyRain: number;    // Equitable Threat Score (>64.5mm) - higher is better (0-1)
  etsVeryHeavy: number;    // ETS (>115.5mm)
  crps: number;            // Continuous Ranked Probability Score - lower is better
  brierScore: number;      // Probabilistic Brier Score - lower is better
  correlationR: number;    // Pearson correlation coefficient (0-1)
  biasRatio: number;       // Frequency bias ratio (1.0 = unbiased)
}

export interface LeadTimeSkill {
  leadTime: LeadTimeHours;
  modelSkills: Record<string, {
    rmse: number;
    ets: number;
    weight: number;
  }>;
}

export interface ExtremeWeatherEvent {
  id: string;
  title: string;
  type: 'heavy_rainfall' | 'heatwave' | 'cyclone_wind' | 'flash_flood';
  subdivision: string;
  level: HazardLevel;
  peakValue: string;
  leadTimeRange: string;
  populationImpact: string;
  recommendedAction: string;
  modelConsensus: number; // 0-100%
  drivingModel: string;
  ndrfActionPlan: string;
}

export interface BlendingSettings {
  algorithm: 'rcaw' | 'bma' | 'xgboost' | 'dynamic_kalman' | 'uniform';
  regime: WeatherRegime;
  historicalWindowDays: 30 | 60 | 90;
  orographicCorrection: boolean;
  aiWeightCapMediumRange: number; // 0.1 - 0.9
  extremeEventBoost: boolean;
  varianceThreshold: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  status: 'completed' | 'processing' | 'queued' | 'error';
  timestamp: string;
  durationMs: number;
  recordsCount: number;
  details: string;
}
