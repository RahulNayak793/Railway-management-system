const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isMockMode, mockDb, supabase, saveMockDbToFile } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

// Setup upload directory for mock / dev mode
const uploadDir = path.join(__dirname, '../../data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage & file filter validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'attach-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF, PNG, JPG, JPEG, and WEBP files up to 5 MB are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter
});

const SUPPORTED_CATEGORIES = [
  'Refund & Cancellation',
  'PNR & Booking Issues',
  'Train Schedule',
  'In-Train Catering',
  'Food Order',
  'Lost & Found',
  'Cleanliness / Coach Maintenance',
  'Payment Issues',
  'Account & Login',
  'Other'
];

const VALID_STATUSES = ['open', 'pending', 'closed'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// Simple text sanitizer
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '').trim();
}

// Normalize message object to exact uniform contract
function normalizeMessage(m, ticket, userProfilesMap) {
  let senderId = m.sender_id;
  let senderProfile = userProfilesMap ? userProfilesMap.get(senderId) : null;

  // Fallback to checking m.sender object if present
  if (!senderProfile && m.sender && typeof m.sender === 'object') {
    senderProfile = {
      id: senderId,
      full_name: m.sender.full_name || m.sender_name,
      role: m.sender.role || m.sender_role
    };
  }

  // Fallback defaults based on passenger ownership
  const isPassengerOwner = ticket && (senderId === ticket.passenger_id);
  const fullName = senderProfile ? senderProfile.full_name : (m.sender_name || (isPassengerOwner ? 'Passenger' : 'Support Agent'));
  const role = senderProfile ? senderProfile.role : (m.sender_role || (isPassengerOwner ? 'passenger' : 'staff'));

  return {
    id: m.id,
    ticket_id: m.ticket_id,
    message: m.message || '',
    sender: {
      id: senderId,
      full_name: fullName,
      role: role
    },
    attachment_url: m.attachment_url || null,
    attachment_name: m.attachment_name || null,
    attachment_type: m.attachment_type || null,
    created_at: m.created_at
  };
}

// ==========================================
// 1. FILE UPLOAD ENDPOINT
// ==========================================
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file format.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({
    attachment_url: fileUrl,
    attachment_name: req.file.originalname,
    attachment_type: req.file.mimetype
  });
});

