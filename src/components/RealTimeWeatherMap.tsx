import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MetricType, StationData } from '../types';
import { api } from '../services/apiService';
import { ApiKeyModal } from './ApiKeyModal';

interface RealTimeWeatherMapProps {
  stations: Record<string, StationData>;
  selectedStationKey: string;
  onSelectStation: (key: string, newStationData?: StationData) => void;
  activeMetric: MetricType;
  onShowToast: (msg: string, icon?: string) => void;
}

type MapTileProvider = 'streets' | 'osm' | 'voyager' | 'satellite';

// Local neighborhood observation nodes for granular city micro-climate visualization
const CITY_NEIGHBORHOODS: Record<
  string,
  Array<{ id: string; name: string; tag: string; lat: number; lng: number; offsetRain: number; offsetTemp: number }>
> = {
  mumbai: [
    { id: 'mum-santacruz', name: 'Santacruz Airport AWS', tag: 'Aviation Weather', lat: 19.0896, lng: 72.8656, offsetRain: 4.2, offsetTemp: 0.5 },
    { id: 'mum-colaba', name: 'Colaba Observatory', tag: 'Marine Coast', lat: 18.9067, lng: 72.8147, offsetRain: -2.1, offsetTemp: -0.8 },
    { id: 'mum-bandra', name: 'Bandra West Ward', tag: 'Urban Coastal', lat: 19.0544, lng: 72.8402, offsetRain: 1.5, offsetTemp: 0.2 },
    { id: 'mum-powai', name: 'Powai Lake Basin', tag: 'Inland High-Moisture', lat: 19.1176, lng: 72.9060, offsetRain: 8.4, offsetTemp: -0.4 },
    { id: 'mum-thane', name: 'Thane Creek Gateway', tag: 'Micro-basin AWS', lat: 19.2183, lng: 72.9781, offsetRain: 11.2, offsetTemp: 1.1 },
    { id: 'mum-navi', name: 'Navi Mumbai Belapur', tag: 'Industrial Corridor', lat: 19.0178, lng: 73.0421, offsetRain: 6.0, offsetTemp: 1.4 },
  ],
  delhi: [
    { id: 'del-safdarjung', name: 'Safdarjung Base AWS', tag: 'Primary Synoptic', lat: 28.5833, lng: 77.2167, offsetRain: 0, offsetTemp: 0 },
    { id: 'del-palam', name: 'Palam IGI Airport AWS', tag: 'Aviation Micro-grid', lat: 28.5665, lng: 77.1031, offsetRain: -0.5, offsetTemp: 0.8 },
    { id: 'del-lodhi', name: 'Lodhi Road Station', tag: 'Central Observatory', lat: 28.5916, lng: 77.2273, offsetRain: 0.2, offsetTemp: -0.3 },
    { id: 'del-cp', name: 'Connaught Place Core', tag: 'Urban Heat Island', lat: 28.6315, lng: 77.2167, offsetRain: 0, offsetTemp: 1.8 },
    { id: 'del-ridge', name: 'Delhi Ridge Station', tag: 'Forested Canopy', lat: 28.6942, lng: 77.1554, offsetRain: 1.2, offsetTemp: -1.2 },
    { id: 'del-noida', name: 'Noida NCMRWF Supercomputer', tag: 'MoES HPC Site', lat: 28.6253, lng: 77.3621, offsetRain: 0.8, offsetTemp: 0.4 },
  ],
  bengaluru: [
    { id: 'blr-city', name: 'Bengaluru City Observatory', tag: 'Central IMD', lat: 12.9716, lng: 77.5946, offsetRain: 0, offsetTemp: 0 },
    { id: 'blr-kia', name: 'Kempegowda Airport AWS', tag: 'Aviation Corridor', lat: 13.1986, lng: 77.7066, offsetRain: 3.5, offsetTemp: -1.5 },
    { id: 'blr-koramangala', name: 'Koramangala Basin', tag: 'Valley Flood Watch', lat: 12.9352, lng: 77.6245, offsetRain: 5.1, offsetTemp: 0.6 },
    { id: 'blr-whitefield', name: 'Whitefield East Node', tag: 'IT Corridor AWS', lat: 12.9698, lng: 77.7500, offsetRain: 2.2, offsetTemp: 0.9 },
    { id: 'blr-ecity', name: 'Electronic City South', tag: 'Industrial Micro-grid', lat: 12.8452, lng: 77.6602, offsetRain: -1.0, offsetTemp: 1.1 },
  ],
  kolkata: [
    { id: 'ccu-alipore', name: 'Alipore Meteorological Office', tag: 'Regional IMD HQ', lat: 22.5333, lng: 88.3333, offsetRain: 0, offsetTemp: 0 },
    { id: 'ccu-dumdum', name: 'Dum Dum Airport AWS', tag: 'Aviation Station', lat: 22.6547, lng: 88.4467, offsetRain: 4.8, offsetTemp: 0.4 },
    { id: 'ccu-saltlake', name: 'Salt Lake Sector V', tag: 'East Wetland Zone', lat: 22.5800, lng: 88.4200, offsetRain: 2.1, offsetTemp: 0.2 },
    { id: 'ccu-howrah', name: 'Howrah Riverfront', tag: 'Hooghly Estuary', lat: 22.5850, lng: 88.3426, offsetRain: 1.4, offsetTemp: -0.6 },
  ],
  ahmedabad: [
    { id: 'amd-sabarmati', name: 'Sabarmati Riverfront', tag: 'Urban Waterfront', lat: 23.0338, lng: 72.5850, offsetRain: 0, offsetTemp: 0 },
    { id: 'amd-airport', name: 'Sardar Patel Airport AWS', tag: 'Aviation Radar', lat: 23.0734, lng: 72.6266, offsetRain: -0.4, offsetTemp: 0.6 },
    { id: 'amd-sg', name: 'SG Highway West Node', tag: 'High-expansion Belt', lat: 23.0525, lng: 72.5110, offsetRain: 0.2, offsetTemp: 1.1 },
  ],
  bhubaneswar: [
    { id: 'bbi-central', name: 'Bhubaneswar Central IMD', tag: 'Cyclone Early Warning', lat: 20.2961, lng: 85.8245, offsetRain: 0, offsetTemp: 0 },
    { id: 'bbi-cuttack', name: 'Cuttack Mahanadi Basin', tag: 'Riverine AWS', lat: 20.4625, lng: 85.8830, offsetRain: 3.2, offsetTemp: -0.4 },
    { id: 'bbi-airport', name: 'Biju Patnaik Airport AWS', tag: 'Coastal Radar Site', lat: 20.2444, lng: 85.8178, offsetRain: 1.1, offsetTemp: 0.3 },
  ],
  cherrapunji: [
    { id: 'shl-sohra', name: 'Cherrapunji Sohra AWS', tag: 'High-Orographic Cliff', lat: 25.2986, lng: 91.7324, offsetRain: 0, offsetTemp: 0 },
    { id: 'shl-shillong', name: 'Shillong Peak Station', tag: 'Pine Ridge AWS', lat: 25.5412, lng: 91.8687, offsetRain: -45.0, offsetTemp: -3.2 },
    { id: 'shl-mawsynram', name: 'Mawsynram Station', tag: 'Record Precipitation Gauge', lat: 25.2978, lng: 91.5828, offsetRain: 15.0, offsetTemp: -0.8 },
  ],
};

