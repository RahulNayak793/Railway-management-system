import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  CreditCard, Plus, ArrowRightLeft, Clock, ShieldCheck, 
  AlertCircle, RefreshCw, Smartphone, Landmark, Wallet, CheckCircle2, Lock
} from 'lucide-react';

const PassengerWallet = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [balance, setBalance] = useState(2450.00);
  const [addAmount, setAddAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'card' | 'netbanking' | 'wallet'
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('SBI');

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [lastTxnRef, setLastTxnRef] = useState('');

  const [transactions, setTransactions] = useState([
    {
      id: 'txn-1',
      type: 'credit',
      title: 'Money Added via UPI',
      date: '2026-07-28T14:30:00Z',
      amount: 1000,
      status: 'success',
      reference: 'UPI/61239847192'
    },
    {
      id: 'txn-2',
      type: 'debit',
      title: 'Ticket Booking (PNR: 2345678901)',
      date: '2026-07-25T09:15:00Z',
      amount: 1450,
      status: 'success',
      reference: 'BK-94812'
    },
    {
      id: 'txn-3',
      type: 'credit',
      title: 'Ticket Cancellation Refund',
      date: '2026-07-18T11:45:00Z',
      amount: 1680,
      status: 'success',
      reference: 'REF-59281'
    }
  ]);

  const presetAmounts = [500, 1000, 2000, 5000];

  const handleAddMoney = (e) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount to add', 'error');
      return;
    }

    if (paymentMethod === 'upi' && !upiId.trim()) {
      showToast('Please enter your VPA / UPI ID', 'error');
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentSuccess(true);
      
      const newBalance = balance + amount;
      setBalance(newBalance);
      
      const txnRef = `TXN/${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      setLastTxnRef(txnRef);

      const newTxn = {
        id: `txn-${Date.now()}`,
        type: 'credit',
        title: `Money Added via ${paymentMethod.toUpperCase()}`,
        date: new Date().toISOString(),
        amount: amount,
        status: 'success',
        reference: txnRef
      };
      
      setTransactions(prev => [newTxn, ...prev]);
      showToast(`₹${amount} added successfully to your Rail Wallet!`, 'success');
      
      setTimeout(() => {
        setPaymentSuccess(false);
        setAddAmount('');
      }, 3500);
    }, 1500);
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-8 animate-slide-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Rail Wallet</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage your balance for instant, zero-fee ticket and meal bookings.</p>
        </div>
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-black text-emerald-800">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>RBI Regulated Payment Wallet</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Balance & Add Money Form */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Wallet Balance Card */}
          <div className="bg-gradient-to-br from-[#064e3b] via-[#0f172a] to-[#022c22] border border-emerald-900/50 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(6,78,59,0.2)] relative overflow-hidden text-white group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -z-10 group-hover:bg-emerald-500/20 transition-all duration-1000"></div>
            
            <div className="flex justify-between items-start z-10">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-black tracking-widest uppercase text-emerald-50">Rail Wallet Balance</h3>
                </div>
              </div>
              
              <div className="px-3 py-1.5 bg-emerald-950/60 rounded-full border border-emerald-800/50 backdrop-blur-sm">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center space-x-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 mr-0.5" /> 
                  <span>Active</span>
                </span>
              </div>
            </div>
            
            <div className="mt-10 z-10">
              <p className="text-[11px] text-emerald-200/60 uppercase tracking-widest font-bold mb-2">Available Balance</p>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter font-mono flex items-start">
                <span className="text-2xl mt-1.5 mr-1 text-emerald-400/80">₹</span>
                {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
          </div>

          {/* Add Money Form & Payment Option Selectors */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[28px] border border-slate-200/80 shadow-sm p-6 relative overflow-hidden min-h-[380px]">
            {paymentSuccess ? (
              <div className="flex flex-col items-center justify-center h-full py-10 space-y-4 animate-scale-in">
                <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-emerald-50 text-emerald-600 mb-2">
                  <CheckCircle2 className="h-10 w-10 animate-bounce" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Top-Up Successful!</h3>
                <p className="text-xs text-slate-500 font-bold text-center px-4">
                  ₹{addAmount} added via {paymentMethod.toUpperCase()}. Reference: <span className="font-mono text-slate-700">{lastTxnRef}</span>
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-black text-slate-800 tracking-wide mb-4 flex items-center">
                  <Plus className="h-4 w-4 mr-2 text-emerald-600" />
                  Add Money to Rail Wallet
                </h3>
            
                <form onSubmit={handleAddMoney} className="space-y-4">
                  
                  {/* Amount Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-lg font-black text-slate-400">₹</span>
                    </div>
                    <input
                      type="number"
                      placeholder="Enter Top-Up Amount"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
                      min="1"
                      step="1"
                      disabled={isProcessing}
                      required
                    />
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {presetAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAddAmount(amt.toString())}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 rounded-xl text-xs font-extrabold transition-all active:scale-95 disabled:opacity-50"
                      >
                        + ₹{amt}
                      </button>
                    ))}
                  </div>

                  {/* Payment Options Selection */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Select Payment Option
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'upi', label: 'UPI / QR', icon: Smartphone, sub: 'GPay / PhonePe' },
                        { id: 'card', label: 'Credit / Debit', icon: CreditCard, sub: 'Visa, Mastercard' },
                        { id: 'netbanking', label: 'Net Banking', icon: Landmark, sub: 'SBI, HDFC, ICICI' },
                        { id: 'wallet', label: 'Mobile Wallets', icon: Wallet, sub: 'Amazon Pay, Paytm' }
                      ].map((pm) => {
                        const Icon = pm.icon;
                        const isSelected = paymentMethod === pm.id;
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setPaymentMethod(pm.id)}
                            disabled={isProcessing}
                            className={`p-2.5 rounded-2xl border text-left transition flex items-center space-x-2 ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <div className="overflow-hidden">
                              <span className="text-[11px] font-extrabold block leading-tight">{pm.label}</span>
                              <span className="text-[9px] text-slate-400 block truncate mt-0.5">{pm.sub}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Inputs based on Payment Method */}
                  {paymentMethod === 'upi' && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                      <label className="block text-[9px] font-black uppercase text-slate-500">VPA / UPI ID</label>
                      <input
                        type="text"
                        placeholder="e.g. rahul@upi or 9876543210@paytm"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 text-xs">
                      <input
                        type="text"
                        placeholder="16-Digit Card Number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold font-mono text-slate-800 focus:border-emerald-500 focus:outline-none"
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800"
                          required
                        />
                        <input
                          type="password"
                          placeholder="CVV"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'netbanking' && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                      <label className="block text-[9px] font-black uppercase text-slate-500">Select Bank</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="SBI">State Bank of India (SBI)</option>
                        <option value="HDFC">HDFC Bank</option>
                        <option value="ICICI">ICICI Bank</option>
                        <option value="AXIS">Axis Bank</option>
                        <option value="PNB">Punjab National Bank</option>
                      </select>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3.5 font-black text-xs text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Authorizing Payment...</span>
                      </>
                    ) : (
                      <>
                        <span>Add ₹{addAmount || '0'} to Rail Wallet</span>
                        <ArrowRightLeft className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-400 text-center font-semibold pt-0.5 flex items-center justify-center space-x-1">
                    <Lock className="h-3 w-3 text-emerald-600" />
                    <span>Protected by 256-Bit SSL Security</span>
                  </p>
                </form>
              </>
            )}
          </div>
          
          {/* Info Banner */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex space-x-3 text-xs">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-blue-900">Zero Payment Gateway Fees</p>
              <p className="text-[11px] text-blue-700 font-medium mt-0.5 leading-relaxed">
                Paying via Rail Wallet completely waives off the 1.5% payment gateway convenience surcharge on train tickets & meals.
              </p>
            </div>
          </div>

        </div>

        {/* Right Column: Transaction History */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] h-full overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <Clock className="h-5 w-5 text-indigo-600" />
                <h2 className="text-sm font-black text-slate-800 tracking-wide">Wallet Statement & History</h2>
              </div>
              <span className="text-[11px] font-bold text-slate-400">Showing last {transactions.length} transactions</span>
            </div>
            
            <div className="flex-1 p-3 overflow-y-auto min-h-[400px]">
              {transactions.length > 0 ? (
                <div className="space-y-1.5">
                  {transactions.map((txn) => (
                    <div 
                      key={txn.id} 
                      className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group cursor-pointer border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-2xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                          txn.type === 'credit' 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-rose-50 text-rose-600'
                        }`}>
                          {txn.type === 'credit' ? <Plus className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{txn.title}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-[11px] text-slate-500 font-semibold">{formatDate(txn.date)}</p>
                            <span className="text-slate-300">•</span>
                            <p className="text-[10px] font-mono font-bold text-slate-400">Ref: {txn.reference}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black font-mono tracking-tight ${
                          txn.type === 'credit' ? 'text-emerald-600' : 'text-slate-800'
                        }`}>
                          {txn.type === 'credit' ? '+' : '-'} ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          {txn.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                  <CreditCard className="h-12 w-12 text-slate-200" />
                  <p className="text-sm font-bold">No recent transactions</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PassengerWallet;
