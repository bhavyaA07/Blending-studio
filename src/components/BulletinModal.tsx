import React, { useState } from 'react';
import { StationData } from '../types';
import { api } from '../services/apiService';

interface BulletinModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: StationData;
  leadTimeDay: number;
  onShowToast: (msg: string, icon?: string) => void;
}

export const BulletinModal: React.FC<BulletinModalProps> = ({
  isOpen,
  onClose,
  station,
  leadTimeDay,
  onShowToast,
}) => {
  const [isDispatching, setIsDispatching] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const res = await api.dispatchBulletin(
        `NCMRWF/OPS/LIVE-BLEND/2026/0926-${station.id.toUpperCase()}`,
        'NDRF-HQ-NEW-DELHI',
        `${station.state} SEOC`
      );
      if (res && res.status === 'DISPATCHED_AND_LOGGED') {
        onShowToast(
          `Dispatched official bulletin to NDRF HQ & ${station.state} Disaster Management Authority!`,
          'mark_email_read'
        );
      } else {
        onShowToast('Bulletin dispatched to emergency channels.', 'check_circle');
      }
    } catch {
      onShowToast('Failed to transmit bulletin via emergency gateway.', 'error');
    } finally {
      setIsDispatching(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1b1c1a]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#ffffff] rounded-2xl shadow-2xl border border-[#DDD4C8] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#f5f3f0] border-b border-[#DDD4C8] flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#96361d] text-[22px]">assignment</span>
            <span className="font-headline-sm text-[18px] font-bold text-[#1b1c1a]">
              Official MoES / NCMRWF Meteorological Bulletin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff] border border-[#DDD4C8] text-[#1b1c1a] font-semibold text-[12px] hover:bg-[#eae8e5] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8a726c] hover:bg-[#efeeeb] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Printable Bulletin Document */}
        <div className="p-8 overflow-y-auto font-mono text-[12px] leading-relaxed bg-[#ffffff] text-[#1b1c1a]">
          <div className="border-b-2 border-[#1b1c1a] pb-4 mb-6 text-center">
            <div className="text-[14px] font-bold tracking-widest uppercase">
              GOVERNMENT OF INDIA &bull; MINISTRY OF EARTH SCIENCES
            </div>
            <div className="text-[16px] font-headline-sm font-bold text-[#96361d] mt-1">
              NATIONAL CENTRE FOR MEDIUM RANGE WEATHER FORECASTING (NCMRWF)
            </div>
            <div className="text-[11px] text-[#4c5762]">
              A-50, Sector 62, Institutional Area, Noida, Uttar Pradesh 201309
            </div>
          </div>

          <div className="bg-[#f5f3f0] p-4 rounded-lg border border-[#DDD4C8] mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div>
                <b>BULLETIN ID:</b> NCMRWF/OPS/LIVE-BLEND/2026/0926-01
              </div>
              <div>
                <b>TARGET STATION:</b> {station.name.toUpperCase()} (ID: {station.sensorId})
              </div>
              <div>
                <b>TERRAIN REGION:</b> {station.state}
              </div>
            </div>
            <div>
              <div>
                <b>LEAD TIME:</b> T+{leadTimeDay * 24} HOURS (DAY {leadTimeDay})
              </div>
              <div>
                <b>ISSUED AT:</b> {new Date().toUTCString()}
              </div>
              <div>
                <b>DISASTER ALERT:</b> <span className="font-bold text-[#96361d]">{station.alertTitle}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="font-bold text-[#96361d] uppercase border-b border-[#DDD4C8] pb-1 mb-2">
                1. Multi-Model Ingestion Breakdown
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#faf9f7] p-3 rounded border border-[#efeeeb]">
                <div>
                  <span className="text-[#4c5762] block text-[11px]">NCUM (Met-Office):</span>
                  <span className="font-bold text-[14px]">{station.modelRain.ncum} mm</span>
                </div>
                <div>
                  <span className="text-[#4c5762] block text-[11px]">ECMWF IFS (Copernicus):</span>
                  <span className="font-bold text-[14px]">{station.modelRain.ecmwf} mm</span>
                </div>
                <div>
                  <span className="text-[#4c5762] block text-[11px]">DeepMind GraphCast:</span>
                  <span className="font-bold text-[14px]">{station.modelRain.graphCast} mm</span>
                </div>
                <div>
                  <span className="text-[#4c5762] block text-[11px]">Huawei Pangu-Weather:</span>
                  <span className="font-bold text-[14px]">{station.modelRain.pangu} mm</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-[#96361d] uppercase border-b border-[#DDD4C8] pb-1 mb-2">
                2. Dynamically Blended Consensus Values
              </div>
              <div className="grid grid-cols-3 gap-3 bg-[#fff5f2] p-3 rounded border border-[#ffdbd2]">
                <div>
                  <span className="text-[#82270f] block text-[11px]">Blended Rainfall (24h):</span>
                  <span className="font-bold text-[16px] text-[#96361d]">{station.rain} mm</span>
                </div>
                <div>
                  <span className="text-[#82270f] block text-[11px]">2-Meter Temperature:</span>
                  <span className="font-bold text-[16px] text-[#96361d]">{station.temp} °C</span>
                </div>
                <div>
                  <span className="text-[#82270f] block text-[11px]">Surface Wind / Gusts:</span>
                  <span className="font-bold text-[16px] text-[#96361d]">{station.wind} km/h</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-[#96361d] uppercase border-b border-[#DDD4C8] pb-1 mb-2">
                3. Meteorological Rationale
              </div>
              <p className="text-[12px] text-[#1b1c1a] bg-[#faf9f7] p-3 rounded border border-[#efeeeb] leading-normal font-sans">
                {station.reasoning}
              </p>
            </div>

            <div>
              <div className="font-bold text-[#96361d] uppercase border-b border-[#DDD4C8] pb-1 mb-2">
                4. Operational Instructions for District Disaster Cells &amp; NDRF
              </div>
              <p className="text-[12px] text-[#96361d] bg-[#fff5f2] p-3 rounded border border-[#ffdbd2] font-sans font-semibold">
                {station.actionText}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#f5f3f0] border-t border-[#DDD4C8] flex items-center justify-between no-print">
          <div className="text-[11px] text-[#4c5762]">
            Transmitted via NIC-VSAT / National Disaster Management Authority Gateway
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#4c5762] hover:text-[#1b1c1a] text-[13px] font-semibold cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleDispatch}
              disabled={isDispatching}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#96361d] hover:bg-[#b64d32] text-[#ffffff] font-semibold text-[13px] shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isDispatching ? 'sync' : 'send'}
              </span>
              <span>{isDispatching ? 'Transmitting...' : 'Dispatch to NDRF HQ & State SEOC'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
