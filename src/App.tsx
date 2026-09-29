import React, { useState, useEffect } from 'react';
import { ViewTab, StationData } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ExplainerModal } from './components/ExplainerModal';
import { BulletinModal } from './components/BulletinModal';
import { Toast } from './components/Toast';
import { InteractiveStudioView } from './views/InteractiveStudioView';
import { DynamicWeightingView } from './views/DynamicWeightingView';
import { SevereHazardsView } from './views/SevereHazardsView';
import { ArchitectureView } from './views/ArchitectureView';
import { STATIONS } from './data/weatherData';
import { api } from './services/apiService';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ViewTab>('interactive-forecast-studio');
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [isBulletinOpen, setIsBulletinOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);

  // Live stations state populated from backend
  const [liveStations, setLiveStations] = useState<Record<string, StationData> | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Active ensemble weights
  const [activeWeights] = useState({
    ncum: 32,
    ecmwf: 30,
    graphCast: 23,
    pangu: 15,
  });

  const triggerToast = (message: string, icon = 'info') => {
    setToast({ message, icon });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Fetch live station telemetry on boot
  const loadLiveStations = async (force = false) => {
    setIsLiveLoading(true);
    try {
      const data = force ? await api.refreshLiveStations() : await api.getStations();
      if (data && Object.keys(data).length > 0) {
        setLiveStations((prev) => ({ ...prev, ...data }));
        setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        if (force) {
          triggerToast('Synchronized live weather metrics with OpenWeatherMap AWS & Open-Meteo', 'cloud_sync');
        }
      }
    } catch {
      // Fallback gracefully to default STATIONS
    } finally {
      setIsLiveLoading(false);
    }
  };

  useEffect(() => {
    loadLiveStations();
  }, []);

  const handleAddCustomStation = (key: string, data: StationData) => {
    setLiveStations((prev) => ({
      ...prev,
      [key]: data,
    }));
  };

  // Active station for bulletin modal
  const stationsMap = liveStations || STATIONS;
  const bulletinStation = stationsMap.mumbai || STATIONS.mumbai;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
      {/* Global Application Header */}
      <Header currentTab={currentTab} onTabChange={setCurrentTab} isLiveActive={true} />

      {/* Main Tab Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {currentTab === 'interactive-forecast-studio' && (
          <InteractiveStudioView
            onOpenExplainer={() => setIsExplainerOpen(true)}
            onOpenBulletin={() => setIsBulletinOpen(true)}
            onShowToast={triggerToast}
            activeWeights={activeWeights}
            liveStations={liveStations}
            onRefreshLive={() => loadLiveStations(true)}
            isLiveLoading={isLiveLoading}
            lastSyncTime={lastSyncTime}
            onAddCustomStation={handleAddCustomStation}
          />
        )}

        {currentTab === 'dynamic-weighting-engine' && (
          <DynamicWeightingView onShowToast={triggerToast} stations={stationsMap} />
        )}

        {currentTab === 'severe-hazard-bulletins' && (
          <SevereHazardsView onShowToast={triggerToast} stations={stationsMap} />
        )}

        {currentTab === 'system-architecture-hpc' && (
          <ArchitectureView onShowToast={triggerToast} />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Explainer Modal */}
      <ExplainerModal isOpen={isExplainerOpen} onClose={() => setIsExplainerOpen(false)} />

      {/* Severe Weather Bulletin Modal */}
      <BulletinModal
        isOpen={isBulletinOpen}
        onClose={() => setIsBulletinOpen(false)}
        station={bulletinStation}
        leadTimeDay={1}
        onShowToast={triggerToast}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.icon}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
