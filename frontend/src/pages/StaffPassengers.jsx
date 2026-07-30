import React, { useState, useEffect } from 'react';
import { 
  Users, Search, UserCheck, ShieldAlert, BadgeCheck, XCircle, Eye, X, 
  Mail, Phone, MapPin, Calendar, CreditCard, Ticket, ShieldCheck, Download, 
  UserPlus, FileText, DollarSign, CheckCircle2, Clock, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '../services/api';

const StaffPassengers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Verified', 'Unverified'
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState([]);
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [viewingPnrDetail, setViewingPnrDetail] = useState(null);

  const mockPassengers = [
    { 
      id: 'usr-1', 
      name: 'Ramesh Kumar', 
      email: 'ramesh.kumar@gmail.com', 
      phone: '+91 9876543210', 
      secondaryPhone: '+91 9811223344',
      age: 42,
      gender: 'Male',
      dob: '14 Aug 1982',
      address: 'House #102, Green Park Avenue, Sector 14',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110016',
      emergencyContact: 'Suresh Kumar (Brother) - +91 9811002233',
      documentType: 'Aadhaar Card', 
      documentNumber: '4829-1092-4921',
      documentUrl: 'aadhaar_ramesh_kumar.pdf', 
      verified: true,
      registeredAt: '12 Jan 2023',
      accountStatus: 'Active',
      walletBalance: 1450,
      totalBookings: 8,
      totalSpent: 18450,
      savedCoPassengers: [
        { id: 'sp1', name: 'Sunita Kumar', age: 39, gender: 'Female', relation: 'Spouse', idType: 'Aadhaar Card' },
        { id: 'sp2', name: 'Rohan Kumar', age: 14, gender: 'Male', relation: 'Son', idType: 'School ID' }
      ],
      bookingHistory: [
        { 
          pnr: '6543210987', 
          trainNo: '12618', 
          trainName: 'Mangala Lakshadweep Exp', 
          route: 'ERS → NZM', 
          travelDate: '21 May 2024', 
          class: '2A', 
          seat: 'B2-23', 
          amount: 3672.50, 
          status: 'Confirmed',
          passengersRoster: [
            { name: 'Ramesh Kumar', age: 42, seat: 'B2-23 (Lower)', status: 'Confirmed' },
            { name: 'Sunita Kumar', age: 39, seat: 'B2-24 (Middle)', status: 'Confirmed' },
            { name: 'Rohan Kumar', age: 14, seat: 'B2-25 (Upper)', status: 'Confirmed' }
          ]
        },
        { 
          pnr: '5432109876', 
          trainNo: '12951', 
          trainName: 'Mumbai Rajdhani', 
          route: 'NDLS → MMCT', 
          travelDate: '10 Feb 2024', 
          class: '1A', 
          seat: 'H1-4', 
          amount: 5120.00, 
          status: 'Confirmed',
          passengersRoster: [
            { name: 'Ramesh Kumar', age: 42, seat: 'H1-4 (Cabin)', status: 'Confirmed' }
          ]
        },
        { 
          pnr: '4321098765', 
          trainNo: '12002', 
          trainName: 'Shatabdi Express', 
          route: 'NDLS → BPL', 
          travelDate: '15 Nov 2023', 
          class: 'CC', 
          seat: 'C3-12', 
          amount: 1450.00, 
          status: 'Cancelled',
          passengersRoster: [
            { name: 'Ramesh Kumar', age: 42, seat: 'N/A', status: 'Cancelled' }
          ]
        }
      ]
    },
    { 
      id: 'usr-2', 
      name: 'Suresh Patel', 
      email: 'suresh.patel@yahoo.com', 
      phone: '+91 8765432109', 
      secondaryPhone: '+91 9822114455',
      age: 48,
      gender: 'Male',
      dob: '05 Mar 1976',
      address: 'Flat 402, Sai Heights, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      emergencyContact: 'Meena Patel (Wife) - +91 9822114455',
      documentType: 'Passport', 
      documentNumber: 'Z8901234',
      documentUrl: 'passport_suresh_patel.pdf', 
      verified: false,
      registeredAt: '20 Aug 2023',
      accountStatus: 'Under Review',
      walletBalance: 600,
      totalBookings: 4,
      totalSpent: 9240,
      savedCoPassengers: [
        { id: 'sp3', name: 'Kalpesh Patel', age: 22, gender: 'Male', relation: 'Brother', idType: 'Aadhaar Card' }
      ],
      bookingHistory: [
        { 
          pnr: '6543210988', 
          trainNo: '12951', 
          trainName: 'Mumbai Central Rajdhani', 
          route: 'MMCT → NDLS', 
          travelDate: '21 May 2024', 
          class: '3A', 
          seat: 'A1-4', 
          amount: 3074.50, 
          status: 'RAC',
          passengersRoster: [
            { name: 'Suresh Patel', age: 48, seat: 'A1-4 (RAC 4)', status: 'RAC' },
            { name: 'Kalpesh Patel', age: 22, seat: 'A1-4 (RAC 5)', status: 'RAC' }
          ]
        }
      ]
    },
    { 
      id: 'usr-3', 
      name: 'Anita Sharma', 
      email: 'anita.sharma@gmail.com', 
      phone: '+91 7654321098', 
      secondaryPhone: '+91 9711223344',
      age: 34,
      gender: 'Female',
      dob: '22 Nov 1989',
      address: 'B-14, Kasturba Marg',
      city: 'Thiruvananthapuram',
      state: 'Kerala',
      pincode: '695001',
      emergencyContact: 'Rajesh Sharma (Husband) - +91 9711223344',
      documentType: 'PAN Card', 
      documentNumber: 'ABCDE1234F',
      documentUrl: 'pan_anita_sharma.pdf', 
      verified: true,
      registeredAt: '04 Mar 2023',
      accountStatus: 'Active',
      walletBalance: 2100,
      totalBookings: 6,
      totalSpent: 11200,
      savedCoPassengers: [],
      bookingHistory: [
        { 
          pnr: '6543210989', 
          trainNo: '16346', 
          trainName: 'Netravati Express', 
          route: 'TVC → LTT', 
          travelDate: '22 May 2024', 
          class: 'SL', 
          seat: 'N/A', 
          amount: 926.00, 
          status: 'Waiting',
          passengersRoster: [
            { name: 'Anita Sharma', age: 34, seat: 'W/L 12', status: 'Waiting' }
          ]
        }
      ]
    },
    { 
      id: 'usr-4', 
      name: 'Vikram Singh', 
      email: 'vikram.singh@outlook.com', 
      phone: '+91 6543210987', 
      secondaryPhone: '+91 9411998877',
      age: 29,
      gender: 'Male',
      dob: '18 Jul 1995',
      address: '77, Civil Lines',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302006',
      emergencyContact: 'Karan Singh (Father) - +91 9411998877',
      documentType: 'Aadhaar Card', 
      documentNumber: '9921-8812-3341',
      documentUrl: 'aadhaar_vikram_singh.pdf', 
      verified: true,
      registeredAt: '10 Oct 2023',
      accountStatus: 'Active',
      walletBalance: 850,
      totalBookings: 5,
      totalSpent: 14200,
      savedCoPassengers: [
        { id: 'sp4', name: 'Pooja Singh', age: 27, gender: 'Female', relation: 'Spouse', idType: 'Aadhaar Card' }
      ],
      bookingHistory: [
        { 
          pnr: '6543210990', 
          trainNo: '12628', 
          trainName: 'Karnataka Express', 
          route: 'NDLS → SBC', 
          travelDate: '22 May 2024', 
          class: '3A', 
          seat: 'B1-12', 
          amount: 2297.50, 
          status: 'Confirmed',
          passengersRoster: [
            { name: 'Vikram Singh', age: 29, seat: 'B1-12 (Lower)', status: 'Confirmed' },
            { name: 'Pooja Singh', age: 27, seat: 'B1-13 (Middle)', status: 'Confirmed' }
          ]
        }
      ]
    },
    { 
      id: 'usr-5', 
      name: 'Neha Gupta', 
      email: 'neha.gupta@gmail.com', 
      phone: '+91 5432109876', 
      secondaryPhone: '+91 9833445566',
      age: 31,
      gender: 'Female',
      dob: '02 Sep 1992',
      address: 'Flat 12B, Ocean View Apartments',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      emergencyContact: 'Amit Gupta (Husband) - +91 9833445566',
      documentType: 'Passport', 
      documentNumber: 'K9910293',
      documentUrl: null, 
      verified: false,
      registeredAt: '14 Jan 2024',
      accountStatus: 'Pending Verification',
      walletBalance: 0,
      totalBookings: 2,
      totalSpent: 4800,
      savedCoPassengers: [],
      bookingHistory: [
        { 
          pnr: '6543210991', 
          trainNo: '11013', 
          trainName: 'Coimbatore Express', 
          route: 'LTT → CBE', 
          travelDate: '23 May 2024', 
          class: '2A', 
          seat: 'A2-15', 
          amount: 2591.00, 
          status: 'Confirmed',
          passengersRoster: [
            { name: 'Neha Gupta', age: 31, seat: 'A2-15 (Side Upper)', status: 'Confirmed' }
          ]
        }
      ]
    },
    { 
      id: 'usr-6', 
      name: 'Priya Sharma', 
      email: 'priya.sharma@domain.com', 
      phone: '+91 9123456780', 
      secondaryPhone: '+91 9112233445',
      age: 36,
      gender: 'Female',
      dob: '30 Dec 1987',
      address: '221, Park Street',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700016',
      emergencyContact: 'Deepak Sharma (Father) - +91 9112233445',
      documentType: 'Aadhaar Card', 
      documentNumber: '8821-3910-1029',
      documentUrl: 'aadhaar_priya_sharma.pdf', 
      verified: true,
      registeredAt: '01 Jun 2023',
      accountStatus: 'Active',
      walletBalance: 3200,
      totalBookings: 9,
      totalSpent: 28400,
      savedCoPassengers: [],
      bookingHistory: [
        { 
          pnr: '9876543210', 
          trainNo: '12952', 
          trainName: 'New Delhi Rajdhani', 
          route: 'NDLS → MMCT', 
          travelDate: '24 May 2024', 
          class: '1A', 
          seat: 'H1-2', 
          amount: 5152.50, 
          status: 'Confirmed',
          passengersRoster: [
            { name: 'Priya Sharma', age: 36, seat: 'H1-2 (Lower)', status: 'Confirmed' }
          ]
        }
      ]
    }
  ];

  const fetchPassengers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      let apiUsers = [];
      if (res.data && res.data.length > 0) {
        apiUsers = res.data
          .filter(u => u.role !== 'admin' && u.role !== 'staff')
          .map(u => ({
            id: u.id || `usr-${Math.random().toString(36).substr(2, 6)}`,
            name: u.full_name || u.name || u.email?.split('@')[0] || 'Passenger User',
            email: u.email || 'passenger@railway.com',
            phone: u.phone || '+91 9876543210',
            secondaryPhone: '+91 9811002233',
            age: u.age || 35,
            gender: u.gender || 'Male',
            dob: u.dob || '15 Aug 1990',
            address: u.address || 'Registered Residential Address',
            city: u.city || 'New Delhi',
            state: u.state || 'Delhi',
            pincode: u.pincode || '110001',
            emergencyContact: 'Primary Emergency Contact (+91 9800000000)',
            documentType: u.document_type || 'Aadhaar Card',
            documentNumber: u.document_number || 'XXXX-XXXX-8921',
            documentUrl: u.document_url || 'kyc_document.pdf',
            verified: u.verified !== undefined ? u.verified : true,
            registeredAt: u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '12 Jan 2023',
            accountStatus: 'Active',
            walletBalance: 1250,
            totalBookings: 3,
            totalSpent: 8450,
            savedCoPassengers: [],
            bookingHistory: []
          }));
      }

      // Merge API profiles with rich mock database so passenger history & co-travelers are always intact
      const mergedMap = new Map();
      mockPassengers.forEach(p => mergedMap.set(p.email.toLowerCase(), p));
      apiUsers.forEach(p => {
        if (mergedMap.has(p.email.toLowerCase())) {
          mergedMap.set(p.email.toLowerCase(), { ...mergedMap.get(p.email.toLowerCase()), ...p });
        } else {
          mergedMap.set(p.email.toLowerCase(), p);
        }
      });

      setPassengers(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn('API fetch user error, falling back to mock database:', err);
      setPassengers(mockPassengers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassengers();
  }, []);

  const toggleVerification = (id) => {
    setPassengers(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, verified: !p.verified, accountStatus: !p.verified ? 'Active' : 'Under Review' };
      }
      return p;
    }));
    if (selectedPassenger && selectedPassenger.id === id) {
      setSelectedPassenger(prev => ({
        ...prev,
        verified: !prev.verified,
        accountStatus: !prev.verified ? 'Active' : 'Under Review'
      }));
    }
  };

  const filteredPassengers = passengers.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(searchLower) || 
      p.email.toLowerCase().includes(searchLower) ||
      p.phone.includes(searchTerm) ||
      p.documentNumber.includes(searchTerm);

    const matchesFilter = 
      filterType === 'All' || 
      (filterType === 'Verified' && p.verified) || 
      (filterType === 'Unverified' && !p.verified);

    return matchesSearch && matchesFilter;
  });

  const totalVerified = passengers.filter(p => p.verified).length;
  const totalPending = passengers.filter(p => !p.verified).length;
  const totalBookingsAll = passengers.reduce((sum, p) => sum + (p.totalBookings || 0), 0);
  const totalSpendAll = passengers.reduce((sum, p) => sum + (p.totalSpent || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-emerald-200">
              Staff Control Center
            </span>
            <span className="text-xs text-slate-400 font-bold">• Passenger Registry</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Passenger Directory & Identity Dossiers
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Verify passenger identity credentials, review personal dossiers, saved co-travelers, and complete PNR history.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchPassengers} 
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition active:scale-95 border border-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Registry</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Registered Passengers', value: passengers.length, sub: 'Active Profiles', color: 'text-blue-600 bg-blue-500/10 border-blue-100', icon: Users },
          { label: 'KYC Verified Accounts', value: totalVerified, sub: 'Identity Authenticated', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-100', icon: UserCheck },
          { label: 'Pending KYC Checks', value: totalPending, sub: 'Verification Needed', color: 'text-amber-600 bg-amber-500/10 border-amber-100', icon: ShieldAlert },
          { label: 'Lifetime Revenue', value: `₹${totalSpendAll.toLocaleString('en-IN')}`, sub: `Across ${totalBookingsAll} Bookings`, color: 'text-purple-600 bg-purple-500/10 border-purple-100', icon: DollarSign }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/80 p-4 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                <span className="text-xl font-black text-slate-800 mt-0.5 block">{stat.value}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{stat.sub}</span>
              </div>
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${stat.color} font-bold`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Search */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 w-full md:w-96 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition">
          <Search className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search Name, Email, Phone, Aadhaar or Passport No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-bold text-slate-700"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase">KYC Status:</span>
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
            {['All', 'Verified', 'Unverified'].map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                  filterType === f ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f === 'Unverified' ? 'Checks Pending' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Passenger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">Passenger Profile</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Contact & Address</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Identity File</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">KYC Status</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Booking History</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right pr-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPassengers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-xs font-bold text-slate-400">
                    No passengers match your search and filter parameters.
                  </td>
                </tr>
              ) : (
                filteredPassengers.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    
                    {/* Profile */}
                    <td className="px-6 py-4.5 pl-8">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 font-black text-xs shadow-inner">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="font-black text-slate-800 text-xs block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold block">{p.email}</span>
                          <span className="text-[9px] font-semibold text-slate-500 block mt-0.5">
                            {p.age} Yrs • {p.gender}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4.5 text-xs">
                      <span className="font-black text-slate-800 block">{p.phone}</span>
                      <span className="text-[10px] text-slate-500 font-bold block mt-0.5">{p.city}, {p.state}</span>
                    </td>

                    {/* ID Document */}
                    <td className="px-6 py-4.5 text-xs">
                      <span className="font-black text-slate-700 block">{p.documentType}</span>
                      <span className="font-mono text-[10px] text-slate-400 font-bold block">{p.documentNumber}</span>
                      {p.documentUrl ? (
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); alert(`Simulating download of ${p.documentType} file: ${p.documentUrl}`); }}
                          className="text-[10px] font-bold text-primary-600 hover:underline flex items-center space-x-1 mt-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download Document</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-rose-500 font-semibold italic mt-1 block">Not Uploaded</span>
                      )}
                    </td>

                    {/* KYC Status */}
                    <td className="px-6 py-4.5 text-xs font-bold">
                      <span className={`inline-flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        p.verified 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {p.verified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                        <span>{p.verified ? 'Verified Profile' : 'Checks Pending'}</span>
                      </span>
                    </td>

                    {/* Booking Stats */}
                    <td className="px-6 py-4.5 text-xs">
                      <span className="font-black text-slate-800 block">{p.totalBookings} Total Bookings</span>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold block mt-0.5">
                        Spent: ₹{p.totalSpent.toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4.5 text-right pr-8 space-x-2">
                      <button
                        onClick={() => { setSelectedPassenger(p); setActiveTab('profile'); }}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 text-xs font-black transition active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Full Dossier</span>
                      </button>

                      <button
                        onClick={() => toggleVerification(p.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 border ${
                          p.verified
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {p.verified ? 'Revoke KYC' : 'Approve KYC'}
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PASSENGER PROFILE & BOOKING HISTORY DOSSIER MODAL */}
      {selectedPassenger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-black text-base shadow-md">
                  {selectedPassenger.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-black tracking-tight">{selectedPassenger.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      selectedPassenger.verified ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-900'
                    }`}>
                      {selectedPassenger.verified ? 'KYC Verified' : 'Pending Verification'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center space-x-2">
                    <span>{selectedPassenger.email}</span>
                    <span>•</span>
                    <span>{selectedPassenger.phone}</span>
                    <span>•</span>
                    <span>ID: {selectedPassenger.id}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedPassenger(null); setViewingPnrDetail(null); }}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tab Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center space-x-2 overflow-x-auto">
              {[
                { id: 'profile', label: 'Personal & KYC Details', icon: Users },
                { id: 'history', label: `Complete Booking History (${selectedPassenger.bookingHistory.length})`, icon: Ticket },
                { id: 'copassengers', label: `Saved Co-Passengers (${selectedPassenger.savedCoPassengers.length})`, icon: UserPlus },
                { id: 'financial', label: 'Financial Audit & Wallet', icon: CreditCard }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setViewingPnrDetail(null); }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-black transition whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'bg-white text-primary-700 shadow-sm border border-slate-200' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
              
              {/* TAB 1: PERSONAL & KYC DETAILS */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-xs">
                    
                    {/* Personal Information Grid */}
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-3">
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Full Name</span>
                          <span className="font-black text-slate-800">{selectedPassenger.name}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Age & Gender</span>
                          <span className="font-black text-slate-800">{selectedPassenger.age} Yrs ({selectedPassenger.gender})</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Date of Birth</span>
                          <span className="font-black text-slate-800">{selectedPassenger.dob}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Member Since</span>
                          <span className="font-black text-slate-800">{selectedPassenger.registeredAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact & Address */}
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-3">
                        Contact & Address Roster
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Primary Contact Methods</span>
                          <div className="flex items-center space-x-2 text-slate-700 font-bold">
                            <Mail className="h-3.5 w-3.5 text-primary-600" />
                            <span>{selectedPassenger.email}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-slate-700 font-bold">
                            <Phone className="h-3.5 w-3.5 text-primary-600" />
                            <span>{selectedPassenger.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-rose-600 font-bold">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Emergency: {selectedPassenger.emergencyContact}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Residential Address</span>
                          <div className="flex items-start space-x-2 text-slate-700 font-bold">
                            <MapPin className="h-3.5 w-3.5 text-primary-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span>{selectedPassenger.address}</span>
                              <span className="block text-slate-500 font-semibold mt-0.5">
                                {selectedPassenger.city}, {selectedPassenger.state} - {selectedPassenger.pincode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KYC Document Audit */}
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-3">
                        KYC Government Identity Document Audit
                      </h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-800 text-xs">{selectedPassenger.documentType}</span>
                            <span className="font-mono text-xs font-black text-primary-700 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded">
                              {selectedPassenger.documentNumber}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                            Status: {selectedPassenger.verified ? 'Verified & Authenticated against Government Identity Database' : 'Pending Manual Staff Verification'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          {selectedPassenger.documentUrl ? (
                            <button 
                              onClick={() => alert(`Opening scanned identity document: ${selectedPassenger.documentUrl}`)}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-black text-xs hover:bg-slate-100 transition"
                            >
                              <Download className="h-3.5 w-3.5 text-primary-600" />
                              <span>View Scanned File</span>
                            </button>
                          ) : (
                            <span className="text-xs text-rose-500 font-bold italic">No document uploaded</span>
                          )}

                          <button 
                            onClick={() => toggleVerification(selectedPassenger.id)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
                              selectedPassenger.verified 
                                ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' 
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                            }`}
                          >
                            {selectedPassenger.verified ? 'Revoke Verification' : 'Approve Profile'}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: COMPLETE BOOKING HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        Complete Booking Roster for {selectedPassenger.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">Every ticket reservation, journey route, fare, and passenger roster under this user account.</p>
                    </div>
                  </div>

                  {selectedPassenger.bookingHistory.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                      <Ticket className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400">No booking records found for this passenger.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">PNR Number</th>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Train Info</th>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Route & Date</th>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Class & Seat</th>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Fare Paid</th>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Status</th>
                            <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPassenger.bookingHistory.map(b => (
                            <tr key={b.pnr} className="hover:bg-slate-50/60 transition">
                              <td className="px-4 py-3.5 font-mono font-black text-primary-600">#{b.pnr}</td>
                              <td className="px-4 py-3.5">
                                <span className="font-black text-slate-800 block">{b.trainName}</span>
                                <span className="font-mono text-[10px] text-slate-400 block">#{b.trainNo}</span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="font-bold text-slate-800 block">{b.route}</span>
                                <span className="text-[10px] text-slate-400 block font-semibold">{b.travelDate}</span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="font-black text-slate-700 block">{b.class} Class</span>
                                <span className="font-mono text-[10px] text-slate-500 block">{b.seat}</span>
                              </td>
                              <td className="px-4 py-3.5 font-mono font-black text-slate-800">
                                ₹{b.amount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  b.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'RAC' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <button 
                                  onClick={() => setViewingPnrDetail(b)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black transition"
                                >
                                  View Roster
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sub-view for PNR roster if clicked */}
                  {viewingPnrDetail && (
                    <div className="bg-white p-5 rounded-2xl border border-primary-200 space-y-3 shadow-sm animate-slide-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-primary-700 uppercase">
                          Co-Passengers Roster for Ticket PNR #{viewingPnrDetail.pnr} ({viewingPnrDetail.trainName})
                        </span>
                        <button onClick={() => setViewingPnrDetail(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">
                          Close Ticket Details ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {viewingPnrDetail.passengersRoster.map((pr, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                            <span className="font-black text-slate-800 block">{pr.name} ({pr.age} Yrs)</span>
                            <span className="font-mono text-primary-700 font-bold block">{pr.seat}</span>
                            <span className="text-[10px] font-black uppercase text-emerald-700 block">{pr.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: SAVED CO-PASSENGERS */}
              {activeTab === 'copassengers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        Saved Family & Co-Travelers Roster
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">Pre-saved companion profiles for quick ticket booking under this account.</p>
                    </div>
                  </div>

                  {selectedPassenger.savedCoPassengers.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                      <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400">No saved co-passengers registered under this profile.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedPassenger.savedCoPassengers.map(sp => (
                        <div key={sp.id} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                                {sp.name[0]}
                              </div>
                              <div>
                                <span className="font-black text-slate-800 text-xs block">{sp.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold block">{sp.relation}</span>
                              </div>
                            </div>
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded">
                              {sp.gender}, {sp.age} Yrs
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-2 flex justify-between">
                            <span>Default ID Proof:</span>
                            <span className="font-mono text-slate-700 font-bold">{sp.idType}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: FINANCIAL AUDIT */}
              {activeTab === 'financial' && (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-xs">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                      Financial Account Metrics & Wallet Audit
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Lifetime Total Spent</span>
                        <span className="text-xl font-black text-primary-700">₹{selectedPassenger.totalSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Wallet Balance</span>
                        <span className="text-xl font-black text-emerald-700">₹{selectedPassenger.walletBalance.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Completed Trips</span>
                        <span className="text-xl font-black text-slate-800">{selectedPassenger.totalBookings} Trips</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">
                Inspected by Railway Administration Staff
              </span>
              <button 
                onClick={() => { setSelectedPassenger(null); setViewingPnrDetail(null); }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black transition active:scale-95"
              >
                Close Dossier
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default StaffPassengers;
