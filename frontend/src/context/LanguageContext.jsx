import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    home: 'Home',
    bookTicket: 'Book Ticket',
    liveTrainStatus: 'Live Train Status',
    pnrStatus: 'PNR Status',
    stationSchedule: 'Station Schedule',
    myBookings: 'My Bookings',
    catering: 'E-Catering',
    support: 'Support & Help',
    fromStation: 'From Station',
    toStation: 'To Station',
    journeyDate: 'Journey Date',
    class: 'Class',
    searchTrains: 'Search Trains',
    checkPnr: 'Check PNR',
    stationSearch: 'Station Search',
    search: 'Search',
    trainNumber: 'Train Number',
    trainName: 'Train Name',
    departure: 'Departure',
    arrival: 'Arrival',
    status: 'Status',
    passengerDetails: 'Passenger Details',
    totalFare: 'Total Fare',
    accessibility: 'Accessibility',
    language: 'Language'
  },
  hi: {
    home: 'मुख्य पृष्ठ',
    bookTicket: 'टिकट बुक करें',
    liveTrainStatus: 'लाइव ट्रेन स्थिति',
    pnrStatus: 'पीएनआर स्थिति',
    stationSchedule: 'स्टेशन समय-सारणी',
    myBookings: 'मेरी बुकिंग',
    catering: 'ई-कैटरिंग',
    support: 'सहायता एवं समर्थन',
    fromStation: 'प्रस्थान स्टेशन',
    toStation: 'गंतव्य स्टेशन',
    journeyDate: 'यात्रा तिथि',
    class: 'श्रेणी',
    searchTrains: 'ट्रेनें खोजें',
    checkPnr: 'पीएनआर जांचें',
    stationSearch: 'स्टेशन खोज',
    search: 'खोजें',
    trainNumber: 'ट्रेन संख्या',
    trainName: 'ट्रेन नाम',
    departure: 'प्रस्थान',
    arrival: 'आगमन',
    status: 'स्थिति',
    passengerDetails: 'यात्री विवरण',
    totalFare: 'कुल किराया',
    accessibility: 'पहुंच नियंत्रण',
    language: 'भाषा'
  },
  kn: {
    home: 'ಮುಖ್ಯ ಪುಟ',
    bookTicket: 'ಟಿಕೆಟ್ ಕಾಯ್ದಿರಿಸಿ',
    liveTrainStatus: 'ನೇರ ವೇಳೆಾಪಟ್ಟಿ',
    pnrStatus: 'ಪಿಎನ್‌ಆರ್ ಸ್ಥಿತಿ',
    stationSchedule: 'ನಿಲ್ದಾಣದ ವೇಳಾಪಟ್ಟಿ',
    myBookings: 'ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು',
    catering: 'ಇ-ಆಹಾರ',
    support: 'ನೆರವು ಮತ್ತು ಬೆಂಬಲ',
    fromStation: 'ಪ್ರಾರಂಭದ ನಿಲ್ದಾಣ',
    toStation: 'ತಲುಪುವ ನಿಲ್ದಾಣ',
    journeyDate: 'ಪ್ರಯಾಣದ ದಿನಾಂಕ',
    class: 'ತರಗತಿ',
    searchTrains: 'ರೈಲುಗಳನ್ನು ಹುಡುಕಿ',
    checkPnr: 'ಪಿಎನ್‌ಆರ್ ಪರೀಕ್ಷಿಸಿ',
    stationSearch: 'ನಿಲ್ದಾಣ ಹುಡುಕಾಟ',
    search: 'ಹುಡುಕಿ',
    trainNumber: 'ರೈಲು ಸಂಖ್ಯೆ',
    trainName: 'ರೈಲಿನ ಹೆಸರು',
    departure: 'ಹೊರಡುವ ಸಮಯ',
    arrival: 'ತಲುಪುವ ಸಮಯ',
    status: 'ಸ್ಥಿತಿ',
    passengerDetails: 'ಪ್ರಯಾಣಿಕರ ವಿವರಗಳು',
    totalFare: 'ಒಟ್ಟು ದರ',
    accessibility: 'ಪ್ರವೇಶಿಸುವಿಕೆ',
    language: 'ಭಾಷೆ'
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('railway_app_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('railway_app_lang', lang);
  }, [lang]);

  const t = (key) => {
    const dict = translations[lang] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
