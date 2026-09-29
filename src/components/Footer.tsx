import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#f5f3f0] border-t border-[#DDD4C8] py-6 px-4 sm:px-8 lg:px-10 mt-12 text-[#4c5762] text-[12px]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <div className="font-semibold text-[#1b1c1a]">
            National Centre for Medium Range Weather Forecasting (NCMRWF)
          </div>
          <div>Ministry of Earth Sciences, Government of India &bull; A-50, Sector 62, Noida, UP 201309</div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-label-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2e7d32]"></span>
            <span>Pratyush &amp; Mihir HPC: Operational</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2563eb]"></span>
            <span>Multi-Model AI Blending v4.2</span>
          </span>
          <span>OpenWeatherMap &amp; Open-Meteo Ingested</span>
        </div>
      </div>
    </footer>
  );
};
