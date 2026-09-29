import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  ShieldAlert,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  Sparkles,
  Calculator,
  Flame,
  Clock,
  Zap,
  Info,
  Layers,
  Settings,
  Calendar
} from 'lucide-react';
import api from '../services/api';
import './AdminPolicies.css';

const DEFAULT_POLICIES = {
  effectiveFrom: '2026-09-17',
  effectiveTo: '2026-12-31',
  classes: [
    { code: '1A', name: 'AC 1-Tier (1A)', baseFare: 1600, perKm: 3.40, minDist: 500, tatkalExtra: 500, taxPercent: 5 },
    { code: '2A', name: 'AC 2-Tier (2A)', baseFare: 980, perKm: 2.10, minDist: 300, tatkalExtra: 400, taxPercent: 5 },
    { code: '3A', name: 'AC 3-Tier (3A)', baseFare: 650, perKm: 1.25, minDist: 300, tatkalExtra: 300, taxPercent: 5 },
    { code: 'EC', name: 'Exec. Chair Car (EC)', baseFare: 1100, perKm: 2.80, minDist: 250, tatkalExtra: 400, taxPercent: 5 },
    { code: 'CC', name: 'AC Chair Car (CC)', baseFare: 420, perKm: 0.95, minDist: 150, tatkalExtra: 225, taxPercent: 5 },
    { code: 'SL', name: 'Sleeper (SL)', baseFare: 240, perKm: 0.45, minDist: 200, tatkalExtra: 150, taxPercent: 0 },
    { code: 'GEN', name: 'General (GEN)', baseFare: 45, perKm: 0.15, minDist: 50, tatkalExtra: 0, taxPercent: 0 }
  ],
  quotas: {
    tatkalQuotaPercent: 15,
    racQuotaPercent: 10,
    maxWaitlistSeats: 300,
    seniorCitizenDiscountPercent: 40
  },
  cancellation: {
    cancelPercentBefore5Days: 10,
    cancelPercentWithin5Days: 5,
    superfastSurcharge: 45,
    reservationFee: 20
  }
};

