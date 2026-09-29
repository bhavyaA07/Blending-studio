export type ViewTab =
  | 'interactive-forecast-studio'
  | 'dynamic-weighting-engine'
  | 'severe-hazard-bulletins'
  | 'system-architecture-hpc';

export type MetricType = 'rain' | 'temp' | 'wind' | 'alert' | 'model_weights';

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
  liveWeatherCondition?: string;
  isLiveFeed?: boolean;
  liveObservedAt?: string;
}
