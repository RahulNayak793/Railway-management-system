import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Plus, FileText, Send, Paperclip, CheckCircle, 
  Search, Filter, RefreshCw, AlertCircle, ChevronDown, ChevronUp, 
  Phone, Shield, LifeBuoy, X, ExternalLink, Download, Image as ImageIcon,
  ArrowLeft, Clock, Tag, Ticket as TicketIcon, Lock, HelpCircle
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const SUPPORT_CATEGORIES = [
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

const FAQS = [
  {
    q: 'How do I cancel my ticket?',
    a: 'Navigate to "My Bookings", select your upcoming journey, and click "Request Cancellation". Cancellation charges and refund eligibility are processed according to Indian Railways cancellation rules.'
  },
  {
    q: 'How long does a refund take?',
    a: 'Refunds are generally credited back to the original payment method within 3 to 7 working days, depending on the applicable railway and payment gateway settlement policies.'
  },
  {
    q: 'How do I check my PNR status?',
    a: 'You can check your PNR status instantly by entering your 10-digit PNR number in the search bar on the Home page or in "My Bookings".'
  },
  {
    q: 'How do I select a seat?',
    a: 'During train ticket booking, after entering passenger details, you can use our interactive Coach Berth layout to choose your preferred berth (Lower, Upper, Side Lower, etc.).'
  },
  {
    q: 'How do I report a missing item?',
    a: 'Create a support ticket under the category "Lost & Found" with your PNR, train number, and coach/berth details. You can also dial helpline 139 immediately.'
  },
  {
    q: 'How do I report a catering issue?',
    a: 'Select category "In-Train Catering" or "Food Order" when raising a support ticket, or use the live feedback tool in your active booking manifest.'
  },
  {
    q: 'How do I contact railway support?',
    a: 'Dial the official 24/7 RailMadad helpline at 139 from any phone, or raise an online support ticket right here in your passenger dashboard.'
  },
  {
    q: 'How do I change passenger details?',
    a: 'Name or age modifications on confirmed e-tickets must be submitted at computerized Railway Reservation Counters along with valid photo ID at least 24 hours prior to scheduled departure.'
  },
  {
    q: 'What happens if my train is delayed?',
    a: 'If a train is delayed by more than 3 hours and you choose not to travel, you can file a TDR (Ticket Deposit Receipt) before the actual departure of the train for full fare refund consideration.'
  },
  {
    q: 'How can I raise a payment complaint?',
    a: 'If your money was debited without ticket generation, money is automatically refunded by your bank within 3-5 business days. You can also raise a ticket under category "Payment Issues" with your Transaction Reference ID.'
  }
];

const SupportTickets = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'pending' | 'closed'

  // Bookings list for ticket dropdown
  const [userBookings, setUserBookings] = useState([]);

  // File attachment state for new message
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // File attachment state for new ticket modal
  const [modalFile, setModalFile] = useState(null);
  const modalFileInputRef = useRef(null);

  // New ticket modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newCategory, setNewCategory] = useState('Refund & Cancellation');
  const [selectedBookingId, setSelectedBookingId] = useState('');

  // Mobile view state
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  // FAQ open states
  const [openFaq, setOpenFaq] = useState(null);

  // Chat auto scroll ref
  const messagesEndRef = useRef(null);

  // Fetch passenger bookings for the dropdown
  const fetchUserBookings = async () => {
    try {
      const res = await api.get('/bookings');
      if (Array.isArray(res.data)) {
        setUserBookings(res.data);
      }
    } catch (err) {
      console.warn('Failed to load user bookings for dropdown:', err);
    }
  };

  // Fetch all support tickets
  const fetchTickets = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/support/tickets');
      const data = Array.isArray(res.data) ? res.data : [];
      setTickets(data);

      if (data.length > 0 && !activeTicket) {
        handleSelectTicket(data[0]);
      } else if (activeTicket) {
        // Keep activeTicket updated
        const updated = data.find(t => t.id === activeTicket.id);
        if (updated) setActiveTicket(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchUserBookings();
  }, []);

  // Poll messages every 5 seconds for the active ticket
  useEffect(() => {
    if (!activeTicket) return;

    const fetchMessagesSilently = async () => {
      try {
        const res = await api.get(`/support/tickets/${activeTicket.id}/messages`);
        if (Array.isArray(res.data)) {
          setMessages(prev => {
            // Deduplicate and keep newest
            const existingIds = new Set(prev.map(m => m.id));
            const hasNew = res.data.some(m => !existingIds.has(m.id));
            if (hasNew || res.data.length !== prev.length) {
              return res.data;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Silent message poll failed:', err);
      }
    };

    const intervalId = setInterval(fetchMessagesSilently, 5000);
    return () => clearInterval(intervalId);
  }, [activeTicket?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectTicket = async (ticket) => {
    setActiveTicket(ticket);
    setMobileView('chat');
    try {
      const res = await api.get(`/support/tickets/${ticket.id}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load message thread.', 'error');
    }
  };

  // Handle File Selection with 5MB & Extension validation
  const validateAndSetFile = (file, setFileState) => {
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5 MB
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      showToast('Invalid file format. Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.', 'error', 'Upload Error');
      return;
    }

    if (file.size > maxSize) {
      showToast('File size exceeds 5 MB limit. Please select a smaller file.', 'error', 'File Too Large');
      return;
    }

    setFileState(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    validateAndSetFile(file, setSelectedFile);
  };

  const handleModalFileSelect = (e) => {
    const file = e.target.files[0];
    validateAndSetFile(file, setModalFile);
  };

  // Helper to upload a file to the backend
  const uploadAttachment = async (fileObj) => {
    if (!fileObj) return null;
    const formData = new FormData();
    formData.append('file', fileObj);

    const res = await api.post('/support/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data; // { attachment_url, attachment_name, attachment_type }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activeTicket) return;
    if (!newMsgText.trim() && !selectedFile) {
      showToast('Please type a message or select an attachment.', 'error');
      return;
    }

    if (activeTicket.status === 'closed') {
      showToast('This ticket is closed. Click "Reopen Ticket" to post messages.', 'error', 'Ticket Closed');
      return;
    }

    setUploadingFile(true);
    try {
      let attachmentData = null;
      if (selectedFile) {
        attachmentData = await uploadAttachment(selectedFile);
      }

      const res = await api.post(`/support/tickets/${activeTicket.id}/messages`, {
        message: newMsgText,
        ...(attachmentData || {})
      });

      setMessages(prev => [...prev, res.data]);
      setNewMsgText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to send message.';
      showToast(msg, 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) {
      showToast('Subject and description are required.', 'error');
      return;
    }

    setUploadingFile(true);
    try {
      let selectedPnr = null;
      let selectedBId = null;
      if (selectedBookingId) {
        const bk = userBookings.find(b => String(b.id) === String(selectedBookingId));
        if (bk) {
          selectedPnr = bk.pnr_number;
          selectedBId = bk.id;
        }
      }

      const res = await api.post('/support/tickets', {
        subject: newSubject,
        description: newDescription,
        priority: newPriority,
        category: newCategory,
        pnr: selectedPnr,
        booking_id: selectedBId
      });

      // Upload file if selected in modal
      if (modalFile && res.data?.id) {
        try {
          const attachData = await uploadAttachment(modalFile);
          const msgRes = await api.post(`/support/tickets/${res.data.id}/messages`, {
            message: 'Attached file on ticket creation:',
            ...attachData
          });
        } catch (fErr) {
          console.warn('Modal file attachment upload failed:', fErr);
        }
      }

      setTickets([res.data, ...tickets]);
      handleSelectTicket(res.data);
      setShowCreateModal(false);
      
      // Reset form
      setNewSubject('');
      setNewDescription('');
      setNewPriority('medium');
      setNewCategory('Refund & Cancellation');
      setSelectedBookingId('');
      setModalFile(null);

      showToast('Support ticket registered successfully.', 'success', 'Ticket Created');
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to create support ticket.';
      showToast(msg, 'error', 'Submission Error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!activeTicket) return;
    const nextStatus = activeTicket.status === 'closed' ? 'open' : 'closed';
    const actionLabel = nextStatus === 'closed' ? 'Mark as Resolved' : 'Reopen Ticket';

    try {
      const res = await api.patch(`/support/tickets/${activeTicket.id}`, { status: nextStatus });
      setActiveTicket(res.data);
      setTickets(prev => prev.map(t => t.id === activeTicket.id ? res.data : t));
      showToast(`Ticket status updated to ${nextStatus.toUpperCase()}.`, 'success', actionLabel);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to update ticket status.';
      showToast(msg, 'error');
    }
  };

  // Filtered tickets based on search query & status filter
  const filteredTickets = tickets.filter(t => {
    // Status Filter
    if (statusFilter !== 'all' && t.status !== statusFilter) {
      return false;
    }
    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSub = t.subject?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchId = t.id?.toLowerCase().includes(q);
      const matchPnr = t.pnr?.toLowerCase().includes(q);
      const matchCat = t.category?.toLowerCase().includes(q);
      return matchSub || matchDesc || matchId || matchPnr || matchCat;
    }
    return true;
  });

  // Ticket count stats for tabs
  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    closed: tickets.filter(t => t.status === 'closed').length
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-8">
      {/* ========================================== */}
      {/* PAGE HEADER & QUICK ASSISTANCE BANNER       */}
      {/* ========================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-primary-400 font-bold text-xs uppercase tracking-wider mb-2">
              <LifeBuoy className="h-4 w-4" />
              <span>RailControl Help & Passenger Care</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Help & Support Desk</h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Raise query tickets for refund status, PNR disputes, in-train meals, or lost belongings with 24/7 dedicated support staff.
            </p>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
              title="Refresh tickets"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white px-5 py-3 text-xs font-extrabold shadow-lg shadow-primary-900/40 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Raise Support Ticket</span>
            </button>
          </div>
        </div>

        {/* Quick Assistance Helpline Badges */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase font-semibold">RailMadad Universal</p>
              <p className="text-xs font-bold text-white font-mono">Dial 139</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-500/20 text-red-300">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase font-semibold">RPF Security Helpline</p>
              <p className="text-xs font-bold text-white font-mono">Dial 182 / 139</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase font-semibold">Medical Emergency</p>
              <p className="text-xs font-bold text-white font-mono">Dial 102 / 139</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
              <TicketIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase font-semibold">IRCTC Support Email</p>
              <p className="text-xs font-bold text-white font-mono truncate">care@irctc.co.in</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* MAIN CHAT & TICKET SYSTEM INTERFACE       */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* LEFT COLUMN: TICKET LIST & FILTERS */}
        <div className={`lg:block border border-slate-200 rounded-3xl bg-white p-4 shadow-sm flex flex-col h-[600px] overflow-hidden ${
          mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search subject, PNR, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-primary-500 font-sans"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 mb-3 space-x-1">
            {['all', 'open', 'pending', 'closed'].map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`py-1.5 px-3 text-[11px] font-bold uppercase transition rounded-t-lg border-b-2 ${
                  statusFilter === tab 
                    ? 'border-primary-600 text-primary-900 bg-primary-50/30' 
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab} ({ticketCounts[tab]})
              </button>
            ))}
          </div>

          {/* Ticket Queue List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-slate-400 p-6 text-center">
                <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                <p className="font-bold text-slate-600 text-xs">No tickets found</p>
                <p className="text-[11px] mt-1 text-slate-400">Try adjusting your search query or filters.</p>
              </div>
            ) : (
              filteredTickets.map(t => {
                const isActive = activeTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      isActive 
                        ? 'border-primary-500 bg-primary-50/20 shadow-sm' 
                        : 'border-slate-100 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-extrabold text-slate-800 text-xs truncate max-w-[170px]">
                        {t.subject}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
                        t.status === 'open' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : t.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                      {t.description || 'No description provided'}
                    </p>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium">
                      <span className="flex items-center space-x-1">
                        <Tag className="h-3 w-3 text-slate-400" />
                        <span className="truncate max-w-[100px]">{t.category || 'Other'}</span>
                      </span>
                      {t.pnr && (
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                          PNR: {t.pnr}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE CONVERSATION VIEW */}
        <div className={`lg:col-span-2 border border-slate-200 rounded-3xl bg-white shadow-sm flex flex-col h-[600px] overflow-hidden ${
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        }`}>
          {activeTicket ? (
            <>
              {/* Conversation Header */}
              <div className="border-b border-slate-100 p-4 bg-slate-50/80 backdrop-blur flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">{activeTicket.subject}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        activeTicket.priority === 'high' 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : activeTicket.priority === 'medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {activeTicket.priority} Priority
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-0.5">
                      <span>ID: <code className="font-mono">{activeTicket.id}</code></span>
                      <span>Category: <strong className="text-slate-600">{activeTicket.category || 'Other'}</strong></span>
                      {activeTicket.pnr && (
                        <span>PNR: <code className="font-mono text-primary-800 font-bold">{activeTicket.pnr}</code></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Toggle Action Button */}
                <button
                  onClick={handleToggleStatus}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                    activeTicket.status === 'closed'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{activeTicket.status === 'closed' ? 'Reopen Ticket' : 'Mark as Resolved'}</span>
                </button>
              </div>

              {/* Message History List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
                {messages.map((m, idx) => {
                  const isSelf = m.sender?.id === user?.id || m.sender?.role === 'passenger';
                  const isPdf = m.attachment_type === 'application/pdf' || m.attachment_url?.endsWith('.pdf');

                  return (
                    <div key={m.id || idx} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-xs shadow-sm space-y-1.5 ${
                        isSelf 
                          ? 'bg-primary-900 text-white rounded-br-none' 
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}>
                        <div className="flex justify-between items-center text-[9px] opacity-70 font-semibold border-b border-white/10 pb-1">
                          <span>{isSelf ? 'You (Passenger)' : m.sender?.full_name || 'Railway Staff Support'}</span>
                          <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>

                        {m.message && <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>}

                        {/* Attachment Display */}
                        {m.attachment_url && (
                          <div className="pt-1">
                            {isPdf ? (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center space-x-2 p-2 rounded-xl border text-xs font-semibold ${
                                  isSelf 
                                    ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' 
                                    : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                                }`}
                              >
                                <FileText className="h-4 w-4 text-red-400" />
                                <span className="truncate max-w-[150px]">{m.attachment_name || 'Download PDF Document'}</span>
                                <Download className="h-3 w-3 ml-auto opacity-70" />
                              </a>
                            ) : (
                              <div className="space-y-1">
                                <img
                                  src={m.attachment_url}
                                  alt={m.attachment_name || 'Attachment'}
                                  className="max-h-48 rounded-lg object-contain bg-black/20 border border-white/10"
                                />
                                <a
                                  href={m.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-[9px] underline block ${isSelf ? 'text-slate-200' : 'text-primary-700'}`}
                                >
                                  View full image ({m.attachment_name || 'Attachment'})
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Closed Ticket Notice */}
              {activeTicket.status === 'closed' && (
                <div className="bg-slate-100 border-t border-slate-200 p-3 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <span>This support ticket is closed. Click <strong>"Reopen Ticket"</strong> in the top right to continue correspondence.</span>
                </div>
              )}

              {/* File Attachment Selected Bar */}
              {selectedFile && (
                <div className="bg-primary-50 border-t border-primary-100 p-2.5 px-4 flex items-center justify-between text-xs text-primary-900">
                  <div className="flex items-center space-x-2 truncate">
                    <Paperclip className="h-4 w-4 text-primary-600 shrink-0" />
                    <span className="font-semibold truncate">{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center space-x-2">
                {/* Hidden File Picker */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={activeTicket.status === 'closed' || uploadingFile}
                  className="p-2.5 text-slate-400 hover:text-primary-700 hover:bg-slate-100 rounded-xl transition disabled:opacity-40"
                  title="Attach PDF, PNG, JPG, WEBP (Max 5MB)"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <input
                  type="text"
                  placeholder={activeTicket.status === 'closed' ? 'Ticket closed...' : 'Type your message response...'}
                  value={newMsgText}
                  onChange={(e) => setNewMsgText(e.target.value)}
                  disabled={activeTicket.status === 'closed' || uploadingFile}
                  className="flex-grow rounded-xl border border-slate-200 px-4 py-2.5 text-xs focus:border-primary-500 focus:outline-none disabled:bg-slate-100 font-sans"
                />

                <button
                  type="submit"
                  disabled={activeTicket.status === 'closed' || uploadingFile || (!newMsgText.trim() && !selectedFile)}
                  className="rounded-xl bg-primary-900 hover:bg-primary-950 text-white p-2.5 transition shadow disabled:opacity-40 flex items-center space-x-1"
                >
                  {uploadingFile ? (
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Send className="h-4.5 w-4.5" />
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-grow flex flex-col justify-center items-center text-slate-400 p-8 text-center space-y-3">
              <div className="p-4 rounded-full bg-slate-100">
                <MessageSquare className="h-10 w-10 text-slate-400" />
              </div>
              <div>
                <p className="font-extrabold text-slate-700 text-sm">No Active Ticket Selected</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Select a support inquiry from the list on the left, or raise a new ticket to communicate with railway staff.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 rounded-xl bg-primary-900 text-white px-4 py-2 text-xs font-bold shadow hover:bg-primary-950 transition"
              >
                Raise New Ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* RAISE TICKET MODAL                         */}
      {/* ========================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-primary-50 text-primary-700">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Raise Support Ticket</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              {/* Category */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Inquiry Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs focus:outline-none focus:border-primary-500 cursor-pointer bg-white"
                  required
                >
                  {SUPPORT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Related Booking / PNR Dropdown */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Related PNR / Booking (Optional)
                </label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs focus:outline-none focus:border-primary-500 cursor-pointer bg-white"
                >
                  <option value="">-- Select a booking (Optional) --</option>
                  {userBookings.map(b => (
                    <option key={b.id} value={b.id}>
                      PNR: {b.pnr_number} | {b.train_name || b.train?.train_name || 'Train'} ({b.travel_date}) [{b.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Subject *</label>
                <input
                  type="text"
                  placeholder="e.g. Refund status for cancelled ticket PNR: 23291"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Inquiry Details *</label>
                <textarea
                  placeholder="Elaborate details of your issue, travel date, coach number, or transaction ID..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows="4"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs focus:outline-none focus:border-primary-500 cursor-pointer bg-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              {/* Modal File Upload */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Attachment (PDF, PNG, JPG, WEBP - Max 5MB)
                </label>
                <input
                  type="file"
                  ref={modalFileInputRef}
                  onChange={handleModalFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingFile}
                  className="w-1/2 rounded-xl bg-primary-900 hover:bg-primary-950 text-white px-4 py-2.5 text-xs font-bold shadow flex items-center justify-center space-x-2"
                >
                  {uploadingFile ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Submit Ticket</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* FAQ / KNOWLEDGE BASE SECTION              */}
      {/* ========================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2 text-primary-700 font-bold text-xs uppercase tracking-wider mb-1">
            <HelpCircle className="h-4 w-4" />
            <span>Self-Service Knowledge Base</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
          <p className="text-xs text-slate-500">Quick answers to common passenger queries regarding cancellation, refunds, and board services.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 hover:bg-slate-50 transition cursor-pointer"
                onClick={() => setOpenFaq(isOpen ? null : idx)}
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-800 text-xs flex items-center space-x-2">
                    <span className="text-primary-700 font-mono font-bold">Q{idx + 1}.</span>
                    <span>{faq.q}</span>
                  </h4>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </div>
                {isOpen && (
                  <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-200/60 leading-relaxed font-sans">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SupportTickets;
