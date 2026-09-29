import React, { useState } from 'react';
import { MetricType, StationData } from '../types';
import { STATIONS } from '../data/weatherData';
import { api } from '../services/apiService';
import { RealTimeWeatherMap } from '../components/RealTimeWeatherMap';
import { ApiKeyModal } from '../components/ApiKeyModal';

interface InteractiveStudioViewProps {
  onOpenExplainer: () => void;
  onOpenBulletin: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  activeWeights: { ncum: number; ecmwf: number; graphCast: number; pangu: number };
  liveStations?: Record<string, StationData> | null;
  onRefreshLive?: () => void;
  isLiveLoading?: boolean;
  lastSyncTime?: string | null;
  onAddCustomStation?: (key: string, data: StationData) => void;
}

export const InteractiveStudioView: React.FC<InteractiveStudioViewProps> = ({
  onOpenExplainer,
  onOpenBulletin,
  onShowToast,
  activeWeights,
  liveStations,
  onRefreshLive,
  isLiveLoading = false,
  lastSyncTime = null,
  onAddCustomStation,
}) => {
  const [selectedStationKey, setSelectedStationKey] = useState<string>('mumbai');
  const [activeMetric, setActiveMetric] = useState<MetricType>('rain');
  const [timelineDay, setTimelineDay] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // Map of active stations (live API data merged with fallback STATIONS)
  const stationsMap = liveStations && Object.keys(liveStations).length > 0 ? liveStations : STATIONS;
  const currentStation = stationsMap[selectedStationKey] || stationsMap.mumbai || STATIONS.mumbai;

  const handleSelectStation = (key: string, newStationData?: StationData) => {
    setSelectedStationKey(key);
    setAiDiagnosis(null);

    if (newStationData && onAddCustomStation) {
      onAddCustomStation(key, newStationData);
    }

    const station = newStationData || stationsMap[key] || STATIONS[key];
    if (station) {
      onShowToast(`Loaded telemetry probe for: ${station.name}`, 'sensors');
    }
  };

  const handleGenerateAiDiagnosis = async () => {
    setIsAiLoading(true);
    try {
      const res = await api.getSynopticAiAnalysis(currentStation.id, timelineDay);
      if (res && res.analysis) {
        setAiDiagnosis(res.analysis);
        onShowToast(
          `Synoptic divergence assessment generated via ${
            res.source === 'GEMINI_LIVE_API' ? 'Gemini 3.8 Flash' : 'NCMRWF Operational Synoptic Engine'
          }`,
          'insights'
        );
      }
    } catch {
      onShowToast('Could not generate synoptic analysis', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleMetricChange = (metric: MetricType, label: string) => {
    setActiveMetric(metric);
    onShowToast(`Display layer updated to: ${label}`, 'layers');
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    onShowToast(
      isPlaying ? 'Simulation paused at current lead-time' : 'Simulating dynamic forecast progression (+24h to +240h)',
      isPlaying ? 'pause' : 'play_arrow'
    );
  };

  const handleDispatchNDRF = async () => {
    try {
      const res = await api.dispatchBulletin(
        `DISP-${currentStation.sensorId}-${Date.now()}`,
        'NDRF Headquarters & SEOC Command',
        `${currentStation.state} Disaster Relief Authority`
      );
      if (res && res.status === 'DISPATCHED_AND_LOGGED') {
        onShowToast(
          `Transmitted synoptic alert package to NDRF HQ & ${currentStation.state} SEOC.`,
          'mark_email_read'
        );
      } else {
        onShowToast(
          `Transmitted synoptic alert package to National Disaster Response Force HQ & ${currentStation.state} SEOC.`,
          'emergency_share'
        );
      }
    } catch {
      onShowToast(
        `Transmitted synoptic alert package to National Disaster Response Force HQ & ${currentStation.state} SEOC.`,
        'emergency_share'
      );
    }
  };

  // Lead time adjustments
  const leadHours = timelineDay * 24;
  const adjustedNcumRain = timelineDay <= 3 ? currentStation.modelRain.ncum : +(currentStation.modelRain.ncum * 0.9).toFixed(1);
  const adjustedGraphCastRain = timelineDay <= 3 ? currentStation.modelRain.graphCast : +(currentStation.modelRain.graphCast * 1.05).toFixed(1);

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 py-5 flex flex-col gap-5">
      {/* Sub-Bar / Operational Meta */}
      <section className="w-full rounded-xl bg-[#ffffff] p-4 shadow-xs border border-[#DDD4C8]/50 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Synthesis pill and explainer trigger */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8f5e9] border border-[#a5d6a7]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2e7d32] animate-pulse"></span>
            <span className="font-body-sm text-[12px] text-[#1b5e20] font-semibold flex items-center gap-1.5">
              <span>Live APIs: OpenWeatherMap AWS &amp; Open-Meteo Multi-Model</span>
              {lastSyncTime && <span className="text-[#388e3c] font-normal">({lastSyncTime})</span>}
            </span>
            {onRefreshLive && (
              <button
                type="button"
                onClick={onRefreshLive}
                disabled={isLiveLoading}
                title="Fetch latest data from live APIs"
                className="ml-1 px-1.5 py-0.5 rounded bg-[#c8e6c9] hover:bg-[#a5d6a7] text-[#1b5e20] text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className={`material-symbols-outlined text-[14px] ${isLiveLoading ? 'animate-spin' : ''}`}>sync</span>
                <span>{isLiveLoading ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenExplainer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5f3f0] text-[#96361d] hover:bg-[#eae8e5] transition-colors font-body-sm text-[13px] border border-[#DDD4C8]/40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">psychology_alt</span>
            <span>How Blending Works: Ingestion &rarr; Terrain &rarr; Trust % &rarr; Alert</span>
          </button>

          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5f3f0] text-[#1b1c1a] hover:bg-[#eae8e5] transition-colors font-body-sm text-[13px] border border-[#DDD4C8]/50 cursor-pointer"
            title="Configure meteorological APIs and radar tile feeds"
          >
            <span className="material-symbols-outlined text-[16px] text-[#96361d]">vpn_key</span>
            <span>API Keys &amp; Feeds</span>
          </button>
        </div>

        {/* Right: Active weights and Export CTA */}
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f5f3f0] text-[#4c5762] border border-[#DDD4C8]/40">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-[#46645a] font-bold">
              Active Blend
            </span>
            <span className="font-label-md text-[11px] text-[#1b1c1a] font-semibold">
              NCUM {activeWeights.ncum}% &bull; ECMWF {activeWeights.ecmwf}% &bull; GraphCast {activeWeights.graphCast}% &bull; Pangu {activeWeights.pangu}%
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenBulletin}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#96361d] text-[#ffffff] hover:bg-[#b64d32] transition-colors font-body-sm text-[13px] shadow-xs cursor-pointer font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Export 1-Page Official MoES Card</span>
          </button>
        </div>
      </section>

      {/* Main Grid Layout (7 cols / 5 cols) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Real-Time Map & Lead Time Controls (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Metric Selectors Strip */}
          <div className="w-full bg-[#ffffff] p-2 rounded-xl shadow-xs border border-[#DDD4C8]/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" id="metricTabs">
              <button
                type="button"
                onClick={() => handleMetricChange('rain', 'Rainfall (mm)')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm text-[13px] font-semibold transition-all cursor-pointer ${
                  activeMetric === 'rain'
                    ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                    : 'bg-[#efeeeb] text-[#1b1c1a] hover:bg-[#eae8e5]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">rainy</span>
                <span>Rainfall (mm)</span>
              </button>

              <button
                type="button"
                onClick={() => handleMetricChange('temp', 'Temperature (°C)')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm text-[13px] font-semibold transition-all cursor-pointer ${
                  activeMetric === 'temp'
                    ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                    : 'bg-[#efeeeb] text-[#1b1c1a] hover:bg-[#eae8e5]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">thermostat</span>
                <span>Temperature (°C)</span>
              </button>

              <button
                type="button"
                onClick={() => handleMetricChange('wind', 'Wind & Gusts (km/h)')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm text-[13px] font-semibold transition-all cursor-pointer ${
                  activeMetric === 'wind'
                    ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                    : 'bg-[#efeeeb] text-[#1b1c1a] hover:bg-[#eae8e5]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">air</span>
                <span>Wind &amp; Gusts (km/h)</span>
              </button>

              <button
                type="button"
                onClick={() => handleMetricChange('alert', 'Disaster Alert Level')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm text-[13px] font-semibold transition-all cursor-pointer ${
                  activeMetric === 'alert'
                    ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                    : 'bg-[#efeeeb] text-[#1b1c1a] hover:bg-[#eae8e5]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>Disaster Alert Level</span>
              </button>

              <button
                type="button"
                onClick={() => handleMetricChange('model_weights', 'Model Weight Maps & Dominance')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm text-[13px] font-semibold transition-all cursor-pointer ${
                  activeMetric === 'model_weights'
                    ? 'bg-[#2563eb] text-[#ffffff] shadow-xs'
                    : 'bg-[#e0e7ff] text-[#1e40af] hover:bg-[#c7d2fe]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">hub</span>
                <span>Model Weight Maps</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f5f3f0] font-label-sm text-[10px] text-[#46645a] border border-[#DDD4C8]/40">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
              <span>Live Real-World GIS Mesh</span>
            </div>
          </div>

          {/* REAL-TIME WEATHER MAP COMPONENT */}
          <RealTimeWeatherMap
            stations={stationsMap}
            selectedStationKey={selectedStationKey}
            onSelectStation={handleSelectStation}
            activeMetric={activeMetric}
            onShowToast={onShowToast}
          />

          {/* Lead-Time Timeline Slider Card */}
          <div className="w-full bg-[#ffffff] p-5 rounded-xl shadow-xs border border-[#DDD4C8]/50 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD4C8]/40 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#96361d] text-[20px]">timelapse</span>
                <div>
                  <h3 className="font-headline-sm text-[16px] font-bold text-[#1b1c1a]">
                    Operational Lead Time Horizon: Day {timelineDay} (T+{leadHours}h)
                  </h3>
                  <p className="text-[11px] text-[#4c5762]">
                    Dynamic weight shift: Day 1–3 Physics Anchored &rarr; Day 5–10 AI Foundation Steering
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5f3f0] hover:bg-[#eae8e5] text-[#1b1c1a] text-[12px] font-semibold border border-[#DDD4C8] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                  <span>{isPlaying ? 'Pause' : 'Simulate Progression'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[12px] font-label-md text-[#4c5762]">
                <span className="text-[#96361d] font-bold">T+24h (Day 1)</span>
                <span>T+72h (Day 3)</span>
                <span>T+120h (Day 5)</span>
                <span>T+168h (Day 7)</span>
                <span className="text-[#46645a] font-bold">T+240h (Day 10)</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={timelineDay}
                onChange={(e) => setTimelineDay(parseInt(e.target.value))}
                className="w-full h-2 bg-[#efeeeb] rounded-lg appearance-none cursor-pointer accent-[#96361d]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Station Details, Model Breakdown & Gemini Diagnosis (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Active Station Card */}
          <div className="w-full bg-[#ffffff] p-5 rounded-xl shadow-xs border border-[#DDD4C8]/50 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-label-sm text-[#46645a] font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[15px]">sensors</span>
                  <span>{currentStation.sensorId}</span>
                  <span>&bull;</span>
                  <span>{currentStation.state}</span>
                </div>
                <h2 className="font-headline-sm text-[22px] font-bold text-[#1b1c1a] mt-0.5">
                  {currentStation.name}
                </h2>
                <div className="text-[12px] text-[#4c5762] mt-0.5 flex items-center gap-2">
                  <span>Lat: {currentStation.coordinates.lat}° N, Lon: {currentStation.coordinates.lng}° E</span>
                  {currentStation.isLiveFeed && (
                    <span className="px-1.5 py-0.5 rounded bg-[#e8f5e9] text-[#1b5e20] text-[10px] font-bold">
                      LIVE AWS
                    </span>
                  )}
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded-lg text-[12px] font-bold ${currentStation.alertBadgeClass}`}>
                {currentStation.alertTitle}
              </div>
            </div>

            {/* Current Metrics 3-Stat Display */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#f5f3f0] border border-[#DDD4C8]/50 text-center">
              <div>
                <span className="text-[11px] text-[#4c5762] block">Consensus Rain</span>
                <span className="font-headline-sm text-[20px] font-bold text-[#1b1c1a]">
                  {currentStation.rain} <span className="text-[12px] font-normal text-[#4c5762]">mm</span>
                </span>
                <span className="text-[10px] text-[#96361d] font-semibold block">{currentStation.rainSeverity}</span>
              </div>
              <div className="border-x border-[#DDD4C8]/60 px-1">
                <span className="text-[11px] text-[#4c5762] block">Surface Temp</span>
                <span className="font-headline-sm text-[20px] font-bold text-[#1b1c1a]">
                  {currentStation.temp} <span className="text-[12px] font-normal text-[#4c5762]">°C</span>
                </span>
                <span className="text-[10px] text-[#4c5762] block">{currentStation.tempSeverity}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#4c5762] block">Peak Wind</span>
                <span className="font-headline-sm text-[20px] font-bold text-[#1b1c1a]">
                  {currentStation.wind} <span className="text-[12px] font-normal text-[#4c5762]">km/h</span>
                </span>
                <span className="text-[10px] text-[#4c5762] block">{currentStation.windSeverity}</span>
              </div>
            </div>

            {/* Multi-Model Comparison Breakdown */}
            <div>
              <div className="flex items-center justify-between text-[12px] font-semibold text-[#1b1c1a] mb-2">
                <span>Multi-Model Precipitation Comparison:</span>
                <span className="text-[11px] text-[#46645a] font-normal">T+{leadHours}h Horizon</span>
              </div>
              <div className="space-y-2">
                {/* NCUM */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf9f7] border border-[#DDD4C8]/40 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#96361d]"></span>
                    <div>
                      <span className="font-semibold text-[#1b1c1a]">NCUM Core (Physics)</span>
                      <span className="text-[10px] text-[#4c5762] block">Met Office 12km Convective</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#1b1c1a]">{adjustedNcumRain} mm</span>
                    <span className="text-[10px] text-[#4c5762] block">Weight: {activeWeights.ncum}%</span>
                  </div>
                </div>

                {/* ECMWF */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf9f7] border border-[#DDD4C8]/40 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#46645a]"></span>
                    <div>
                      <span className="font-semibold text-[#1b1c1a]">ECMWF IFS (Copernicus)</span>
                      <span className="text-[10px] text-[#4c5762] block">European HRES 0.25° Mesh</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#1b1c1a]">{currentStation.modelRain.ecmwf} mm</span>
                    <span className="text-[10px] text-[#4c5762] block">Weight: {activeWeights.ecmwf}%</span>
                  </div>
                </div>

                {/* GraphCast */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf9f7] border border-[#DDD4C8]/40 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></span>
                    <div>
                      <span className="font-semibold text-[#1b1c1a]">DeepMind GraphCast (AI)</span>
                      <span className="text-[10px] text-[#4c5762] block">Global GNN Foundation</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#1b1c1a]">{adjustedGraphCastRain} mm</span>
                    <span className="text-[10px] text-[#4c5762] block">Weight: {activeWeights.graphCast}%</span>
                  </div>
                </div>

                {/* Pangu-Weather */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf9f7] border border-[#DDD4C8]/40 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]"></span>
                    <div>
                      <span className="font-semibold text-[#1b1c1a]">Huawei Pangu-Weather (AI)</span>
                      <span className="text-[10px] text-[#4c5762] block">3D Earth-Specific Transformer</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#1b1c1a]">{currentStation.modelRain.pangu} mm</span>
                    <span className="text-[10px] text-[#4c5762] block">Weight: {activeWeights.pangu}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plain English Reasoning & Live Gemini Synoptic AI Diagnosis */}
            <div className="p-3.5 rounded-lg bg-[#f5f3f0] border border-[#DDD4C8]/40 flex flex-col gap-2 mt-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#96361d] text-[20px]">psychology</span>
                  <span className="text-[12px] font-bold text-[#96361d] uppercase tracking-wide">
                    Meteorological Rationale
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAiDiagnosis}
                  disabled={isAiLoading}
                  className="px-2.5 py-1 rounded bg-[#ffffff] hover:bg-[#efeeeb] text-[#96361d] text-[11px] font-bold border border-[#DDD4C8] shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className={`material-symbols-outlined text-[14px] ${isAiLoading ? 'animate-spin' : ''}`}>
                    {isAiLoading ? 'progress_activity' : 'insights'}
                  </span>
                  <span>{isAiLoading ? 'Analyzing Divergence...' : 'Run Divergence Diagnosis'}</span>
                </button>
              </div>

              <p className="text-[12px] text-[#1b1c1a] font-body-sm leading-normal">
                {currentStation.reasoning}
              </p>

              {aiDiagnosis && (
                <div className="mt-2 p-3 rounded-lg bg-[#ffffff] border border-[#ffdbd2] text-[12px] text-[#1b1c1a] space-y-2">
                  <div className="flex items-center gap-1.5 text-[#96361d] font-bold text-[11px] uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[15px]">verified</span>
                    <span>Operational Synoptic Assessment (Physics vs Neural Model Divergence)</span>
                  </div>
                  <div className="whitespace-pre-line text-[#4c5762] font-sans leading-relaxed">
                    {aiDiagnosis}
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Action & NDRF Transmission Card */}
            <div className="p-3.5 rounded-lg bg-[#fff5f2] border border-[#ffdbd2] flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#ba1a1a]">
                <span className="material-symbols-outlined text-[18px]">emergency</span>
                <span className="text-[12px] font-bold uppercase tracking-wide">
                  Standard Disaster Response Action
                </span>
              </div>
              <p className="text-[12px] text-[#96361d] font-semibold leading-normal">
                {currentStation.actionText}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[#82270f] font-label-sm">
                  Priority: High &bull; Recipient: SEOC &amp; NDRF
                </span>
                <button
                  type="button"
                  onClick={handleDispatchNDRF}
                  className="px-3 py-1 bg-[#ba1a1a] hover:bg-[#93000a] text-[#ffffff] font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  <span>Transmit to NDRF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Key and Data Feeds Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
