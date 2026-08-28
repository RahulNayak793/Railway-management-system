import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Train, Search, Compass, MapPin, Gauge, ShieldCheck, Share2, Clock, CheckCircle2, Navigation, AlertCircle, Copy, Edit3, Save, Radio, AlertTriangle } from 'lucide-react';
import L from 'leaflet';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AIDelayWidget from '../components/AIDelayWidget';

const LiveTracking = () => {
  const [searchParams] = useSearchParams();
  const trainIdFromParam = searchParams.get('train_id');
  const dateFromParam = searchParams.get('date') || searchParams.get('travel_date');

  const auth = useAuth();
  const user = auth?.user;

  // Determine if logged-in user is staff or admin
  const isStaffOrAdmin = user && (user.role === 'staff' || user.role === 'admin' || user.user_metadata?.role === 'staff' || user.user_metadata?.role === 'admin');

  const [query, setQuery] = useState('');
  const [activeTrain, setActiveTrain] = useState(null);
  const [activeDate, setActiveDate] = useState(dateFromParam || null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);

  // Staff Telemetry Control Form State
  const [showStaffControls, setShowStaffControls] = useState(false);
  const [telemetryForm, setTelemetryForm] = useState({
    speed: 100,
    delay_minutes: 0,
    delay_reason: 'Signal Clearance',
    status: 'LIVE',
    current_station_code: '',
    next_station_code: '',
    platform: '1',
    latitude: '',
    longitude: ''
  });
  const [updatingTelemetry, setUpdatingTelemetry] = useState(false);

  // Leaflet Map Ref
  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch initial trains list and active booked journeys
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      try {
        const [trainsRes, bookingsRes] = await Promise.all([
          api.get('/trains?include_all=true'),
          api.get('/bookings').catch(() => ({ data: [] }))
        ]);

        const allTrains = trainsRes.data || [];
        const bookingsData = (bookingsRes.data || []).filter(b => b.status !== 'cancelled');
        setUserBookings(bookingsData);

        let targetTrain = null;
        let targetDate = dateFromParam;

        if (trainIdFromParam) {
          targetTrain = allTrains.find(t => t.id === trainIdFromParam || t.train_number === trainIdFromParam);
        } else if (bookingsData.length > 0) {
          const firstBooking = bookingsData[0];
          const bookedTrainId = firstBooking.train_id || firstBooking.train?.id;
          targetTrain = allTrains.find(t => t.id === bookedTrainId) || firstBooking.train;
          if (!targetDate && firstBooking.travel_date) {
            targetDate = firstBooking.travel_date;
          }
        }

        if (!targetTrain && allTrains.length > 0) {
          targetTrain = allTrains[0];
        }

        if (targetTrain) {
          setActiveTrain(targetTrain);
          if (targetDate) setActiveDate(targetDate);
        }
      } catch (err) {
        console.error('Error fetching initial trains/bookings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [trainIdFromParam, dateFromParam]);

  // Fetch Live Status & Connect SSE whenever activeTrain or activeDate changes
  useEffect(() => {
    if (!activeTrain) return;

    let eventSource = null;

    const fetchLiveStatus = async () => {
      try {
        const dateQuery = activeDate ? `?date=${activeDate}` : '';
        const res = await api.get(`/trains/${activeTrain.id}/live-status${dateQuery}`);
        if (res.data) {
          setLiveStatus(res.data);
          if (res.data.telemetry) {
            setTelemetryForm({
              speed: res.data.telemetry.speed || 0,
              delay_minutes: res.data.telemetry.delay_minutes || 0,
              delay_reason: res.data.telemetry.delay_reason || 'Signal Clearance',
              status: res.data.telemetry.status || 'LIVE',
              current_station_code: res.data.telemetry.current_station_code || '',
              next_station_code: res.data.telemetry.next_station_code || '',
              platform: res.data.telemetry.platform || '1',
              latitude: res.data.telemetry.latitude || '',
              longitude: res.data.telemetry.longitude || ''
            });
          }
        }
      } catch (err) {
        console.error('Error fetching live status:', err);
      }
    };

    fetchLiveStatus();

    // Setup periodic polling interval to auto-transition from NOT_STARTED to LIVE when departure time arrives
    const statusCheckInterval = setInterval(fetchLiveStatus, 15000);

    // Establish SSE Stream
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const sseUrl = `${apiBaseUrl}/api/tracking/stream/${activeTrain.id}${activeDate ? `?date=${activeDate}` : ''}`;

    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onopen = () => setSseConnected(true);
      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const data = JSON.parse(event.data);
          if (data && !data.error) {
            setLiveStatus(data);
          }
        } catch (e) {
          console.error('Error parsing SSE telemetry payload:', e);
        }
      };
      eventSource.onerror = () => setSseConnected(false);
    } catch (e) {
      console.error('SSE initialization failed:', e);
    }

    return () => {
      clearInterval(statusCheckInterval);
      if (eventSource) eventSource.close();
    };
  }, [activeTrain, activeDate]);

  // Render Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || !liveStatus) return;

    const stops = liveStatus.stops || [];
    if (stops.length === 0) return;

    const routeCoords = stops
      .filter(s => s.lat && s.lng)
      .map(s => [parseFloat(s.lat), parseFloat(s.lng)]);

    if (routeCoords.length === 0) return;

    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
    }

    const isNotStarted = liveStatus.status?.state === 'NOT_STARTED';
    const isCompleted = liveStatus.status?.state === 'COMPLETED';

    const initialCenter = (isNotStarted)
      ? routeCoords[0]
      : (isCompleted ? routeCoords[routeCoords.length - 1] : ((liveStatus.telemetry?.latitude && liveStatus.telemetry?.longitude) ? [parseFloat(liveStatus.telemetry.latitude), parseFloat(liveStatus.telemetry.longitude)] : routeCoords[0]));

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 6,
      zoomControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const polyline = L.polyline(routeCoords, {
      color: '#003366',
      weight: 4,
      opacity: 0.8,
      dashArray: '8, 8'
    }).addTo(map);

    // Add station markers
    stops.forEach((stop) => {
      if (!stop.lat || !stop.lng) return;

      let markerColor = '#64748B';
      if (stop.status === 'COMPLETED') markerColor = '#003366';
      else if (stop.status === 'CURRENT') markerColor = '#10B981';
      else if (stop.status === 'NEXT') markerColor = '#F59E0B';

      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([parseFloat(stop.lat), parseFloat(stop.lng)], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #003366;">${stop.name} (${stop.code})</strong><br/>
          <span>Platform: ${stop.platform || '1'}</span><br/>
          <span>Sch Arr: ${stop.arrTime} | Sch Dep: ${stop.depTime}</span><br/>
          <span style="font-weight: bold; color: ${markerColor};">Status: ${stop.status}</span>
        </div>
      `);
    });

    // Add Train Marker: ONLY if not pre-departure OR at origin station without pulse if NOT_STARTED
    if (isNotStarted) {
      // Locked at origin station marker without moving pulse animation
      const originLat = routeCoords[0][0];
      const originLng = routeCoords[0][1];
      const originTrainIcon = L.divIcon({
        className: 'static-origin-pin',
        html: `
          <div style="width: 18px; height: 18px; background: #003366; border: 3px solid #F59E0B; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      const trainMarker = L.marker([originLat, originLng], { icon: originTrainIcon }).addTo(map);
      trainMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #003366;">🚂 #${liveStatus.train.train_number} - ${liveStatus.train.train_name}</strong><br/>
          <span style="color: #D97706; font-weight: bold;">Status: NOT DEPARTED YET</span><br/>
          <span>Scheduled Dep: ${liveStatus.status.scheduled_departure_time} (${liveStatus.status.scheduled_departure_date})</span>
        </div>
      `);
    } else if (liveStatus.telemetry?.latitude && liveStatus.telemetry?.longitude) {
      const trainLat = parseFloat(liveStatus.telemetry.latitude);
      const trainLng = parseFloat(liveStatus.telemetry.longitude);

      const trainIcon = L.divIcon({
        className: 'custom-train-pin',
        html: `
          <div style="position: relative;">
            <div style="position: absolute; top: -12px; left: -12px; width: 24px; height: 24px; background: rgba(0, 242, 254, 0.4); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 16px; height: 16px; background: #00F2FE; border: 3px solid #003366; border-radius: 50%; box-shadow: 0 0 12px #00F2FE;"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const trainMarker = L.marker([trainLat, trainLng], { icon: trainIcon }).addTo(map);
      trainMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #003366;">🚂 #${liveStatus.train.train_number} - ${liveStatus.train.train_name}</strong><br/>
          <span>Speed: <strong>${liveStatus.telemetry.speed} km/h</strong></span><br/>
          <span>Status: <strong>${liveStatus.telemetry.status}</strong></span>
        </div>
      `).openPopup();
    }

    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    leafletMapInstance.current = map;

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [liveStatus]);

  // Search Handler
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query) return;
    setLoading(true);
    try {
      const res = await api.get('/trains?include_all=true');
      const matched = res.data.find(t => 
        t.train_number === query.trim() || 
        t.train_name.toLowerCase().includes(query.trim().toLowerCase())
      );
      if (matched) {
        setActiveTrain(matched);
      } else {
        alert(`Train "${query}" not found.`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Staff Telemetry Updates
  const handleStaffTelemetrySubmit = async (e) => {
    e.preventDefault();
    if (!activeTrain) return;
    setUpdatingTelemetry(true);

    try {
      const payload = {
        ...telemetryForm,
        service_date: activeDate || liveStatus?.status?.service_date
      };
      const res = await api.post(`/trains/${activeTrain.id}/telemetry`, payload);
      if (res.data && res.data.liveStatus) {
        setLiveStatus(res.data.liveStatus);
      }
      showToast('Live telemetry updated and broadcasted successfully!');
      setShowStaffControls(false);
    } catch (err) {
      console.error('Telemetry update failed:', err);
      showToast('Failed to update telemetry. Staff authorization required.');
    } finally {
      setUpdatingTelemetry(false);
    }
  };

  const isNotStarted = liveStatus?.status?.state === 'NOT_STARTED';
  const isCompleted = liveStatus?.status?.state === 'COMPLETED';

  // Status badge element
  const getStatusBadge = () => {
    const state = liveStatus?.status?.state || 'NOT_STARTED';
    const delayMinutes = liveStatus?.telemetry?.delay_minutes || 0;

    if (state === 'NOT_STARTED') {
      return <span className="bg-amber-50 text-amber-700 border-amber-200 border px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> NOT STARTED</span>;
    }
    if (state === 'COMPLETED') {
      return <span className="bg-blue-50 text-blue-700 border-blue-200 border px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> JOURNEY COMPLETED</span>;
    }
    if (state === 'SCHEDULE_UNAVAILABLE') {
      return <span className="bg-slate-100 text-slate-600 border-slate-300 border px-3 py-1 rounded-full text-xs font-black uppercase">SCHEDULE UNAVAILABLE</span>;
    }
    if (state === 'DATA_UNAVAILABLE') {
      return <span className="bg-slate-100 text-slate-600 border-slate-300 border px-3 py-1 rounded-full text-xs font-black uppercase">DATA UNAVAILABLE</span>;
    }
    if (delayMinutes > 0 || state === 'DELAYED') {
      return <span className="bg-amber-50 text-amber-700 border-amber-200 border px-3 py-1 rounded-full text-xs font-black uppercase">DELAYED {delayMinutes}m</span>;
    }
    return <span className="bg-green-50 text-green-700 border-green-200 border px-3 py-1 rounded-full text-xs font-black uppercase">LIVE - ON TIME</span>;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 font-sans space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-slate-900 border border-slate-800 text-white text-xs font-bold py-3 px-5 rounded-xl shadow-2xl z-50 animate-bounce flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header section */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Live Train Tracking</h1>
            {sseConnected && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                <Radio className="h-3 w-3 text-emerald-500 animate-pulse" /> SSE LIVE STREAM
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time GPS telemetry position, live speed, station timeline and platform updates.</p>
        </div>

        {/* Train Lookup Search */}
        <form onSubmit={handleSearch} className="flex space-x-2 w-full sm:max-w-xs flex-shrink-0">
          <div className="flex flex-1 items-center bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 shadow-inner">
            <Search className="h-4 w-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="e.g. 12952 or Rajdhani"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-extrabold text-slate-850"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#003366] hover:bg-[#002550] text-white px-4 py-2 text-xs font-black transition-all shadow-sm"
          >
            Track
          </button>
        </form>
      </div>

      {/* Booked Trains Quick Tracking Bar */}
      {userBookings.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-[#003366] to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-blue-900/40 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h2 className="text-xs font-black tracking-wide uppercase">Your Active Booked Journeys</h2>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
              {userBookings.length} Booked Train{userBookings.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userBookings.map((b) => {
              const trainName = b.train?.train_name || 'Rajdhani Express';
              const trainNo = b.train?.train_number || '12952';
              const travelDate = b.travel_date || b.booking_date;
              const isSelected = activeTrain && (activeTrain.id === b.train_id || activeTrain.train_number === trainNo) && activeDate === travelDate;

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    const matched = b.train || { id: b.train_id, train_name: trainName, train_number: trainNo, status: 'on_time' };
                    setActiveTrain(matched);
                    setActiveDate(travelDate);
                  }}
                  className={`cursor-pointer rounded-xl p-3.5 border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-white/20 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                      <Train className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-white">{trainName}</span>
                        <span className="text-[10px] bg-white/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">#{trainNo}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium mt-0.5">PNR: {b.pnr_number} • Date: {travelDate}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                      isSelected ? 'bg-emerald-400 text-slate-950 shadow' : 'bg-white/10 text-white hover:bg-white/25'
                    }`}
                  >
                    {isSelected ? 'Tracking' : 'Track'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#003366] border-r-transparent align-[-0.125em]" />
          <p className="text-xs text-slate-400 font-bold mt-3">Connecting to dynamic telemetry server...</p>
        </div>
      ) : activeTrain ? (
        <div className="space-y-6">
          
          {/* Active Train Header Card */}
          <div className="bg-[#f0f5fc] rounded-2xl border border-blue-150 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3.5">
              <div className="rounded-xl bg-[#003366]/10 p-3 text-[#003366]">
                <Train className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] bg-[#003366]/10 text-[#003366] font-black px-2 py-0.5 rounded-md font-mono">
                    #{activeTrain.train_number}
                  </span>
                  {liveStatus?.status?.scheduled_departure_date && (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">
                      Journey Date: {liveStatus.status.scheduled_departure_date}
                    </span>
                  )}
                </div>
                <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight mt-1">{activeTrain.train_name}</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  Route: {liveStatus?.stops?.[0]?.name || activeTrain.source || 'Origin'} &rarr; {liveStatus?.stops?.[liveStatus.stops.length - 1]?.name || activeTrain.destination || 'Destination'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-stretch md:self-auto justify-between">
              {getStatusBadge()}

              {/* Staff/Admin Control Button */}
              {isStaffOrAdmin && (
                <button
                  onClick={() => setShowStaffControls(!showStaffControls)}
                  className="flex items-center space-x-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-black text-amber-900 transition active:scale-95 shadow-sm"
                >
                  <Edit3 className="h-3.5 w-3.5 text-amber-700" />
                  <span>{showStaffControls ? 'Close Staff Controls' : 'Staff Telemetry Controls'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/passenger/track?train_id=${activeTrain.id}${activeDate ? `&date=${activeDate}` : ''}`;
                  navigator.clipboard.writeText(shareUrl).then(() => showToast('Live status link copied!')).catch(() => {});
                }}
                className="flex items-center space-x-1.5 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-700 transition active:scale-95 shadow-sm"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Status</span>
              </button>
            </div>
          </div>

          {/* HARD UI STATE FOR PRE-DEPARTURE: NOT_STARTED CARD */}
          {isNotStarted && (
            <div className="bg-white rounded-3xl border border-amber-200 p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-5 max-w-2xl mx-auto animate-scale-in">
              <div className="h-16 w-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-inner">
                <Clock className="h-8 w-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-amber-600 tracking-widest bg-amber-100/80 px-3 py-1 rounded-full border border-amber-300">
                  NOT STARTED
                </span>
                <h3 className="text-lg font-black text-slate-800 pt-1">Train Has Not Departed Yet</h3>
                <p className="text-xs text-slate-500 max-w-lg leading-relaxed font-medium">
                  This train is scheduled to depart from <strong className="text-slate-800">{liveStatus?.status?.origin_station || activeTrain.source}</strong> on{' '}
                  <strong className="text-slate-800">{liveStatus?.status?.scheduled_departure_date}</strong> at{' '}
                  <strong className="text-[#003366]">{liveStatus?.status?.scheduled_departure_time}</strong>.
                  Live GPS speed and progress movement will automatically activate at scheduled departure time.
                </p>
              </div>

              <div className="w-full bg-[#f0f5fc] rounded-2xl border border-blue-150 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Scheduled Journey Date</span>
                  <span className="text-xs font-extrabold text-slate-800 font-mono mt-0.5 block">{liveStatus?.status?.scheduled_departure_date}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Scheduled Departure Time</span>
                  <span className="text-xs font-extrabold text-[#003366] font-mono mt-0.5 block">{liveStatus?.status?.scheduled_departure_time}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Scheduled Platform</span>
                  <span className="text-xs font-extrabold text-emerald-600 mt-0.5 block">PF {liveStatus?.stops?.[0]?.platform || '1'}</span>
                </div>
              </div>

              {liveStatus?.status?.mins_until_departure > 0 && (
                <div className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Time remaining until scheduled departure: {Math.floor(liveStatus.status.mins_until_departure / 60)}h {liveStatus.status.mins_until_departure % 60}m</span>
                </div>
              )}
            </div>
          )}

          {/* Staff Telemetry Update Form Modal/Card */}
          {showStaffControls && isStaffOrAdmin && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 shadow-md space-y-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <div className="flex items-center space-x-2 text-amber-900">
                  <Edit3 className="h-5 w-5" />
                  <h3 className="text-sm font-black uppercase tracking-wider">Authorized Staff Telemetry Management</h3>
                </div>
                <span className="text-[10px] bg-amber-200/60 text-amber-900 px-2.5 py-0.5 rounded font-bold uppercase font-mono">
                  Journey Date: {activeDate || liveStatus?.status?.service_date || 'Today'}
                </span>
              </div>

              <form onSubmit={handleStaffTelemetrySubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">Speed (km/h)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={telemetryForm.speed}
                    onChange={(e) => setTelemetryForm({ ...telemetryForm, speed: e.target.value })}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">Delay Minutes</label>
                  <input
                    type="number"
                    min="0"
                    value={telemetryForm.delay_minutes}
                    onChange={(e) => setTelemetryForm({ ...telemetryForm, delay_minutes: e.target.value })}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">Delay Reason</label>
                  <select
                    value={telemetryForm.delay_reason}
                    onChange={(e) => setTelemetryForm({ ...telemetryForm, delay_reason: e.target.value })}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Signal Clearance">Signal Clearance</option>
                    <option value="Weather / Dense Fog">Weather / Dense Fog</option>
                    <option value="Track Maintenance Work">Track Maintenance Work</option>
                    <option value="Locomotive Technical Issue">Locomotive Technical Issue</option>
                    <option value="Late Arrival of Pairing Train">Late Arrival of Pairing Train</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">Status State</label>
                  <select
                    value={telemetryForm.status}
                    onChange={(e) => setTelemetryForm({ ...telemetryForm, status: e.target.value })}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="LIVE">LIVE (Running)</option>
                    <option value="DELAYED">DELAYED</option>
                    <option value="STOPPED">STOPPED</option>
                    <option value="NOT STARTED">NOT STARTED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-4 flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStaffControls(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingTelemetry}
                    className="flex items-center space-x-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition shadow"
                  >
                    <Save className="h-4 w-4" />
                    <span>{updatingTelemetry ? 'Saving...' : 'Save & Broadcast Telemetry'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* AI Route Delay & Weather Intelligence Widget */}
          <AIDelayWidget trainNumber={activeTrain.train_number} liveStatus={liveStatus} />

          {/* Interactive Geographic Map Section using Leaflet */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                <Navigation className="h-4 w-4 text-cyan-400 animate-pulse" /> Geographic GPS Route & Satellite Track
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {isNotStarted ? 'PRE-DEPARTURE ROUTE MAP' : (isCompleted ? 'JOURNEY COMPLETED ROUTE' : 'LIVE GPS TELEMETRY ACTIVE')}
              </span>
            </div>

            {/* Leaflet Map DOM Container */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 shadow-inner h-80 bg-slate-950">
              <div ref={mapContainerRef} className="w-full h-full z-10" />
            </div>
          </div>

          {/* Grid split: Telemetry details & Vertical Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Left Column: Telemetry details */}
            <div className="md:col-span-4 space-y-4">
              
              {/* Speed speedometer card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Speedometer</span>
                  <div className="text-3xl font-black text-cyan-300 mt-1 flex items-baseline space-x-1 font-mono">
                    <span>{isNotStarted ? 0 : (liveStatus?.telemetry?.speed ?? 0)}</span>
                    <span className="text-xs font-bold text-slate-400">km/h</span>
                  </div>
                  <span className="text-[9.5px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md mt-2 inline-block border border-emerald-500/20">
                    {isNotStarted ? '⏸ Stationary at Origin' : '⚡ Locomotive Telemetry: Active'}
                  </span>
                </div>
                <div className="p-3.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
                  <Gauge className="h-9 w-9" />
                </div>
              </div>

              {/* Next stop ETA card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Next Station ETA</span>
                  <div className="text-2xl font-black text-amber-400 mt-1 flex items-baseline space-x-1 font-mono">
                    <span>{isNotStarted ? 'ETA unavailable' : (liveStatus?.journey?.eta_next_station || 'ETA unavailable')}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 block mt-2">
                    Next Stop: <strong className="text-cyan-300">{liveStatus?.telemetry?.next_station_code || '---'}</strong>
                  </span>
                </div>
                <div className="p-3.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="h-9 w-9" />
                </div>
              </div>

              {/* Progress distance card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Journey Distance Progress</span>
                <div className="flex items-center justify-between text-xs font-black text-slate-200 mt-2">
                  <span>{isNotStarted ? 0 : (liveStatus?.journey?.progress_percent || 0)}% Completed</span>
                  <span className="font-mono text-cyan-300">
                    {isNotStarted ? 0 : Math.round(liveStatus?.telemetry?.distance_travelled_km || 0)} / {liveStatus?.journey?.total_distance_km || 1000} km
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 mt-2 overflow-hidden shadow-inner border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-blue-600 h-2.5 rounded-full transition-all duration-500 shadow-md shadow-cyan-500/50"
                    style={{ width: `${isNotStarted ? 0 : (liveStatus?.journey?.progress_percent || 0)}%` }}
                  ></div>
                </div>
              </div>

            </div>

            {/* Right Column: Vertical Timeline stops dynamically loaded from DB */}
            <div className="md:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Dynamic Route Station Timeline & Schedules</h3>

              <div className="relative pl-8 border-l-2 border-slate-150 space-y-6 py-2 ml-4">
                {(liveStatus?.stops || []).map((stop, idx) => {
                  let pointStyle = 'border-slate-300 bg-white text-slate-300';
                  let textStyle = 'text-slate-400 font-semibold';
                  let cardStyle = 'border-transparent bg-transparent';
                  
                  if (stop.status === 'COMPLETED') {
                    pointStyle = 'border-[#003366] bg-[#003366] text-white shadow-sm';
                    textStyle = 'text-slate-500 font-bold';
                  } else if (stop.status === 'CURRENT') {
                    pointStyle = 'border-green-500 bg-green-500 text-white ring-4 ring-green-100 animate-pulse';
                    textStyle = 'text-slate-850 font-black';
                    cardStyle = 'bg-green-50/50 border-green-100 border p-3.5 rounded-2xl shadow-sm';
                  } else if (stop.status === 'NEXT') {
                    pointStyle = 'border-amber-500 bg-amber-500 text-white ring-4 ring-amber-100';
                    textStyle = 'text-slate-800 font-extrabold';
                  } else {
                    textStyle = 'text-slate-700 font-bold';
                  }

                  return (
                    <div key={idx} className={`relative transition-all duration-300 ${cardStyle}`}>
                      
                      {/* Timeline node */}
                      <span className={`absolute left-[-45px] top-1 flex h-6 w-6 items-center justify-center rounded-full border transition-all ${pointStyle}`}>
                        {stop.status === 'COMPLETED' ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-white" />
                        ) : stop.status === 'CURRENT' ? (
                          <Navigation className="h-3 w-3 text-white rotate-45" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        )}
                      </span>

                      {/* Content block */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-slate-100 border border-slate-200 rounded font-mono font-black px-1.5 py-0.5 text-slate-600">
                              {stop.code}
                            </span>
                            <span className={`text-sm tracking-tight ${textStyle}`}>{stop.name}</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 font-bold mt-1.5 flex flex-wrap items-center gap-2">
                            <span>Platform PF {stop.platform || '1'}</span>
                            <span>&bull;</span>
                            <span>Sch Arr: {stop.arrTime}</span>
                            <span>&bull;</span>
                            <span>Sch Dep: {stop.depTime}</span>
                            {stop.distanceFromOriginKm !== undefined && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono">{stop.distanceFromOriginKm} km</span>
                              </>
                            )}
                          </p>
                        </div>

                        {stop.status === 'CURRENT' && (
                          <span className="rounded-full bg-green-150 text-green-800 px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider animate-pulse">
                            {isNotStarted ? 'ORIGIN TERMINAL' : 'CURRENT POSITION'}
                          </span>
                        )}
                        {stop.status === 'NEXT' && (
                          <span className="rounded-full bg-amber-150 text-amber-800 px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider">
                            NEXT STOP
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* Popular Quick Select list */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-xl mx-auto space-y-4">
            <div className="h-16 w-16 bg-blue-50 text-[#003366] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Compass className="h-8 w-8 animate-spin-slow" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800">Track Current Train Location</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Search by train number above or select any active route below to load dynamic telemetry and Leaflet map tracking.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LiveTracking;
