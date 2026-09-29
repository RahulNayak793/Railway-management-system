const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase, saveMockDbToFile } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const { status, category, filter } = req.query;

  if (isMockMode) {
    let userNotifs = Array.from(mockDb.notifications.values()).filter(n => {
      if (!n) return false;
      const idMatch = n.user_id === userId || n.passenger_id === userId;
      const emailMatch = Boolean(userEmail && n.user_email && String(n.user_email).toLowerCase() === String(userEmail).toLowerCase());
      return idMatch || emailMatch;
    });

    // Apply status filter
    const statusFilter = status || filter;
    if (statusFilter === 'unread') {
      userNotifs = userNotifs.filter(n => !n.is_read);
    } else if (statusFilter === 'read') {
      userNotifs = userNotifs.filter(n => n.is_read);
    }

    // Apply category filter
    if (category && category !== 'all') {
      if (category === 'train_updates') {
        userNotifs = userNotifs.filter(n => 
          n.type === 'TRAIN_STATUS' || 
          n.type === 'warning' || 
          n.type === 'danger' || 
          n.title?.toLowerCase().includes('train') ||
          n.train_number
        );
      } else if (category === 'booking') {
        userNotifs = userNotifs.filter(n => 
          n.type === 'booking' || 
          n.title?.toLowerCase().includes('booking') || 
          n.title?.toLowerCase().includes('ticket') || 
          n.title?.toLowerCase().includes('confirmed')
        );
      } else if (category === 'payment') {
        userNotifs = userNotifs.filter(n => 
          n.type === 'payment' || 
          n.title?.toLowerCase().includes('payment') || 
          n.title?.toLowerCase().includes('refund')
        );
      } else if (category === 'other') {
        userNotifs = userNotifs.filter(n => 
          n.type !== 'TRAIN_STATUS' && 
          !n.train_number && 
          !n.title?.toLowerCase().includes('train') &&
          !n.title?.toLowerCase().includes('booking') &&
          !n.title?.toLowerCase().includes('payment')
        );
      }
    }

    const sorted = userNotifs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return res.json(sorted);
  } else {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const statusFilter = status || filter;
      if (statusFilter === 'unread') {
        query = query.eq('is_read', false);
      } else if (statusFilter === 'read') {
        query = query.eq('is_read', true);
      }

      if (category && category !== 'all') {
        if (category === 'train_updates') {
          query = query.or('type.eq.TRAIN_STATUS,type.eq.warning,type.eq.danger,title.ilike.%train%');
        } else if (category === 'booking') {
          query = query.or('type.eq.booking,title.ilike.%booking%,title.ilike.%ticket%');
        } else if (category === 'payment') {
          query = query.or('type.eq.payment,title.ilike.%payment%,title.ilike.%refund%');
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const nowIso = new Date().toISOString();

  if (isMockMode) {
    let count = 0;
    Array.from(mockDb.notifications.values()).forEach(n => {
      const match = (n.user_id === userId || n.passenger_id === userId) || (userEmail && n.user_email && String(n.user_email).toLowerCase() === String(userEmail).toLowerCase());
      if (match && !n.is_read) {
        n.is_read = true;
        n.status = 'READ';
        n.read_at = nowIso;
        mockDb.notifications.set(n.id, n);
        count++;
      }
    });
    saveMockDbToFile();
    return res.json({ message: 'All notifications marked as read', count });
  } else {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, status: 'READ', read_at: nowIso })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Mark single notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const notif = mockDb.notifications.get(id) || Array.from(mockDb.notifications.values()).find(n => n.id === id || n.notification_id === id);
    if (!notif || (notif.user_id !== userId && notif.passenger_id !== userId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    notif.is_read = true;
    notif.status = 'READ';
    notif.read_at = nowIso;
    mockDb.notifications.set(notif.id, notif);
    saveMockDbToFile();
    return res.json(notif);
  } else {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, status: 'READ', read_at: nowIso })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  if (isMockMode) {
    const notif = mockDb.notifications.get(id) || Array.from(mockDb.notifications.values()).find(n => n.id === id || n.notification_id === id);
    if (!notif || (notif.user_id !== userId && notif.passenger_id !== userId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    mockDb.notifications.delete(notif.id);
    saveMockDbToFile();
    return res.json({ message: 'Notification deleted' });
  } else {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return res.json({ message: 'Notification deleted' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

module.exports = router;