// ==========================================
// 2. GET ALL SUPPORT TICKETS
// ==========================================
router.get('/tickets', authenticateToken, async (req, res) => {
  const { id: userId, role } = req.user;

  if (isMockMode) {
    let tickets = Array.from(mockDb.support_tickets.values());
    if (role === 'passenger') {
      tickets = tickets.filter(t => t.passenger_id === userId);
    }

    // Enrich tickets with passenger_name & ensure defaults
    tickets = tickets.map(t => {
      const passenger = mockDb.profiles.get(t.passenger_id);
      return {
        ...t,
        category: t.category || 'Other',
        pnr: t.pnr || null,
        booking_id: t.booking_id || null,
        priority: t.priority || 'medium',
        passenger_name: passenger ? passenger.full_name : 'Passenger',
        updated_at: t.updated_at || t.created_at
      };
    });

    tickets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
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

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;

      const formatted = (data || []).map(t => ({
        ...t,
        passenger_name: t.passenger?.full_name || 'Passenger'
      }));

      return res.json(formatted);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// ==========================================
// 3. CREATE TICKET
// ==========================================
router.post('/tickets', authenticateToken, async (req, res) => {
  let { subject, description, priority, category, pnr, booking_id } = req.body;
  const userId = req.user.id;

  subject = sanitizeText(subject);
  description = sanitizeText(description);

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }
  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  // Priority validation
  priority = (priority || 'medium').toLowerCase();
  if (!VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority. Must be low, medium, or high.' });
  }

  // Category validation
  category = category ? String(category).trim() : 'Other';
  if (!SUPPORTED_CATEGORIES.includes(category)) {
    return res.status(400).json({ 
      error: `Invalid category. Must be one of: ${SUPPORTED_CATEGORIES.join(', ')}` 
    });
  }

  // PNR / Booking ownership validation
  let validatedBooking = null;
  if (pnr || booking_id) {
    if (isMockMode) {
      const allBookings = Array.from(mockDb.bookings.values());
      validatedBooking = allBookings.find(b => 
        (pnr && b.pnr_number === String(pnr).trim()) || 
        (booking_id && b.id === booking_id)
      );

      if (!validatedBooking) {
        return res.status(400).json({ error: 'Associated PNR or Booking ID not found.' });
      }

      if (req.user.role === 'passenger' && validatedBooking.passenger_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You do not own this booking / PNR.' });
      }
    } else {
      try {
        let bQuery = supabase.from('bookings').select('*');
        if (pnr) bQuery = bQuery.eq('pnr_number', String(pnr).trim());
        else if (booking_id) bQuery = bQuery.eq('id', booking_id);

        const { data: bData, error: bError } = await bQuery.maybeSingle();
        if (bError || !bData) {
          return res.status(400).json({ error: 'Associated PNR or Booking ID not found.' });
        }
        if (req.user.role === 'passenger' && bData.passenger_id !== userId) {
          return res.status(403).json({ error: 'Forbidden: You do not own this booking / PNR.' });
        }
        validatedBooking = bData;
      } catch (err) {
        return res.status(400).json({ error: 'Error validating booking: ' + err.message });
      }
    }
  }

  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const ticketId = 'tk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const passengerProfile = mockDb.profiles.get(userId);

    const newTicket = {
      id: ticketId,
      passenger_id: userId,
      subject,
      description,
      status: 'open',
      priority,
      category,
      pnr: validatedBooking ? validatedBooking.pnr_number : (pnr || null),
      booking_id: validatedBooking ? validatedBooking.id : (booking_id || null),
      passenger_name: passengerProfile ? passengerProfile.full_name : 'Passenger',
      created_at: nowIso,
      updated_at: nowIso
    };

    mockDb.support_tickets.set(ticketId, newTicket);

    // Initial description auto-message in thread
    const initMsgId = 'msg-' + Date.now() + '-init';
    mockDb.support_messages.set(initMsgId, {
      id: initMsgId,
      ticket_id: ticketId,
      sender_id: userId,
      message: description,
      attachment_url: null,
      attachment_name: null,
      attachment_type: null,
      created_at: nowIso
    });

    saveMockDbToFile();
    return res.status(201).json(newTicket);
  } else {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          passenger_id: userId,
          subject,
          description,
          priority,
          category,
          pnr: validatedBooking ? validatedBooking.pnr_number : (pnr || null),
          booking_id: validatedBooking ? validatedBooking.id : (booking_id || null),
          status: 'open'
        })
        .select(`*, passenger:profiles(full_name)`)
        .single();

      if (error) throw error;

      // Create initial message
      await supabase.from('support_messages').insert({
        ticket_id: data.id,
        sender_id: userId,
        message: description
      });

      return res.status(201).json({
        ...data,
        passenger_name: data.passenger?.full_name || 'Passenger'
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// ==========================================
// 4. GET SINGLE TICKET
// ==========================================
router.get('/tickets/:ticketId', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;
  const { id: userId, role } = req.user;

  if (isMockMode) {
    const ticket = mockDb.support_tickets.get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (role === 'passenger' && ticket.passenger_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket' });
    }

    const passenger = mockDb.profiles.get(ticket.passenger_id);
    return res.json({
      ...ticket,
      passenger_name: passenger ? passenger.full_name : 'Passenger'
    });
  } else {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`*, passenger:profiles(full_name)`)
        .eq('id', ticketId)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Ticket not found' });

      if (role === 'passenger' && data.passenger_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket' });
      }

      return res.json({
        ...data,
        passenger_name: data.passenger?.full_name || 'Passenger'
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// ==========================================
// 5. GET MESSAGES FOR A TICKET
// ==========================================
router.get('/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;
  const { id: userId, role } = req.user;

  if (isMockMode) {
    const ticket = mockDb.support_tickets.get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (role === 'passenger' && ticket.passenger_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket messages' });
    }

    const messages = Array.from(mockDb.support_messages.values())
      .filter(m => m.ticket_id === ticketId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const normalized = messages.map(m => normalizeMessage(m, ticket, mockDb.profiles));
    return res.json(normalized);
  } else {
    try {
      // Access check
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (role === 'passenger' && ticket.passenger_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket messages' });
      }

      const { data: rawMsgs, error: mErr } = await supabase
        .from('support_messages')
        .select(`
          *,
          sender:profiles(id, full_name, role)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (mErr) throw mErr;

      const normalized = (rawMsgs || []).map(m => normalizeMessage(m, ticket, null));
      return res.json(normalized);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// ==========================================
// 6. POST MESSAGE IN TICKET
// ==========================================
router.post('/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;
  let { message, attachment_url, attachment_name, attachment_type } = req.body;
  const { id: userId, role } = req.user;

  message = sanitizeText(message);

  if (!message && !attachment_url) {
    return res.status(400).json({ error: 'Message text or attachment is required.' });
  }

  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const ticket = mockDb.support_tickets.get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (role === 'passenger' && ticket.passenger_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You cannot send messages to this ticket.' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Ticket is closed. Reopen ticket to send messages.' });
    }

    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const newMsgRaw = {
      id: msgId,
      ticket_id: ticketId,
      sender_id: userId,
      message: message || '',
      attachment_url: attachment_url || null,
      attachment_name: attachment_name || null,
      attachment_type: attachment_type || null,
      created_at: nowIso
    };

    mockDb.support_messages.set(msgId, newMsgRaw);

    // Update ticket updated_at and status handling
    ticket.updated_at = nowIso;
    const userProfile = mockDb.profiles.get(userId);
    if (userProfile && (userProfile.role === 'staff' || userProfile.role === 'admin')) {
      ticket.status = 'pending'; // marked as answered / pending customer response
    }
    mockDb.support_tickets.set(ticketId, ticket);

    saveMockDbToFile();

    // Mock notification logging hook
    console.log(`[SUPPORT NOTIFICATION] New response on ticket ${ticketId} from ${userId} (${role})`);

    const normalized = normalizeMessage(newMsgRaw, ticket, mockDb.profiles);
    return res.status(201).json(normalized);
  } else {
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (role === 'passenger' && ticket.passenger_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You cannot send messages to this ticket.' });
      }

      if (ticket.status === 'closed') {
        return res.status(400).json({ error: 'Ticket is closed. Reopen ticket to send messages.' });
      }

      const { data: inserted, error: mErr } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: userId,
          message: message || '',
          attachment_url: attachment_url || null,
          attachment_name: attachment_name || null,
          attachment_type: attachment_type || null
        })
        .select(`*, sender:profiles(id, full_name, role)`)
        .single();

      if (mErr) throw mErr;

      // Touch ticket updated_at
      await supabase
        .from('support_tickets')
        .update({ updated_at: nowIso })
        .eq('id', ticketId);

      const normalized = normalizeMessage(inserted, ticket, null);
      return res.status(201).json(normalized);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// ==========================================
// 7. UPDATE TICKET STATUS (PATCH /tickets/:ticketId)
// ==========================================
router.patch('/tickets/:ticketId', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;
  let { status } = req.body;
  const { id: userId, role } = req.user;

  if (!status) {
    return res.status(400).json({ error: 'Status field is required.' });
  }

  status = String(status).toLowerCase().trim();
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ 
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
    });
  }

  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const ticket = mockDb.support_tickets.get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (role === 'passenger') {
      if (ticket.passenger_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You cannot change status of this ticket.' });
      }
      // Passengers can only close ('closed') or reopen ('open') their own ticket
      if (status !== 'closed' && status !== 'open') {
        return res.status(400).json({ error: 'Passengers can only set status to closed or open.' });
      }
    }

    ticket.status = status;
    ticket.updated_at = nowIso;
    mockDb.support_tickets.set(ticketId, ticket);

    saveMockDbToFile();

    const passengerProfile = mockDb.profiles.get(ticket.passenger_id);
    return res.json({
      ...ticket,
      passenger_name: passengerProfile ? passengerProfile.full_name : 'Passenger'
    });
  } else {
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });

      if (role === 'passenger') {
        if (ticket.passenger_id !== userId) {
          return res.status(403).json({ error: 'Forbidden: You cannot change status of this ticket.' });
        }
        if (status !== 'closed' && status !== 'open') {
          return res.status(400).json({ error: 'Passengers can only set status to closed or open.' });
        }
      }

      const { data: updated, error: uErr } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: nowIso })
        .eq('id', ticketId)
        .select(`*, passenger:profiles(full_name)`)
        .single();

      if (uErr) throw uErr;

      return res.json({
        ...updated,
        passenger_name: updated.passenger?.full_name || 'Passenger'
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

module.exports = router;
