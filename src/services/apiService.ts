import { StationData } from '../types';

export interface BlendingResponse {
  stationId: string;
  stationName: string;
  leadTimeDays: number;
  regime: string;
  effectiveWeights: {
    ncum: number;
    ecmwf: number;
    graphCast: number;
    pangu: number;
  };
  consensus: {
    rain: number;
    temp: number;
    wind: number;
    unitRain: string;
    unitTemp: string;
    unitWind: string;
  };
  skillMetrics: {
    hybridRmse: number;
    baselineRmse: number;
    improvementPercent: number;
    equitableThreatScore: number;
    brierScore: number;
  };
  isLive?: boolean;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  architecture: string;
  leadTimesSupported: string;
  operationalCentres: string[];
  activeEndpoints: string[];
}

export interface HpcTelemetryResponse {
  cluster: string;
  totalCapacityPflops: number;
  activeNodes: number;
  idleNodes: number;
  systemLoadPercent: number;
  ingestionQueues: {
    ncumGrib2: { status: string; recordsProcessed: number; latencyMs: number };
    ecmwfWmoGts: { status: string; recordsProcessed: number; latencyMs: number };
    insat3dSounder: { status: string; recordsProcessed: number; latencyMs: number };
    imdAwsNetwork: { status: string; activeStations: number; reportingRate: string };
    openWeatherMapAws?: { status: string; latencyMs: number };
  };
  neuralInferenceNodes: {
    gpuCount: number;
    gpuArchitecture: string;
    graphCastInferenceSeconds: number;
    panguWeatherInferenceSeconds: number;
    deepMetInferenceSeconds: number;
  };
  blendingEngine: {
    algorithm: string;
    regriddingLibrary: string;
    errorCovarianceMatrix: string;
    lastExecutionCycle: string;
    cycleDurationSec: number;
  };
}

export interface SynopticAiResponse {
  source: string;
  model?: string;
  analysis: string;
  station: string;
  timestamp: string;
}

// REST API Client with real-time backend synchronization
export const api = {
  async getHealth(): Promise<HealthResponse | null> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getStations(force = false): Promise<Record<string, StationData> | null> {
    try {
      const url = force ? '/api/stations?refresh=true' : '/api/stations';
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.stationsMap || null;
    } catch {
      return null;
    }
  },

  async refreshLiveStations(): Promise<Record<string, StationData> | null> {
    try {
      const res = await fetch('/api/stations/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.stationsMap || null;
    } catch {
      return null;
    }
  },

  async computeBlend(
    stationId: string,
    leadTimeDays: number,
    weights: { ncum: number; ecmwf: number; graphCast: number; pangu: number },
    season?: string,
    weatherRegime?: string
  ): Promise<BlendingResponse | null> {
    try {
      const res = await fetch('/api/blend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId, leadTimeDays, weights, season, weatherRegime }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getPipelineScript(): Promise<{
    filename: string;
    language: string;
    cronSchedule: string;
    slurmBatchDirective: string;
    script: string;
  } | null> {
    try {
      const res = await fetch('/api/pipeline/script');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async dispatchBulletin(bulletinId?: string, recipient?: string, recipientState?: string) {
    try {
      const res = await fetch('/api/bulletin/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulletinId, recipient, recipientState }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getHpcStatus(): Promise<HpcTelemetryResponse | null> {
    try {
      const res = await fetch('/api/hpc/status');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async searchLocation(query: string): Promise<Array<{
    id: string;
    name: string;
    state: string;
    country: string;
    countryCode: string;
    lat: number;
    lon: number;
    displayName: string;
  }>> {
    if (!query || query.trim().length < 2) return [];
    try {
      const res = await fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    } catch {
      return [];
    }
  },

  async fetchCustomStation(params: {
    name: string;
    state: string;
    lat: number;
    lon: number;
  }): Promise<{ stationKey: string; station: StationData } | null> {
    try {
      const res = await fetch('/api/location/custom-station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getSynopticAiAnalysis(stationId: string, leadTimeDays: number = 1): Promise<SynopticAiResponse | null> {
    try {
      const res = await fetch('/api/ai/synoptic-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId, leadTimeDays }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};
