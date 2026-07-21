import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Paperclip, CheckSquare, Search, Award, Mail } from 'lucide-react';
import api from '../services/api';

const StaffInquiries = () => {
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [notifySms, setNotifySms] = useState(true);
  const [saveKb, setSaveKb] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    try {
      const res = await api.post(`/support/tickets/${activeTicket.id}/messages`, {
        message: replyText
      });
      
      // Update UI messages list
      setMessages([...messages, {
        ...res.data,
        sender: { full_name: 'Staff Support (You)', role: 'staff' }
      }]);
      setReplyText('');
      
      if (notifySms) {
        console.log(`📱 SMS notification dispatched to passenger.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-extrabold text-slate-800">Passenger Inquiry & Support Queue</h1>
        <p className="text-xs text-slate-400">Resolve passenger disputes, cancellations queries, and missing luggage tickets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[550px]">
        {/* Ticket List Queue */}
        <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket subject..."
              className="w-full text-xs focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
            </div>
          ) : (
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
                      <span className="font-bold text-slate-800 text-xs truncate max-w-[130px]">{t.subject}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                        t.priority === 'high' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>User: {t.passenger?.full_name || 'Passenger'}</span>
                      <span className="font-semibold text-primary-600">{t.status.toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat / Ticket Workspace */}
        <div className="md:col-span-2 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-full overflow-hidden">
          {activeTicket ? (
            <>
              {/* Header */}
              <div className="border-b border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{activeTicket.subject}</h3>
                  <span className="text-[10px] text-slate-400">Owner: {activeTicket.passenger?.full_name || 'Passenger'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">PNR: 423-8902514</span>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                {messages.map((m, idx) => {
                  const isPassenger = m.sender_id === activeTicket.passenger_id || m.sender?.role === 'passenger';
                  return (
                    <div key={idx} className={`flex ${isPassenger ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        !isPassenger 
                          ? 'bg-primary-900 text-white rounded-br-none' 
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}>
                        <span className="text-[9px] block opacity-60 font-semibold mb-0.5">
                          {!isPassenger ? 'You (Staff)' : activeTicket.passenger?.full_name || 'Passenger'}
                        </span>
                        <p>{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply box and switches */}
              <div className="p-4 border-t border-slate-100 bg-white space-y-4">
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifySms}
                      onChange={(e) => setNotifySms(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Notify passenger via SMS / Whatsapp</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveKb}
                      onChange={(e) => setSaveKb(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Save answers to general Knowledge base</span>
                  </label>
                </div>

                <form onSubmit={handleReplySubmit} className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    placeholder="Write your response message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-grow bg-transparent text-sm focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-primary-900 hover:bg-primary-950 text-white px-4 py-2 text-xs font-bold transition"
                  >
                    Send Reply
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col justify-center items-center text-slate-400 p-8 text-center">
              <MessageSquare className="h-12 w-12 text-slate-200 mb-3" />
              <p className="font-bold">No active passenger support inquiries</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffInquiries;
