const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

// Get feedback / aggregated feedback for a train
router.get('/train/:trainId', async (req, res) => {
  const { trainId } = req.params;

  if (isMockMode) {
    const feedbackList = Array.from(mockDb.feedback.values()).filter(f => f.train_id === trainId);
    
    if (feedbackList.length === 0) {
      return res.json({
        average: 0,
        cleanliness: 0,
        punctuality: 0,
        facilities: 0,
        comfort: 0,
        reviews: []
      });
    }

    const totals = feedbackList.reduce(
      (acc, curr) => {
        acc.cleanliness += curr.cleanliness;
        acc.punctuality += curr.punctuality;
        acc.facilities += curr.facilities;
        acc.comfort += curr.comfort;
        return acc;
      },
      { cleanliness: 0, punctuality: 0, facilities: 0, comfort: 0 }
    );

    const count = feedbackList.length;
    const averages = {
      cleanliness: parseFloat((totals.cleanliness / count).toFixed(1)),
      punctuality: parseFloat((totals.punctuality / count).toFixed(1)),
      facilities: parseFloat((totals.facilities / count).toFixed(1)),
      comfort: parseFloat((totals.comfort / count).toFixed(1))
    };

    const overallAvg = parseFloat(
      ((averages.cleanliness + averages.punctuality + averages.facilities + averages.comfort) / 4).toFixed(1)
    );

    return res.json({
      average: overallAvg,
      ...averages,
      reviews: feedbackList.map(f => {
        const passenger = mockDb.profiles.get(f.passenger_id);
        return {
          id: f.id,
          passenger_name: passenger ? passenger.full_name : 'Passenger',
          comments: f.comments,
          created_at: f.created_at
        };
      })
    });
  } else {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          *,
          passenger:profiles(full_name)
        `)
        .eq('train_id', trainId);

      if (error) throw error;
      
      if (data.length === 0) {
        return res.json({
          average: 0,
          cleanliness: 0,
          punctuality: 0,
          facilities: 0,
          comfort: 0,
          reviews: []
        });
      }

      const count = data.length;
      const cleanlinessSum = data.reduce((sum, f) => sum + (f.cleanliness || 0), 0);
      const punctualitySum = data.reduce((sum, f) => sum + (f.punctuality || 0), 0);
      const facilitiesSum = data.reduce((sum, f) => sum + (f.facilities || 0), 0);
      const comfortSum = data.reduce((sum, f) => sum + (f.comfort || 0), 0);

      const averages = {
        cleanliness: parseFloat((cleanlinessSum / count).toFixed(1)),
        punctuality: parseFloat((punctualitySum / count).toFixed(1)),
        facilities: parseFloat((facilitiesSum / count).toFixed(1)),
        comfort: parseFloat((comfortSum / count).toFixed(1))
      };

      const overallAvg = parseFloat(
        ((averages.cleanliness + averages.punctuality + averages.facilities + averages.comfort) / 4).toFixed(1)
      );

      return res.json({
        average: overallAvg,
        ...averages,
        reviews: data.map(f => ({
          id: f.id,
          passenger_name: f.passenger?.full_name || 'Passenger',
          comments: f.comments,
          created_at: f.created_at
        }))
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Submit Feedback (Passenger only)
router.post('/', authenticateToken, async (req, res) => {
  const { train_id, cleanliness, punctuality, facilities, comfort, comments } = req.body;
  const passengerId = req.user.id;

  if (!train_id) {
    return res.status(400).json({ error: 'train_id is required' });
  }

  if (isMockMode) {
    const feedbackId = 'fb-' + Math.random().toString(36).substr(2, 9);
    const newFeedback = {
      id: feedbackId,
      passenger_id: passengerId,
      train_id,
      cleanliness: parseInt(cleanliness || '5'),
      punctuality: parseInt(punctuality || '5'),
      facilities: parseInt(facilities || '5'),
      comfort: parseInt(comfort || '5'),
      comments: comments || '',
      created_at: new Date().toISOString()
    };
    mockDb.feedback.set(feedbackId, newFeedback);
    return res.status(201).json(newFeedback);
  } else {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          passenger_id: passengerId,
          train_id,
          cleanliness,
          punctuality,
          facilities,
          comfort,
          comments
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

module.exports = router;
