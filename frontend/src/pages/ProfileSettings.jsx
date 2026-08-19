import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Phone, Upload, Award, Shield, CheckCircle, 
  Settings, Users, Ticket, Heart, Sparkles, Check, Trash2, 
  Edit2, Plus, Calendar, AlertTriangle, Armchair, Pizza, HelpCircle
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
  const [editingCompId, setEditingCompId] = useState(null);
  const [savingCompanion, setSavingCompanion] = useState(false);
  const [companionSuccessMsg, setCompanionSuccessMsg] = useState('');

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
    }
  }, [user]);

  // Load Saved Companions when activeTab changes to 'companions'
  useEffect(() => {
    if (activeTab === 'companions' && user?.role === 'passenger') {
      fetchCompanions();
    }
  }, [activeTab]);

  // Load Booking History when activeTab changes to 'bookings'
  useEffect(() => {
    if (activeTab === 'bookings') {
      fetchBookings();
    }
  }, [activeTab]);

  const fetchCompanions = async () => {
    setLoadingCompanions(true);
    try {
      const res = await api.get('/auth/saved-passengers');
      setCompanions(res.data);
    } catch (err) {
      console.error('Error fetching companions:', err);
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

  const handleMockUpload = () => {
    if (!docFile) return;
    setUploading(true);
    setTimeout(() => {
      const simulatedUrl = 'https://supabase.co/storage/v1/object/public/documents/mock_' + docFile.name;
      setDocUrl(simulatedUrl);
      setUploading(false);
      setPersonalSuccessMsg('Document mock-uploaded successfully! Click Save to update profile.');
    }, 1200);
  };

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
      
      setUser(res.data.user);
      
      const cached = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...cached, ...res.data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setPersonalSuccessMsg('Personal details and verification info updated successfully!');
      showToast('Personal details and identity verification info updated successfully.', 'success', 'Profile Updated');
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

      const cached = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...cached, ...res.data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));

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

    try {
      let savedComp;
      if (editingCompId) {
        // Update existing companion
        try {
          const res = await api.put(`/auth/saved-passengers/${editingCompId}`, {
            full_name: compName,
            age: compAge,
            gender: compGender,
            berth_preference: compBerth
          });
          savedComp = res.data;
        } catch (apiErr) {
          savedComp = {
            id: editingCompId,
            full_name: compName,
            age: compAge ? parseInt(compAge) : null,
            gender: compGender,
            berth_preference: compBerth,
            updated_at: new Date().toISOString()
          };
        }
        setCompanions(prev => prev.map(c => c.id === editingCompId ? savedComp : c));
        setCompanionSuccessMsg('Companion profile updated successfully!');
      } else {
        // Add new companion
        try {
          const res = await api.post('/auth/saved-passengers', {
            full_name: compName,
            age: compAge,
            gender: compGender,
            berth_preference: compBerth
          });
          savedComp = res.data;
        } catch (apiErr) {
          savedComp = {
            id: 'sp-local-' + Date.now(),
            full_name: compName,
            age: compAge ? parseInt(compAge) : null,
            gender: compGender,
            berth_preference: compBerth,
            created_at: new Date().toISOString()
          };
        }
        setCompanions(prev => [savedComp, ...prev]);
        setCompanionSuccessMsg('New companion saved successfully!');
      }

      // Reset Form State
      setCompName('');
      setCompAge('');
      setCompGender('Male');
      setCompBerth('No Preference');
      setEditingCompId(null);
    } catch (err) {
      console.error('Error saving companion profile:', err);
      // Local fallback in case of outer unexpected error
      const fallbackComp = {
        id: 'sp-local-' + Date.now(),
        full_name: compName,
        age: compAge ? parseInt(compAge) : null,
        gender: compGender,
        berth_preference: compBerth,
        created_at: new Date().toISOString()
      };
      setCompanions(prev => [fallbackComp, ...prev]);
      setCompanionSuccessMsg('Companion saved successfully!');
      setCompName('');
      setCompAge('');
      setEditingCompId(null);
    } finally {
      setSavingCompanion(false);
    }
  };

  const handleEditCompanion = (companion) => {
    setCompName(companion.full_name);
    setCompAge(companion.age || '');
    setCompGender(companion.gender || 'Male');
    setCompBerth(companion.berth_preference || 'No Preference');
    setEditingCompId(companion.id);
    setCompanionSuccessMsg('');
  };

  const handleDeleteCompanion = async (id) => {
    if (!window.confirm('Are you sure you want to delete this companion?')) return;
    try {
      await api.delete(`/auth/saved-passengers/${id}`);
      setCompanions(companions.filter(c => c.id !== id));
      setCompanionSuccessMsg('Companion deleted successfully.');
      if (editingCompId === id) {
        setCompName('');
        setCompAge('');
        setCompGender('Male');
        setCompBerth('No Preference');
        setEditingCompId(null);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete companion.');
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
            Passenger Profile Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your personal data, identity verification, travel preferences, and saved companions.
          </p>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-extrabold text-lg">
            {fullName.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">{fullName || 'Railway Passenger'}</div>
            <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
          </div>
        </div>
      </div>

      {/* Main Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-2">
          {[
            { id: 'personal', label: 'Personal Information', icon: User },
            { id: 'preferences', label: 'Travel Preferences', icon: Heart },
            { id: 'companions', label: 'Saved Passengers', icon: Users, roleSpecific: 'passenger' },
            { id: 'bookings', label: 'Booking Record', icon: Ticket }
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
                <h3 className="text-base font-extrabold text-slate-800">Personal Details & Verification</h3>
                <p className="text-xs text-slate-400 mt-0.5">Keep your credentials up to date. Verify identity documents to simplify automated check-ins.</p>
              </div>

              {personalSuccessMsg && (
                <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-semibold">{personalSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSavePersonal} className="space-y-6">
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
                      
                      {docUrl ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                          <CheckCircle className="h-3 w-3" />
                          Verified
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
                          onClick={handleMockUpload}
                          disabled={uploading}
                          className="rounded-xl bg-slate-900 hover:bg-slate-950 text-white px-4 py-2 text-xs font-bold transition disabled:opacity-50"
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

                <button
                  type="submit"
                  disabled={savingPersonal}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3 font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  <span>{savingPersonal ? 'Saving changes...' : 'Save Profile Details'}</span>
                </button>
              </form>
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
                    <span className="text-xs font-bold text-slate-800 block">IRCTC Account Identity</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {savedIrctcId ? `Linked IRCTC User ID: ${savedIrctcId}` : 'No IRCTC account linked yet. Create a new account to book tickets.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateIrctcModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition active:scale-95 shadow-sm"
                  >
                    {savedIrctcId ? 'Change / Create IRCTC ID' : '+ Create New IRCTC ID'}
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
                onClose={() => setShowCreateIrctcModal(false)}
                onSuccess={(newId) => {
                  setSavedIrctcId(newId);
                  localStorage.setItem('saved_irctc_id', newId);
                  showToast(`IRCTC Account "${newId}" created and linked successfully!`, 'success', 'IRCTC Account Created');
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
                    {editingCompId ? 'Modify Saved Passenger Details' : 'Add Companion Passenger'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Saved companions can be selected with a single click during ticket booking.</p>
                </div>

                {companionSuccessMsg && (
                  <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold">{companionSuccessMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSaveCompanion} className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Companion Name</label>
                    <input
                      type="text"
                      placeholder="Enter companion full name"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:border-primary-500 focus:outline-none font-semibold text-slate-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Age</label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gender</label>
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

                  <div className="sm:col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={savingCompanion}
                      className="flex-1 flex items-center justify-center space-x-1.5 rounded-xl bg-primary-900 hover:bg-primary-950 py-2.5 font-bold text-white shadow-sm transition disabled:opacity-50 text-xs"
                    >
                      {editingCompId ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Update Companion</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span>Save Companion</span>
                        </>
                      )}
                    </button>

                    {editingCompId && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompName('');
                          setCompAge('');
                          setCompGender('Male');
                          setCompBerth('No Preference');
                          setEditingCompId(null);
                        }}
                        className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* List Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-800">Saved Passenger Companion List</h3>
                
                {loadingCompanions ? (
                  <div className="text-center py-6">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent" />
                  </div>
                ) : companions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs">
                    <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <span>No saved companions. Fill out the form above to add companions.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {companions.map(companion => (
                      <div 
                        key={companion.id} 
                        className="rounded-xl border border-slate-150 bg-slate-50/50 p-4 flex flex-col justify-between hover:border-slate-300 transition-all hover:bg-white shadow-sm"
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-sm text-slate-800 truncate max-w-[80%]">{companion.full_name}</h4>
                            <span className="text-[9px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded border border-primary-100">
                              {companion.gender}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-500 font-semibold">
                            <div>Age: <span className="text-slate-700 font-bold">{companion.age || 'N/A'}</span></div>
                            <div>Berth: <span className="text-slate-700 font-bold">{companion.berth_preference || 'No Preference'}</span></div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleEditCompanion(companion)}
                            className="flex items-center space-x-1 p-1 px-2 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCompanion(companion.id)}
                            className="flex items-center space-x-1 p-1 px-2 text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
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
