import React, { useState } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [owmKey, setOwmKey] = useState<string>(
    localStorage.getItem('NCMRWF_CUSTOM_OWM_KEY') || 'b7978957fd1a1a7273db5159d3ee6cd0'
  );
  const [radarProvider, setRadarProvider] = useState<string>(
    localStorage.getItem('NCMRWF_RADAR_PROVIDER') || 'rainviewer'
  );
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('NCMRWF_CUSTOM_OWM_KEY', owmKey.trim());
    localStorage.setItem('NCMRWF_RADAR_PROVIDER', radarProvider);
    onShowToast('API configuration updated. Reloading map layers...', 'check_circle');
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 600);
  };

  const handleCopyEnvSnippet = () => {
    const snippet = `# Add this to your project's .env file:
OPENWEATHER_API_KEY="${owmKey.trim() || 'YOUR_OPENWEATHER_KEY'}"`;
    navigator.clipboard.writeText(snippet);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    onShowToast('.env snippet copied to clipboard', 'content_copy');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1b1c1a]/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#ffffff] rounded-2xl shadow-2xl border border-[#DDD4C8] max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#DDD4C8] flex items-center justify-between bg-[#fbf9f6] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fff0eb] border border-[#ffdbd2] flex items-center justify-center text-[#96361d]">
              <span className="material-symbols-outlined text-[24px]">vpn_key</span>
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#1b1c1a]">API Keys &amp; Data Sources Configuration</h2>
              <p className="text-[12px] text-[#57423d]">
                Configure meteorological feeds, radar tile providers, and AI reasoning models
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#eae8e5] text-[#4c5762] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 text-[#1b1c1a] text-[13px]">
          {/* Explanation Alert for the "Need API key" error */}
          <div className="p-4 rounded-xl bg-[#fff4ed] border border-[#ffcdba] flex items-start gap-3">
            <span className="material-symbols-outlined text-[#96361d] text-[22px] shrink-0 mt-0.5">
              info
            </span>
            <div className="space-y-1">
              <div className="font-bold text-[#96361d] text-[14px]">
                Why did the map say "Need API key"?
              </div>
              <p className="text-[#57423d] leading-relaxed">
                The map's precipitation radar was querying <strong>OpenWeatherMap</strong> map tiles. OpenWeatherMap's free tier only covers weather JSON data, but for map tiles it imprints <em>"Need API key"</em> onto the images unless you have a paid Weather Maps 2.0 subscription.
              </p>
              <p className="text-[#57423d] leading-relaxed">
                <strong>Solution:</strong> We switched the default radar to <strong>RainViewer Doppler Radar</strong>, which is <strong>100% free and requires NO API key</strong>! Your map now works cleanly with zero watermarks.
              </p>
            </div>
          </div>

          {/* Active Data Sources Grid */}
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#46645a] mb-3">
              Meteorological Data Pipeline Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* RainViewer */}
              <div className="p-3.5 rounded-xl border border-[#c8e6c9] bg-[#f1f8e9] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1b5e20] text-[13px]">RainViewer Live Radar</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8e6c9] text-[#1b5e20]">
                      NO KEY NEEDED
                    </span>
                  </div>
                  <p className="text-[11px] text-[#33691e] mt-1">
                    Real-time global Doppler radar tile feeds updated every 10 minutes.
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-[#2e7d32] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Active on Map (Default)
                </div>
              </div>

              {/* Open-Meteo */}
              <div className="p-3.5 rounded-xl border border-[#c8e6c9] bg-[#f1f8e9] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1b5e20] text-[13px]">Open-Meteo Ensemble</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8e6c9] text-[#1b5e20]">
                      NO KEY NEEDED
                    </span>
                  </div>
                  <p className="text-[11px] text-[#33691e] mt-1">
                    NCUM, ECMWF IFS, GFS, and ICON numerical weather prediction models.
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-[#2e7d32] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Active Backend Stream
                </div>
              </div>

              {/* OpenWeatherMap */}
              <div className="p-3.5 rounded-xl border border-[#DDD4C8] bg-[#fbf9f6] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1b1c1a] text-[13px]">OpenWeatherMap AWS</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e0e0e0] text-[#424242]">
                      KEY CONFIGURED
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57423d] mt-1">
                    Fetches real-time AWS ground weather observations and station pressure.
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-[#46645a] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">sensors</span>
                  Active for Ground Station Telemetry
                </div>
              </div>

              {/* NCMRWF Synoptic Engine */}
              <div className="p-3.5 rounded-xl border border-[#c8eadd] bg-[#f0f9f5] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#002117] text-[13px]">NCMRWF Synoptic Engine</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8eadd] text-[#002117]">
                      OPERATIONAL
                    </span>
                  </div>
                  <p className="text-[11px] text-[#2c4d41] mt-1">
                    Automated divergence assessment comparing physics equations vs neural foundation models.
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-[#1b5e20] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Built-in Deterministic Atmospheric Core
                </div>
              </div>
            </div>
          </div>

          {/* Radar Provider Switch */}
          <div className="border-t border-[#DDD4C8] pt-4">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#46645a] mb-2">
              Precipitation Radar Tile Engine
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  radarProvider === 'rainviewer'
                    ? 'border-[#96361d] bg-[#fff5f2] ring-1 ring-[#96361d]'
                    : 'border-[#DDD4C8] hover:bg-[#fbf9f6]'
                }`}
              >
                <input
                  type="radio"
                  name="radarProvider"
                  value="rainviewer"
                  checked={radarProvider === 'rainviewer'}
                  onChange={() => setRadarProvider('rainviewer')}
                  className="mt-1 text-[#96361d] focus:ring-[#96361d]"
                />
                <div>
                  <div className="font-bold text-[13px] text-[#1b1c1a]">RainViewer (Recommended)</div>
                  <div className="text-[11px] text-[#57423d] mt-0.5">
                    100% Free, no API key needed, real-time Doppler radar tiles without watermarks.
                  </div>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  radarProvider === 'openweathermap'
                    ? 'border-[#96361d] bg-[#fff5f2] ring-1 ring-[#96361d]'
                    : 'border-[#DDD4C8] hover:bg-[#fbf9f6]'
                }`}
              >
                <input
                  type="radio"
                  name="radarProvider"
                  value="openweathermap"
                  checked={radarProvider === 'openweathermap'}
                  onChange={() => setRadarProvider('openweathermap')}
                  className="mt-1 text-[#96361d] focus:ring-[#96361d]"
                />
                <div>
                  <div className="font-bold text-[13px] text-[#1b1c1a]">OpenWeatherMap Radar</div>
                  <div className="text-[11px] text-[#57423d] mt-0.5">
                    Requires a paid or Weather Maps 2.0 activated key. Free keys display a watermark.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Where to add keys section */}
          <div className="border-t border-[#DDD4C8] pt-4 space-y-3">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#46645a]">
              Where to Add or Update Keys
            </h3>
            <div className="p-4 rounded-xl bg-[#f5f3f0] border border-[#DDD4C8] space-y-2">
              <div className="text-[12px] font-semibold text-[#1b1c1a]">
                Option 1: Project Environment File (Permanent)
              </div>
              <p className="text-[12px] text-[#57423d]">
                Open the <code>.env</code> file in the root directory and set:
              </p>
              <div className="bg-[#1b1c1a] text-[#86efac] p-3 rounded-lg font-mono text-[11px] flex items-center justify-between overflow-x-auto">
                <span>
                  OPENWEATHER_API_KEY="{owmKey || 'your_openweather_key'}"
                </span>
                <button
                  type="button"
                  onClick={handleCopyEnvSnippet}
                  className="ml-3 px-2 py-1 rounded bg-[#333] hover:bg-[#444] text-[#ffffff] text-[10px] cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[12px]">
                    {copiedKey ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="text-[12px] font-semibold text-[#1b1c1a] pt-2">
                Option 2: In-App Quick Override
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#57423d] font-medium block">
                  OpenWeatherMap API Key (from <a href="https://home.openweathermap.org/api_keys" target="_blank" rel="noreferrer" className="text-[#96361d] underline">openweathermap.org</a>):
                </label>
                <input
                  type="text"
                  value={owmKey}
                  onChange={(e) => setOwmKey(e.target.value)}
                  placeholder="Enter 32-character hex key (e.g. b7978957fd1a1a7273db5159d3ee6cd0)"
                  className="w-full px-3 py-2 rounded-lg border border-[#DDD4C8] bg-[#ffffff] font-mono text-[12px] text-[#1b1c1a] focus:outline-none focus:ring-2 focus:ring-[#96361d]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DDD4C8] bg-[#fbf9f6] flex items-center justify-between sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#DDD4C8] text-[#4c5762] hover:bg-[#eae8e5] text-[12px] font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#96361d] text-[#ffffff] hover:bg-[#b64d32] text-[12px] font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>Save &amp; Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