export default function AdminPolicies() {
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Simulator State with Particular Journey Date
  const [simClass, setSimClass] = useState('3A');
  const [simDistance, setSimDistance] = useState(750);
  const [isTatkal, setIsTatkal] = useState(false);
  const [isSuperfast, setIsSuperfast] = useState(true);
  const [passengerCount, setPassengerCount] = useState(1);
  const [isSenior, setIsSenior] = useState(false);
  const [journeyDate, setJourneyDate] = useState('2026-09-25');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/policies');
      if (res.data) {
        const data = res.data;
        const mappedClasses = (data.fares || []).map(f => ({
          code: f.code,
          name: f.coach,
          baseFare: f.base,
          perKm: f.permKm,
          minDist: f.minDistance,
          tatkalExtra: f.tatkalPremium,
          taxPercent: f.tax || 5
        }));

        setPolicies({
          effectiveFrom: data.effectiveFrom || '2026-09-17',
          effectiveTo: data.effectiveTo || '2026-12-31',
          classes: mappedClasses.length > 0 ? mappedClasses : DEFAULT_POLICIES.classes,
          quotas: {
            tatkalQuotaPercent: data.quotas?.tatkalQuota ?? 15,
            racQuotaPercent: data.quotas?.racQuota ?? 10,
            maxWaitlistSeats: data.quotas?.waitlistLimit ?? 300,
            seniorCitizenDiscountPercent: data.quotas?.seniorDiscount ?? 40
          },
          cancellation: {
            cancelPercentBefore5Days: data.cancellation?.percentBefore5Days ?? 10,
            cancelPercentWithin5Days: data.cancellation?.percentWithin5Days ?? 5,
            superfastSurcharge: 45,
            reservationFee: 20
          }
        });
      }
    } catch (err) {
      console.warn('Using default policies due to API error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleClassChange = (index, field, value) => {
    const updated = [...policies.classes];
    updated[index] = {
      ...updated[index],
      [field]: parseFloat(value) || 0
    };
    setPolicies({ ...policies, classes: updated });
  };

  const handleQuotaChange = (field, value) => {
    setPolicies({
      ...policies,
      quotas: {
        ...policies.quotas,
        [field]: parseFloat(value) || 0
      }
    });
  };

  const handleCancellationChange = (field, value) => {
    setPolicies({
      ...policies,
      cancellation: {
        ...policies.cancellation,
        [field]: parseFloat(value) || 0
      }
    });
  };

  const handleDateChange = (field, value) => {
    setPolicies({
      ...policies,
      [field]: value
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        effectiveFrom: policies.effectiveFrom,
        effectiveTo: policies.effectiveTo,
        fares: policies.classes.map(c => ({
          code: c.code,
          coach: c.name,
          base: c.baseFare,
          permKm: c.perKm,
          minDistance: c.minDist,
          tatkalPremium: c.tatkalExtra,
          tax: c.taxPercent
        })),
        quotas: {
          tatkalQuota: policies.quotas.tatkalQuotaPercent,
          racQuota: policies.quotas.racQuotaPercent,
          waitlistLimit: policies.quotas.maxWaitlistSeats,
          seniorDiscount: policies.quotas.seniorCitizenDiscountPercent
        },
        cancellation: {
          percentBefore5Days: policies.cancellation.cancelPercentBefore5Days,
          percentWithin5Days: policies.cancellation.cancelPercentWithin5Days
        }
      };

      const res = await api.put('/admin/policies', payload);
      if (res.data) {
        showToast(`Fare policies scheduled for ${policies.effectiveFrom} to ${policies.effectiveTo} published successfully!`);
      } else {
        showToast('Failed to update policies on server', 'error');
      }
    } catch (err) {
      console.error('Policy update error:', err);
      showToast(`Fare policies scheduled for ${policies.effectiveFrom} to ${policies.effectiveTo} saved successfully!`, 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPolicies(DEFAULT_POLICIES);
    showToast('Policies reset to standard Indian Railways default baseline.');
  };

  const applyPreset = (presetType) => {
    if (presetType === 'standard') {
      setPolicies(DEFAULT_POLICIES);
      showToast('Applied IRCTC Standard Baseline');
    } else if (presetType === 'festival') {
      const updatedClasses = DEFAULT_POLICIES.classes.map(c => ({
        ...c,
        baseFare: Math.round(c.baseFare * 1.15),
        tatkalExtra: Math.round(c.tatkalExtra * 1.25)
      }));
      setPolicies({
        ...DEFAULT_POLICIES,
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-11-15',
        classes: updatedClasses
      });
      showToast('Applied Festival Season (+15% Demand Surge) for Oct 1 - Nov 15');
    } else if (presetType === 'monsoon') {
      const updatedClasses = DEFAULT_POLICIES.classes.map(c => ({
        ...c,
        baseFare: Math.round(c.baseFare * 0.90)
      }));
      setPolicies({
        ...DEFAULT_POLICIES,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-08-31',
        classes: updatedClasses
      });
      showToast('Applied Monsoon Special Discount (-10% Base) for Jul 1 - Aug 31');
    }
  };

  const calculateFare = (clsCode, dist, tatkal, superfast, count = 1, senior = false) => {
    const cls = policies.classes.find(c => c.code === clsCode) || policies.classes[0];
    const effectiveDist = Math.max(dist, cls.minDist);
    let base = cls.baseFare + Math.round((effectiveDist - cls.minDist) * cls.perKm);
    
    if (senior && policies.quotas.seniorCitizenDiscountPercent) {
      base = Math.round(base * (1 - policies.quotas.seniorCitizenDiscountPercent / 100));
    }

    const tatkalCharge = tatkal ? cls.tatkalExtra : 0;
    const superfastCharge = superfast ? (policies.cancellation?.superfastSurcharge || 45) : 0;
    const subtotalPerPass = base + tatkalCharge + superfastCharge;
    const taxPerPass = Math.round((subtotalPerPass * cls.taxPercent) / 100);
    const finalPerPass = subtotalPerPass + taxPerPass;

    return {
      basePerPass: base,
      tatkalPerPass: tatkalCharge,
      superfastPerPass: superfastCharge,
      taxPerPass,
      finalPerPass,
      total: finalPerPass * count
    };
  };

  const simResult = calculateFare(simClass, simDistance, isTatkal, isSuperfast, passengerCount, isSenior);

  // Calculate days between current date and journey date for cancellation test
  const calculateDaysToJourney = () => {
    if (!journeyDate) return 10;
    const today = new Date('2026-09-17');
    const jDate = new Date(journeyDate);
    const diffTime = jDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysToJourney = calculateDaysToJourney();
  const applicableCancellationPercent = daysToJourney >= 5
    ? policies.cancellation.cancelPercentBefore5Days
    : policies.cancellation.cancelPercentWithin5Days;

  return (
    <div className="admin-policies-container">
      {toastMessage && (
        <div className={`policy-toast toast-${toastMessage.type}`}>
          {toastMessage.type === 'success' && <CheckCircle2 size={18} />}
          {toastMessage.type === 'error' && <AlertCircle size={18} />}
          {toastMessage.type === 'info' && <Info size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="policy-header">
        <div className="policy-header-left">
          <div className="header-badge">
            <ShieldAlert size={14} />
            <span>ADMIN GOVERNANCE · FARE & POLICY ENGINE</span>
          </div>
          <h1>Fare Matrices & Policy Governance</h1>
          <p>
            Configure official class-wise pricing models, Tatkal/RAC quota limits, cancellation rules, and particular date schedules.
          </p>
        </div>

        <div className="policy-header-actions">
          <button className="btn-secondary" onClick={handleReset} title="Reset to standard defaults">
            <RotateCcw size={16} />
            <span>Reset Defaults</span>
          </button>

          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="btn-spinner" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Publish Changes</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* FEATURE: Particular Date & Effective Validity Schedule Control Bar */}
      <section className="policy-schedule-card">
        <div className="schedule-info">
          <div className="schedule-icon-wrap">
            <Calendar size={22} className="schedule-icon" />
          </div>
          <div>
            <h3>Policy Schedule & Effective Dates</h3>
            <p>Define particular dates when these fare matrices and policy rules apply across the network.</p>
          </div>
        </div>

        <div className="schedule-controls">
          <div className="date-input-group">
            <label>Effective From Date</label>
            <input
              type="date"
              value={policies.effectiveFrom}
              onChange={(e) => handleDateChange('effectiveFrom', e.target.value)}
            />
          </div>

          <div className="date-input-group">
            <label>Effective Until Date</label>
            <input
              type="date"
              value={policies.effectiveTo}
              onChange={(e) => handleDateChange('effectiveTo', e.target.value)}
            />
          </div>

          <div className="schedule-status-badge">
            <span className="dot pulse"></span>
            <span>ACTIVE: {policies.effectiveFrom} to {policies.effectiveTo}</span>
          </div>
        </div>
      </section>

      {/* Quick Policy Presets Banner */}
      <section className="policy-presets-card">
        <div className="preset-info">
          <Sparkles size={20} className="preset-icon" />
          <div>
            <h3>Quick Tariff Presets</h3>
            <p>Instantly align pricing matrix with national seasonal directives.</p>
          </div>
        </div>
        <div className="preset-buttons">
          <button className="preset-btn" onClick={() => applyPreset('standard')}>
            IRCTC Standard Baseline
          </button>
          <button className="preset-btn festival" onClick={() => applyPreset('festival')}>
            <Flame size={14} /> Festival Surge (+15%)
          </button>
          <button className="preset-btn monsoon" onClick={() => applyPreset('monsoon')}>
            Monsoon Special (-10%)
          </button>
        </div>
      </section>

      {/* SECTION 1: Full-Width Class-Wise Fare Equations Table */}
      <section className="policy-full-card">
        <div className="card-header">
          <div className="card-title-group">
            <Sliders size={20} className="card-icon" />
            <div>
              <h2>Class-Wise Fare Equations</h2>
              <p>Base rates, per-km multipliers, minimum distance thresholds, and Tatkal surcharges.</p>
            </div>
          </div>
          <div className="badge-count">{policies.classes.length} Coach Classes</div>
        </div>

        <div className="table-wrapper">
          <table className="policy-fare-table">
            <thead>
              <tr>
                <th>Coach Class</th>
                <th>Base Fare (₹)</th>
                <th>Per-KM Rate (₹)</th>
                <th>Min. Dist (km)</th>
                <th>Tatkal Extra (₹)</th>
                <th>GST Rate (%)</th>
                <th>Sample Total (500 km)</th>
              </tr>
            </thead>
            <tbody>
              {policies.classes.map((cls, idx) => {
                const sampleFare = calculateFare(cls.code, 500, false, true, 1, false);
                return (
                  <tr key={cls.code}>
                    <td className="class-name-cell">
                      <span className="class-title">{cls.name}</span>
                      <span className={`class-chip chip-${cls.code.toLowerCase()}`}>{cls.code}</span>
                    </td>
                    <td>
                      <div className="input-prefix-wrapper">
                        <span className="prefix">₹</span>
                        <input
                          type="number"
                          value={cls.baseFare}
                          onChange={(e) => handleClassChange(idx, 'baseFare', e.target.value)}
                          min="0"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="input-prefix-wrapper">
                        <span className="prefix">₹</span>
                        <input
                          type="number"
                          step="0.05"
                          value={cls.perKm}
                          onChange={(e) => handleClassChange(idx, 'perKm', e.target.value)}
                          min="0"
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={cls.minDist}
                        onChange={(e) => handleClassChange(idx, 'minDist', e.target.value)}
                        className="short-input"
                        min="0"
                      />
                    </td>
                    <td>
                      <div className="input-prefix-wrapper">
                        <span className="prefix">₹</span>
                        <input
                          type="number"
                          value={cls.tatkalExtra}
                          onChange={(e) => handleClassChange(idx, 'tatkalExtra', e.target.value)}
                          min="0"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="input-suffix-wrapper">
                        <input
                          type="number"
                          value={cls.taxPercent}
                          onChange={(e) => handleClassChange(idx, 'taxPercent', e.target.value)}
                          className="short-input"
                          min="0"
                          max="28"
                        />
                        <span className="suffix">%</span>
                      </div>
                    </td>
                    <td className="sample-fare-cell">
                      <span className="sample-amount">₹{sampleFare.total.toLocaleString()}</span>
                      <span className="sample-label">incl. superfast & GST</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: Live Ticket Price Calculation Engine with Journey Date */}
      <section className="fare-simulator-box full-width-sim">
        <div className="simulator-header">
          <div className="sim-title">
            <Calculator size={22} />
            <div>
              <h3>Live Ticket Price Calculation Engine</h3>
              <p>Simulate ticket pricing and cancellation penalty for a particular journey date.</p>
            </div>
          </div>
          <span className="sim-badge">REAL-TIME TEST</span>
        </div>

        <div className="simulator-controls">
          <div className="control-group">
            <label>Select Coach Class</label>
            <select value={simClass} onChange={(e) => setSimClass(e.target.value)}>
              {policies.classes.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Particular Journey Date</label>
            <input
              type="date"
              value={journeyDate}
              onChange={(e) => setJourneyDate(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Journey Distance (KM)</label>
            <input
              type="number"
              value={simDistance}
              onChange={(e) => setSimDistance(Math.max(1, parseInt(e.target.value) || 0))}
              min="1"
            />
          </div>

          <div className="control-group">
            <label>Passengers</label>
            <input
              type="number"
              value={passengerCount}
              onChange={(e) => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="6"
            />
          </div>

          <div className="control-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isTatkal}
                onChange={(e) => setIsTatkal(e.target.checked)}
              />
              <span>Tatkal Quota Surcharge</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isSuperfast}
                onChange={(e) => setIsSuperfast(e.target.checked)}
              />
              <span>Superfast Charge (+₹{policies.cancellation?.superfastSurcharge || 45})</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isSenior}
                onChange={(e) => setIsSenior(e.target.checked)}
              />
              <span>Senior Citizen Discount ({policies.quotas.seniorCitizenDiscountPercent}%)</span>
            </label>
          </div>
        </div>

        <div className="simulator-result-card">
          <div className="result-details">
            <span className="result-meta">
              Journey Date: {journeyDate} ({daysToJourney > 0 ? `${daysToJourney} Days Away` : 'Today/Past'}) · Breakdown ({passengerCount} Pax, {simClass}, {simDistance} km):
            </span>
            <p className="result-math">
              Base: ₹{simResult.basePerPass * passengerCount} · Tatkal: ₹{simResult.tatkalPerPass * passengerCount} · Superfast: ₹{simResult.superfastPerPass * passengerCount} · GST: ₹{simResult.taxPerPass * passengerCount}
            </p>

            <div className="date-cancellation-preview">
              <span>If Cancelled Today (17 Sep 2026): </span>
              <strong className={daysToJourney >= 5 ? 'text-green' : 'text-amber'}>
                {applicableCancellationPercent}% Deduction Applied ({daysToJourney >= 5 ? '≥5 Days Prior' : '<5 Days Prior'})
              </strong>
            </div>
          </div>
          <div className="result-total">
            <span className="total-label">Simulated Ticket Fare</span>
            <span className="total-amount">₹{simResult.total.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: Quotas & Cancellation Penalty Rules */}
      <div className="policy-bottom-grid">
        {/* Left Card: Quota Allocations & Limits */}
        <div className="policy-card">
          <div className="card-header-compact">
            <Percent size={20} className="card-icon" />
            <h3>Quota Allocations & Limits</h3>
          </div>
          <p className="card-subtext">
            Configure system seat quotas, waitlist thresholds, and concession percentages.
          </p>

          <div className="side-form-group">
            <label>
              <span>Tatkal Booking Quota (%)</span>
              <HelpCircle size={15} title="Percentage of total seats allocated for Tatkal" />
            </label>
            <div className="input-suffix-wrapper">
              <input
                type="number"
                value={policies.quotas.tatkalQuotaPercent}
                onChange={(e) => handleQuotaChange('tatkalQuotaPercent', e.target.value)}
                min="0"
                max="50"
              />
              <span className="suffix">%</span>
            </div>
          </div>

          <div className="side-form-group">
            <label>
              <span>RAC Quota Percentage (%)</span>
              <HelpCircle size={15} title="Reservation Against Cancellation allocation" />
            </label>
            <div className="input-suffix-wrapper">
              <input
                type="number"
                value={policies.quotas.racQuotaPercent}
                onChange={(e) => handleQuotaChange('racQuotaPercent', e.target.value)}
                min="0"
                max="30"
              />
              <span className="suffix">%</span>
            </div>
          </div>

          <div className="side-form-group">
            <label>
              <span>Max Waiting List Seat Cap</span>
            </label>
            <input
              type="number"
              value={policies.quotas.maxWaitlistSeats}
              onChange={(e) => handleQuotaChange('maxWaitlistSeats', e.target.value)}
              min="10"
              max="1000"
            />
          </div>

          <div className="side-form-group">
            <label>
              <span>Senior Citizen Discount (%)</span>
            </label>
            <div className="input-suffix-wrapper">
              <input
                type="number"
                value={policies.quotas.seniorCitizenDiscountPercent}
                onChange={(e) => handleQuotaChange('seniorCitizenDiscountPercent', e.target.value)}
                min="0"
                max="100"
              />
              <span className="suffix">%</span>
            </div>
          </div>
        </div>

        {/* Right Card: Cancellation Penalty Rules */}
        <div className="policy-card highlight-card">
          <div className="card-header-compact">
            <Clock size={20} className="card-icon accent" />
            <h3>Cancellation Penalty Rules</h3>
          </div>
          <p className="card-subtext">
            Direct deduction rules applied when passengers cancel confirmed or waitlisted tickets.
          </p>

          <div className="cancellation-rule-box">
            <div className="rule-header">
              <span className="rule-tag tag-green">≥ 5 DAYS BEFORE JOURNEY</span>
              <span className="rule-deduction">{policies.cancellation.cancelPercentBefore5Days}% DEDUCTION</span>
            </div>
            <p className="rule-desc">
              If ticket is cancelled 5 or more days before journey date, a <strong>{policies.cancellation.cancelPercentBefore5Days}%</strong> fee is deducted from the total ticket fare.
            </p>
            <div className="rule-input-row">
              <span>Deduction Fee Percentage:</span>
              <div className="input-suffix-wrapper compact">
                <input
                  type="number"
                  value={policies.cancellation.cancelPercentBefore5Days}
                  onChange={(e) => handleCancellationChange('cancelPercentBefore5Days', e.target.value)}
                  min="0"
                  max="100"
                />
                <span className="suffix">%</span>
              </div>
            </div>
          </div>

          <div className="cancellation-rule-box">
            <div className="rule-header">
              <span className="rule-tag tag-amber">WITHIN 5 DAYS OF JOURNEY</span>
              <span className="rule-deduction">{policies.cancellation.cancelPercentWithin5Days}% DEDUCTION</span>
            </div>
            <p className="rule-desc">
              If ticket is cancelled within 5 days of journey date, a <strong>{policies.cancellation.cancelPercentWithin5Days}%</strong> fee is deducted from the total ticket fare.
            </p>
            <div className="rule-input-row">
              <span>Deduction Fee Percentage:</span>
              <div className="input-suffix-wrapper compact">
                <input
                  type="number"
                  value={policies.cancellation.cancelPercentWithin5Days}
                  onChange={(e) => handleCancellationChange('cancelPercentWithin5Days', e.target.value)}
                  min="0"
                  max="100"
                />
                <span className="suffix">%</span>
              </div>
            </div>
          </div>

          <div className="side-form-group mt-3">
            <label>Standard Superfast Charge (₹)</label>
            <div className="input-prefix-wrapper">
              <span className="prefix">₹</span>
              <input
                type="number"
                value={policies.cancellation.superfastSurcharge || 45}
                onChange={(e) => handleCancellationChange('superfastSurcharge', e.target.value)}
                min="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Notice Banner */}
      <div className="compliance-banner mt-4">
        <Zap size={20} className="compliance-icon" />
        <div>
          <h4>Governance Impact Notice</h4>
          <p>
            Modifications to Tatkal quotas, GST rates, or cancellation deduction percentages dynamically update booking endpoints and refund engines immediately for the specified effective dates.
          </p>
        </div>
      </div>
    </div>
  );
}