export const RealTimeWeatherMap: React.FC<RealTimeWeatherMapProps> = ({
  stations,
  selectedStationKey,
  onSelectStation,
  activeMetric,
  onShowToast,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const radarTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Default to High-Detail City Streets
  const [activeTile, setActiveTile] = useState<MapTileProvider>('streets');
  const [showRadar, setShowRadar] = useState<boolean>(false);
  const [radarOpacity, setRadarOpacity] = useState<number>(0.4);
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [radarProvider, setRadarProvider] = useState<string>(() => {
    return localStorage.getItem('NCMRWF_RADAR_PROVIDER') || 'rainviewer';
  });
  const [rainViewerPath, setRainViewerPath] = useState<string>('');
  const [rainViewerHost, setRainViewerHost] = useState<string>('https://tilecache.rainviewer.com');
  const [radarTimestamp, setRadarTimestamp] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    name: string;
    state: string;
    country: string;
    lat: number;
    lon: number;
    displayName: string;
  }>>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isLocatingPoint, setIsLocatingPoint] = useState<boolean>(false);

  // Quick pick cities
  const quickPicks = [
    { name: 'Mumbai', lat: 19.076, lon: 72.8777, state: 'Maharashtra', country: 'India', key: 'mumbai' },
    { name: 'New Delhi', lat: 28.6139, lon: 77.209, state: 'Delhi NCR', country: 'India', key: 'delhi' },
    { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, state: 'Karnataka', country: 'India', key: 'bengaluru' },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639, state: 'West Bengal', country: 'India', key: 'kolkata' },
    { name: 'Cherrapunji', lat: 25.2986, lon: 91.7324, state: 'Meghalaya', country: 'India', key: 'cherrapunji' },
    { name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245, state: 'Odisha', country: 'India', key: 'bhubaneswar' },
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, state: 'Gujarat', country: 'India', key: 'ahmedabad' },
  ];

  // High-Resolution City Map Providers
  const tileLayers: Record<MapTileProvider, { label: string; url: string; attribution: string; maxZoom: number }> = {
    streets: {
      label: 'City Streets',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; High-Detail World Street Map',
      maxZoom: 19,
    },
    osm: {
      label: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    },
    voyager: {
      label: 'Urban Voyager',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      maxZoom: 19,
    },
    satellite: {
      label: 'Satellite Hybrid',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18,
    },
  };

  // Fetch RainViewer radar timestamps on load (100% Free, NO API Key needed!)
  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((res) => res.json())
      .then((data) => {
        if (data?.radar?.past?.length > 0) {
          const latest = data.radar.past[data.radar.past.length - 1];
          setRainViewerHost(data.host || 'https://tilecache.rainviewer.com');
          setRainViewerPath(latest.path);
          const date = new Date(latest.time * 1000);
          setRadarTimestamp(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      })
      .catch(() => {
        setRainViewerPath('/v2/radar/nowcast_latest');
      });
  }, []);

  // Compute radar tile URL based on active provider
  const getRadarTileUrl = (path: string, host: string, provider: string) => {
    if (provider === 'openweathermap') {
      const key = localStorage.getItem('NCMRWF_CUSTOM_OWM_KEY') || 'b7978957fd1a1a7273db5159d3ee6cd0';
      return `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${key}`;
    }
    // RainViewer (No API key needed, zero watermark)
    if (path) {
      return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
    }
    return 'https://tilecache.rainviewer.com/v2/radar/nowcast_latest/256/{z}/{x}/{y}/2/1_1.png';
  };

  // 1. Initialize Leaflet Map centered on City Scale (Zoom 12)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center directly on active station's city coordinates (Zoom 12 for street-level view)
    const initialStation = stations[selectedStationKey] || stations.mumbai;
    const initialLat = initialStation?.coordinates?.lat || 19.076;
    const initialLng = initialStation?.coordinates?.lng || 72.8777;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12, // PROPER CITY SCALE!
      zoomControl: false,
      attributionControl: false,
    });

    // Track zoom level for indicator
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Add initial high-detail street base tile layer
    const baseLayer = L.tileLayer(tileLayers.streets.url, {
      attribution: tileLayers.streets.attribution,
      maxZoom: tileLayers.streets.maxZoom,
    }).addTo(map);
    baseTileLayerRef.current = baseLayer;

    // Add precipitation radar overlay layer (RainViewer by default - No API Key needed!)
    const initialRadarUrl = getRadarTileUrl(rainViewerPath, rainViewerHost, radarProvider);
    const radarLayer = L.tileLayer(initialRadarUrl, {
      opacity: radarOpacity,
      maxZoom: 18,
      zIndex: 5,
    });
    if (showRadar) {
      radarLayer.addTo(map);
    }
    radarTileLayerRef.current = radarLayer;

    // Layer group for station & neighborhood markers
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    // Handle map click to query arbitrary location
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setIsLocatingPoint(true);
      onShowToast(`Probing multi-model weather mesh at Lat: ${lat.toFixed(3)}°, Lon: ${lng.toFixed(3)}°...`, 'travel_explore');

      try {
        const customRes = await api.fetchCustomStation({
          name: `Lat ${lat.toFixed(2)} / Lon ${lng.toFixed(2)}`,
          state: 'Field Inspection Sector',
          lat: parseFloat(lat.toFixed(4)),
          lon: parseFloat(lng.toFixed(4)),
        });

        if (customRes && customRes.station) {
          onSelectStation(customRes.stationKey, customRes.station);
          onShowToast(`Synthesized AI-NWP forecast for coordinates: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`, 'verified');
        }
      } catch {
        onShowToast('Could not ingest forecast for clicked location', 'error');
      } finally {
        setIsLocatingPoint(false);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Handle Base Tile Layer Switch
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    const config = tileLayers[activeTile];

    mapInstanceRef.current.removeLayer(baseTileLayerRef.current);
    const newBaseLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(mapInstanceRef.current);

    // Keep radar above base
    if (radarTileLayerRef.current && showRadar) {
      radarTileLayerRef.current.bringToFront();
    }

    baseTileLayerRef.current = newBaseLayer;
  }, [activeTile]);

  // 3. Handle Radar Overlay Updates (URL change or Toggle)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove existing radar layer
    if (radarTileLayerRef.current && map.hasLayer(radarTileLayerRef.current)) {
      map.removeLayer(radarTileLayerRef.current);
    }

    if (showRadar) {
      const newUrl = getRadarTileUrl(rainViewerPath, rainViewerHost, radarProvider);
      const newRadarLayer = L.tileLayer(newUrl, {
        opacity: radarOpacity,
        maxZoom: 18,
        zIndex: 5,
      }).addTo(map);

      radarTileLayerRef.current = newRadarLayer;
      newRadarLayer.bringToFront();
    }
  }, [showRadar, radarOpacity, rainViewerPath, rainViewerHost, radarProvider]);

  // 4. Update Markers on Map when stations or activeMetric or selectedStation changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    Object.entries(stations).forEach(([key, station]) => {
      const isSelected = key === selectedStationKey;
      const lat = station.coordinates.lat;
      const lng = station.coordinates.lng;

      // Determine metric text and color badge
      let metricValue = '';
      let badgeBg = 'bg-[#46645a]';
      let borderGlow = 'border-[#46645a]';

      if (activeMetric === 'rain') {
        metricValue = `${station.rain} mm`;
        if (station.rain >= 70) {
          badgeBg = 'bg-[#ba1a1a]';
          borderGlow = 'border-[#ba1a1a] ring-2 ring-[#ba1a1a]/30';
        } else if (station.rain >= 35) {
          badgeBg = 'bg-[#b64d32]';
          borderGlow = 'border-[#b64d32]';
        } else if (station.rain >= 15) {
          badgeBg = 'bg-[#e8a338]';
          borderGlow = 'border-[#e8a338]';
        } else {
          badgeBg = 'bg-[#2e7d32]';
        }
      } else if (activeMetric === 'temp') {
        metricValue = `${station.temp} °C`;
        if (station.temp >= 38) {
          badgeBg = 'bg-[#ba1a1a]';
          borderGlow = 'border-[#ba1a1a]';
        } else if (station.temp >= 32) {
          badgeBg = 'bg-[#f59e0b]';
        } else {
          badgeBg = 'bg-[#2563eb]';
        }
      } else if (activeMetric === 'wind') {
        metricValue = `${station.wind} km/h`;
        if (station.wind >= 50) {
          badgeBg = 'bg-[#ba1a1a]';
        } else if (station.wind >= 35) {
          badgeBg = 'bg-[#ea580c]';
        } else {
          badgeBg = 'bg-[#0284c7]';
        }
      } else if (activeMetric === 'model_weights') {
        const w = station.weights;
        const maxVal = Math.max(w.ncum, w.ecmwf, w.graphCast, w.pangu);
        let dominantModel = 'GraphCast';
        badgeBg = 'bg-[#2563eb]';
        if (w.ncum === maxVal) {
          dominantModel = 'NCUM';
          badgeBg = 'bg-[#96361d]';
        } else if (w.ecmwf === maxVal) {
          dominantModel = 'ECMWF';
          badgeBg = 'bg-[#475569]';
        } else if (w.pangu === maxVal) {
          dominantModel = 'Pangu';
          badgeBg = 'bg-[#7c3aed]';
        }
        metricValue = `${dominantModel} ${maxVal}%`;
      } else {
        // Alert level
        metricValue = station.alertTitle.includes('Red')
          ? 'RED'
          : station.alertTitle.includes('Orange')
          ? 'ORANGE'
          : station.alertTitle.includes('Yellow')
          ? 'YELLOW'
          : 'GREEN';
        badgeBg =
          metricValue === 'RED'
            ? 'bg-[#ba1a1a]'
            : metricValue === 'ORANGE'
            ? 'bg-[#ea580c]'
            : metricValue === 'YELLOW'
            ? 'bg-[#ca8a04]'
            : 'bg-[#15803d]';
      }

      // Generate HTML DivIcon
      const htmlMarkup = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -100%);">
          ${
            isSelected
              ? `<span class="absolute -top-1 -left-1 flex h-7 w-7 pointer-events-none">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#96361d] opacity-80"></span>
                  <span class="relative inline-flex rounded-full h-7 w-7 bg-[#96361d]/30"></span>
                </span>`
              : ''
          }
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shadow-md transition-all duration-150 transform hover:scale-110 ${
            isSelected
              ? 'bg-[#ffffff] border-2 border-[#96361d] ring-3 ring-[#96361d]/30 font-bold'
              : 'bg-[#ffffff]/95 border border-[#DDD4C8] hover:border-[#96361d]'
          }">
            <span class="w-2.5 h-2.5 rounded-full ${badgeBg} ${
              station.rain >= 70 || isSelected ? 'animate-pulse' : ''
            }"></span>
            <span class="text-[12px] font-sans font-semibold text-[#1b1c1a] whitespace-nowrap">${station.name.replace(
              ' Station',
              ''
            ).replace(' AWS Observatory', '')}</span>
            <span class="text-[11px] font-mono px-1.5 py-0.2 rounded text-[#ffffff] ${badgeBg} font-medium">${metricValue}</span>
          </div>
          <div class="w-2 h-2 bg-[#ffffff] rotate-45 mx-auto -mt-1 border-r border-b ${
            isSelected ? 'border-[#96361d]' : 'border-[#DDD4C8]'
          }"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: htmlMarkup,
        className: 'custom-weather-pin',
        iconSize: [120, 40],
        iconAnchor: [60, 40],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Click marker to select and zoom into city street level
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectStation(key);
        map.flyTo([lat, lng], 12, { duration: 1.2 });
      });

      // Tooltip
      marker.bindTooltip(
        `
        <div style="font-family: system-ui, sans-serif; padding: 4px 6px;">
          <div style="font-weight: 700; color: #1b1c1a; font-size: 13px;">${station.name}</div>
          <div style="font-size: 11px; color: #4c5762; margin-bottom: 4px;">${station.state} &bull; Sensor: ${station.sensorId}</div>
          <div style="display: flex; gap: 8px; font-size: 11px; border-top: 1px solid #eee; padding-top: 4px;">
            <span>🌧️ <b>${station.rain} mm</b></span>
            <span>🌡️ <b>${station.temp} °C</b></span>
            <span>💨 <b>${station.wind} km/h</b></span>
          </div>
          <div style="font-size: 10px; margin-top: 3px; font-weight: 600; color: #96361d;">${station.alertTitle}</div>
        </div>
      `,
        { direction: 'top', offset: [0, -42], opacity: 0.95 }
      );

      markersGroup.addLayer(marker);
    });

    // Also render localized neighborhood observation nodes for the currently selected city
    const neighborhoods = CITY_NEIGHBORHOODS[selectedStationKey] || [];
    neighborhoods.forEach((nh) => {
      const parentStation = stations[selectedStationKey];
      const localRain = +(Math.max(0, (parentStation?.rain || 15) + nh.offsetRain)).toFixed(1);
      const localTemp = +(Math.max(10, (parentStation?.temp || 28) + nh.offsetTemp)).toFixed(1);

      const nhMarkup = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="flex items-center gap-1.5 bg-[#1b1c1a]/95 text-[#ffffff] px-2 py-0.5 rounded-full shadow-lg border border-[#ffffff]/50 hover:bg-[#96361d] hover:scale-110 transition-all text-[10px]">
            <span class="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping"></span>
            <span class="font-medium whitespace-nowrap">${nh.name}</span>
            <span class="font-mono text-[#86efac] font-bold text-[9px]">${activeMetric === 'rain' ? localRain + ' mm' : localTemp + ' °C'}</span>
          </div>
        </div>
      `;

      const nhIcon = L.divIcon({
        html: nhMarkup,
        className: 'custom-nh-pin',
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });

      const nhMarker = L.marker([nh.lat, nh.lng], { icon: nhIcon });
      nhMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px 6px; min-width: 170px;">
          <div style="font-size: 10px; text-transform: uppercase; color: #46645a; font-weight: 700;">${nh.tag}</div>
          <div style="font-weight: 700; color: #1b1c1a; font-size: 13px; margin: 2px 0;">${nh.name}</div>
          <div style="font-size: 11px; color: #57423d; margin-bottom: 6px;">City Micro-Sensor Observation Node</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; background: #f5f3f0; padding: 6px; border-radius: 6px;">
            <div>🌧️ Rain: <b>${localRain} mm</b></div>
            <div>🌡️ Temp: <b>${localTemp} °C</b></div>
          </div>
        </div>
      `);
      markersGroup.addLayer(nhMarker);
    });
  }, [stations, selectedStationKey, activeMetric]);

  // Automatically fly to selected station city at Street Level (Zoom 12) whenever station changes
  useEffect(() => {
    const station = stations[selectedStationKey];
    if (station && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([station.coordinates.lat, station.coordinates.lng], 12, {
        duration: 1.2,
      });
    }
  }, [selectedStationKey]);

  // 5. Handle Live Location Geocoding Search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchLocation(searchQuery);
        setSearchResults(results);
        setIsDropdownOpen(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Pick Location from search - Fly to proper city street level (Zoom 12)
  const handleSelectLocationResult = async (item: {
    name: string;
    state: string;
    country: string;
    lat: number;
    lon: number;
  }) => {
    setIsDropdownOpen(false);
    setSearchQuery('');
    onShowToast(`Deploying multi-model grid analysis for: ${item.name} (${item.state})...`, 'radar');

    // Pan map directly to city street level (Zoom 12)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lon], 12, { duration: 1.5 });
    }

    // Ingest live data for this location from backend
    try {
      const customRes = await api.fetchCustomStation({
        name: item.name,
        state: item.state,
        lat: item.lat,
        lon: item.lon,
      });

      if (customRes && customRes.station) {
        onSelectStation(customRes.stationKey, customRes.station);
        onShowToast(`Live city forecast synchronized for ${item.name}!`, 'check_circle');
      }
    } catch {
      onShowToast(`Could not fetch live telemetry for ${item.name}`, 'error');
    }
  };

  const handleQuickPick = (pick: typeof quickPicks[0]) => {
    if (stations[pick.key]) {
      onSelectStation(pick.key);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([pick.lat, pick.lon], 12, { duration: 1.2 });
      }
    } else {
      handleSelectLocationResult(pick);
    }
  };

  const setMapZoomPreset = (zoomLvl: number) => {
    if (!mapInstanceRef.current) return;
    const center = stations[selectedStationKey]
      ? [stations[selectedStationKey].coordinates.lat, stations[selectedStationKey].coordinates.lng]
      : mapInstanceRef.current.getCenter();
    mapInstanceRef.current.flyTo(center as L.LatLngExpression, zoomLvl, { duration: 1.0 });
    if (zoomLvl >= 12) {
      onShowToast('Focused on City Street View (Zoom 12x)', 'location_city');
    } else if (zoomLvl >= 8) {
      onShowToast('Focused on Metropolitan District View (Zoom 9x)', 'map');
    } else {
      onShowToast('Focused on National Subcontinent Grid (Zoom 5x)', 'public');
    }
  };

  const resetViewIndia = () => {
    setMapZoomPreset(5);
  };

  const zoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div className="relative w-full h-[550px] rounded-xl overflow-hidden border border-[#DDD4C8] shadow-sm select-none flex flex-col">
      {/* Real Map Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0 bg-[#e5e3df]" />

      {/* FLOATING TOP BAR: Search Bar & Location Autocomplete */}
      <div className="relative z-20 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pointer-events-none">
        {/* Search Bar Input Container */}
        <div className="pointer-events-auto relative w-full sm:w-96">
          <div className="flex items-center gap-2 bg-[#ffffff]/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-[#DDD4C8]/80 text-[#1b1c1a]">
            <span className="material-symbols-outlined text-[#96361d] text-[20px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setIsDropdownOpen(true);
              }}
              placeholder="Search any location or city (e.g. Pune, Jaipur, Kochi)..."
              className="w-full bg-transparent text-[13px] font-sans text-[#1b1c1a] placeholder:text-[#8a726c] focus:outline-none"
            />
            {isSearching && (
              <span className="material-symbols-outlined text-[#96361d] text-[18px] animate-spin">
                progress_activity
              </span>
            )}
            {searchQuery && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsDropdownOpen(false);
                }}
                className="text-[#8a726c] hover:text-[#1b1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#ffffff] rounded-xl shadow-2xl border border-[#DDD4C8] max-h-72 overflow-y-auto divide-y divide-[#efeeeb] z-30">
              <div className="px-3 py-1.5 bg-[#f5f3f0] text-[11px] font-label-sm text-[#4c5762] uppercase tracking-wider flex items-center justify-between">
                <span>Matching Locations ({searchResults.length})</span>
                <span className="text-[10px] text-[#46645a]">Click to load live forecast</span>
              </div>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleSelectLocationResult(result)}
                  className="px-3.5 py-2.5 hover:bg-[#fff5f2] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#96361d] text-[18px] group-hover:scale-110 transition-transform">
                      location_on
                    </span>
                    <div>
                      <div className="font-semibold text-[13px] text-[#1b1c1a] group-hover:text-[#96361d]">
                        {result.name}
                      </div>
                      <div className="text-[11px] text-[#57423d]">
                        {result.state}, {result.country}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#8a726c] px-2 py-0.5 rounded bg-[#f5f3f0]">
                    {result.lat.toFixed(2)}°, {result.lon.toFixed(2)}°
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Pick Chips */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full">
          <span className="hidden xl:inline-block text-[11px] font-medium text-[#ffffff] bg-[#1b1c1a]/70 px-2 py-1 rounded-md backdrop-blur-xs">
            Hubs:
          </span>
          {quickPicks.map((pick) => (
            <button
              key={pick.name}
              type="button"
              onClick={() => handleQuickPick(pick)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold transition-all shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1 backdrop-blur-md ${
                selectedStationKey === pick.key
                  ? 'bg-[#96361d] text-[#ffffff] ring-2 ring-[#ffffff]/50 shadow-md'
                  : 'bg-[#ffffff]/90 hover:bg-[#ffffff] text-[#1b1c1a] border border-[#DDD4C8]/80'
              }`}
            >
              <span>{pick.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FLOATING BOTTOM-LEFT: High-Detail City Map Switcher & Radar Controls */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto flex flex-col gap-2">
        {/* City Zoom Presets Bar */}
        <div className="bg-[#ffffff]/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-[#DDD4C8] flex items-center gap-1 text-[11px] font-semibold">
          <span className="text-[#8a726c] px-1.5 text-[10px] uppercase tracking-wider font-bold">Scale:</span>
          <button
            type="button"
            onClick={() => setMapZoomPreset(12)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              currentZoom >= 11
                ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            <span>🏙️ City Streets (12x)</span>
          </button>
          <button
            type="button"
            onClick={() => setMapZoomPreset(9)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              currentZoom >= 8 && currentZoom < 11
                ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            <span>📍 District (9x)</span>
          </button>
          <button
            type="button"
            onClick={() => setMapZoomPreset(5)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              currentZoom < 8
                ? 'bg-[#96361d] text-[#ffffff] shadow-xs'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            <span>🇮🇳 National (5x)</span>
          </button>
        </div>

        {/* Map Tile Layers */}
        <div className="bg-[#ffffff]/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-[#DDD4C8] flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTile('streets')}
            title="High-Detail City Street Map (Esri)"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              activeTile === 'streets'
                ? 'bg-[#96361d] text-[#ffffff]'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            🏙️ City Streets
          </button>
          <button
            type="button"
            onClick={() => setActiveTile('osm')}
            title="OpenStreetMap Standard (Avenues, Transit, Lanes)"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              activeTile === 'osm'
                ? 'bg-[#96361d] text-[#ffffff]'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            🗺️ OpenStreetMap
          </button>
          <button
            type="button"
            onClick={() => setActiveTile('voyager')}
            title="Carto Urban Voyager (Vibrant city blocks & roads)"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              activeTile === 'voyager'
                ? 'bg-[#96361d] text-[#ffffff]'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            🎨 Urban Voyager
          </button>
          <button
            type="button"
            onClick={() => setActiveTile('satellite')}
            title="Satellite Imagery with City Hybrid Labels"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              activeTile === 'satellite'
                ? 'bg-[#96361d] text-[#ffffff]'
                : 'text-[#4c5762] hover:bg-[#f5f3f0]'
            }`}
          >
            🛰️ Satellite
          </button>
        </div>

        {/* Live Radar Toggle & API Keys Pill */}
        <div className="bg-[#ffffff]/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-[#DDD4C8] flex flex-col gap-1.5 text-[11px] font-sans">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  showRadar ? 'bg-[#22c55e] animate-pulse' : 'bg-[#9ca3af]'
                }`}
              ></span>
              <span className="font-semibold text-[#1b1c1a]">Precipitation Radar Overlay</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRadar(!showRadar)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                showRadar
                  ? 'bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0]'
                  : 'bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb]'
              }`}
            >
              {showRadar ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#efeeeb] pt-1.5 text-[10px] text-[#4c5762]">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-[#1b5e20]">
                {radarProvider === 'rainviewer' ? 'RainViewer (Free, No Key)' : 'OpenWeatherMap'}
              </span>
              {radarTimestamp && <span>&bull; {radarTimestamp}</span>}
            </span>
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="text-[#96361d] hover:underline font-semibold cursor-pointer flex items-center gap-0.5"
              title="Configure API keys and data feeds"
            >
              <span className="material-symbols-outlined text-[13px]">vpn_key</span>
              <span>API Keys</span>
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING BOTTOM-RIGHT: Map Navigation, Zoom & Probing Helper */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto flex flex-col items-end gap-2">
        {/* Click anywhere tooltip hint */}
        <div className="hidden md:flex items-center gap-1.5 bg-[#ffffff]/90 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-[#DDD4C8] text-[11px] text-[#4c5762]">
          <span className="material-symbols-outlined text-[#96361d] text-[15px]">touch_app</span>
          <span>Click anywhere to probe street forecast</span>
          {isLocatingPoint && (
            <span className="material-symbols-outlined text-[#96361d] text-[14px] animate-spin">
              progress_activity
            </span>
          )}
        </div>

        {/* Zoom & Reset Controls */}
        <div className="bg-[#ffffff]/95 backdrop-blur-md rounded-xl shadow-lg border border-[#DDD4C8] flex flex-col divide-y divide-[#efeeeb] overflow-hidden">
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In"
            className="p-2 hover:bg-[#f5f3f0] text-[#1b1c1a] transition-colors cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out"
            className="p-2 hover:bg-[#f5f3f0] text-[#1b1c1a] transition-colors cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <button
            type="button"
            onClick={() => setMapZoomPreset(12)}
            title="Reset to City Street View (Zoom 12x)"
            className="p-2 hover:bg-[#f5f3f0] text-[#96361d] transition-colors cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">location_city</span>
          </button>
          <button
            type="button"
            onClick={resetViewIndia}
            title="Reset View to India Subcontinent"
            className="p-2 hover:bg-[#f5f3f0] text-[#4c5762] transition-colors cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">public</span>
          </button>
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
