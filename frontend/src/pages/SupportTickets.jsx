import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, FileText, Send, Paperclip, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const SupportTickets = () => {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [loading, setLoading] = useState(true);

  // New ticket form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support/tickets');
      setTickets(res.data);
      if (res.data.length > 0 && !activeTicket) {
        handleSelectTicket(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSelectTicket = async (ticket) => {
    setActiveTicket(ticket);
    try {
      const res = await api.get(`/support/tickets/${ticket.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsgText.trim() || !activeTicket) return;

    try {
      const res = await api.post(`/support/tickets/${activeTicket.id}/messages`, {
        message: newMsgText
      });
      // Append and reset
      setMessages([...messages, {
        ...res.data,
        sender: { full_name: 'You', role: 'passenger' }
      }]);
      setNewMsgText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/support/tickets', {
        subject: newSubject,
        description: newDescription,
        priority: newPriority
      });
      setTickets([res.data, ...tickets]);
      handleSelectTicket(res.data);
      setShowCreateModal(false);
      setNewSubject('');
      setNewDescription('');
      showToast('Your support inquiry ticket has been registered.', 'success', 'Ticket Registered');
    } catch (err) {
      console.error(err);
      showToast('Failed to create support ticket.', 'error', 'Submission Error');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Support & Assistance</h1>
          <p className="text-xs text-slate-400">Raise query tickets regarding cancellations, refunds, or missing items.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1 rounded-xl bg-primary-900 hover:bg-primary-950 text-white px-4 py-2.5 text-xs font-bold transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Ticket</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
        {/* Left Side: Ticket Queue list */}
        <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm flex flex-col h-full overflow-hidden">
          <h3 className="font-extrabold text-slate-800 mb-3 text-sm">Tickets Queue</h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {tickets.map(t => {
              const isActive = activeTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTicket(t)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    isActive 
                      ? 'border-primary-500 bg-primary-50/10' 
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-slate-800 text-xs truncate max-w-[130px]">{t.subject}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                      t.status === 'open' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{t.description || 'No description'}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Active Chat View */}
        <div className="md:col-span-2 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-full overflow-hidden">
          {activeTicket ? (
            <>
              {/* Chat Header */}
              <div className="border-b border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{activeTicket.subject}</h3>
                  <p className="text-[10px] text-slate-400">Created: {activeTicket.created_at?.slice(0, 10)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                  activeTicket.priority === 'high' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {activeTicket.priority} priority
                </span>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                {messages.map((m, idx) => {
                  const isSelf = m.sender_id === activeTicket.passenger_id || m.sender?.role === 'passenger';
                  return (
                    <div key={idx} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        isSelf 
                          ? 'bg-primary-900 text-white rounded-br-none' 
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}>
                        <span className="text-[9px] block opacity-60 font-semibold mb-0.5">
                          {isSelf ? 'You' : m.sender?.full_name || 'Staff Support'}
                        </span>
                        <p>{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex items-center space-x-2">
                <button type="button" className="text-slate-400 hover:text-slate-600">
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  placeholder="Type your response to support staff..."
                  value={newMsgText}
                  onChange={(e) => setNewMsgText(e.target.value)}
                  className="flex-grow rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="rounded-xl bg-primary-900 hover:bg-primary-950 text-white p-2.5 transition"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-grow flex flex-col justify-center items-center text-slate-400 p-8 text-center">
              <MessageSquare className="h-12 w-12 text-slate-200 mb-3" />
              <p className="font-bold text-slate-600">No active support tickets select</p>
              <p className="text-xs">Create or select a ticket from the queue list to start support correspondence.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">Raise Support Ticket</h3>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Refund status PNR: 23291"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Inquiry Description</label>
                <textarea
                  placeholder="Elaborate details of the issue..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows="3"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-primary-500 cursor-pointer"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-lg bg-primary-900 hover:bg-primary-950 text-white px-4 py-2 text-sm font-semibold shadow"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTickets;
