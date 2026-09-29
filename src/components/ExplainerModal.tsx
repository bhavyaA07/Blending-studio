import React from 'react';

interface ExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExplainerModal: React.FC<ExplainerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1b1c1a]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#ffffff] rounded-2xl shadow-2xl border border-[#DDD4C8] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f5f3f0] border-b border-[#DDD4C8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#96361d] text-[24px]">psychology_alt</span>
            <div>
              <h3 className="font-headline-sm text-[18px] font-bold text-[#1b1c1a]">
                How Multi-Model AI-NWP Blending Works
              </h3>
              <p className="text-[12px] text-[#4c5762]">
                Regime-Conditioned Adaptive Weighting (RCAW) Architecture &bull; MoES / NCMRWF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8a726c] hover:bg-[#efeeeb] hover:text-[#1b1c1a] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#1b1c1a] font-body-sm text-[13px] leading-relaxed">
          {/* Step 1 */}
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-[#96361d] text-[#ffffff] font-bold flex items-center justify-center shrink-0 text-sm">
              1
            </div>
            <div>
              <h4 className="font-headline-sm text-[16px] font-bold text-[#96361d]">
                1. Dual Ingestion: Physics Supercomputers &amp; AI Neural Foundations
              </h4>
              <p className="text-[#4c5762] mt-1">
                The blending system ingests both physical NWP model grids (NCUM 12km &amp; ECMWF IFS 9km) and state-of-the-art AI foundation models (Google DeepMind GraphCast &amp; Huawei Pangu-Weather). Live AWS surface observations from OpenWeatherMap and IMD provide ground-truth calibration.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-[#46645a] text-[#ffffff] font-bold flex items-center justify-center shrink-0 text-sm">
              2
            </div>
            <div>
              <h4 className="font-headline-sm text-[16px] font-bold text-[#46645a]">
                2. Topographic &amp; Regime Classification
              </h4>
              <p className="text-[#4c5762] mt-1">
                India is partitioned into distinctive micro-climatic regimes: Western Ghats Orography, Thar Desert, Gangetic Plains, and Coastal Basins. For complex terrain (e.g. Khasi Hills in Cherrapunji), non-hydrostatic Eulerian physics models are prioritized to capture vertical convective ascent that AI global grids may oversmooth.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-[#b64d32] text-[#ffffff] font-bold flex items-center justify-center shrink-0 text-sm">
              3
            </div>
            <div>
              <h4 className="font-headline-sm text-[16px] font-bold text-[#b64d32]">
                3. Lead-Time Trust Transition (Day 1 to Day 10)
              </h4>
              <p className="text-[#4c5762] mt-1">
                Physics models excel at short lead times (Day 1–3) where boundary-layer thermodynamics dominate. As forecast lead times increase to Day 5–10, physical models suffer rapid error drift. AI models maintain stable synoptic steering, resulting in dynamic weight transfer from physics to AI foundations.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-[#ba1a1a] text-[#ffffff] font-bold flex items-center justify-center shrink-0 text-sm">
              4
            </div>
            <div>
              <h4 className="font-headline-sm text-[16px] font-bold text-[#ba1a1a]">
                4. Automated Hazard Thresholding &amp; Relief Dispatch
              </h4>
              <p className="text-[#4c5762] mt-1">
                When blended consensus parameters exceed predefined safety thresholds (e.g., &gt;64 mm/24h rain, &gt;42°C heatwave, or &gt;55 km/h squalls), the system triggers standardized IMD/MoES color codes (Green, Yellow, Orange, Red) and generates formal disaster advisories for the NDRF and State Relief Commissioners.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#f5f3f0] border-t border-[#DDD4C8] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#96361d] text-[#ffffff] font-semibold text-[13px] rounded-lg hover:bg-[#b64d32] transition-colors cursor-pointer"
          >
            Got It, Close
          </button>
        </div>
      </div>
    </div>
  );
};
