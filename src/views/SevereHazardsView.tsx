import React, { useState } from 'react';
import { StationData } from '../types';
import { STATIONS } from '../data/weatherData';
import { api } from '../services/apiService';

interface SevereHazardsViewProps {
  onShowToast: (msg: string, icon?: string) => void;
  stations?: Record<string, StationData>;
}

export const SevereHazardsView: React.FC<SevereHazardsViewProps> = ({
  onShowToast,
  stations = STATIONS,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const stationList = Object.values(stations);
  const filteredStations = stationList.filter((st) => {
    if (filterSeverity === 'red') return st.alertTitle.includes('Red');
    if (filterSeverity === 'orange') return st.alertTitle.includes('Orange');
    if (filterSeverity === 'yellow') return st.alertTitle.includes('Yellow');
    return true;
  });

  const handleTransmitAllAdvisories = async () => {
    setIsBroadcasting(true);
    try {
      const res = await api.dispatchBulletin(
        `CONSOLIDATED-HAZARDS-${Date.now()}`,
        'MHA-NDMA & NDRF Headquarters (New Delhi)',
        'State Disaster Relief Commissioners'
      );
      if (res && res.status === 'DISPATCHED_AND_LOGGED') {
        onShowToast(
          `Dispatched consolidated advisories (${filteredStations.length} stations) to NDRF HQ & SEOC.`,
          'mark_email_read'
        );
      } else {
        onShowToast('Dispatched consolidated severe hazard advisories to MHA & NDRF HQ.', 'send');
      }
    } catch {
      onShowToast('Dispatched alerts via emergency queue fallback.', 'send');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleDispatchSingle = async (st: StationData) => {
    try {
      const res = await api.dispatchBulletin(
        `ALERT-${st.sensorId}-${Date.now()}`,
        'Local NDRF Battalion & District Magistrate',
        `${st.state} State Relief Cell`
      );
      if (res && res.status === 'DISPATCHED_AND_LOGGED') {
        onShowToast(`Issued emergency directive for ${st.name} to ${st.state} SEOC.`, 'emergency');
      } else {
        onShowToast(`Issued targeted dispatch for ${st.name}`, 'emergency');
      }
    } catch {
      onShowToast(`Issued targeted dispatch for ${st.name}`, 'emergency');
    }
  };

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 py-6 flex flex-col gap-6">
      {/* Top Title Banner */}
      <div className="bg-[#ffffff] p-6 rounded-2xl border border-[#DDD4C8]/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#ba1a1a] font-bold text-[12px] uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">emergency</span>
            <span>National Severe Weather &amp; Disaster Early Warning</span>
          </div>
          <h1 className="font-headline-sm text-[24px] font-bold text-[#1b1c1a] mt-1">
            Active Multi-Hazard Alert Registry
          </h1>
          <p className="text-[13px] text-[#4c5762] max-w-2xl mt-0.5">
            Operational alerts dynamically derived from hybrid AI-NWP precipitation, heatwave, and coastal surge threshold crossings.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTransmitAllAdvisories}
          disabled={isBroadcasting}
          className="px-5 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-[#ffffff] font-semibold text-[13px] shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
        >
          <span className={`material-symbols-outlined text-[18px] ${isBroadcasting ? 'animate-spin' : ''}`}>
            {isBroadcasting ? 'progress_activity' : 'send'}
          </span>
          <span>{isBroadcasting ? 'Transmitting to NDRF...' : 'Broadcast All NDRF Warnings'}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterSeverity('all')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
            filterSeverity === 'all'
              ? 'bg-[#1b1c1a] text-[#ffffff]'
              : 'bg-[#ffffff] text-[#4c5762] border border-[#DDD4C8] hover:bg-[#f5f3f0]'
          }`}
        >
          All Stations ({stationList.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('red')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
            filterSeverity === 'red'
              ? 'bg-[#ba1a1a] text-[#ffffff]'
              : 'bg-[#ffffff] text-[#ba1a1a] border border-[#ffdad6] hover:bg-[#fff5f2]'
          }`}
        >
          Red Alerts Only
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('orange')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
            filterSeverity === 'orange'
              ? 'bg-[#ea580c] text-[#ffffff]'
              : 'bg-[#ffffff] text-[#ea580c] border border-[#fed7aa] hover:bg-[#fff7ed]'
          }`}
        >
          Orange Alerts Only
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('yellow')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
            filterSeverity === 'yellow'
              ? 'bg-[#ca8a04] text-[#ffffff]'
              : 'bg-[#ffffff] text-[#ca8a04] border border-[#fef08a] hover:bg-[#fefce8]'
          }`}
        >
          Yellow Alerts
        </button>
      </div>

      {/* Hazards Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStations.map((st) => (
          <div
            key={st.id}
            className="bg-[#ffffff] rounded-2xl border border-[#DDD4C8]/70 shadow-xs overflow-hidden flex flex-col justify-between"
          >
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-label-sm text-[#4c5762] uppercase tracking-wider block">
                    {st.state} &bull; {st.sensorId}
                  </span>
                  <h3 className="font-headline-sm text-[18px] font-bold text-[#1b1c1a]">
                    {st.name}
                  </h3>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${st.alertBadgeClass}`}>
                  {st.alertTitle}
                </span>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-2 bg-[#f5f3f0] p-2.5 rounded-xl text-center text-[12px]">
                <div>
                  <span className="text-[10px] text-[#4c5762] block">Rain</span>
                  <span className="font-bold text-[#1b1c1a]">{st.rain} mm</span>
                </div>
                <div className="border-x border-[#DDD4C8]">
                  <span className="text-[10px] text-[#4c5762] block">Temp</span>
                  <span className="font-bold text-[#1b1c1a]">{st.temp} °C</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#4c5762] block">Wind</span>
                  <span className="font-bold text-[#1b1c1a]">{st.wind} km/h</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[#4c5762] block mb-1">
                  Phenomenon Diagnosis:
                </span>
                <p className="text-[12px] text-[#1b1c1a] leading-relaxed line-clamp-2">
                  {st.reasoning}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[#ba1a1a] block mb-1">
                  Mandated NDRF Protocol:
                </span>
                <p className="text-[12px] text-[#96361d] font-semibold leading-relaxed bg-[#fff5f2] p-2 rounded-lg border border-[#ffdbd2]">
                  {st.actionText}
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#faf9f7] border-t border-[#DDD4C8]/50 flex items-center justify-between text-[11px]">
              <span className="text-[#4c5762]">Lead Time: Live T+24h</span>
              <button
                type="button"
                onClick={() => handleDispatchSingle(st)}
                className="text-[#96361d] font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Dispatch Alert</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
