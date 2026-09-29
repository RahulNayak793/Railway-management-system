import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomDropdown = ({
  options = [],
  value = '',
  onChange,
  label = '',
  placeholder = 'Select option',
  icon: DefaultIcon,
  darkVariant = false,
  id,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  const selectedOption = options.find(opt => 
    opt.value === value || 
    opt.code === value || 
    (Array.isArray(opt.altValues) && opt.altValues.includes(value))
  ) || options[0];

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex(opt => opt.value === selectedOption?.value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, selectedOption]);

  const handleSelect = (option) => {
    if (onChange) {
      onChange(option.value || option.code);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Tab') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (focusedIndex >= 0 && focusedIndex < options.length) {
        handleSelect(options[focusedIndex]);
      }
    }
  };

  useEffect(() => {
    if (isOpen && listRef.current && focusedIndex >= 0) {
      const activeEl = listRef.current.children[focusedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const TriggerIcon = selectedOption?.icon || DefaultIcon;

  return (
    <div 
      ref={dropdownRef} 
      className={`relative w-full station-search-container ${className}`}
      id={id}
    >
      {label && (
        <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 pl-1 ${
          darkVariant ? 'text-slate-300' : 'text-slate-400'
        }`}>
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between backdrop-blur-sm rounded-2xl px-4 py-3.5 border transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer text-left focus:outline-none focus:ring-2 ${
          darkVariant
            ? 'bg-white/10 border-white/20 text-white hover:bg-white/15 focus:ring-white/30 focus:border-white/40'
            : 'bg-white/80 border-slate-200 text-slate-850 hover:bg-white focus:ring-primary-500/20 focus:border-primary-500'
        }`}
      >
        <div className="flex items-center space-x-2.5 truncate pr-2">
          {TriggerIcon && (
            <TriggerIcon className={`h-4.5 w-4.5 flex-shrink-0 ${
              darkVariant ? 'text-primary-300' : 'text-primary-600'
            }`} />
          )}
          <span className="font-extrabold text-sm truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${
          isOpen ? 'rotate-180 text-primary-500' : darkVariant ? 'text-slate-300' : 'text-slate-400'
        }`} />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 right-0 mt-2 max-h-72 overflow-y-auto backdrop-blur-xl rounded-2xl border shadow-2xl z-50 py-1.5 scrollbar-thin transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
            darkVariant
              ? 'bg-slate-900/98 border-slate-700 text-slate-200 divide-slate-800'
              : 'bg-white/98 border-slate-200 text-slate-800 divide-slate-100'
          }`}
        >
          {options.map((option, idx) => {
            const isSelected = selectedOption?.value === option.value;
            const isFocused = focusedIndex === idx;
            const OptionIcon = option.icon;

            return (
              <div
                key={option.value || idx}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors text-xs font-semibold select-none ${
                  isSelected
                    ? darkVariant
                      ? 'bg-primary-900/40 text-primary-300 font-extrabold border-l-4 border-primary-500 pl-3'
                      : 'bg-primary-50 text-primary-800 font-extrabold border-l-4 border-primary-600 pl-3'
                    : isFocused
                    ? darkVariant
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-50 text-slate-900'
                    : darkVariant
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-primary-50/50 hover:text-primary-900'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  {OptionIcon && (
                    <OptionIcon className={`h-4 w-4 flex-shrink-0 ${
                      isSelected
                        ? 'text-primary-600'
                        : darkVariant
                        ? 'text-slate-400'
                        : 'text-slate-400'
                    }`} />
                  )}
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-xs leading-snug">{option.label}</span>
                    {option.description && (
                      <span className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="h-4 w-4 text-primary-600 flex-shrink-0 ml-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
