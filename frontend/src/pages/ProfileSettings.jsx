import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Phone, Upload, Award, Shield, CheckCircle, Clock,
  Settings, Users, Ticket, Heart, Sparkles, Check, Trash2, 
  Edit2, Plus, Calendar, AlertTriangle, Armchair, Pizza, HelpCircle,
  X, AlertCircle, Bookmark, Lock
} from 'lucide-react';
import CreateIrctcModal from '../components/CreateIrctcModal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const ProfileSettings = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Active Tab: 'personal' | 'preferences' | 'companions' | 'bookings'
  const [activeTab, setActiveTab] = useState('personal');
  const [showCreateIrctcModal, setShowCreateIrctcModal] = useState(false);
  const [savedIrctcId, setSavedIrctcId] = useState(() => localStorage.getItem('saved_irctc_id') || '');

  // Personal Info Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState(user?.gender || 'Male');
  const [age, setAge] = useState(user?.age || '');
  const [docFile, setDocFile] = useState(null);
  const [docUrl, setDocUrl] = useState(user?.document_url || '');
  const [uploading, setUploading] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSuccessMsg, setPersonalSuccessMsg] = useState('');

  // Travel Preferences Form State
  const [mealPref, setMealPref] = useState(user?.meal_preference || 'No Preference');
  const [berthPref, setBerthPref] = useState(user?.berth_preference || 'No Preference');
  const [wheelchair, setWheelchair] = useState(user?.wheelchair_required || false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccessMsg, setPrefsSuccessMsg] = useState('');

  // Saved Companions State
  const [companions, setCompanions] = useState([]);
  const [loadingCompanions, setLoadingCompanions] = useState(false);
  const [compName, setCompName] = useState('');
  const [compAge, setCompAge] = useState('');
  const [compGender, setCompGender] = useState('Male');
  const [compBerth, setCompBerth] = useState('No Preference');
  const [compIrctc, setCompIrctc] = useState('');
  const [compFood, setCompFood] = useState('No Preference');
  const [editingCompId, setEditingCompId] = useState(null);
  const [savingCompanion, setSavingCompanion] = useState(false);
  const [companionSuccessMsg, setCompanionSuccessMsg] = useState('');
  const [deleteModalPassenger, setDeleteModalPassenger] = useState(null);
  const [deletingPassenger, setDeletingPassenger] = useState(false);

  // Booking History State
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Sync state with user context updates
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setGender(user.gender || 'Male');
      setAge(user.age || '');
      setDocUrl(user.document_url || '');
      setMealPref(user.meal_preference || 'No Preference');
      setBerthPref(user.berth_preference || 'No Preference');
      setWheelchair(user.wheelchair_required || false);
      const userIrctc = user.irctc_user_id || user.irctc_id || localStorage.getItem('saved_irctc_id') || '';
      setSavedIrctcId(userIrctc);
    }
  }, [user]);

  // Load Saved Companions when activeTab changes to 'companions'
  useEffect(() => {
    if (activeTab === 'companions' && user?.role === 'passenger') {
      fetchCompanions();
    }
  }, [activeTab, user]);

  // Load Booking History when activeTab changes to 'bookings'
  useEffect(() => {
    if (activeTab === 'bookings' && user?.role === 'passenger') {
      fetchBookings();
    }
  }, [activeTab, user]);

  // Ensure staff and admin do not stay on passenger-only tabs
  useEffect(() => {
    if (user && user.role !== 'passenger' && activeTab !== 'personal') {
      setActiveTab('personal');
    }
  }, [user, activeTab]);

  const fetchCompanions = async () => {
    setLoadingCompanions(true);
    try {
      const res = await api.get('/passengers/saved');
      setCompanions(res.data || []);
    } catch (err) {
      try {
        const fallback = await api.get('/auth/saved-passengers');
        setCompanions(fallback.data || []);
      } catch (fbErr) {
        console.error('Error fetching companions:', fbErr);
      }
    } finally {
      setLoadingCompanions(false);
    }
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await api.get('/bookings');
      setBookings(res.data);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!docFile) {
      alert('Please select a file first.');
      return;
    }

    if (docFile.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5 MB.');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(docFile.type)) {
      alert('Unsupported file format. Please upload PDF, PNG, JPG, JPEG, or WEBP.');
      return;
    }

    setUploading(true);
    setPersonalSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('document', docFile);

      const res = await api.post('/auth/profile/identity-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.success) {
        setUser(res.data.user);
        setDocUrl(res.data.user.document_url || '');
        setPersonalSuccessMsg('Identity document uploaded and stored securely!');
        showToast('Your identity document has been uploaded and stored securely.', 'success', 'Upload Successful');
      } else {
        throw new Error(res.data?.message || 'Server did not confirm successful upload.');
      }
    } catch (err) {
      console.error('Document upload failed:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Upload failed.';
      alert('Upload failed: ' + errMsg);
    } finally {
      setUploading(false);
    }
  };

  // Edit mode state: once saved, details stay locked permanently, but user can click Edit
  const [isEditing, setIsEditing] = useState(false);

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalSuccessMsg('');

    try {
      const res = await api.put('/auth/profile', {
        full_name: fullName,
        phone,
        gender,
        age,
        document_url: docUrl
      });
      
      const updatedUser = res.data.user || {};
      setUser(updatedUser);
      
      // Persist permanently in role-specific local storage
      const role = (updatedUser.role || user?.role || '').toLowerCase();
      if (role === 'staff') {
        const cached = JSON.parse(localStorage.getItem('staff_user') || '{}');
        localStorage.setItem('staff_user', JSON.stringify({ ...cached, ...updatedUser }));
      } else if (role === 'admin') {
        const cached = JSON.parse(localStorage.getItem('admin_user') || '{}');
        localStorage.setItem('admin_user', JSON.stringify({ ...cached, ...updatedUser }));
      } else {
        const cached = JSON.parse(localStorage.getItem('passenger_user') || '{}');
        localStorage.setItem('passenger_user', JSON.stringify({ ...cached, ...updatedUser }));
      }
      
      setIsEditing(false);
      setPersonalSuccessMsg('Profile details permanently saved to database.');
      showToast('Profile details permanently saved to database.', 'success', 'Saved Permanently');
    } catch (err) {
      console.error(err);
      showToast('Failed to save profile changes.', 'error', 'Save Error');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefsSuccessMsg('');

    try {
      const res = await api.put('/auth/profile', {
        meal_preference: mealPref,
        berth_preference: berthPref,
        wheelchair_required: wheelchair
      });

      setUser(res.data.user);

      const cached = JSON.parse(localStorage.getItem('passenger_user') || '{}');
      const updatedUser = { ...cached, ...res.data.user };
      localStorage.setItem('passenger_user', JSON.stringify(updatedUser));

      setPrefsSuccessMsg('Travel preferences saved successfully!');
      showToast('Travel and berth preferences updated successfully.', 'success', 'Preferences Saved');
    } catch (err) {
      console.error(err);
      showToast('Failed to save travel preferences.', 'error', 'Save Error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveCompanion = async (e) => {
    e.preventDefault();
    if (!compName || !compAge) {
      alert('Name and Age are required.');
      return;
    }

    setSavingCompanion(true);
    setCompanionSuccessMsg('');

    const payload = {
      full_name: compName.trim(),
      age: compAge ? parseInt(compAge, 10) : null,
      gender: compGender,
      irctc_user_id: compIrctc.trim(),
      berth_preference: compBerth,
      food_preference: compFood
    };

    try {
      let savedComp;
      if (editingCompId) {
        // Update existing passenger
        try {
          const res = await api.put(`/passengers/saved/${editingCompId}`, payload);
          savedComp = res.data;
        } catch (apiErr) {
          const fallbackRes = await api.put(`/auth/saved-passengers/${editingCompId}`, payload);
          savedComp = fallbackRes.data;
        }
        setCompanions(prev => prev.map(c => c.id === editingCompId ? savedComp : c));
        showToast(`Saved passenger "${compName}" updated successfully!`, 'success', 'Profile Updated');
      } else {
        // Add new passenger
        try {
          const res = await api.post('/passengers/saved', payload);
          savedComp = res.data;
        } catch (apiErr) {
          const fallbackRes = await api.post('/auth/saved-passengers', payload);
          savedComp = fallbackRes.data;
        }
        setCompanions(prev => [savedComp, ...prev]);
        showToast(`Passenger "${compName}" saved to your profile!`, 'success', 'Passenger Saved');
      }

      // Reset Form State
      setCompName('');
      setCompAge('');
      setCompGender('Male');
      setCompBerth('No Preference');
      setCompIrctc('');
      setCompFood('No Preference');
      setEditingCompId(null);
    } catch (err) {
      console.error('Error saving companion profile:', err);
      showToast('Failed to save companion: ' + (err.response?.data?.error || err.message), 'error', 'Save Failed');
    } finally {
      setSavingCompanion(false);
    }
  };

  const handleEditCompanion = (companion) => {
    setCompName(companion.full_name || '');
    setCompAge(companion.age !== null && companion.age !== undefined ? companion.age : '');
    setCompGender(companion.gender || 'Male');
    setCompBerth(companion.berth_preference || 'No Preference');
    setCompIrctc(companion.irctc_user_id || companion.irctc_id || '');
    setCompFood(companion.food_preference || 'No Preference');
    setEditingCompId(companion.id);
    setCompanionSuccessMsg('');
  };

  const requestDeleteCompanion = (companion) => {
    setDeleteModalPassenger(companion);
  };

  const confirmDeletePassenger = async () => {
    if (!deleteModalPassenger) return;
    setDeletingPassenger(true);
    try {
      try {
        await api.delete(`/passengers/saved/${deleteModalPassenger.id}`);
      } catch (e) {
        await api.delete(`/auth/saved-passengers/${deleteModalPassenger.id}`);
      }
      setCompanions(companions.filter(c => c.id !== deleteModalPassenger.id));
      showToast(`Passenger "${deleteModalPassenger.full_name}" removed from saved list.`, 'success', 'Passenger Removed');
      if (editingCompId === deleteModalPassenger.id) {
        setCompName('');
        setCompAge('');
        setCompGender('Male');
        setCompBerth('No Preference');
        setCompIrctc('');
        setCompFood('No Preference');
        setEditingCompId(null);
      }
      setDeleteModalPassenger(null);
    } catch (err) {
      console.error('Failed to delete companion:', err);
      showToast('Failed to delete passenger: ' + (err.response?.data?.error || err.message), 'error', 'Delete Failed');
    } finally {
      setDeletingPassenger(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans">
      
      {/* Header Area */}
      <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary-600 animate-spin-slow" />
            {user.role === 'staff' 
              ? 'Staff Profile & Settings' 
              : user.role === 'admin' 
              ? 'Administrator Profile & Settings' 
              : 'Passenger Profile Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {user.role === 'staff' || user.role === 'admin'
              ? 'Manage your official railway credentials, contact details, and account settings.'
              : 'Manage your personal data, identity verification, travel preferences, and saved companions.'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-extrabold text-lg">
            {fullName.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">
              {fullName || (user.role === 'staff' ? 'Operations Staff' : user.role === 'admin' ? 'Administrator' : 'Railway Passenger')}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
          </div>
        </div>
      </div>

      {/* Main Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-2">
          {[
            { id: 'personal', label: user.role === 'passenger' ? 'Personal Information' : 'Official Details', icon: User },
            { id: 'preferences', label: 'Travel Preferences', icon: Heart, roleSpecific: 'passenger' },
            { id: 'companions', label: 'Saved Passengers', icon: Users, roleSpecific: 'passenger' },
            { id: 'bookings', label: 'Booking Record', icon: Ticket, roleSpecific: 'passenger' }
          ].map(tab => {
            if (tab.roleSpecific && user.role !== tab.roleSpecific) return null;
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPersonalSuccessMsg('');
                  setPrefsSuccessMsg('');
                  setCompanionSuccessMsg('');
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-primary-900 text-white shadow-md shadow-primary-900/10 translate-x-1' 
                    : 'bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <IconComponent className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="md:col-span-3">
          
          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {user.role === 'passenger' ? 'Personal Details & Verification' : 'Official Credentials & Contact Details'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {user.role === 'passenger' 
                    ? 'Keep your credentials up to date. Verify identity documents to simplify automated check-ins.'
                    : 'Keep your contact information and official railway profile details up to date.'}
                </p>
              </div>

              {user.role !== 'passenger' && (
                <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-amber-400" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                        Official Railway Credentials
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      {user.duty_status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Employee ID</span>
                      <span className="font-mono font-bold text-white">{user.employee_id || 'EMP-17883'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Department</span>
                      <span className="font-bold text-white">{user.department || 'Operations'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Designation</span>
                      <span className="font-bold text-white">{user.designation || (user.role === 'staff' ? 'Operations Officer' : 'Administrator')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Base Station</span>
                      <span className="font-mono font-bold text-white">{user.base_station || 'NDLS'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Staff Type</span>
                      <span className="font-bold text-white">{user.staff_type || 'Operations Staff'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">System Role</span>
                      <span className="font-mono font-bold text-amber-400 uppercase">{user.role}</span>
                    </div>
                  </div>
                </div>
              )}

              {!isEditing ? (
                <div className="space-y-6">
                  {/* Status Card: Saved Permanently */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                            Details Saved Permanently
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold">
                            <Lock className="h-3 w-3" />
                            Locked & Stored
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Profile information is stored permanently in the railway database. Click <strong>Edit Details</strong> below anytime you need to update them.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-edit-profile-top"
                      onClick={() => {
                        setPersonalSuccessMsg('');
                        setIsEditing(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-bold shadow-sm transition self-start sm:self-center cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit Details</span>
                    </button>
                  </div>

                  {personalSuccessMsg && (
                    <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                      <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs font-semibold">{personalSuccessMsg}</span>
                    </div>
                  )}

                  {/* Saved Details Display Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</span>
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-bold text-slate-800">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{fullName || user.full_name || 'Not provided'}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</span>
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-bold text-slate-800">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{phone || user.phone || 'Not provided'}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</span>
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-bold text-slate-800">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{gender || user.gender || 'Not specified'}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age</span>
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-bold text-slate-800">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{age || user.age ? `${age || user.age} yrs` : 'Not specified'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2 text-slate-500">
                      <Mail className="h-4.5 w-4.5 text-slate-400" />
                      <span>Account Email: <strong className="text-slate-700 font-mono">{user.email}</strong></span>
                    </div>
                    <span className="capitalize px-2.5 py-0.5 rounded-md bg-slate-200 text-[10px] font-bold text-slate-700">
                      {user.role} role
                    </span>
                  </div>

                  {/* Identity Document Verification (passenger only) */}
                  {user.role === 'passenger' && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Identity Verification Documents</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">Please upload a scan of your National Identity Card, Passport or Driver's license.</p>
                        </div>
                        {user?.verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </span>
                        ) : docUrl ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase">
                            <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                            Pending Verification
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase">
                            <AlertTriangle className="h-3 w-3" />
                            Unverified
                          </span>
                        )}
                      </div>
                      {docUrl && (
                        <div className="flex items-center space-x-2 text-[10px] text-primary-600 font-bold bg-primary-50/50 p-2.5 rounded-xl border border-primary-100">
                          <Award className="h-4 w-4 text-primary-600" />
                          <span>Uploaded File Reference: <a href={docUrl} target="_blank" rel="noreferrer" className="underline font-mono">{docUrl.substring(docUrl.lastIndexOf('/') + 1)}</a></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit Button */}
                  <button
                    type="button"
                    id="btn-edit-profile-bottom"
                    onClick={() => {
                      setPersonalSuccessMsg('');
                      setIsEditing(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3 font-bold text-white shadow-md transition cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span>Edit Profile Details</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSavePersonal} className="space-y-6">
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <Edit2 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>Editing details. Changes will be permanently saved to the database.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFullName(user.full_name || '');
                        setPhone(user.phone || '');
                        setGender(user.gender || 'Male');
                        setAge(user.age || '');
                        setIsEditing(false);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-primary-500 transition">
                        <User className="h-4.5 w-4.5 text-slate-400 mr-2" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full text-xs bg-transparent focus:outline-none text-slate-700 font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-primary-500 transition">
                        <Phone className="h-4.5 w-4.5 text-slate-400 mr-2" />
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full text-xs bg-transparent focus:outline-none text-slate-700 font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gender</label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-primary-500 transition">
                        <User className="h-4.5 w-4.5 text-slate-400 mr-2" />
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full text-xs bg-transparent focus:outline-none text-slate-700 font-semibold cursor-pointer"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Age</label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-primary-500 transition">
                        <Calendar className="h-4.5 w-4.5 text-slate-400 mr-2" />
                        <input
                          type="number"
                          placeholder="Enter your age"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="w-full text-xs bg-transparent focus:outline-none text-slate-700 font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Mail className="h-4.5 w-4.5" />
                      <span>Account Email: <strong className="text-slate-600 font-mono">{user.email}</strong></span>
                    </div>
                    <span className="capitalize px-2 py-0.5 rounded-md bg-slate-200 text-[10px] font-bold text-slate-600">
                      {user.role} role
                    </span>
                  </div>

                  {/* Identity Document Verification */}
                  {user.role === 'passenger' && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Identity Verification Documents</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">Please upload a scan of your National Identity Card, Passport or Driver's license.</p>
                        </div>
                        
                        {user?.verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </span>
                        ) : docUrl ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase">
                            <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                            Pending Verification
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase">
                            <AlertTriangle className="h-3 w-3" />
                            Unverified
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                          <Upload className="h-4 w-4 text-slate-400 mr-2" />
                          <input
                            type="file"
                            onChange={(e) => setDocFile(e.target.files[0])}
                            className="w-full focus:outline-none text-slate-500 cursor-pointer"
                          />
                        </div>
                        {docFile && (
                          <button
                            type="button"
                            onClick={handleUploadDocument}
                            disabled={uploading}
                            className="rounded-xl bg-slate-900 hover:bg-slate-950 text-white px-4 py-2 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                          >
                            {uploading ? 'Uploading...' : 'Upload Document'}
                          </button>
                        )}
                      </div>

                      {docUrl && (
                        <div className="flex items-center space-x-2 text-[10px] text-primary-600 font-bold bg-primary-50/50 p-2.5 rounded-xl border border-primary-100">
                          <Award className="h-4 w-4 text-primary-600" />
                          <span>Uploaded File Reference: <a href={docUrl} target="_blank" rel="noreferrer" className="underline font-mono">{docUrl.substring(docUrl.lastIndexOf('/') + 1)}</a></span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingPersonal}
                      className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3 font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>{savingPersonal ? 'Saving permanently...' : 'Save Profile Details'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFullName(user.full_name || '');
                        setPhone(user.phone || '');
                        setGender(user.gender || 'Male');
                        setAge(user.age || '');
                        setIsEditing(false);
                      }}
                      className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: TRAVEL PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Travel & Booking Preferences</h3>
                <p className="text-xs text-slate-400 mt-0.5">Customize your defaults to bypass options and book seats faster.</p>
              </div>

              {prefsSuccessMsg && (
                <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-semibold">{prefsSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSavePreferences} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Preferred Berth Type</label>
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-primary-500 transition">
                      <Armchair className="h-4.5 w-4.5 text-slate-400 mr-2" />
                      <select
                        value={berthPref}
                        onChange={(e) => setBerthPref(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none text-slate-700 font-semibold cursor-pointer"
                      >
                        <option value="No Preference">No Preference</option>
                        <option value="LB">Lower Berth (LB)</option>
                        <option value="MB">Middle Berth (MB)</option>
                        <option value="UB">Upper Berth (UB)</option>
                        <option value="SL">Side Lower (SL)</option>
                        <option value="SU">Side Upper (SU)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Catering / Meal Preference</label>
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-primary-500 transition">
                      <Pizza className="h-4.5 w-4.5 text-slate-400 mr-2" />
                      <select
                        value={mealPref}
                        onChange={(e) => setMealPref(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none text-slate-700 font-semibold cursor-pointer"
                      >
                        <option value="No Preference">No Preference</option>
                        <option value="Veg">Vegetarian Meal</option>
                        <option value="Non-Veg">Non-Vegetarian Meal</option>
                        <option value="Diabetic">Diabetic Friendly Meal</option>
                        <option value="Child Meal">Child Special Meal</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Wheelchair Assistance Required</span>
                    <span className="text-[10px] text-slate-400">Request ground assistance / boarding wheelchair support at all transit stations.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWheelchair(!wheelchair)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      wheelchair ? 'bg-primary-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      wheelchair ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-orange-50/70 border border-orange-200/80 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block uppercase tracking-wide">IRCTC Account Identity</span>
                    <span className="text-xs font-mono font-bold text-orange-700 block mt-0.5">
                      {savedIrctcId ? `IRCTC User ID: ${savedIrctcId}` : 'IRCTC User ID: Not Added'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateIrctcModal(true)}
                    className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition active:scale-95 shadow-sm"
                  >
                    Add / Update IRCTC User ID
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3 font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  <span>{savingPrefs ? 'Saving preferences...' : 'Save Preferences'}</span>
                </button>
              </form>

              <CreateIrctcModal
                isOpen={showCreateIrctcModal}
                currentIrctcId={savedIrctcId}
                onClose={() => setShowCreateIrctcModal(false)}
                onSuccess={(newId) => {
                  setSavedIrctcId(newId);
                  localStorage.setItem('saved_irctc_id', newId);
                  if (setUser && user) {
                    setUser({ ...user, irctc_user_id: newId, irctc_id: newId });
                  }
                  showToast(`IRCTC User ID "${newId}" saved successfully!`, 'success', 'IRCTC Account Updated');
                }}
              />
            </div>
          )}

          {/* TAB 3: SAVED PASSENGERS (COMPANIONS) */}
          {activeTab === 'companions' && (
            <div className="space-y-6">
              
              {/* Form Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {editingCompId ? 'Modify Saved Passenger Details' : 'Add New Saved Passenger'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Saved passenger profiles can be selected with a single click during ticket booking.</p>
                </div>

                {companionSuccessMsg && (
                  <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold">{companionSuccessMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSaveCompanion} className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="Enter passenger full name"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-semibold text-slate-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Age *</label>
                    <input
                      type="number"
                      placeholder="Age"
                      value={compAge}
                      onChange={(e) => setCompAge(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-semibold text-slate-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gender *</label>
                    <select
                      value={compGender}
                      onChange={(e) => setCompGender(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block mb-1">IRCTC User ID</label>
                    <input
                      type="text"
                      placeholder="IRCTC User ID (optional)"
                      value={compIrctc}
                      onChange={(e) => setCompIrctc(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Berth Preference</label>
                    <select
                      value={compBerth}
                      onChange={(e) => setCompBerth(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="No Preference">No Preference</option>
                      <option value="LB">Lower Berth (LB)</option>
                      <option value="MB">Middle Berth (MB)</option>
                      <option value="UB">Upper Berth (UB)</option>
                      <option value="SL">Side Lower (SL)</option>
                      <option value="SU">Side Upper (SU)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Food Preference</label>
                    <select
                      value={compFood}
                      onChange={(e) => setCompFood(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="No Preference">No Preference</option>
                      <option value="Vegetarian">Vegetarian (Veg)</option>
                      <option value="Non-Vegetarian">Non-Vegetarian (Non-Veg)</option>
                      <option value="Diabetic">Diabetic Friendly</option>
                      <option value="No Train Food">Opt out / No Food</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                    {editingCompId && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompName('');
                          setCompAge('');
                          setCompGender('Male');
                          setCompBerth('No Preference');
                          setCompIrctc('');
                          setCompFood('No Preference');
                          setEditingCompId(null);
                        }}
                        className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 transition"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={savingCompanion}
                      className="inline-flex items-center justify-center space-x-1.5 rounded-xl bg-primary-900 hover:bg-primary-950 px-6 py-2.5 font-bold text-white shadow-sm transition disabled:opacity-50 text-xs"
                    >
                      {editingCompId ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Update Passenger</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span>Save Passenger</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* List Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-primary-800" />
                    <h3 className="text-base font-extrabold text-slate-800">Saved Passengers</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {companions.length} profile{companions.length === 1 ? '' : 's'}
                  </span>
                </div>
                
                {loadingCompanions ? (
                  <div className="text-center py-6">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent" />
                  </div>
                ) : companions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs space-y-2">
                    <Users className="mx-auto h-8 w-8 text-slate-300" />
                    <div className="font-bold text-slate-700">No saved passengers yet</div>
                    <p className="text-[11px] text-slate-500">
                      Save passenger details during booking to quickly use them next time.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {companions.map(companion => (
                      <div 
                        key={companion.id} 
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between hover:border-slate-300 transition-all hover:bg-white shadow-xs"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-sm text-slate-800 truncate max-w-[75%]">{companion.full_name}</h4>
                            <span className="text-[9px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded border border-primary-100">
                              {companion.gender || 'Male'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
                            <div>Age: <span className="text-slate-800 font-bold">{companion.age || '—'}</span></div>
                            <div>Berth: <span className="text-slate-800 font-bold">{companion.berth_preference || 'No Preference'}</span></div>
                            {companion.food_preference && companion.food_preference !== 'No Preference' && (
                              <div className="col-span-2 text-emerald-800 text-[10px] font-semibold flex items-center gap-1">
                                <span>Meal: {companion.food_preference}</span>
                              </div>
                            )}
                            {companion.irctc_user_id && (
                              <div className="col-span-2 text-[10px] font-mono font-bold text-orange-700">
                                IRCTC: {companion.irctc_user_id}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-2.5 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleEditCompanion(companion)}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteCompanion(companion)}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Confirmation Modal for Deleting Saved Passenger (NO window.confirm) */}
              {deleteModalPassenger && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
                    <div className="flex items-center space-x-3 text-rose-600">
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">Remove Saved Passenger</h3>
                        <p className="text-xs text-slate-500">Confirm permanent removal of profile template</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Are you sure you want to remove <strong className="text-slate-900 font-bold">{deleteModalPassenger.full_name}</strong> from your saved passenger list? 
                      <br /><br />
                      <span className="text-slate-400">Note: Historical ticket bookings and past travel records will remain completely unchanged.</span>
                    </p>

                    <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setDeleteModalPassenger(null)}
                        disabled={deletingPassenger}
                        className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeletePassenger}
                        disabled={deletingPassenger}
                        className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-rose-600/20 transition disabled:opacity-50 flex items-center space-x-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{deletingPassenger ? 'Removing...' : 'Remove Passenger'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}


          {/* TAB 4: BOOKING RECORD */}
          {activeTab === 'bookings' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Booking History & Records</h3>
                <p className="text-xs text-slate-400 mt-0.5">Quickly retrieve and manage all past and upcoming train reservations.</p>
              </div>

              {loadingBookings ? (
                <div className="text-center py-8">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-xs space-y-3">
                  <Ticket className="mx-auto h-10 w-10 text-slate-350" />
                  <p className="font-bold text-slate-500">No Booking Records Found</p>
                  <button
                    onClick={() => navigate('/passenger')}
                    className="inline-flex items-center rounded-xl bg-primary-900 text-white font-bold px-4 py-2 hover:bg-primary-950 transition"
                  >
                    Book A Train
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {bookings.map(b => (
                    <div key={b.id} className="rounded-xl border border-slate-150 p-4 hover:border-slate-300 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-800 text-xs">
                            {b.train?.train_name || 'Rajdhani Express'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">PNR: {b.pnr_number}</span>
                        </div>
                        
                        <div className="flex gap-4 items-center text-[10px] text-slate-500 font-semibold mt-1">
                          <span className="flex items-center"><Calendar className="h-3.5 w-3.5 text-primary-600 mr-1" />{b.travel_date}</span>
                          <span>Fare: <strong className="text-slate-700">₹{b.total_fare}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : b.status === 'rac' || b.status === 'waitlist'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {b.status}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigate(`/passenger/ticket/${b.pnr_number}`)}
                            className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 font-bold hover:bg-slate-950 transition text-[10px]"
                          >
                            Ticket
                          </button>
                          {b.status !== 'cancelled' && (
                            <button
                              onClick={() => navigate(`/passenger/track?train_id=${b.train_id}`)}
                              className="border border-primary-200 text-primary-700 hover:bg-primary-50 rounded-lg px-2.5 py-1.5 font-bold transition text-[10px]"
                            >
                              Track
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default ProfileSettings;
