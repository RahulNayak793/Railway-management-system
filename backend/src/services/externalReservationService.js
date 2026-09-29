/**
 * External Railway Reservation Integration Layer
 * 
 * Provides an interface to genuine external reservation systems (e.g., PRS / IRCTC / Authorized Partner APIs).
 * 
 * CRITICAL RULE:
 * If no real authorized external API is configured, outputs:
 *   EXTERNAL AVAILABILITY: NOT CONNECTED (false)
 * Does NOT generate random external bookings, fake passengers, or dummy PRS data.
 */

async function getExternalAvailability({
  trainNumber,
  journeyDate,
  fromStation,
  toStation,
  classCode,
  quota = 'GN'
}) {
  const externalApiUrl = process.env.EXTERNAL_RESERVATION_API_URL;
  const externalApiKey = process.env.EXTERNAL_RESERVATION_API_KEY;

  // Check if real external API is configured
  if (!externalApiUrl || !externalApiKey) {
    return {
      externalAvailabilityConnected: false,
      source: 'EXTERNAL',
      message: 'External reservation availability is NOT CONNECTED.',
      trainNumber,
      journeyDate,
      fromStation,
      toStation,
      classCode,
      quota,
      occupiedSeats: [],
      timestamp: null
    };
  }

  try {
    // Call genuine external reservation API if configured
    const response = await fetch(`${externalApiUrl}/availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${externalApiKey}`
      },
      body: JSON.stringify({
        train_number: trainNumber,
        journey_date: journeyDate,
        from_station: fromStation,
        to_station: toStation,
        class_code: classCode,
        quota
      })
    });

    if (!response.ok) {
      return {
        externalAvailabilityConnected: true,
        isError: true,
        message: 'External reservation availability could not be verified.',
        occupiedSeats: []
      };
    }

    const data = await response.json();
    return {
      externalAvailabilityConnected: true,
      source: 'EXTERNAL',
      trainNumber,
      journeyDate,
      classCode,
      occupiedSeats: Array.isArray(data.occupiedSeats) ? data.occupiedSeats : [],
      timestamp: data.timestamp || new Date().toISOString()
    };
  } catch (err) {
    console.warn('External reservation API unreachable:', err.message);
    return {
      externalAvailabilityConnected: true,
      isError: true,
      message: 'External reservation availability could not be verified.',
      occupiedSeats: []
    };
  }
}

function getIntegrationStatus() {
  const externalApiUrl = process.env.EXTERNAL_RESERVATION_API_URL;
  const externalApiKey = process.env.EXTERNAL_RESERVATION_API_KEY;
  const isConnected = Boolean(externalApiUrl && externalApiKey);
  return {
    externalAvailabilityConnected: isConnected,
    message: isConnected ? 'EXTERNAL AVAILABILITY: CONNECTED' : 'EXTERNAL AVAILABILITY: NOT CONNECTED'
  };
}

async function fetchExternalAvailability(trainNumber, journeyDate, fromStation, toStation, classCode, quota = 'GN') {
  const res = await getExternalAvailability({ trainNumber, journeyDate, fromStation, toStation, classCode, quota });
  return res.occupiedSeats || [];
}

module.exports = {
  getExternalAvailability,
  getIntegrationStatus,
  fetchExternalAvailability
};
