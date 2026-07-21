import React, { useState } from 'react';
import { Users, Search, UserCheck, ShieldAlert, BadgeCheck, XCircle } from 'lucide-react';

const StaffPassengers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Verified', 'Unverified'

  const [passengers, setPassengers] = useState([
    { id: '1', name: 'Ramesh Kumar', email: 'ramesh@gmail.com', phone: '+91 9876543210', documentType: 'Aadhaar Card', documentUrl: 'aadhaar_mock.pdf', verified: true },
    { id: '2', name: 'Suresh Patel', email: 'suresh@gmail.com', phone: '+91 8765432109', documentType: 'Passport', documentUrl: 'passport_mock.pdf', verified: false },
    { id: '3', name: 'Anita Sharma', email: 'anita@gmail.com', phone: '+91 7654321098', documentType: 'PAN Card', documentUrl: 'pan_mock.pdf', verified: true },
    { id: '4', name: 'Vikram Singh', email: 'vikram@gmail.com', phone: '+91 6543210987', documentType: 'Aadhaar Card', documentUrl: 'aadhaar_mock.pdf', verified: true },
    { id: '5', name: 'Neha Gupta', email: 'neha@gmail.com', phone: '+91 5432109876', documentType: 'Passport', documentUrl: null, verified: false },
    { id: '6', name: 'Priya Sharma', email: 'priya@gmail.com', phone: '+91 9123456780', documentType: 'Aadhaar Card', documentUrl: 'aadhaar_mock.pdf', verified: false }
  ]);

  const toggleVerification = (id) => {
    setPassengers(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, verified: !p.verified };
      }
      return p;
    }));
  };

  const filteredPassengers = passengers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || 
      (filterType === 'Verified' && p.verified) || 
      (filterType === 'Unverified' && !p.verified);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Passenger Registry</h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">Verify passenger identity documents, browse accounts, and review profiles.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Registered Passengers', value: passengers.length, color: 'text-blue-600 bg-blue-500/10', icon: Users },
          { label: 'Verified Profiles', value: passengers.filter(p => p.verified).length, color: 'text-emerald-600 bg-emerald-500/10', icon: UserCheck },
          { label: 'Pending Checks', value: passengers.filter(p => !p.verified).length, color: 'text-amber-600 bg-amber-500/10', icon: ShieldAlert }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stat.value}</span>
              </div>
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${stat.color} font-bold`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Control bar */}
      <div className="bg-white border border-slate-200/70 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Search */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 w-full md:w-80 focus-within:ring-2 focus-within:ring-primary-500/15 focus-within:border-primary-500 transition">
          <Search className="h-4.5 w-4.5 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-bold text-slate-700"
          />
        </div>

        {/* Filters */}
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
          {['All', 'Verified', 'Unverified'].map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
                filterType === f ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">Passenger Details</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Contact Number</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Identity File</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Verification Status</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right pr-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPassengers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-xs font-bold text-slate-400">No passengers found</td>
                </tr>
              ) : (
                filteredPassengers.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4.5 text-xs font-black text-slate-800 pl-8">
                      <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-xs shadow-inner">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="font-black text-slate-800 block text-xs">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">{p.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-xs font-bold text-slate-600">{p.phone}</td>
                    <td className="px-6 py-4.5 text-xs font-bold leading-normal">
                      {p.documentUrl ? (
                        <a href="#" onClick={(e) => { e.preventDefault(); alert(`Downloading document: ${p.documentUrl}`); }} className="text-primary-600 hover:underline">
                          {p.documentType} (Download)
                        </a>
                      ) : (
                        <span className="text-slate-400 font-semibold italic">Not uploaded</span>
                      )}
                    </td>
                    <td className="px-6 py-4.5 text-xs font-bold">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        p.verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {p.verified ? 'Verified Account' : 'Checks Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right pr-8">
                      <button
                        onClick={() => toggleVerification(p.id)}
                        disabled={!p.documentUrl}
                        className={`rounded-xl px-4 py-2 text-xs font-black transition active:scale-95 border ${
                          p.verified
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 disabled:opacity-50 disabled:pointer-events-none'
                        }`}
                      >
                        {p.verified ? 'Revoke Status' : 'Approve Profile'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default StaffPassengers;
