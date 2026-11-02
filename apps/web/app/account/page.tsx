'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { formatBdt, STATUS_LABELS_BN } from '../../lib/format';

interface MyDonationsPayload {
  donations: Array<{
    id: string;
    projectName: string;
    amountBdt: number;
    provider: string;
    transactionId: string;
    status: string;
    createdAt: string;
  }>;
  summary: {
    totalVerifiedBdt: number;
    totalPendingBdt: number;
    verifiedCount: number;
    pendingCount: number;
  };
}

interface DailySadaqahData {
  preference: {
    id: string;
    projectId: string;
    amountBdt: number;
    enabled: boolean;
    reminderTime: string;
    currentStreak: number;
  };
  verifiedDailyContributionsBdt: number;
  notice: string;
}

interface UserProfile {
  id: string;
  phone: string;
  name?: string;
  role: string;
  status: string;
  createdAt: string;
}

interface MyBloodDonor {
  id: string;
  displayName: string;
  bloodGroup: string;
  district: string;
  area: string;
  contactPhone: string;
  publicPhoneConsent: boolean;
  lastDonationDate?: string;
  estimatedNextDate?: string;
  isAvailable: boolean;
}

interface MyHelpRequest {
  id: string;
  title: string;
  category: string;
  district: string;
  area: string;
  requiredAmountBdt: number;
  status: string;
  publicVisibility: boolean;
  adminNotes?: string;
  createdAt: string;
}

