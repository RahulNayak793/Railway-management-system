const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  if (isMockMode) {
    let userNotifs = Array.from(mockDb.notifications.values()).filter(n => n.user_id === userId);
    
    // Seed some mock notifications if none exist for this user yet
    if (userNotifs.length === 0) {
      const initialNotifs = [
        {
          id: uuidv4(),
          user_id: userId,
          type: 'info',
          title: 'Welcome to RailControl',
          message: 'Your account has been set up successfully. You can now book tickets and track trains.',
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
        },
        {
          id: uuidv4(),
          user_id: userId,
          type: 'success',
          title: 'Identity Verification Complete',
          message: 'Your identity documents have been verified. You can now use all services without restrictions.',
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
        }
      ];
      initialNotifs.forEach(n => mockDb.notifications.set(n.id, n));
      userNotifs = initialNotifs;
    }
    
    return res.json(userNotifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } else {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  if (isMockMode) {
    let count = 0;
    Array.from(mockDb.notifications.values()).forEach(n => {
      if (n.user_id === userId && !n.is_read) {
        n.is_read = true;
        mockDb.notifications.set(n.id, n);
        count++;
      }
    });
    return res.json({ message: 'All notifications marked as read', count });
  } else {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
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

  if (isMockMode) {
    const notif = mockDb.notifications.get(id);
    if (!notif || notif.user_id !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    notif.is_read = true;
    mockDb.notifications.set(id, notif);
    return res.json(notif);
  } else {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
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
    const notif = mockDb.notifications.get(id);
    if (!notif || notif.user_id !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    mockDb.notifications.delete(id);
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
