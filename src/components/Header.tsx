import React from 'react';
import { ViewTab } from '../types';

interface HeaderProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  isLiveActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange, isLiveActive = true }) => {
  const tabs: Array<{ id: ViewTab; label: string; icon: string }> = [
    { id: 'interactive-forecast-studio', label: 'Interactive Forecast Studio', icon: 'map' },
    { id: 'dynamic-weighting-engine', label: 'Dynamic Weighting Engine', icon: 'tune' },
    { id: 'severe-hazard-bulletins', label: 'Severe Hazard Bulletins', icon: 'warning' },
    { id: 'system-architecture-hpc', label: 'HPC Infrastructure & Models', icon: 'dns' },
  ];

  return (
    <header className="w-full bg-[#ffffff] border-b border-[#DDD4C8]/80 sticky top-0 z-40 shadow-xs">
      <div className="w-full px-4 sm:px-8 lg:px-10 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Ministry Brand & Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#96361d] to-[#b64d32] text-[#ffffff] flex items-center justify-center shadow-xs font-bold text-lg select-none">
            <span className="material-symbols-outlined text-[24px]">cyclone</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-[18px] text-[#1b1c1a] font-bold tracking-tight">
                NCMRWF Blending Studio
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#c8eadd] text-[#002117] font-label-sm text-[10px] font-bold border border-[#a1d4c2] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1b5e20] animate-ping"></span>
                <span>MoES Operational</span>
              </span>
            </div>
            <span className="text-[12px] text-[#4c5762] font-body-sm leading-tight">
              Ministry of Earth Sciences, Govt. of India &bull; Hybrid AI-NWP Meteorological Core
            </span>
          </div>
        </div>

        {/* Live System Status Pill & Time */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f5f3f0] border border-[#DDD4C8]/60 text-[12px] font-label-md">
            <span className="text-[#4c5762]">Ingestion Cycle:</span>
            <span className="font-semibold text-[#1b1c1a]">00 UTC Operational Run</span>
            <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#96361d]/10 text-[#96361d] border border-[#96361d]/20 text-[12px] font-semibold">
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            <span>{isLiveActive ? 'Live Real-Time Telemetry' : 'Model Simulation'}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="w-full px-4 sm:px-8 lg:px-10 bg-[#fbf9f6] border-t border-[#DDD4C8]/50 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[#96361d] text-[#96361d] bg-[#ffffff]'
                  : 'border-transparent text-[#4c5762] hover:text-[#1b1c1a] hover:bg-[#efeeeb]'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-[#96361d]' : 'text-[#8a726c]'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