export default function UserAccountPage() {
  const [activeTab, setActiveTab] = useState<'donations' | 'daily' | 'blood' | 'help' | 'profile'>('donations');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [data, setData] = useState<MyDonationsPayload | null>(null);
  const [dailyData, setDailyData] = useState<DailySadaqahData | null>(null);
  const [dailyAmount, setDailyAmount] = useState(10);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [saveDailyNotice, setSaveDailyNotice] = useState<string | null>(null);

  // Blood donor profile state
  const [donorProfile, setDonorProfile] = useState<MyBloodDonor | null>(null);
  const [bdDisplayName, setBdDisplayName] = useState('');
  const [bdBloodGroup, setBdBloodGroup] = useState('A+');
  const [bdDistrict, setBdDistrict] = useState('');
  const [bdArea, setBdArea] = useState('');
  const [bdPhone, setBdPhone] = useState('');
  const [bdConsent, setBdConsent] = useState(false);
  const [bdLastDate, setBdLastDate] = useState('');
  const [bdAvailable, setBdAvailable] = useState(true);
  const [bdNotice, setBdNotice] = useState<string | null>(null);

  // Help requests state
  const [helpRequests, setHelpRequests] = useState<MyHelpRequest[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hrTitle, setHrTitle] = useState('');
  const [hrCategory, setHrCategory] = useState('MEDICAL');
  const [hrDistrict, setHrDistrict] = useState('');
  const [hrArea, setHrArea] = useState('');
  const [hrAmount, setHrAmount] = useState(5000);
  const [hrApplicantName, setHrApplicantName] = useState('');
  const [hrApplicantPhone, setHrApplicantPhone] = useState('');
  const [hrDescription, setHrDescription] = useState('');
  const [hrFileName, setHrFileName] = useState('');
  const [hrFileBase64, setHrFileBase64] = useState('');
  const [hrNotice, setHrNotice] = useState<string | null>(null);
  const [hrError, setHrError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch current user
    void apiRequest<{ user: UserProfile }>('/auth/me').then((res) => {
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        if (!bdDisplayName && res.data.user.name) setBdDisplayName(res.data.user.name);
        if (!bdPhone && res.data.user.phone) setBdPhone(res.data.user.phone);
      }
    });

    // 2. Fetch donations
    void apiRequest<MyDonationsPayload>('/donations/my').then((res) => {
      if (res.success) setData(res.data);
    });

    // 3. Fetch Daily Sadaqah
    void apiRequest<DailySadaqahData>('/daily-sadaqah/me').then((res) => {
      if (res.success && res.data) {
        setDailyData(res.data);
        setDailyAmount(res.data.preference.amountBdt);
        setReminderEnabled(res.data.preference.enabled);
        setReminderTime(res.data.preference.reminderTime);
      }
    });

    // 4. Fetch blood donor profile
    void apiRequest<MyBloodDonor>('/blood-donors/me').then((res) => {
      if (res.success && res.data) {
        const d = res.data;
        setDonorProfile(d);
        setBdDisplayName(d.displayName);
        setBdBloodGroup(d.bloodGroup);
        setBdDistrict(d.district);
        setBdArea(d.area);
        setBdPhone(d.contactPhone);
        setBdConsent(d.publicPhoneConsent);
        setBdLastDate(d.lastDonationDate || '');
        setBdAvailable(d.isAvailable);
      }
    });

    // 5. Fetch my help requests
    void apiRequest<MyHelpRequest[]>('/help-requests/my').then((res) => {
      if (res.success && res.data) setHelpRequests(res.data);
    });
  }, []);

  async function handleSaveDailySadaqah(e: React.FormEvent) {
    e.preventDefault();
    setSaveDailyNotice(null);
    const res = await apiRequest<{ message: string }>('/daily-sadaqah/me', {
      method: 'PUT',
      body: JSON.stringify({
        projectId: 'proj_general',
        amountBdt: Number(dailyAmount),
        enabled: reminderEnabled,
        reminderTime,
      }),
    });
    if (res.success) {
      setSaveDailyNotice(res.data.message || 'দৈনিক সাদাকা সেটিংস সফলভাবে আপডেট হয়েছে।');
    }
  }

  async function handleSaveBloodDonor(e: React.FormEvent) {
    e.preventDefault();
    setBdNotice(null);
    const res = await apiRequest<{ data: MyBloodDonor }>('/blood-donors', {
      method: 'POST',
      body: JSON.stringify({
        displayName: bdDisplayName,
        bloodGroup: bdBloodGroup,
        district: bdDistrict,
        area: bdArea,
        contactPhone: bdPhone,
        publicPhoneConsent: bdConsent,
        lastDonationDate: bdLastDate || undefined,
        isAvailable: bdAvailable,
        isActive: true,
      }),
    });
    if (res.success) {
      setBdNotice('রক্তদাতা প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে।');
      setDonorProfile(res.data as unknown as MyBloodDonor);
    } else {
      setBdNotice(res.error?.message || 'সংরক্ষণ ব্যর্থ হয়েছে।');
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHrFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1] || '';
      setHrFileBase64(b64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitHelpRequest(e: React.FormEvent) {
    e.preventDefault();
    setHrNotice(null);
    setHrError(null);

    const payload: Record<string, unknown> = {
      title: hrTitle,
      category: hrCategory,
      district: hrDistrict,
      area: hrArea,
      requiredAmountBdt: Number(hrAmount),
      applicantName: hrApplicantName,
      applicantPhone: hrApplicantPhone,
      description: hrDescription,
    };

    if (hrFileName && hrFileBase64) {
      payload.document = {
        fileName: hrFileName,
        mimeType: hrFileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        sizeBytes: Math.round((hrFileBase64.length * 3) / 4),
        base64Content: hrFileBase64,
      };
    }

    const res = await apiRequest<{ helpRequest: MyHelpRequest }>('/help-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setHrNotice('সাহায্যের আবেদনটি সফলভাবে জমা হয়েছে। অ্যাডমিন পর্যালোচনার পর অনুমোদন পেলে প্রকাশ পাবে।');
      setShowHelpModal(false);
      setHrTitle('');
      setHrDescription('');
      void apiRequest<MyHelpRequest[]>('/help-requests/my').then((r) => {
        if (r.success) setHelpRequests(r.data);
      });
    } else {
      setHrError(res.error?.message || 'আবেদন জমা দেওয়া যায়নি।');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-darkGreen mb-1">আমার অ্যাকাউন্ট</h1>
          <p className="text-sm text-textMuted">
            {user ? `লগইনকৃত মোবাইল: ${user.phone} (${user.name || 'সম্মানিত সদস্য'})` : 'আপনার ব্যক্তিগত তথ্য ও দানের বিবরণ'}
          </p>
        </div>
        <a
          href="/donate"
          className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-darkGreen transition-colors"
        >
          নতুন দান করুন
        </a>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {[
          { key: 'donations', label: 'আমার দান ও ইতিহাস' },
          { key: 'daily', label: 'দৈনিক সাদাকা রিমাইন্ডার' },
          { key: 'blood', label: 'রক্তদাতা প্রোফাইল' },
          { key: 'help', label: 'সাহায্যের আবেদন' },
          { key: 'profile', label: 'প্রোফাইল সেটিংস' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary bg-white'
                : 'border-transparent text-textMuted hover:text-darkGreen'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DONATIONS */}
      {activeTab === 'donations' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 border-t-4 border-t-primary">
              <div className="text-sm text-textMuted mb-1">মোট যাচাইকৃত দান (VERIFIED)</div>
              <div className="text-2xl font-bold text-darkGreen">
                {formatBdt(data?.summary.totalVerifiedBdt ?? 0)}
              </div>
              <p className="text-xs text-textMuted mt-1">
                {data?.summary.verifiedCount ?? 0} টি যাচাইকৃত দান
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 border-t-4 border-t-gold">
              <div className="text-sm text-textMuted mb-1">যাচাই চলছে (PENDING)</div>
              <div className="text-2xl font-bold text-darkGreen">
                {formatBdt(data?.summary.totalPendingBdt ?? 0)}
              </div>
              <p className="text-xs text-textMuted mt-1">
                {data?.summary.pendingCount ?? 0} টি অপেক্ষমাণ ট্রানজেকশন
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-bold text-darkGreen mb-4">আমার দানের ইতিহাস</h2>
            {data?.donations && data.donations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-darkGreen text-white">
                      <th className="p-3">প্রকল্পের নাম</th>
                      <th className="p-3">মাধ্যম</th>
                      <th className="p-3">Transaction ID</th>
                      <th className="p-3">টাকার পরিমাণ</th>
                      <th className="p-3">অবস্থা</th>
                      <th className="p-3">তারিখ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.donations.map((d) => (
                      <tr key={d.id} className="border-b border-gray-200">
                        <td className="p-3 font-semibold">{d.projectName}</td>
                        <td className="p-3">{d.provider}</td>
                        <td className="p-3 font-mono font-bold">{d.transactionId}</td>
                        <td className="p-3 font-bold">{formatBdt(d.amountBdt)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              d.status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {STATUS_LABELS_BN[d.status] || d.status}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-textMuted">
                          {new Date(d.createdAt).toLocaleDateString('bn-BD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-textMuted text-sm">
                এখনো কোনো দানের রেকর্ড জমা পড়েনি।{' '}
                <a href="/donate" className="text-primary font-semibold hover:underline">
                  প্রথম সাদাকা করুন
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY SADAQAH */}
      {activeTab === 'daily' && (
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <span className="inline-block bg-gold text-darkGreen font-bold text-xs px-3 py-1 rounded mb-2">
              রিমাইন্ডার-ভিত্তিক সিস্টেম
            </span>
            <h2 className="text-2xl font-bold text-darkGreen mb-1">আমার দৈনিক সাদাকা পছন্দ</h2>
            <p className="text-sm text-textMuted">
              প্রতিদিন নিয়মিত অল্প অল্প সাদাকা করার অভ্যাস গড়ে তুলুন। কোনো ব্যাংক বা মোবাইল ওয়ালেট থেকে স্বয়ংক্রিয়ভাবে টাকা কাটা হয় না।
            </p>
          </div>

          {dailyData && (
            <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surfaceBg border border-gray-200">
              <div>
                <div className="text-xs text-textMuted">বর্তমান ধারাবাহিকতা (Streak)</div>
                <div className="text-2xl font-bold text-darkGreen">
                  🔥 {dailyData.preference.currentStreak} দিন
                </div>
              </div>
              <div>
                <div className="text-xs text-textMuted">দৈনিক সাদাকায় মোট যাচাইকৃত দান</div>
                <div className="text-2xl font-bold text-primary">
                  {formatBdt(dailyData.verifiedDailyContributionsBdt)}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveDailySadaqah} className="space-y-4">
            <div>
              <label htmlFor="dailyAmt" className="block text-sm font-semibold mb-1">
                দৈনিক সাদাকার পরিমাণ (৳)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[5, 10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDailyAmount(amt)}
                    className={`px-3 py-1 rounded-lg border text-sm font-bold ${
                      dailyAmount === amt
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-darkGreen border-gray-300'
                    }`}
                  >
                    ৳{amt}
                  </button>
                ))}
              </div>
              <input
                id="dailyAmt"
                type="number"
                min={1}
                value={dailyAmount}
                onChange={(e) => setDailyAmount(Number(e.target.value))}
                className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="remTime" className="block text-sm font-semibold mb-1">
                  রিমাইন্ডার সময়
                </label>
                <input
                  id="remTime"
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="remEnabled"
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="h-4 w-4 text-primary rounded border-gray-300"
                />
                <label htmlFor="remEnabled" className="text-sm font-semibold text-textMain cursor-pointer">
                  প্রতিদিনের রিমাইন্ডার সক্রিয় রাখুন
                </label>
              </div>
            </div>

            {saveDailyNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-primary text-darkGreen text-sm font-semibold">
                {saveDailyNotice}
              </div>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-darkGreen transition-colors"
            >
              পছন্দসমূহ সংরক্ষণ করুন
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: BLOOD DONOR PROFILE */}
      {activeTab === 'blood' && (
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-bold text-darkGreen mb-1">রক্তদাতা প্রোফাইল</h2>
            <p className="text-sm text-textMuted">
              আপনার রক্তের তথ্য সংরক্ষণ করুন যাতে জরুরি প্রয়োজনে মুমূর্ষু রোগীরা আপনার সহায়তা পেতে পারে। আপনার অনুমতি ব্যতীত মোবাইল নম্বর প্রকাশ্যে দেখানো হবে না।
            </p>
          </div>

          <form onSubmit={handleSaveBloodDonor} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bdName" className="block text-sm font-semibold mb-1">
                  আপনার নাম *
                </label>
                <input
                  id="bdName"
                  type="text"
                  value={bdDisplayName}
                  onChange={(e) => setBdDisplayName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label htmlFor="bdGroup" className="block text-sm font-semibold mb-1">
                  রক্তের গ্রুপ *
                </label>
                <select
                  id="bdGroup"
                  value={bdBloodGroup}
                  onChange={(e) => setBdBloodGroup(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bdDist" className="block text-sm font-semibold mb-1">
                  জেলা *
                </label>
                <input
                  id="bdDist"
                  type="text"
                  placeholder="যেমন: ঢাকা, টাঙ্গাইল"
                  value={bdDistrict}
                  onChange={(e) => setBdDistrict(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label htmlFor="bdAr" className="block text-sm font-semibold mb-1">
                  উপজেলা / এলাকা *
                </label>
                <input
                  id="bdAr"
                  type="text"
                  placeholder="যেমন: মিরপুর, সদর"
                  value={bdArea}
                  onChange={(e) => setBdArea(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bdPh" className="block text-sm font-semibold mb-1">
                  যোগাযোগের মোবাইল নম্বর *
                </label>
                <input
                  id="bdPh"
                  type="text"
                  placeholder="01XXXXXXXXX"
                  value={bdPhone}
                  onChange={(e) => setBdPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label htmlFor="bdLast" className="block text-sm font-semibold mb-1">
                  সর্বশেষ রক্তদানের তারিখ (ঐচ্ছিক)
                </label>
                <input
                  id="bdLast"
                  type="date"
                  value={bdLastDate}
                  onChange={(e) => setBdLastDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input
                  id="bdAvail"
                  type="checkbox"
                  checked={bdAvailable}
                  onChange={(e) => setBdAvailable(e.target.checked)}
                  className="h-4 w-4 text-primary rounded border-gray-300"
                />
                <label htmlFor="bdAvail" className="text-sm font-semibold text-textMain cursor-pointer">
                  বর্তমানে রক্তদানের জন্য প্রস্তুত ও উপলব্ধ আছি (Available)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="bdCons"
                  type="checkbox"
                  checked={bdConsent}
                  onChange={(e) => setBdConsent(e.target.checked)}
                  className="h-4 w-4 text-primary rounded border-gray-300"
                />
                <label htmlFor="bdCons" className="text-sm text-textMain cursor-pointer">
                  আমার মোবাইল নম্বর রক্তদাতা তালিকায় প্রকাশ্যে প্রদর্শন করার অনুমতি দিচ্ছি
                </label>
              </div>
            </div>

            {bdNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-primary text-darkGreen text-sm font-semibold">
                {bdNotice}
              </div>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-darkGreen transition-colors"
            >
              প্রোফাইল সংরক্ষণ করুন
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: HELP REQUESTS */}
      {activeTab === 'help' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-darkGreen mb-1">আমার সাহায্যের আবেদনসমূহ</h2>
              <p className="text-sm text-textMuted">
                জরুরি প্রয়োজনে সাহায্যের আবেদন জমা দিন। মেডিকেল ও পরিচয়পত্র কঠোর গোপনীয়তার সাথে যাচাই করা হয়।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-darkGreen"
            >
              + নতুন আবেদন জমা দিন
            </button>
          </div>

          {hrNotice && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-primary text-darkGreen text-sm font-semibold">
              {hrNotice}
            </div>
          )}

          {helpRequests.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {helpRequests.map((r) => (
                <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-darkGreen text-base">{r.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        r.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status === 'VERIFIED'
                        ? 'যাচাইকৃত'
                        : r.status === 'REJECTED'
                        ? 'বাতিল'
                        : 'যাচাই চলছে'}
                    </span>
                  </div>
                  <p className="text-xs text-textMuted">
                    এলাকা: {r.area}, {r.district} | ক্যাটাগরি: {r.category}
                  </p>
                  <div className="text-sm">
                    প্রয়োজনীয় অর্থ: <strong className="text-primary">{formatBdt(r.requiredAmountBdt)}</strong>
                  </div>
                  {r.adminNotes && (
                    <div className="p-2 rounded bg-surfaceBg border border-gray-200 text-xs text-textMuted">
                      অ্যাডমিন মন্তব্য: {r.adminNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-textMuted text-sm">
              আপনার কোনো সক্রিয় সাহায্যের আবেদন নেই।
            </div>
          )}

          {/* New Help Request Modal / Form */}
          {showHelpModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                  <h3 className="text-xl font-bold text-darkGreen">সাহায্যের আবেদন ফরম</h3>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="text-gray-500 hover:text-black font-bold"
                  >
                    ✕
                  </button>
                </div>

                {hrError && (
                  <div className="p-3 rounded bg-red-50 border border-red-300 text-red-700 text-sm">
                    {hrError}
                  </div>
                )}

                <form onSubmit={handleSubmitHelpRequest} className="space-y-3">
                  <div>
                    <label htmlFor="hrT" className="block text-xs font-semibold mb-1">
                      আবেদনের শিরোনাম *
                    </label>
                    <input
                      id="hrT"
                      type="text"
                      placeholder="যেমন: রোগীর জরুরি হার্ট সার্জারি সহায়তা"
                      value={hrTitle}
                      onChange={(e) => setHrTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="hrCat" className="block text-xs font-semibold mb-1">
                        ক্যাটাগরি *
                      </label>
                      <select
                        id="hrCat"
                        value={hrCategory}
                        onChange={(e) => setHrCategory(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                      >
                        <option value="MEDICAL">চিকিৎসা (Medical)</option>
                        <option value="EDUCATION">শিক্ষা (Education)</option>
                        <option value="FOOD">খাদ্য (Food)</option>
                        <option value="CLEAN_WATER">বিশুদ্ধ পানি (Water)</option>
                        <option value="HOUSING">ঘর মেরামত (Housing)</option>
                        <option value="EMERGENCY">জরুরি (Emergency)</option>
                        <option value="OTHER">অন্যান্য (Other)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="hrAmt" className="block text-xs font-semibold mb-1">
                        প্রয়োজনীয় পরিমাণ (৳) *
                      </label>
                      <input
                        id="hrAmt"
                        type="number"
                        min={100}
                        value={hrAmount}
                        onChange={(e) => setHrAmount(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="hrDist" className="block text-xs font-semibold mb-1">
                        জেলা *
                      </label>
                      <input
                        id="hrDist"
                        type="text"
                        placeholder="যেমন: টাঙ্গাইল"
                        value={hrDistrict}
                        onChange={(e) => setHrDistrict(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="hrAr" className="block text-xs font-semibold mb-1">
                        এলাকা *
                      </label>
                      <input
                        id="hrAr"
                        type="text"
                        placeholder="যেমন: সদর"
                        value={hrArea}
                        onChange={(e) => setHrArea(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="hrName" className="block text-xs font-semibold mb-1">
                        আবেদনকারীর নাম *
                      </label>
                      <input
                        id="hrName"
                        type="text"
                        value={hrApplicantName}
                        onChange={(e) => setHrApplicantName(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="hrPhone" className="block text-xs font-semibold mb-1">
                        মোবাইল নম্বর *
                      </label>
                      <input
                        id="hrPhone"
                        type="text"
                        placeholder="01XXXXXXXXX"
                        value={hrApplicantPhone}
                        onChange={(e) => setHrApplicantPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="hrDesc" className="block text-xs font-semibold mb-1">
                      পরিস্থিতির বিস্তারিত বিবরণ *
                    </label>
                    <textarea
                      id="hrDesc"
                      rows={3}
                      value={hrDescription}
                      onChange={(e) => setHrDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="আবেদনকারীর অবস্থা ও সহায়তার কারণ সংক্ষেপে লিখুন..."
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="hrDoc" className="block text-xs font-semibold mb-1">
                      প্রমাণপত্র / মেডিকেল প্রেসক্রিপশন (PDF বা ছবি, সর্বোচ্চ ৫MB)
                    </label>
                    <input
                      id="hrDoc"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      className="w-full text-xs text-textMuted file:mr-2 file:py-1 file:px-3 file:rounded file:border file:border-primary file:bg-surfaceBg file:text-primary"
                    />
                    <p className="text-[11px] text-textMuted mt-1">
                      * এই ডকুমেন্ট শুধুমাত্র অ্যাডমিন যাচাইয়ের জন্য সংরক্ষিত হবে; কখনো জনসমক্ষে প্রকাশ পাবে না।
                    </p>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg bg-primary text-white font-bold text-sm hover:bg-darkGreen"
                    >
                      আবেদন জমা দিন
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHelpModal(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                    >
                      বাতিল
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PROFILE & LOGOUT */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-bold text-darkGreen mb-1">প্রোফাইল ও নিরাপত্তা</h2>
            <p className="text-sm text-textMuted">
              আপনার সংরক্ষিত অ্যাকাউন্ট ও নিরাপত্তা তথ্য।
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-textMuted">নিবন্ধিত মোবাইল নম্বর:</span>
              <strong className="font-mono text-darkGreen">{user?.phone || 'লোড হচ্ছে...'}</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-textMuted">পূর্ণ নাম:</span>
              <span className="font-semibold">{user?.name || 'অনুল্লেখিত'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-textMuted">ভূমিকা (Role):</span>
              <span className="font-semibold text-primary">{user?.role || 'USER'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-textMuted">অ্যাকাউন্টের অবস্থা:</span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800 font-semibold">
                {user?.status || 'ACTIVE'}
              </span>
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={async () => {
                await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
                if (typeof window !== 'undefined') window.location.href = '/login';
              }}
              className="px-5 py-2.5 rounded-lg border border-red-400 text-red-600 font-bold hover:bg-red-50 text-sm"
            >
              লগআউট করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}