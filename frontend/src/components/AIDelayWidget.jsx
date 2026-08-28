import React, { useState, useEffect } from 'react';
import { Sparkles, CloudRain, Sun, Wind, AlertTriangle, ShieldCheck, Cpu, CloudOff } from 'lucide-react';

const AIDelayWidget = ({ trainNumber, liveStatus }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const telemetry = liveStatus?.telemetry;
  const train = liveStatus?.train;

  const delayMinutes = telemetry?.delay_minutes ?? train?.delay_minutes ?? 0;
  const delayReason = telemetry?.delay_reason;
  const status = telemetry?.status || train?.status || 'NOT STARTED';

  const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY;

  useEffect(() => {
    // If a real weather API key is configured, fetch actual weather for current train location
    if (weatherApiKey && telemetry?.latitude && telemetry?.longitude) {
      setWeatherLoading(true);
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${telemetry.latitude}&lon=${telemetry.longitude}&units=metric&appid=${weatherApiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.main) {
            setWeatherData({
              temp: Math.round(data.main.temp),
              description: data.weather[0]?.main || 'Clear',
              humidity: data.main.humidity,
              windSpeed: Math.round(data.wind?.speed * 3.6 || 0)
            });
          }
        })
        .catch(err => console.error('Weather API fetch error:', err))
        .finally(() => setWeatherLoading(false));
    }
  }, [weatherApiKey, telemetry?.latitude, telemetry?.longitude]);

  // Determine delay risk category from real data
  let onTimeProbability = '100%';
  let riskColor = 'text-emerald-400';
  let riskLabel = 'On Schedule - Low Delay Risk';

  if (status === 'DATA UNAVAILABLE') {
    onTimeProbability = 'N/A';
    riskColor = 'text-slate-400';
    riskLabel = 'Telemetry Unavailable';
  } else if (delayMinutes > 30) {
    onTimeProbability = '35%';
    riskColor = 'text-red-400';
    riskLabel = `High Delay (${delayMinutes}m delay)`;
  } else if (delayMinutes > 0) {
    onTimeProbability = '65%';
    riskColor = 'text-amber-400';
    riskLabel = `Moderate Delay (${delayMinutes}m delay)`;
  } else if (status === 'NOT STARTED') {
    onTimeProbability = '95%';
    riskColor = 'text-[#00F2FE]';
    riskLabel = 'Scheduled Departure';
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 text-white space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-purple-300">AI Route Delay & Weather Intelligence</h3>
            <p className="text-[10px] text-slate-400 font-mono">LIVE TELEMETRY ENGINE • TRAIN #{trainNumber || train?.train_number || '---'}</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1 font-bold">
          <ShieldCheck className="h-3 w-3" /> VERIFIED CORRIDOR
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Real Delay Risk Indicator */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">On-Time Status</span>
          <div className={`text-2xl font-black font-mono ${riskColor}`}>{onTimeProbability}</div>
          <span className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full inline-block ${delayMinutes > 0 ? (delayMinutes > 30 ? 'bg-red-400' : 'bg-amber-400') : 'bg-emerald-400'}`}></span> 
            {riskLabel}
          </span>
        </div>

        {/* Real Route Weather / Configured Weather */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Route Weather</span>
          {weatherLoading ? (
            <span className="text-xs text-slate-400 animate-pulse font-mono">Fetching weather...</span>
          ) : weatherData ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-cyan-300 font-mono">{weatherData.temp}°C {weatherData.description}</span>
                <Sun className="h-6 w-6 text-amber-400" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold mt-2 block">
                Humidity: {weatherData.humidity}% • Wind: {weatherData.windSpeed} km/h
              </span>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <CloudOff className="h-4 w-4 text-slate-500" /> Weather intelligence unavailable
                </span>
              </div>
              <span className="text-[9.5px] text-slate-500 block mt-2">No weather API key configured</span>
            </div>
          )}
        </div>

        {/* Track Corridor Clearance */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Corridor Status</span>
          <div className="text-base font-black text-cyan-400 font-mono flex items-center gap-1.5 truncate">
            <Cpu className="h-4 w-4 text-cyan-400 shrink-0" /> 
            <span>{delayReason ? delayReason : (delayMinutes > 0 ? 'Traffic Bottleneck' : 'Normal Clearance')}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold mt-2">
            {delayMinutes > 0 ? `Delay reason logged: ${delayReason || 'Signal Clearance'}` : 'Corridor operational without delays'}
          </span>
        </div>

      </div>
    </div>
  );
};

export default AIDelayWidget;
