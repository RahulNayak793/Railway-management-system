import React, { createContext, useContext, useState } from 'react';

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('INR'); // 'INR', 'USD', 'EUR', 'GBP'

  const rates = {
    INR: { symbol: '₹', rate: 1, code: 'INR' },
    USD: { symbol: '$', rate: 0.012, code: 'USD' },
    EUR: { symbol: '€', rate: 0.011, code: 'EUR' },
    GBP: { symbol: '£', rate: 0.0095, code: 'GBP' }
  };

  const formatPrice = (priceInInr) => {
    const numeric = parseFloat(priceInInr) || 0;
    const currentRate = rates[currency] || rates.INR;
    const converted = numeric * currentRate.rate;
    
    if (currency === 'INR') {
      return `₹${Math.round(converted).toLocaleString('en-IN')}`;
    }
    return `${currentRate.symbol}${converted.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, rates }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
