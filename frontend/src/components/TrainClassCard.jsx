import React from 'react';
import { Check, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { getClassLabel } from '../utils/trainClasses';
import { isFoodEligibleClass } from '../utils/cateringEligibilityHelper';

const TrainClassCard = ({
  train,
  classCode,
  className,
  availability,
  fare,
  quota = 'GN',
  selected = false,
  onSelect,
  onBook,
  isDeparted = false,
  classNameCustom = ''
}) => {
  const { formatPrice } = useCurrency();
  const displayName = className || getClassLabel(classCode) || classCode;

  // Resolve status color and display label
  let statusText = 'AVAILABLE';
  let statusType = 'AVL';
  let colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (isDeparted) {
    statusText = 'TRAIN DEPARTED';
    statusType = 'DEPARTED';
    colorStyle = 'bg-slate-100 text-slate-500 border-slate-200';
  } else if (availability) {
    const codeStr = String(availability.code || availability.statusLabel || '').toUpperCase();
    statusType = availability.type || availability.statusType || 'AVL';

    if (codeStr.includes('NOT OPEN') || codeStr.includes('OPENS') || statusType === 'NOT_OPEN') {
      statusText = codeStr;
      colorStyle = 'bg-amber-50 text-amber-800 border-amber-300';
    } else if (codeStr === 'FULL' || codeStr.includes('FULL') || codeStr.includes('NOT AVAILABLE') || codeStr.includes('REGRET') || statusType === 'FULL' || statusType === 'NAV') {
      statusText = codeStr.includes('TATKAL') ? 'TATKAL FULL' : 'FULL';
      colorStyle = 'bg-rose-50 text-rose-700 border-rose-300';
    } else if (codeStr.includes('RAC') || statusType === 'RAC') {
      statusText = codeStr.replace('RAC-', 'RAC ').replace('RAC_', 'RAC ');
      colorStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (codeStr.includes('WL') || statusType === 'WL') {
      statusText = codeStr.replace('WL-', 'WL ').replace('WL_', 'WL ');
      colorStyle = 'bg-rose-50 text-rose-700 border-rose-200';
    } else {
      // Confirmed available
      if (codeStr.includes('AVAILABLE')) {
        const parts = codeStr.split(/[-_\s]+/);
        const count = parts.find(p => /^\d+$/.test(p));
        statusText = count ? `AVAILABLE ${parseInt(count, 10)}` : 'AVAILABLE';
      } else {
        statusText = codeStr || 'AVAILABLE';
      }
      colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  } else {
    statusText = 'AVAILABLE';
    colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(classCode, fare);
    }
  };

  const handleBookClick = (e) => {
    e.stopPropagation();
    if (onBook) {
      onBook(train.id || train.train_number, classCode, fare, train);
    } else if (onSelect) {
      onSelect(classCode, fare);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative min-w-[155px] sm:min-w-[170px] max-w-[190px] flex-shrink-0 rounded-2xl border p-3.5 transition-all duration-300 cursor-pointer select-none flex flex-col justify-between group ${
        selected
          ? 'bg-amber-50/60 border-orange-500 shadow-md ring-2 ring-orange-500/20 translate-y-[-2px]'
          : 'bg-white border-slate-200 hover:border-orange-400 hover:shadow-md hover:bg-slate-50/50'
      } ${classNameCustom}`}
    >
      {/* Selected Tag / Ribbon */}
      {selected && (
        <div className="absolute top-2 right-2 flex items-center justify-center h-5 w-5 rounded-full bg-orange-600 text-white shadow-xs">
          <Check className="h-3 w-3 stroke-[3]" />
        </div>
      )}

      {/* Class Name & Code */}
      <div className="space-y-0.5 mb-2">
        <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm tracking-tight flex items-center justify-between">
          <span className="truncate">{displayName}</span>
          <span className="text-[10px] font-mono text-slate-400 font-bold ml-1 uppercase">({classCode})</span>
        </h5>
      </div>

      {/* Availability Status Badge */}
      <div className="my-1.5 space-y-1">
        <div className={`px-2.5 py-1 rounded-xl border text-[10.5px] font-black uppercase font-mono tracking-wide text-center truncate ${colorStyle}`}>
          {statusText}
        </div>
        
        {/* Class Food Eligibility Status */}
        {isFoodEligibleClass(classCode) ? (
          <div className="text-[9px] font-bold text-slate-600 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/80 flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase">FOOD / MEAL</span>
            <span className="font-extrabold text-emerald-700">Available</span>
          </div>
        ) : (
          <div className="text-[8.5px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60 flex items-center justify-between truncate">
            <span>Food/Catering</span>
            <span className="text-slate-500 font-semibold truncate ml-1">Not Available for this Class</span>
          </div>
        )}
      </div>

      {/* Fare & Book Action */}
      <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between mt-auto gap-1">
        <div className="flex flex-col">
          <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Fare</span>
          <span className="text-sm font-black text-slate-900 font-mono leading-none">
            {formatPrice ? formatPrice(fare || 350) : `₹${fare || 350}`}
          </span>
        </div>

        <button
          type="button"
          onClick={handleBookClick}
          disabled={isDeparted}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wide uppercase transition-all duration-200 active:scale-95 shadow-xs shrink-0 ${
            selected
              ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/30'
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {selected ? 'Book Now' : 'Book Now'}
        </button>
      </div>

    </div>
  );
};

export default TrainClassCard;
