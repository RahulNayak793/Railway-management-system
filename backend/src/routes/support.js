const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

// Get all support tickets
router.get('/tickets', authenticateToken, async (req, res) => {
  const { id: userId, role } = req.user;

  if (isMockMode) {
    let tickets = Array.from(mockDb.support_tickets.values());
    if (role === 'passenger') {
      tickets = tickets.filter(t => t.passenger_id === userId);
    }
    
    // Enrich with passenger full name
    tickets = tickets.map(t => {
      const passenger = mockDb.profiles.get(t.passenger_id);
      return {
        ...t,
        passenger_name: passenger ? passenger.full_name : 'Passenger'
      };
    });

    return res.json(tickets);
  } else {
    try {
      let query = supabase.from('support_tickets').select(`
        *,
        passenger:profiles(full_name)
      `);

      if (role === 'passenger') {
        query = query.eq('passenger_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Create support ticket
router.post('/tickets', authenticateToken, async (req, res) => {
  const { subject, description, priority } = req.body;
  const userId = req.user.id;

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  if (isMockMode) {
    const ticketId = 'tk-' + Math.random().toString(36).substr(2, 9);
    const newTicket = {
      id: ticketId,
      passenger_id: userId,
      subject,
      description: description || '',
      status: 'open',
      priority: priority || 'medium',
      created_at: new Date().toISOString()
    };
    mockDb.support_tickets.set(ticketId, newTicket);
    return res.status(201).json(newTicket);
  } else {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          passenger_id: userId,
          subject,
          description,
          priority: priority || 'medium'
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

// Get messages for a support ticket
router.get('/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;

  if (isMockMode) {
    const messages = Array.from(mockDb.support_messages.values())
      .filter(m => m.ticket_id === ticketId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Enrich message sender names
    const enrichedMessages = messages.map(m => {
      const profile = mockDb.profiles.get(m.sender_id);
      return {
        ...m,
        sender_name: profile ? profile.full_name : 'User',
        sender_role: profile ? profile.role : 'passenger'
      };
    });

    return res.json(enrichedMessages);
  } else {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select(`
          *,
          sender:profiles(full_name, role)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Post a message in a support ticket
router.post('/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;
  const { message, attachment_url } = req.body;
  const userId = req.user.id;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  if (isMockMode) {
    const msgId = 'msg-' + Math.random().toString(36).substr(2, 9);
    const newMsg = {
      id: msgId,
      ticket_id: ticketId,
      sender_id: userId,
      message,
      attachment_url: attachment_url || null,
      created_at: new Date().toISOString()
    };
    mockDb.support_messages.set(msgId, newMsg);

    // Auto-update ticket status if staff responds
    const profile = mockDb.profiles.get(userId);
    const ticket = mockDb.support_tickets.get(ticketId);
    if (ticket && profile && (profile.role === 'staff' || profile.role === 'admin')) {
      ticket.status = 'pending'; // marked as answered / pending customer response
      mockDb.support_tickets.set(ticketId, ticket);
    }

    return res.status(201).json(newMsg);
  } else {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: userId,
          message,
          attachment_url
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
