const http = require('http');

http.get('http://localhost:5000/api/trains/live-search?from=UD&to=NDLS&date=2026-10-23', res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Search returned total trains:', data.trains ? data.trains.length : data.length);
      const trainList = data.trains || data;
      const t12345 = trainList.filter(t => String(t.train_number) === '12345');
      console.log('Matching 12345 in search results count:', t12345.length);
      t12345.forEach(t => {
        console.log('12345:', {
          id: t.id,
          train_number: t.train_number,
          train_name: t.train_name,
          available_classes: t.available_classes,
          classes: t.classes,
          date_wise_availability_keys: t.date_wise_availability ? Object.keys(t.date_wise_availability) : null,
          date_wise_SL_count: t.date_wise_availability?.SL?.length
        });
      });

      const demoNums = ['09401', '09403', '09405', '09407', '09433'];
      demoNums.forEach(num => {
        const matches = trainList.filter(t => String(t.train_number) === num);
        console.log(`\nTrain #${num} in search: ${matches.length} matches`);
        matches.forEach(m => {
          console.log({
            id: m.id,
            train_number: m.train_number,
            train_name: m.train_name,
            service_pattern: m.service_pattern,
            frequency: m.frequency,
            specific_service_dates: m.specific_service_dates,
            date_wise_availability_SL: m.date_wise_availability?.SL?.length
          });
        });
      });
    } catch (e) {
      console.error('Parse error:', e);
    }
  });
}).on('error', err => console.error('Request error:', err));
