import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Minus, Sparkles, AlertCircle, CheckCircle2, Clock, IndianRupee, MessageSquare, ChevronUp } from 'lucide-react';

const RailControlAssistantChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hello Admin 👋 How can I assist you with railway operations today?',
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');

    // Generate smart assistant response
    setTimeout(() => {
      let replyText = "I'm monitoring live system telemetry. All core API nodes and database connections are operational.";
      const query = text.toLowerCase();

      if (query.includes('summary') || query.includes('today')) {
        replyText = `Today's Operational Summary:\n• Total Bookings: 18\n• Confirmed: 12 | RAC: 3 | Waitlisted: 2\n• Today's Revenue: ₹ 1,330\n• Active Trains: 3 (12951, 12345, 22436)`;
      } else if (query.includes('delay') || query.includes('train')) {
        replyText = `Train Delay Status:\n⚠️ Train 12345 Udupi Express is currently running 45 minutes behind schedule.\n✓ Train 12951 Mumbai Rajdhani is running ON TIME.\n✓ Train 22436 Vande Bharat Express is running ON TIME.`;
      } else if (query.includes('refund')) {
        replyText = `Refund Disputes Queue:\n• Pending Requests: 23 tickets\n• Processed Today: ₹ 1,250 refunded\n• Auto-Dispute Engine: Active`;
      } else if (query.includes('analytic') || query.includes('booking') || query.includes('revenue')) {
        replyText = `Booking & Revenue Analytics:\n• Gross System Revenue: ₹ 14,500\n• Top Demand Route: NDLS ➔ MMCT (480 Bookings)\n• Most Popular Class: Sleeper Class (42% share)`;
      }

      const botMsg = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: replyText,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    }, 600);
  };

  const quickActions = [
    { label: "Today's Summary", action: "Show today's booking summary" },
    { label: "Delayed Trains", action: "Any delayed trains?" },
    { label: "Pending Refunds", action: "Check pending refunds" },
    { label: "Booking Analytics", action: "Show booking analytics" }
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className="flex items-center space-x-2 bg-[#0052cc] hover:bg-[#0041a3] text-white px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 group active:scale-95 border-2 border-white/20"
        >
          <div className="relative">
            <Bot className="h-6 w-6 text-white" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 border-2 border-[#0052cc] rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-black tracking-wide pr-1">RailControl Assistant</span>
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div className={`w-[90vw] sm:w-[360px] bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[500px]'}`}>
          
          {/* Blue Header */}
          <div className="bg-gradient-to-r from-[#0052cc] to-[#003d99] text-white p-3.5 flex justify-between items-center flex-shrink-0 select-none">
            <div className="flex items-center space-x-2.5">
              <div className="relative h-9 w-9 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <Bot className="h-5 w-5 text-white" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-400 rounded-full border-2 border-[#0052cc]" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-tight leading-tight">RailControl Assistant</h3>
                <span className="text-[10px] text-blue-200 font-semibold flex items-center space-x-1">
                  <Sparkles className="h-2.5 w-2.5 text-amber-300 inline" />
                  <span>Online • Railway Operations Help</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded-lg hover:bg-white/10 text-blue-100 transition"
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-blue-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Body */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-2xs ${
                        msg.sender === 'user'
                          ? 'bg-[#0052cc] text-white rounded-br-none font-medium'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Chips */}
              <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none flex-shrink-0">
                {quickActions.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip.action)}
                    className="text-[10px] font-extrabold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-full px-2.5 py-1 transition whitespace-nowrap"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Input Footer */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="p-2.5 bg-white border-t border-slate-200 flex items-center space-x-2 flex-shrink-0"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="h-8 w-8 rounded-xl bg-[#0052cc] hover:bg-[#0041a3] text-white flex items-center justify-center transition disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

        </div>
      )}

    </div>
  );
};

export default RailControlAssistantChat;
