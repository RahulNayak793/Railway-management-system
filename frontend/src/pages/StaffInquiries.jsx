import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Paperclip, CheckSquare, Search, Award, Mail, 
  Filter, RefreshCw, AlertCircle, FileText, ExternalLink, Download, 
  Tag, Clock, ShieldCheck, X, CheckCircle, LifeBuoy, User
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const SUPPORT_CATEGORIES = [
  'All Categories',
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

const StaffInquiries = () => {
  const { showToast } = useToast();

  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [notifySms, setNotifySms] = useState(true);
  const [saveKb, setSaveKb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'pending' | 'closed'
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // File Upload State for Reply
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const fetchTickets = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await api.get('/support/tickets');
      const data = Array.isArray(res.data) ? res.data : (res.data?.tickets || []);
      setTickets(data);

      if (data.length > 0 && !activeTicket) {
        handleSelectTicket(data[0]);
      } else if (activeTicket) {
        const updatedActive = data.find(t => t.id === activeTicket.id);
        if (updatedActive) {
          setActiveTicket(updatedActive);
        }
      }
    } catch (err) {
      console.error('Error fetching staff tickets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => {
      fetchTickets();
    }, 15000); // 15s auto polling for staff dashboard
    return () => clearInterval(interval);
  }, []);

  const handleSelectTicket = async (ticket) => {
    setActiveTicket(ticket);
    try {
      const res = await api.get(`/support/tickets/${ticket.id}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching ticket messages:', err);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast?.('Invalid file format. Only PDF, PNG, JPG, JPEG, and WEBP files up to 5 MB are allowed.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast?.('File size exceeds 5 MB limit.', 'error');
      return;
    }

    setSelectedFile(file);
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if ((!replyText.trim() && !selectedFile) || !activeTicket) return;

    let attachmentData = null;
    if (selectedFile) {
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await api.post('/support/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachmentData = uploadRes.data;
      } catch (err) {
        showToast?.('File upload failed: ' + (err.response?.data?.error || err.message), 'error');
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    try {
      const payload = {
        message: replyText.trim(),
        ...(attachmentData || {})
      };

      const res = await api.post(`/support/tickets/${activeTicket.id}/messages`, payload);

      setMessages(prev => [...prev, res.data]);
      setReplyText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      showToast?.('Reply sent to passenger successfully.', 'success');
      fetchTickets();
    } catch (err) {
      showToast?.('Failed to send reply: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!activeTicket) return;
    try {
      const res = await api.patch(`/support/tickets/${activeTicket.id}`, { status: newStatus });
      setActiveTicket(res.data);
      showToast?.(`Ticket status updated to ${newStatus.toUpperCase()}`, 'success');
      fetchTickets();
    } catch (err) {
      showToast?.('Failed to update status: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.pnr && t.pnr.includes(q)) ||
      (t.passenger_name && t.passenger_name.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter;
    const matchesCategory = categoryFilter === 'All Categories' || (t.category || '') === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || (t.priority || '').toLowerCase() === priorityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-primary-600" />
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Passenger Inquiry & Support Operations</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Central Helpdesk: Manage passenger tickets, resolve grievances, inspect attachments, and dispatch official responses.
          </p>
        </div>

        <button
          onClick={() => fetchTickets(true)}
          disabled={refreshing}
          className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing Queue...' : 'Refresh Queue'}</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search PNR, passenger, subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="all">All Ticket Statuses</option>
          <option value="open">Open (Needs Attention)</option>
          <option value="pending">Pending Customer Response</option>
          <option value="closed">Closed / Resolved</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {SUPPORT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="all">All Priorities</option>
          <option value="high">High Priority Only</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
      </div>

      {/* Main Support Grid Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[620px]">
        {/* Ticket List Queue Sidebar */}
        <div className="border border-slate-200 rounded-2xl bg-white p-3.5 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center pb-2.5 mb-2 border-b border-slate-100">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Inquiry Queue</span>
            <span className="text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">
              {filteredTickets.length} Tickets
            </span>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col justify-center items-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent mb-2" />
              <span className="text-xs font-semibold text-slate-400">Loading Support Tickets...</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-400 py-12 text-center">
              <MessageSquare className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-xs font-bold text-slate-500">No matching support inquiries found</p>
              <span className="text-[10px] text-slate-400 mt-1">Try clearing search or filter selections.</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredTickets.map(t => {
                const isActive = activeTicket?.id === t.id;
                const statusUpper = (t.status || 'open').toUpperCase();
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isActive 
                        ? 'border-primary-500 bg-primary-50/20 shadow-sm ring-1 ring-primary-500/20' 
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-bold text-slate-800 text-xs truncate flex-1">{t.subject}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase shrink-0 ${
                        t.priority === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.priority || 'medium'}
                      </span>
                    </div>

                    <div className="text-[10px] font-semibold text-slate-500 space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700 font-bold flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400 inline" />
                          {t.passenger_name || t.passenger?.full_name || 'Passenger'}
                        </span>
                        {t.pnr && <span className="font-mono font-bold text-primary-600">#{t.pnr}</span>}
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 mt-1">
                        <span className="text-[9px] text-slate-400">{t.category || 'Other'}</span>
                        <span className={`text-[9px] font-black uppercase ${
                          statusUpper === 'OPEN' ? 'text-amber-600' :
                          statusUpper === 'PENDING' ? 'text-blue-600' : 'text-emerald-600'
                        }`}>
                          {statusUpper}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat / Ticket Workspace Details */}
        <div className="md:col-span-2 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-full overflow-hidden">
          {activeTicket ? (
            <>
              {/* Workspace Ticket Header */}
              <div className="border-b border-slate-200 p-4 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-black text-slate-800 text-sm">{activeTicket.subject}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      activeTicket.priority === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {activeTicket.priority || 'medium'} priority
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium mt-1">
                    <span>Passenger: <strong className="text-slate-800">{activeTicket.passenger_name || 'Passenger'}</strong></span>
                    {activeTicket.pnr && <span>PNR: <strong className="font-mono text-primary-700">#{activeTicket.pnr}</strong></span>}
                    <span>Category: <strong>{activeTicket.category || 'Other'}</strong></span>
                  </div>
                </div>

                {/* Status Action Controls */}
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                  <select
                    value={(activeTicket.status || 'open').toLowerCase()}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="text-xs font-bold rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="open">OPEN</option>
                    <option value="pending">PENDING RESPONSE</option>
                    <option value="closed">CLOSED</option>
                  </select>
                </div>
              </div>

              {/* Message History Feed */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/40">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    No messages in this ticket thread yet.
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const senderRole = (m.sender?.role || m.sender_role || '').toLowerCase();
                    const isStaff = senderRole === 'staff' || senderRole === 'admin';
                    const senderName = m.sender?.full_name || m.sender_name || (isStaff ? 'Staff Support Agent' : activeTicket.passenger_name || 'Passenger');
                    const isImg = m.attachment_url && /\.(jpg|jpeg|png|webp)$/i.test(m.attachment_url);

                    return (
                      <div key={m.id || idx} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs shadow-sm ${
                          isStaff 
                            ? 'bg-slate-900 text-white rounded-br-none' 
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                        }`}>
                          <div className="flex justify-between items-center gap-3 mb-1 opacity-70">
                            <span className="font-bold text-[10px]">
                              {isStaff ? `You (${senderName})` : senderName}
                            </span>
                            <span className="text-[9px] font-mono">
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          {m.message && <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>}

                          {/* Attachment Card */}
                          {m.attachment_url && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/40">
                              {isImg ? (
                                <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block group">
                                  <img 
                                    src={m.attachment_url} 
                                    alt="attachment" 
                                    className="max-h-40 rounded-xl object-cover border border-slate-300/50 mb-1 group-hover:opacity-95 transition" 
                                  />
                                  <span className="text-[9px] underline opacity-80 flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3 inline" /> {m.attachment_name || 'View Image Attachment'}
                                  </span>
                                </a>
                              ) : (
                                <a 
                                  href={m.attachment_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className={`inline-flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${
                                    isStaff ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                  } transition`}
                                >
                                  <FileText className="h-3.5 w-3.5 text-primary-500" />
                                  <span className="truncate max-w-[160px]">{m.attachment_name || 'Attached Document'}</span>
                                  <Download className="h-3 w-3 opacity-60" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Form Footer */}
              <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifySms}
                      onChange={(e) => setNotifySms(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Notify passenger via SMS / Whatsapp notification</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveKb}
                      onChange={(e) => setSaveKb(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Flag response for Knowledge Base entry</span>
                  </label>
                </div>

                {/* Selected File Badge */}
                {selectedFile && (
                  <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-3 py-1.5 text-xs text-primary-900">
                    <div className="flex items-center space-x-2 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                      <span className="font-bold truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-slate-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedFile(null)} 
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleReplySubmit} className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file (PDF, PNG, JPG up to 5MB)"
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    placeholder="Write official response message to passenger..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-grow bg-transparent text-xs sm:text-sm focus:outline-none text-slate-800 placeholder:text-slate-400"
                  />

                  <button
                    type="submit"
                    disabled={uploadingFile || (!replyText.trim() && !selectedFile)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-primary-900 hover:bg-primary-950 text-white px-4 py-2 text-xs font-bold transition disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{uploadingFile ? 'Uploading...' : 'Send Reply'}</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col justify-center items-center text-slate-400 p-8 text-center">
              <LifeBuoy className="h-12 w-12 text-slate-200 mb-3" />
              <p className="font-bold text-slate-600">No Active Passenger Ticket Selected</p>
              <span className="text-xs text-slate-400 mt-1 max-w-xs">
                Select an inquiry from the sidebar queue to inspect passenger details, attachments, and respond.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffInquiries;
