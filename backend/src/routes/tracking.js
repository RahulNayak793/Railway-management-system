const express = require('express');
const router = express.Router();
const { getLiveStatusForTrain } = require('../utils/liveStatusHelper');

// Registry of SSE client connections per train ID: Map<trainId, Set<{ res, serviceDate }>>
const clientConnections = new Map();

/**
 * GET /api/tracking/train/:trainNumber
 * Direct train number live status tracking endpoint.
 */
router.get('/train/:trainNumber', async (req, res) => {
  try {
    const { trainNumber } = req.params;
    const date = req.query.date || req.query.service_date || req.query.travel_date;
    const liveStatus = await getLiveStatusForTrain(trainNumber, date);
    if (!liveStatus) {
      return res.status(404).json({ success: false, error: 'Train not found or route data unavailable' });
    }
    return res.json(liveStatus);
  } catch (err) {
    console.error('Error fetching train tracking by trainNumber:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch tracking status: ' + err.message });
  }
});

/**
 * GET /api/tracking/stream/:trainId
 * SSE endpoint for streaming live telemetry updates to passengers and staff.
 */
router.get('/stream/:trainId', async (req, res) => {
  const { trainId } = req.params;
  const date = req.query.date || req.query.service_date || req.query.travel_date;

  if (!trainId) {
    return res.status(400).json({ error: 'trainId parameter is required' });
  }

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const clientObj = { res, serviceDate: date };

  // Fetch and send initial live status immediately
  try {
    const initialStatus = await getLiveStatusForTrain(trainId, date);
    if (initialStatus) {
      res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Train not found or data unavailable' })}\n\n`);
    }
  } catch (e) {
    console.error('Error serving initial SSE status:', e.message);
  }

  // Register client connection
  if (!clientConnections.has(trainId)) {
    clientConnections.set(trainId, new Set());
  }
  const trainClients = clientConnections.get(trainId);
  trainClients.add(clientObj);

  // Stream dynamic live telemetry updates every 3 seconds so the client experiences real-time continuous movement
  const streamTimer = setInterval(async () => {
    try {
      const currentStatus = await getLiveStatusForTrain(trainId, date);
      if (currentStatus) {
        res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);
      }
    } catch (e) {
      clearInterval(streamTimer);
    }
  }, 3000);

  // Setup periodic heartbeat every 15 seconds to keep stream active
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(streamTimer);
    clearInterval(heartbeatTimer);
    trainClients.delete(clientObj);
    if (trainClients.size === 0) {
      clientConnections.delete(trainId);
    }
  });
});

/**
 * Broadcast updated live status payload to all connected clients for a given train ID and service date.
 */
async function broadcastTelemetryUpdate(trainId, customPayload = null, serviceDate = null) {
  const trainClients = clientConnections.get(trainId);
  if (!trainClients || trainClients.size === 0) return;

  try {
    const payload = customPayload || await getLiveStatusForTrain(trainId, serviceDate);
    if (!payload) return;

    const dataString = `data: ${JSON.stringify(payload)}\n\n`;
    for (const clientObj of Array.from(trainClients)) {
      try {
        if (!serviceDate || !clientObj.serviceDate || clientObj.serviceDate === serviceDate) {
          clientObj.res.write(dataString);
        }
      } catch (err) {
        trainClients.delete(clientObj);
      }
    }
  } catch (err) {
    console.error('Error broadcasting SSE telemetry update:', err.message);
  }
}

module.exports = {
  router,
  broadcastTelemetryUpdate
};
