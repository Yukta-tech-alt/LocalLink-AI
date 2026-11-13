import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock3, Eye,
  Smartphone, FileText, Upload, RefreshCw, KeyRound, AlertOctagon,
  Fingerprint, History, Info, CheckCircle, Send, Building2, MapPin,
  ExternalLink, Trash2, ArrowUpRight, Search, Filter, ShieldAlert,
  SlidersHorizontal, ChevronRight, UserRound, Phone, Check, Award
} from 'lucide-react';

const API = axios.create({ baseURL: 'http://127.0.0.1:5000/api' });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const userStr = localStorage.getItem('ll_user');
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u?.id) config.headers['X-User-Id'] = u.id;
    } catch (e) {}
  }
  return config;
});

// ==========================================
// FEATURE 1 & 5: BUSINESS OWNER VERIFICATION PAGE
// ==========================================
export function BusinessVerificationPage({ user, businesses, refreshBusinesses, notify }) {
  const myBiz = businesses.find(b => b.owner_id === user?.id) || businesses[0] || null;
  const [activeStep, setActiveStep] = useState(1);
  const [verif, setVerif] = useState(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Mobile OTP State
  const [phone, setPhone] = useState(user?.phone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Step 2: Business & Documents
  const [bizName, setBizName] = useState('');
  const [bizCat, setBizCat] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [ownerFullName, setOwnerFullName] = useState(user?.name || '');
  const [bizEmail, setBizEmail] = useState(user?.email || '');
  const [bizPhone, setBizPhone] = useState(user?.phone || '');
  const [bizWebsite, setBizWebsite] = useState('');
  const [docType, setDocType] = useState('registration_cert');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Step 3: Address & Location
  const [addressLine, setAddressLine] = useState('');
  const [latitude, setLatitude] = useState(12.9141);
  const [longitude, setLongitude] = useState(74.8560);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  // Step 4: Submission
  const [submitting, setSubmitting] = useState(false);

  // Load Status
  const loadVerificationStatus = async () => {
    if (!myBiz) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await API.get(`/verification/my-status?business_id=${myBiz.id}`);
      setVerif(res.data);
      if (res.data.mobile_verified) setPhone(res.data.verified_mobile || user?.phone || '');
      setBizName(res.data.business_name || myBiz.name || '');
      setBizCat(res.data.business_category || myBiz.category || '');
      setRegNumber(res.data.registration_number || '');
      setOwnerFullName(res.data.owner_full_name || user?.name || '');
      setBizEmail(res.data.business_email || user?.email || '');
      setBizPhone(res.data.business_phone || user?.phone || '');
      setBizWebsite(res.data.business_website || '');
      setAddressLine(res.data.address_line || myBiz.address || '');
      if (res.data.latitude) setLatitude(res.data.latitude);
      if (res.data.longitude) setLongitude(res.data.longitude);
      setLocationConfirmed(res.data.address_verified || false);

      // Auto step progression
      if (res.data.status === 'Verified' || res.data.status === 'Pending Review' || res.data.status === 'Under Review' || res.data.status === 'Resubmission Required' || res.data.status === 'Rejected') {
        setActiveStep(4);
      } else if (res.data.address_verified) {
        setActiveStep(4);
      } else if (res.data.documents && res.data.documents.length > 0) {
        setActiveStep(3);
      } else if (res.data.mobile_verified) {
        setActiveStep(2);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerificationStatus();
  }, [myBiz?.id]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Request Mobile OTP
  const handleRequestOtp = async () => {
    if (!phone || phone.length < 10) {
      notify('Please enter a valid 10-15 digit mobile number.');
      return;
    }
    setRequestingOtp(true);
    try {
      const res = await API.post('/verification/otp/request', { phone, business_id: myBiz?.id });
      setOtpSent(true);
      setCooldown(60);
      if (res.data.dev_otp) {
        setDevOtp(res.data.dev_otp);
        notify(`OTP sent! [Dev Mode Code: ${res.data.dev_otp}]`);
      } else {
        notify('Verification code sent to your registered mobile number.');
      }
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setRequestingOtp(false);
    }
  };

  // Verify Mobile OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      notify('Please enter the 6-digit OTP code.');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await API.post('/verification/otp/verify', { phone, otp, business_id: myBiz?.id });
      notify('Mobile number successfully verified!');
      setDevOtp('');
      setOtp('');
      loadVerificationStatus();
      setActiveStep(2);
    } catch (err) {
      notify(err.response?.data?.error || 'Invalid OTP code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Save Step 2 Business Information
  const handleSaveBusinessInfo = async (e) => {
    e.preventDefault();
    if (!myBiz) return;
    try {
      await API.post('/verification/business-info', {
        business_id: myBiz.id,
        business_name: bizName,
        business_category: bizCat,
        registration_number: regNumber,
        owner_full_name: ownerFullName,
        business_email: bizEmail,
        business_phone: bizPhone,
        business_website: bizWebsite
      });
      notify('Business identity details saved successfully.');
      setActiveStep(3);
    } catch (err) {
      notify(err.response?.data?.error || 'Could not save business details.');
    }
  };

  // Upload Document
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      notify('Please select a document file to upload (PDF, PNG, JPG).');
      return;
    }
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('doc_type', docType);
    formData.append('business_id', myBiz?.id);

    try {
      await API.post('/verification/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notify('Document uploaded securely for verification review.');
      setSelectedFile(null);
      loadVerificationStatus();
    } catch (err) {
      notify(err.response?.data?.error || 'Document upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    try {
      await API.delete(`/verification/documents/${docId}`);
      notify('Document removed.');
      loadVerificationStatus();
    } catch (err) {
      notify('Failed to delete document.');
    }
  };

  // Save Step 3 Address
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!myBiz) return;
    try {
      await API.post('/verification/address', {
        business_id: myBiz.id,
        address_line: addressLine,
        latitude: parseFloat(latitude) || null,
        longitude: parseFloat(longitude) || null,
        confirm_location: locationConfirmed
      });
      notify('Business address and location coordinates confirmed.');
      setActiveStep(4);
    } catch (err) {
      notify(err.response?.data?.error || 'Could not save address details.');
    }
  };

  // Step 4 Final Submission
  const handleSubmitVerification = async () => {
    if (!myBiz) return;
    setSubmitting(true);
    try {
      const res = await API.post('/verification/submit', { business_id: myBiz.id });
      notify('Verification request submitted successfully for administrator review!');
      loadVerificationStatus();
      if (refreshBusinesses) refreshBusinesses();
    } catch (err) {
      notify(err.response?.data?.error || 'Submission failed. Please complete all steps.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Verified':
        return <span className="status-badge verified"><ShieldCheck size={14} /> Verified Business Partner</span>;
      case 'Pending Review':
        return <span className="status-badge pending"><Clock3 size={14} /> Pending Admin Review</span>;
      case 'Under Review':
        return <span className="status-badge progress"><Eye size={14} /> Under Review</span>;
      case 'Resubmission Required':
        return <span className="status-badge urgent"><AlertTriangle size={14} /> Resubmission Required</span>;
      case 'Rejected':
        return <span className="status-badge rejected"><XCircle size={14} /> Verification Declined</span>;
      default:
        return <span className="status-badge open"><Info size={14} /> Not Submitted</span>;
    }
  };

  if (!myBiz) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
        <Store size={48} style={{ color: 'var(--brand-purple)', margin: '0 auto 16px' }} />
        <h3>No Registered Business Found</h3>
        <p>You need to create a business listing before submitting verification.</p>
      </div>
    );
  }

  return (
    <div className="verification-page-container">
      {/* Top Header Card */}
      <div className="panel verification-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="eyebrow">IDENTITY & TRUST SYSTEM</span>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 8px', color: '#1e1b4b' }}>
              Business Verification & Trust
            </h2>
            <p style={{ color: 'var(--muted)', maxWidth: '640px', fontSize: '14px', lineHeight: 1.5 }}>
              Complete the 4-step verification protocol to earn the prestigious <strong>Verified Business Badge</strong>,
              boost your <strong>Local Trust Score</strong>, and unlock elevated ranking across hyperlocal discovery.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '8px' }}>{getStatusBadge(verif?.status || 'Not Submitted')}</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Business: <strong>{myBiz.name}</strong>
            </div>
          </div>
        </div>

        {/* Verification Stepper Navigation */}
        <div className="verification-stepper">
          {[
            { step: 1, title: '1. Mobile Verification', done: verif?.mobile_verified, icon: Smartphone },
            { step: 2, title: '2. Business & Proofs', done: (verif?.documents?.length || 0) > 0, icon: FileText },
            { step: 3, title: '3. Physical Address', done: verif?.address_verified, icon: MapPin },
            { step: 4, title: '4. Admin Review', done: verif?.status === 'Verified', icon: ShieldCheck }
          ].map((s) => (
            <div
              key={s.step}
              className={`stepper-item ${activeStep === s.step ? 'active' : ''} ${s.done ? 'completed' : ''}`}
              onClick={() => setActiveStep(s.step)}
            >
              <div className="stepper-bubble">
                {s.done ? <Check size={16} /> : <s.icon size={16} />}
              </div>
              <span className="stepper-label">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div style={{ marginTop: '24px' }}>
        {/* STEP 1: MOBILE VERIFICATION */}
        {activeStep === 1 && (
          <div className="panel step-card">
            <div className="step-card-header">
              <div className="step-icon-wrap"><Smartphone size={22} /></div>
              <div>
                <h3>Step 1: Mobile Phone Number Verification</h3>
                <p>Verify your official mobile number via secure SMS OTP. Cryptographically salted and rate-limited.</p>
              </div>
            </div>

            {verif?.mobile_verified ? (
              <div className="verification-success-box">
                <CheckCircle2 size={32} style={{ color: '#10b981' }} />
                <div>
                  <h4 style={{ color: '#065f46', margin: '0 0 4px' }}>Mobile Number Verified</h4>
                  <p style={{ margin: 0, color: '#047857', fontSize: '14px' }}>
                    Verified Phone: <strong>{verif.verified_mobile}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setActiveStep(2)}
                >
                  Continue to Step 2 <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div style={{ maxWidth: '480px', marginTop: '16px' }}>
                <div className="field">
                  <label>Business Owner Mobile Number</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      disabled={otpSent && cooldown > 0}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRequestOtp}
                      disabled={requestingOtp || (otpSent && cooldown > 0)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {requestingOtp ? 'Sending...' : cooldown > 0 ? `Resend (${cooldown}s)` : 'Request OTP'}
                    </button>
                  </div>
                  <span className="field-hint">A 6-digit verification code will be dispatched. Valid for 5 minutes.</span>
                </div>

                {devOtp && (
                  <div className="dev-otp-pill">
                    <KeyRound size={15} />
                    <span><strong>Local Dev OTP Code:</strong> {devOtp} (Development Mode Active)</span>
                  </div>
                )}

                {otpSent && (
                  <div className="field" style={{ marginTop: '20px' }}>
                    <label>Enter 6-Digit Verification Code</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        maxLength={6}
                        className="input"
                        placeholder="123456"
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 700, textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otp.length !== 6}
                      >
                        {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: BUSINESS INFORMATION & SUPPORTING DOCUMENTS */}
        {activeStep === 2 && (
          <div className="panel step-card">
            <div className="step-card-header">
              <div className="step-icon-wrap"><FileText size={22} /></div>
              <div>
                <h3>Step 2: Business Information & Supporting Documents</h3>
                <p>Provide verified entity details and upload authentic supporting documentation (MSME, Shop Act, GST, or alternative proof).</p>
              </div>
            </div>

            <form onSubmit={handleSaveBusinessInfo} style={{ marginTop: '20px' }}>
              <div className="grid-2col">
                <div className="field">
                  <label>Official Business Name *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={bizName}
                    onChange={e => setBizName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Business Category *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={bizCat}
                    onChange={e => setBizCat(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Registration / GST / MSME / Shop Act Number</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 29AAAAA0000A1Z5 or MSME-KA-00123"
                    value={regNumber}
                    onChange={e => setRegNumber(e.target.value)}
                  />
                  <span className="field-hint">Optional for informal micro-enterprises; see alternatives below.</span>
                </div>
                <div className="field">
                  <label>Owner Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={ownerFullName}
                    onChange={e => setOwnerFullName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Official Business Email *</label>
                  <input
                    type="email"
                    required
                    className="input"
                    value={bizEmail}
                    onChange={e => setBizEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Business Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    className="input"
                    value={bizPhone}
                    onChange={e => setBizPhone(e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label>Business Website or Social Listing</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://yourbusiness.com or Google Maps link"
                    value={bizWebsite}
                    onChange={e => setBizWebsite(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="submit" className="btn btn-secondary">
                  Save Business Details
                </button>
              </div>
            </form>

            <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />

            {/* Document Upload Area */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Upload Supporting Documents</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                    Small and micro-businesses without GST can upload a utility bill, trade license, or premises rent agreement.
                  </p>
                </div>
                <span className="pill">{verif?.documents?.length || 0} Documents Uploaded</span>
              </div>

              <form onSubmit={handleUploadDocument} className="doc-upload-box">
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    className="input"
                    style={{ width: '220px' }}
                    value={docType}
                    onChange={e => setDocType(e.target.value)}
                  >
                    <option value="registration_cert">Registration Certificate / GST</option>
                    <option value="shop_establishment">Shop & Establishment Certificate</option>
                    <option value="utility_bill">Commercial Utility Bill</option>
                    <option value="trade_license">Municipal Trade License</option>
                    <option value="ownership_proof">Premises Ownership / Lease Deed</option>
                  </select>

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="input"
                    style={{ flex: 1, minWidth: '220px' }}
                    onChange={e => setSelectedFile(e.target.files[0])}
                  />

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploadingDoc || !selectedFile}
                  >
                    <Upload size={16} /> {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
                <span className="field-hint" style={{ marginTop: '8px', display: 'block' }}>
                  Supported formats: PDF, PNG, JPG, JPEG (Max file size: 10MB). Stored securely outside public root.
                </span>
              </form>

              {/* Uploaded Documents List */}
              {verif?.documents && verif.documents.length > 0 && (
                <div className="uploaded-docs-list">
                  {verif.documents.map((d) => (
                    <div key={d.id} className="doc-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={20} style={{ color: 'var(--brand-purple)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{d.original_filename}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            Type: <strong style={{ textTransform: 'capitalize' }}>{d.doc_type.replace('_', ' ')}</strong> • {(d.file_size / 1024).toFixed(1)} KB • Uploaded {d.uploaded_at}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className={`status-badge ${d.status === 'Approved' ? 'verified' : 'pending'}`}>
                          {d.status}
                        </span>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Remove document"
                          onClick={() => handleDeleteDocument(d.id)}
                        >
                          <Trash2 size={16} style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveStep(1)}>
                  Back to Step 1
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveStep(3)}
                  disabled={!verif?.documents || verif.documents.length === 0}
                >
                  Continue to Step 3 <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PHYSICAL ADDRESS & LOCATION VERIFICATION */}
        {activeStep === 3 && (
          <div className="panel step-card">
            <div className="step-card-header">
              <div className="step-icon-wrap"><MapPin size={22} /></div>
              <div>
                <h3>Step 3: Physical Address & Location Confirmation</h3>
                <p>Pinpoint your business storefront or registered office coordinates for verified hyperlocal discovery.</p>
              </div>
            </div>

            <form onSubmit={handleSaveAddress} style={{ marginTop: '20px' }}>
              <div className="field">
                <label>Complete Physical Address *</label>
                <textarea
                  rows={3}
                  required
                  className="input"
                  placeholder="Door/Shop No., Street, Landmark, Area, City, Pin Code"
                  value={addressLine}
                  onChange={e => setAddressLine(e.target.value)}
                />
              </div>

              <div className="grid-2col">
                <div className="field">
                  <label>Storefront Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={latitude}
                    onChange={e => setLatitude(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Storefront Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={longitude}
                    onChange={e => setLongitude(e.target.value)}
                  />
                </div>
              </div>

              <div className="checkbox-field" style={{ margin: '16px 0 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="confirmLoc"
                  checked={locationConfirmed}
                  onChange={e => setLocationConfirmed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--brand-purple)' }}
                />
                <label htmlFor="confirmLoc" style={{ fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}>
                  I confirm that this address corresponds to our genuine, operating business premises.
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveStep(2)}>
                  Back to Step 2
                </button>
                <button type="submit" className="btn btn-primary" disabled={!locationConfirmed || !addressLine}>
                  Save & Proceed to Review <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 4: SUBMISSION & ADMIN APPROVAL WORKFLOW */}
        {activeStep === 4 && (
          <div className="panel step-card">
            <div className="step-card-header">
              <div className="step-icon-wrap"><ShieldCheck size={22} /></div>
              <div>
                <h3>Step 4: Verification Review & Trust Impact</h3>
                <p>Review your submitted dossier and track verification review progress in real time.</p>
              </div>
            </div>

            {/* Status Feedback Banners */}
            {verif?.status === 'Verified' && (
              <div className="verification-badge-award-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="award-badge-icon">
                    <ShieldCheck size={40} style={{ color: '#ffffff' }} />
                  </div>
                  <div>
                    <h3 style={{ color: '#065f46', margin: '0 0 6px' }}>
                      Official Verified Business Badge Active
                    </h3>
                    <p style={{ margin: 0, color: '#047857', fontSize: '14px', lineHeight: 1.5 }}>
                      Congratulations! Your business identity and documentation have been fully reviewed and certified by platform trust administrators.
                    </p>
                  </div>
                </div>

                <div className="trust-boost-pill">
                  <Award size={18} />
                  <span><strong>+25 Trust Score Boost:</strong> Full 100% Identity Verification Score Awarded!</span>
                </div>
              </div>
            )}

            {verif?.status === 'Resubmission Required' && (
              <div className="warning-banner" style={{ margin: '16px 0 24px', padding: '18px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 6px', color: '#92400e', fontSize: '15px' }}>Administrator Requested Clarification / Resubmission</h4>
                    <p style={{ margin: '0 0 10px', color: '#b45309', fontSize: '14px' }}>
                      <strong>Admin Feedback:</strong> {verif?.rejection_reason || 'Please upload updated registration documentation.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setActiveStep(2)}
                    >
                      Update Documents in Step 2
                    </button>
                  </div>
                </div>
              </div>
            )}

            {verif?.status === 'Pending Review' && (
              <div className="info-banner" style={{ margin: '16px 0 24px', padding: '18px', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Clock3 size={24} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px', color: '#1e40af', fontSize: '15px' }}>Verification Under Administrative Review</h4>
                    <p style={{ margin: 0, color: '#1d4ed8', fontSize: '14px' }}>
                      Your verification dossier is queued for administrator inspection. Documents are typically reviewed within 24 business hours.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dossier Summary Grid */}
            <div className="dossier-summary-grid">
              <div className="summary-item">
                <span className="summary-label">Mobile Phone</span>
                <span className="summary-val">
                  {verif?.mobile_verified ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={15} /> {verif.verified_mobile}
                    </span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>Unverified</span>
                  )}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Registration / MSME</span>
                <span className="summary-val">{verif?.registration_number || 'Micro-Enterprise Exemption'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Documents Attached</span>
                <span className="summary-val">{verif?.documents?.length || 0} files</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Physical Address</span>
                <span className="summary-val">{verif?.address_line || myBiz.address}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setActiveStep(3)}>
                Back to Address
              </button>

              {verif?.status !== 'Verified' && verif?.status !== 'Pending Review' && verif?.status !== 'Under Review' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitVerification}
                  disabled={submitting || !verif?.mobile_verified}
                >
                  <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Verification Dossier'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// FEATURE 4: ADMIN BUSINESS IDENTITY & SECURITY CENTER
// ==========================================
export function AdminSecurityCenter({ refreshBusinesses, notify }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, requests, suspicious, linking, appeals
  const [loading, setLoading] = useState(false);

  // Overview KPIs
  const [overview, setOverview] = useState(null);

  // Requests Data & Filter
  const [requests, setRequests] = useState([]);
  const [reqFilter, setReqFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');
  const [selectedReq, setSelectedReq] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Suspicious Accounts
  const [suspiciousList, setSuspiciousList] = useState([]);
  const [suspRiskFilter, setSuspRiskFilter] = useState('all');
  const [selectedUserInvestigation, setSelectedUserInvestigation] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [actionReason, setActionReason] = useState('');

  // Identity Linking
  const [linkingList, setLinkingList] = useState([]);

  // Appeals & Audits
  const [appealsList, setAppealsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [appealDecisionNotes, setAppealDecisionNotes] = useState('');

  // Load Overview Data
  const loadOverview = async () => {
    try {
      const res = await API.get('/admin/security/overview');
      setOverview(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Requests
  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/verification/requests?status=${reqFilter}`);
      setRequests(res.data);
    } catch (err) {
      notify('Failed to load verification requests.');
    } finally {
      setLoading(false);
    }
  };

  // Load Suspicious Accounts
  const loadSuspicious = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/security/suspicious-accounts?risk_level=${suspRiskFilter}`);
      setSuspiciousList(res.data);
    } catch (err) {
      notify('Failed to load suspicious accounts.');
    } finally {
      setLoading(false);
    }
  };

  // Load Identity Links
  const loadIdentityLinks = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/security/identity-links');
      setLinkingList(res.data);
    } catch (err) {
      notify('Failed to load identity links.');
    } finally {
      setLoading(false);
    }
  };

  // Load Appeals and Audits
  const loadAppealsAndAudits = async () => {
    try {
      setLoading(true);
      const [appRes, audRes] = await Promise.all([
        API.get('/admin/appeals'),
        API.get('/admin/security/audit-logs')
      ]);
      setAppealsList(appRes.data);
      setAuditLogs(audRes.data);
    } catch (err) {
      notify('Failed to load appeals and audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'requests') loadRequests();
    if (activeTab === 'suspicious') loadSuspicious();
    if (activeTab === 'linking') loadIdentityLinks();
    if (activeTab === 'appeals') loadAppealsAndAudits();
  }, [activeTab, reqFilter, suspRiskFilter]);

  // Handle Verification Decision (Approve / Reject / Resubmission)
  const handleVerificationDecision = async (vid, action) => {
    if ((action === 'reject' || action === 'request_resubmission') && !rejectionReason.trim()) {
      notify('Please provide a reason or clarification instructions for the business owner.');
      return;
    }

    try {
      await API.post(`/admin/verification/requests/${vid}/decide`, {
        action,
        reason: rejectionReason,
        admin_notes: adminNotes
      });
      notify(`Verification request marked as ${action.replace('_', ' ')}.`);
      setSelectedReq(null);
      setRejectionReason('');
      setAdminNotes('');
      loadRequests();
      loadOverview();
      if (refreshBusinesses) refreshBusinesses();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to update request.');
    }
  };

  // Open User Investigation Dossier
  const openInvestigation = async (user) => {
    setSelectedUserInvestigation(user);
    try {
      const res = await API.get(`/admin/security/account-investigation/${user.user_id}`);
      setInvestigationData(res.data);
    } catch (err) {
      notify('Could not load account investigation dossier.');
    }
  };

  // Take Account Security Action
  const handleAccountAction = async (uid, action) => {
    if (action !== 'clear' && !actionReason.trim()) {
      notify('Please provide a mandatory reason for this account action.');
      return;
    }
    try {
      await API.post(`/admin/security/account/${uid}/action`, {
        action,
        reason: actionReason
      });
      notify(`Account security action applied: ${action}`);
      setSelectedUserInvestigation(null);
      setActionReason('');
      loadSuspicious();
      loadOverview();
    } catch (err) {
      notify(err.response?.data?.error || 'Action failed.');
    }
  };

  // Handle Identity Link Status Update
  const handleUpdateLinkStatus = async (linkId, status) => {
    try {
      await API.patch(`/admin/security/identity-links/${linkId}`, { status });
      notify(`Identity link updated to: ${status}`);
      loadIdentityLinks();
    } catch (err) {
      notify('Failed to update identity link.');
    }
  };

  // Decide Appeal
  const handleDecideAppeal = async (appealId, decision) => {
    try {
      await API.post(`/admin/appeals/${appealId}/decide`, {
        decision,
        notes: appealDecisionNotes
      });
      notify(`Appeal ${decision.toLowerCase()} successfully.`);
      setAppealDecisionNotes('');
      loadAppealsAndAudits();
      loadOverview();
    } catch (err) {
      notify('Failed to process appeal.');
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!reqSearch) return true;
    const q = reqSearch.toLowerCase();
    return r.business_name?.toLowerCase().includes(q) || r.owner_email?.toLowerCase().includes(q) || r.owner_name?.toLowerCase().includes(q);
  });

  return (
    <div className="admin-security-center">
      {/* Title Header */}
      <div className="panel" style={{ padding: '24px 28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="eyebrow">ADMINISTRATION & COMPLIANCE</span>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 8px', color: '#1e1b4b' }}>
              Business Identity & Security Center
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
              Verify merchant credentials, inspect customer-business identity associations, detect suspicious activity, and arbitrate appeals.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="pill" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
              <ShieldCheck size={14} /> Identity Engine Active
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="security-tabs-bar">
          {[
            { id: 'overview', label: 'Verification Overview', icon: FileCheck2 },
            { id: 'requests', label: 'Verification Requests', icon: BadgeCheck, count: overview?.pending_requests },
            { id: 'suspicious', label: 'Suspicious Accounts', icon: AlertTriangle, count: overview?.flagged_accounts },
            { id: 'linking', label: 'Identity Linking', icon: Fingerprint, count: overview?.linked_identities_detected },
            { id: 'appeals', label: 'Appeals & Audit Logs', icon: History, count: overview?.pending_appeals }
          ].map((t) => (
            <button
              key={t.id}
              className={`security-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon size={16} />
              <span>{t.label}</span>
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="tab-counter-badge">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="security-kpi-grid">
            <div className="panel kpi-card">
              <span className="kpi-label">Registered Merchants</span>
              <div className="kpi-val">{overview?.total_business_owners ?? 0}</div>
              <span className="kpi-sub">Total business owner accounts</span>
            </div>
            <div className="panel kpi-card">
              <span className="kpi-label">Verified Businesses</span>
              <div className="kpi-val" style={{ color: '#10b981' }}>{overview?.verified_businesses ?? 0}</div>
              <span className="kpi-sub">{overview?.verified_percentage ?? 0}% verification rate</span>
            </div>
            <div className="panel kpi-card">
              <span className="kpi-label">Pending Review</span>
              <div className="kpi-val" style={{ color: '#3b82f6' }}>{overview?.pending_requests ?? 0}</div>
              <span className="kpi-sub">Awaiting admin assessment</span>
            </div>
            <div className="panel kpi-card">
              <span className="kpi-label">Suspicious Accounts</span>
              <div className="kpi-val" style={{ color: '#ef4444' }}>{overview?.flagged_accounts ?? 0}</div>
              <span className="kpi-sub">{overview?.high_risk_count ?? 0} marked HIGH risk</span>
            </div>
          </div>

          {/* Quick Actions & Heuristics Status */}
          <div className="grid-2col" style={{ marginTop: '24px' }}>
            <div className="panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '17px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: 'var(--brand-purple)' }} /> Active Multi-Signal Detection Heuristics
              </h3>
              <ul className="security-heuristics-list">
                <li>
                  <div className="heuristic-dot active" />
                  <div>
                    <strong>Shared Mobile Detection:</strong> Flags when a customer account shares a phone number with a business owner.
                  </div>
                </li>
                <li>
                  <div className="heuristic-dot active" />
                  <div>
                    <strong>Competitor Price Scraping Sensor:</strong> Sliding window tracks rapid automated views across &gt;15 competitor profiles.
                  </div>
                </li>
                <li>
                  <div className="heuristic-dot active" />
                  <div>
                    <strong>Cryptographic OTP Hashing:</strong> SHA-256 salted hashes protect one-time verification tokens against database snooping.
                  </div>
                </li>
                <li>
                  <div className="heuristic-dot active" />
                  <div>
                    <strong>Safe Quarantined Storage:</strong> Supporting proof documents reside strictly outside the public web root.
                  </div>
                </li>
              </ul>
            </div>

            <div className="panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '17px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: 'var(--brand-purple)' }} /> System Operations Status
              </h3>
              <div className="ops-status-rows">
                <div className="ops-row">
                  <span>SMS OTP Dispatcher</span>
                  <span className="pill" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                    {overview?.sms_provider === 'twilio' ? 'Twilio Production SMS' : 'Development OTP Mode Active'}
                  </span>
                </div>
                <div className="ops-row">
                  <span>Linked Identities Detected</span>
                  <strong style={{ color: '#1e1b4b' }}>{overview?.linked_identities_detected ?? 0} associations</strong>
                </div>
                <div className="ops-row">
                  <span>Pending User Appeals</span>
                  <strong style={{ color: overview?.pending_appeals > 0 ? '#ef4444' : '#10b981' }}>
                    {overview?.pending_appeals ?? 0} awaiting review
                  </strong>
                </div>
                <div className="ops-row">
                  <span>Total Security Audit Logs</span>
                  <strong>{overview?.total_audit_logs ?? 0} events recorded</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VERIFICATION REQUESTS */}
      {activeTab === 'requests' && (
        <div className="panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['all', 'Pending Review', 'Under Review', 'Verified', 'Rejected', 'Resubmission Required'].map((st) => (
                <button
                  key={st}
                  className={`btn-filter ${reqFilter === st ? 'active' : ''}`}
                  onClick={() => setReqFilter(st)}
                >
                  {st === 'all' ? 'All Requests' : st}
                </button>
              ))}
            </div>

            <div className="search-box-wrap" style={{ width: '260px' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search business or owner..."
                value={reqSearch}
                onChange={e => setReqSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: '34px' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}><RefreshCw className="spin" size={24} /> Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
              <BadgeCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p>No verification requests matching current criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Mobile</th>
                    <th>Documents</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.business_name}</strong></td>
                      <td><span className="pill">{r.business_category}</span></td>
                      <td>
                        <div>{r.owner_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{r.owner_email}</div>
                      </td>
                      <td>
                        {r.mobile_verified ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                            <CheckCircle2 size={13} /> {r.verified_mobile}
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '13px' }}>Unverified</span>
                        )}
                      </td>
                      <td><strong>{r.documents_count}</strong> files</td>
                      <td style={{ fontSize: '13px' }}>{r.submitted_at || r.created_at}</td>
                      <td>
                        <span className={`status-badge ${r.status === 'Verified' ? 'verified' : r.status === 'Pending Review' ? 'pending' : r.status === 'Resubmission Required' ? 'urgent' : 'open'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedReq(r)}
                        >
                          Review Dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: VERIFICATION REVIEW DOSSIER */}
      {selectedReq && (
        <div className="modal-backdrop">
          <div className="modal dossier-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">MERCHANT DOSSIER</span>
                <h3>Verification Review: {selectedReq.business_name}</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedReq(null)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="dossier-grid">
                <div>
                  <label className="dossier-label">Owner Name</label>
                  <p>{selectedReq.owner_name} ({selectedReq.owner_email})</p>
                </div>
                <div>
                  <label className="dossier-label">Mobile Verification</label>
                  <p>{selectedReq.mobile_verified ? `Verified: ${selectedReq.verified_mobile}` : 'Unverified'}</p>
                </div>
                <div>
                  <label className="dossier-label">Category</label>
                  <p>{selectedReq.business_category}</p>
                </div>
                <div>
                  <label className="dossier-label">Registration / MSME</label>
                  <p>{selectedReq.registration_number || 'None provided / Micro-enterprise'}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="dossier-label">Physical Address</label>
                  <p>{selectedReq.address_line || 'No address specified'}</p>
                  {selectedReq.latitude && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      GPS Coordinates: Lat {selectedReq.latitude}, Long {selectedReq.longitude}
                    </span>
                  )}
                </div>
              </div>

              {/* Uploaded Documents List with Secure Download */}
              <h4 style={{ margin: '20px 0 10px', fontSize: '15px' }}>Supporting Documents ({selectedReq.documents?.length || 0})</h4>
              <div className="uploaded-docs-list">
                {selectedReq.documents?.map((d) => (
                  <div key={d.id} className="doc-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} style={{ color: 'var(--brand-purple)' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{d.original_filename}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          Type: <strong>{d.doc_type}</strong> • {(d.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <a
                      href={`http://127.0.0.1:5000/api/verification/documents/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ExternalLink size={14} /> View File
                    </a>
                  </div>
                ))}
              </div>

              {/* Reason / Notes Inputs */}
              <div style={{ marginTop: '20px' }}>
                <div className="field">
                  <label>Reason / Clarification Notes (Required for Rejection or Resubmission)</label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="e.g. Please re-upload a clear copy of your electricity bill or trade license."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Internal Administrator Notes (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Internal reference notes..."
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                onClick={() => handleVerificationDecision(selectedReq.id, 'reject')}
              >
                <XCircle size={16} /> Reject Listing
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleVerificationDecision(selectedReq.id, 'request_resubmission')}
                >
                  <AlertTriangle size={16} /> Request Resubmission
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleVerificationDecision(selectedReq.id, 'approve')}
                >
                  <CheckCircle size={16} /> Approve & Award Verified Badge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUSPICIOUS ACCOUNTS */}
      {activeTab === 'suspicious' && (
        <div className="panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['all', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  className={`btn-filter ${suspRiskFilter === lvl ? 'active' : ''}`}
                  onClick={() => setSuspRiskFilter(lvl)}
                >
                  {lvl === 'all' ? 'All Risks' : `${lvl} Risk`}
                </button>
              ))}
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Associated Business</th>
                  <th>Risk Classification</th>
                  <th>Primary Signal</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {suspiciousList.map((acc) => (
                  <tr key={acc.assessment_id}>
                    <td>
                      <strong>{acc.user_name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{acc.user_email}</div>
                    </td>
                    <td><span className="pill">{acc.role}</span></td>
                    <td>{acc.associated_business || <span style={{ color: 'var(--muted)' }}>None</span>}</td>
                    <td>
                      <span className={`risk-pill ${acc.risk_level.toLowerCase()}`}>
                        {acc.risk_level === 'HIGH' && <AlertTriangle size={13} />}
                        {acc.risk_level === 'MEDIUM' && <Eye size={13} />}
                        {acc.risk_level === 'LOW' && <ShieldCheck size={13} />}
                        {acc.risk_level} RISK
                      </span>
                    </td>
                    <td style={{ maxWidth: '280px', fontSize: '13px' }}>{acc.primary_reason}</td>
                    <td>
                      <span className="status-badge progress">{acc.investigation_status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openInvestigation(acc)}
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: INVESTIGATE ACCOUNT */}
      {selectedUserInvestigation && (
        <div className="modal-backdrop">
          <div className="modal dossier-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">SECURITY INVESTIGATION</span>
                <h3>Account Dossier: {selectedUserInvestigation.user_name}</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedUserInvestigation(null)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="dossier-grid">
                <div>
                  <label className="dossier-label">Email</label>
                  <p>{selectedUserInvestigation.user_email}</p>
                </div>
                <div>
                  <label className="dossier-label">Role</label>
                  <p>{selectedUserInvestigation.role}</p>
                </div>
                <div>
                  <label className="dossier-label">Account Status</label>
                  <p style={{ fontWeight: 700, textTransform: 'uppercase' }}>{selectedUserInvestigation.account_status}</p>
                </div>
                <div>
                  <label className="dossier-label">Risk Classification</label>
                  <span className={`risk-pill ${selectedUserInvestigation.risk_level.toLowerCase()}`}>
                    {selectedUserInvestigation.risk_level}
                  </span>
                </div>
              </div>

              {/* Detected Risk Signals */}
              <h4 style={{ margin: '20px 0 10px', fontSize: '15px' }}>Detected Risk Signals</h4>
              <ul className="signals-bullet-list">
                {investigationData?.signals?.map((sig, idx) => (
                  <li key={idx}>
                    <AlertTriangle size={15} style={{ color: '#ef4444' }} />
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>

              {/* Recent Suspicious Activity Events */}
              <h4 style={{ margin: '20px 0 10px', fontSize: '15px' }}>Suspicious Activity Telemetry Logs</h4>
              <div className="activity-telemetry-box">
                {investigationData?.recent_activities?.length > 0 ? (
                  investigationData.recent_activities.map((act) => (
                    <div key={act.id} className="telemetry-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{act.activity_type}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{act.timestamp}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>{act.details}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>No automated scraping or anomalous events logged.</p>
                )}
              </div>

              {/* Action Reason */}
              <div className="field" style={{ marginTop: '20px' }}>
                <label>Action Audit Reason (Required for Restrict or Suspend)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Confirmed unauthorized competitor scraping or policy violation."
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ color: '#10b981', borderColor: '#a7f3d0' }}
                onClick={() => handleAccountAction(selectedUserInvestigation.user_id, 'clear')}
              >
                <CheckCircle size={16} /> Clear & Mark Safe
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleAccountAction(selectedUserInvestigation.user_id, 'investigate')}
                >
                  <Eye size={16} /> Mark Under Investigation
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ color: '#d97706', borderColor: '#fde68a' }}
                  onClick={() => handleAccountAction(selectedUserInvestigation.user_id, 'restrict')}
                >
                  <AlertOctagon size={16} /> Restrict Account
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#ef4444' }}
                  onClick={() => handleAccountAction(selectedUserInvestigation.user_id, 'suspend')}
                >
                  <XCircle size={16} /> Suspend Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: IDENTITY LINKING */}
      {activeTab === 'linking' && (
        <div className="panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>Customer & Business Account Identity Linking</h3>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
              Shows accounts associated via verified phone numbers or shared registration details.
              Allows merchants to legitimately use customer features without being falsely flagged.
            </p>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Primary Account</th>
                  <th>Linked Account</th>
                  <th>Link Basis</th>
                  <th>Confidence</th>
                  <th>Shared Details</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {linkingList.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.primary_user_name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{l.primary_user_email} ({l.primary_role})</div>
                    </td>
                    <td>
                      <strong>{l.linked_user_name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{l.linked_user_email} ({l.linked_role})</div>
                    </td>
                    <td><span className="pill">{l.link_type.replace(/_/g, ' ')}</span></td>
                    <td><strong>{(l.confidence_score * 100).toFixed(0)}%</strong></td>
                    <td style={{ fontSize: '13px', maxWidth: '240px' }}>{l.shared_signal_details}</td>
                    <td>
                      <span className={`status-badge ${l.status === 'Confirmed' ? 'verified' : l.status === 'Incorrect Match' ? 'rejected' : 'progress'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleUpdateLinkStatus(l.id, 'Confirmed')}
                          title="Confirm legitimate user linkage"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleUpdateLinkStatus(l.id, 'Incorrect Match')}
                          title="Clear false association"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: APPEALS & AUDIT LOGS */}
      {activeTab === 'appeals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Appeals Queue */}
          <div className="panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>User Account Appeals Queue</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '14px' }}>
              Arbitrate appeals submitted by legitimate customers or merchants requesting review of account restrictions or identity links.
            </p>

            {appealsList.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px' }}>No pending user appeals.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Appeal Type</th>
                      <th>Reason Submitted</th>
                      <th>Submitted Evidence</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appealsList.map((ap) => (
                      <tr key={ap.id}>
                        <td>
                          <strong>{ap.user_name}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{ap.user_email}</div>
                        </td>
                        <td><span className="pill">{ap.appeal_type}</span></td>
                        <td style={{ fontSize: '13px', maxWidth: '240px' }}>{ap.reason}</td>
                        <td style={{ fontSize: '13px', maxWidth: '200px', color: 'var(--muted)' }}>{ap.evidence_text || 'None'}</td>
                        <td>
                          <span className={`status-badge ${ap.status === 'Approved' ? 'verified' : ap.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                            {ap.status}
                          </span>
                        </td>
                        <td>
                          {ap.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleDecideAppeal(ap.id, 'Approved')}
                              >
                                Approve Appeal
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleDecideAppeal(ap.id, 'Rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Logs Stream */}
          <div className="panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>Platform Security Audit Trail</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '14px' }}>
              Immutable audit records for all verification requests, administrative reviews, risk classifications, and security modifications.
            </p>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Details</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                      <td><strong>{log.action}</strong></td>
                      <td>{log.actor_name}</td>
                      <td><span className="pill">{log.target_type}</span></td>
                      <td style={{ fontSize: '13px', maxWidth: '300px' }}>{log.details}</td>
                      <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// FEATURE 2 & CUSTOMER DASHBOARD: SECURITY PROFILE CARD
// ==========================================
export function SecurityProfileCard({ user, notify }) {
  const [securityData, setSecurityData] = useState(null);
  const [appealModal, setAppealModal] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealEvidence, setAppealEvidence] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // Phone OTP state for customer
  const [phone, setPhone] = useState(user?.phone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const loadSecurity = async () => {
    try {
      const res = await API.get('/user/linked-identities');
      setSecurityData(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    loadSecurity();
  }, []);

  useEffect(() => {
    let t;
    if (cooldown > 0) t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const requestPhoneOtp = async () => {
    if (!phone || phone.length < 10) {
      notify('Please enter a valid mobile number.');
      return;
    }
    try {
      const res = await API.post('/verification/otp/request', { phone });
      setOtpSent(true);
      setCooldown(60);
      if (res.data.dev_otp) setDevOtp(res.data.dev_otp);
      notify('OTP sent to your phone.');
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to send OTP.');
    }
  };

  const verifyPhoneOtp = async () => {
    try {
      await API.post('/verification/otp/verify', { phone, otp });
      notify('Mobile phone verified successfully!');
      setOtpSent(false);
      setDevOtp('');
      loadSecurity();
    } catch (e) {
      notify(e.response?.data?.error || 'Invalid OTP.');
    }
  };

  const submitAppeal = async (e) => {
    e.preventDefault();
    setSubmittingAppeal(true);
    try {
      await API.post('/appeals', {
        appeal_type: 'identity_association',
        reason: appealReason,
        evidence_text: appealEvidence
      });
      notify('Appeal submitted for administrator evaluation.');
      setAppealModal(false);
      setAppealReason('');
      setAppealEvidence('');
      loadSecurity();
    } catch (e) {
      notify(e.response?.data?.error || 'Could not submit appeal.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  return (
    <div className="panel" style={{ padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--brand-purple)' }} /> Account Security & Verified Identity
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
            Manage two-factor mobile identity, review associated profiles, and monitor account trust status.
          </p>
        </div>
        <span className={`status-badge ${securityData?.account_status === 'active' ? 'verified' : 'urgent'}`}>
          Status: {securityData?.account_status || 'Active'}
        </span>
      </div>

      <div className="grid-2col" style={{ gap: '16px' }}>
        {/* Mobile Verification */}
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Smartphone size={18} style={{ color: 'var(--brand-purple)' }} />
            <strong style={{ fontSize: '14px' }}>Mobile Verification</strong>
          </div>
          {securityData?.phone_verified ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '14px' }}>
              <CheckCircle2 size={16} /> Verified Mobile ({user?.phone || 'Saved'})
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="tel"
                  className="input"
                  style={{ fontSize: '13px', padding: '6px 10px' }}
                  placeholder="+91 Mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={requestPhoneOtp}
                  disabled={cooldown > 0}
                >
                  {cooldown > 0 ? `${cooldown}s` : 'Get OTP'}
                </button>
              </div>

              {devOtp && (
                <div style={{ fontSize: '12px', color: '#7c3aed', marginBottom: '8px' }}>
                  Dev OTP: <strong>{devOtp}</strong>
                </div>
              )}

              {otpSent && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    maxLength={6}
                    className="input"
                    style={{ fontSize: '13px', padding: '6px 10px', width: '100px', textAlign: 'center' }}
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={verifyPhoneOtp}>
                    Verify
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Linked Accounts & Appeal */}
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Fingerprint size={18} style={{ color: 'var(--brand-purple)' }} />
            <strong style={{ fontSize: '14px' }}>Identity Association</strong>
          </div>

          {securityData?.linked_identities?.length > 0 ? (
            <div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                Associated with <strong>{securityData.linked_identities.length}</strong> business profile(s).
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setAppealModal(true)}
              >
                Appeal Association / Incorrect Match
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              No overlapping merchant or suspicious associations detected on this profile.
            </div>
          )}
        </div>
      </div>

      {/* Appeal Submission Modal */}
      {appealModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Submit Identity or Account Appeal</h3>
              <button type="button" className="btn-icon" onClick={() => setAppealModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitAppeal}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
                  If your customer profile was incorrectly associated with a business or restricted, provide clarification below. Platform administrators will review your appeal.
                </p>
                <div className="field">
                  <label>Reason for Appeal *</label>
                  <textarea
                    rows={3}
                    required
                    className="input"
                    placeholder="e.g. This phone number is shared across household members..."
                    value={appealReason}
                    onChange={e => setAppealReason(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Supporting Evidence / Reference Details</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Household electricity bill reference or separate email ID"
                    value={appealEvidence}
                    onChange={e => setAppealEvidence(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setAppealModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingAppeal}>
                  {submittingAppeal ? 'Submitting...' : 'Submit Appeal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
