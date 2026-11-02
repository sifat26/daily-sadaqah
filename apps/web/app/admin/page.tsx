'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { CATEGORY_LABELS_BN, formatBdt, STATUS_LABELS_BN } from '../../lib/format';

interface AdminDonationItem {
  id: string;
  projectName: string;
  senderPhone: string;
  donorName: string;
  amountBdt: number;
  provider: string;
  transactionId: string;
  status: string;
  isDailySadaqah: boolean;
  createdAt: string;
}

interface AdminExpenseItem {
  id: string;
  projectId: string;
  projectName: string;
  category: string;
  amountBdt: number;
  expenseDate: string;
  purpose: string;
  recipientRef?: string;
  publicDisclosure: boolean;
  status: string;
  createdAt: string;
}

interface AdminHelpRequestItem {
  id: string;
  applicantId: string;
  title: string;
  description: string;
  category: string;
  district: string;
  area: string;
  requiredAmountBdt: number;
  applicantName: string;
  applicantPhone: string;
  status: string;
  publicVisibility: boolean;
  adminNotes?: string;
  documents: Array<{ id: string; fileName: string; mimeType: string; isPrivate: boolean }>;
  createdAt: string;
}

interface AdminBloodDonorItem {
  id: string;
  displayName: string;
  bloodGroup: string;
  district: string;
  area: string;
  contactPhone: string;
  publicPhoneConsent: boolean;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

interface OverviewMetrics {
  totalVerifiedDonationsBdt: number;
  totalApprovedExpensesBdt: number;
  remainingBalanceBdt: number;
  pendingDonationsCount: number;
  verifiedDonationsCount: number;
  approvedExpensesCount: number;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'donations' | 'expenses' | 'help' | 'donors' | 'audit'>('donations');
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name?: string; phone?: string } | null>(null);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Donations state
  const [donations, setDonations] = useState<AdminDonationItem[]>([]);
  const [donationFilter, setDonationFilter] = useState<string>('ALL');
  const [donationSearch, setDonationSearch] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});

  // Expenses state
  const [expenses, setExpenses] = useState<AdminExpenseItem[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expProject, setExpProject] = useState('proj_medical');
  const [expCategory, setExpCategory] = useState('MEDICAL');
  const [expAmount, setExpAmount] = useState(1000);
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expPurpose, setExpPurpose] = useState('');
  const [expRecipientRef, setExpRecipientRef] = useState('');
  const [expStatus, setExpStatus] = useState<'APPROVED' | 'PENDING'>('APPROVED');
  const [expPublic, setExpPublic] = useState(true);

  // Help requests state
  const [helpRequests, setHelpRequests] = useState<AdminHelpRequestItem[]>([]);
  const [hrNotes, setHrNotes] = useState<Record<string, string>>({});

  // Blood donors state
  const [donors, setDonors] = useState<AdminBloodDonorItem[]>([]);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  async function loadAllData() {
    // 0. Current admin user
    void apiRequest<{ user: { id: string; role: string; name?: string; phone?: string } | null }>('/auth/me').then((res) => {
      if (res.success && res.data?.user) {
        setCurrentUser(res.data.user);
      } else {
        setCurrentUser(null);
      }
    });

    // 1. Transparency summary for overview metrics
    void apiRequest<OverviewMetrics>('/transparency/summary').then((res) => {
      if (res.success && res.data) setOverview(res.data);
    });

    // 2. Admin donations
    void apiRequest<AdminDonationItem[]>('/admin/donations').then((res) => {
      if (res.success && res.data) setDonations(res.data);
    });

    // 3. Admin expenses
    void apiRequest<AdminExpenseItem[]>('/admin/expenses').then((res) => {
      if (res.success && res.data) setExpenses(res.data);
    });

    // 4. Admin help requests
    void apiRequest<AdminHelpRequestItem[]>('/admin/help-requests').then((res) => {
      if (res.success && res.data) setHelpRequests(res.data);
    });

    // 5. Admin blood donors
    void apiRequest<AdminBloodDonorItem[]>('/admin/blood-donors').then((res) => {
      if (res.success && res.data) setDonors(res.data);
    });

    // 6. Audit logs
    void apiRequest<AuditLogItem[]>('/admin/audit-logs').then((res) => {
      if (res.success && res.data) setAuditLogs(res.data);
    });
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  async function handleVerifyDonation(id: string, action: 'approve' | 'reject') {
    setNotice(null);
    setErrorNotice(null);
    const notes = actionNotes[id] || '';
    const res = await apiRequest<{ message: string }>(`/admin/donations/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    if (res.success) {
      setNotice(res.data.message);
      void loadAllData();
    } else {
      setErrorNotice(res.error?.message || 'কার্যক্রম সম্পন্ন করা যায়নি।');
    }
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setErrorNotice(null);

    const res = await apiRequest<{ message: string }>('/admin/expenses', {
      method: 'POST',
      body: JSON.stringify({
        projectId: expProject,
        category: expCategory,
        amountBdt: Number(expAmount),
        expenseDate: expDate,
        purpose: expPurpose,
        recipientRef: expRecipientRef || undefined,
        status: expStatus,
        publicDisclosure: expPublic,
      }),
    });

    if (res.success) {
      setNotice('নতুন খরচের রেকর্ড সফলভাবে যুক্ত হয়েছে।');
      setShowExpenseModal(false);
      setExpPurpose('');
      setExpRecipientRef('');
      void loadAllData();
    } else {
      setErrorNotice(res.error?.message || 'খরচ সংরক্ষণ ব্যর্থ হয়েছে।');
    }
  }

  async function handleReviewHelpRequest(id: string, action: 'approve' | 'reject') {
    setNotice(null);
    setErrorNotice(null);
    const adminNotes = hrNotes[id] || '';
    const res = await apiRequest<{ data: AdminHelpRequestItem }>(
      `/admin/help-requests/${id}/${action}`,
      {
        method: 'POST',
        body: JSON.stringify({ adminNotes }),
      }
    );
    if (res.success) {
      setNotice(
        action === 'approve'
          ? 'আবেদনটি সফলভাবে অনুমোদিত হয়েছে এবং জনসমক্ষে প্রকাশ পেয়েছে।'
          : 'আবেদনটি বাতিল করা হয়েছে।'
      );
      void loadAllData();
    } else {
      setErrorNotice(res.error?.message || 'পদক্ষেপ ব্যর্থ হয়েছে।');
    }
  }

  async function handleToggleDonorActive(id: string, currentActive: boolean) {
    setNotice(null);
    const res = await apiRequest<{ data: AdminBloodDonorItem }>(`/admin/blood-donors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !currentActive }),
    });
    if (res.success) {
      setNotice('রক্তদাতার স্ট্যাটাস সফলভাবে পরিবর্তিত হয়েছে।');
      void loadAllData();
    }
  }

  const filteredDonations = donations.filter((d) => {
    if (donationFilter !== 'ALL' && d.status !== donationFilter) return false;
    if (donationSearch) {
      const q = donationSearch.toLowerCase();
      return (
        d.transactionId.toLowerCase().includes(q) ||
        d.senderPhone.includes(q) ||
        d.projectName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Admin Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <span className="inline-block bg-amber-100 text-darkGreen border border-amber-300 font-bold text-xs px-3 py-1 rounded mb-2">
            অ্যাডমিনিস্ট্রেটর নিয়ন্ত্রণ প্যানেল
          </span>
          <h1 className="text-3xl font-bold text-darkGreen mb-1">অ্যাডমিন ড্যাশবোর্ড</h1>
          <p className="text-sm text-textMuted">
            ম্যানুয়াল ট্রানজেকশন যাচাই, অনুমোদিত ব্যয় ব্যবস্থাপনা, সাহায্য আবেদন ও নিরাপত্তা অডিট লগ।
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-white p-2.5 px-4 rounded-xl border border-gray-200 shadow-xs">
              <div className="text-right">
                <div className="text-xs font-bold text-darkGreen">{currentUser.name || 'প্রধান অ্যাডমিন'}</div>
                <div className="text-[11px] text-textMuted font-mono">{currentUser.phone || currentUser.role}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
                  window.location.href = '/login?tab=admin';
                }}
                className="text-xs text-red-600 hover:text-red-700 font-bold border border-red-200 bg-red-50 px-2.5 py-1 rounded-lg"
              >
                লগআউট
              </button>
            </div>
          ) : (
            <a
              href="/login?tab=admin"
              className="text-xs font-bold bg-darkGreen hover:bg-primary text-white px-4 py-2.5 rounded-xl transition-all shadow-xs"
            >
              🔑 অ্যাডমিন লগইন করুন
            </a>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {notice && (
        <div role="status" className="p-4 rounded-lg bg-emerald-50 border border-primary text-darkGreen font-semibold text-sm">
          {notice}
        </div>
      )}
      {errorNotice && (
        <div role="alert" className="p-4 rounded-lg bg-red-50 border border-red-300 text-red-700 font-semibold text-sm">
          {errorNotice}
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 border-t-4 border-t-primary">
          <div className="text-xs text-textMuted mb-1">মোট যাচাইকৃত তহবিল</div>
          <div className="text-xl font-bold text-darkGreen">
            {formatBdt(overview?.totalVerifiedDonationsBdt ?? 0)}
          </div>
          <div className="text-[11px] text-textMuted mt-1">
            {overview?.verifiedDonationsCount ?? 0} টি অনুমোদিত দান
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 border-t-4 border-t-gold">
          <div className="text-xs text-textMuted mb-1">অনুমোদিত মোট ব্যয়</div>
          <div className="text-xl font-bold text-darkGreen">
            {formatBdt(overview?.totalApprovedExpensesBdt ?? 0)}
          </div>
          <div className="text-[11px] text-textMuted mt-1">
            {overview?.approvedExpensesCount ?? 0} টি খরচের হিসাব
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 border-t-4 border-t-primary">
          <div className="text-xs text-textMuted mb-1">অবশিষ্ট ব্যালেন্স</div>
          <div className="text-xl font-bold text-darkGreen">
            {formatBdt(overview?.remainingBalanceBdt ?? 0)}
          </div>
          <div className="text-[11px] text-textMuted mt-1">সক্রিয় তহবিল</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 border-t-4 border-t-amber-500">
          <div className="text-xs text-textMuted mb-1">অপেক্ষমাণ দান (Pending)</div>
          <div className="text-xl font-bold text-amber-700">
            {overview?.pendingDonationsCount ?? 0} টি
          </div>
          <div className="text-[11px] text-textMuted mt-1">যাচাইয়ের অপেক্ষায়</div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {[
          { key: 'donations', label: `দান যাচাই (${overview?.pendingDonationsCount ?? 0})` },
          { key: 'expenses', label: 'খরচ ব্যবস্থাপনা' },
          { key: 'help', label: `সাহায্যের আবেদন (${helpRequests.filter((h) => h.status === 'PENDING').length})` },
          { key: 'donors', label: `রক্তদাতা তালিকা (${donors.length})` },
          { key: 'audit', label: `অডিট লগ (${auditLogs.length})` },
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

      {/* TAB 1: DONATION MANAGEMENT */}
      {activeTab === 'donations' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-darkGreen">১. ম্যানুয়াল দান ট্রানজেকশন যাচাই</h2>
              <p className="text-xs text-textMuted">
                bKash ও Nagad-এর Send Money ট্রানজেকশন স্টেটমেন্ট মিলিয়ে অনুমোদন বা বাতিল করুন।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="TrxID বা মোবাইল দিয়ে খুঁজুন..."
                value={donationSearch}
                onChange={(e) => setDonationSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs w-52"
              />
              <select
                value={donationFilter}
                onChange={(e) => setDonationFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white"
              >
                <option value="ALL">সকল স্ট্যাটাস</option>
                <option value="PENDING">অপেক্ষমাণ (PENDING)</option>
                <option value="VERIFIED">যাচাইকৃত (VERIFIED)</option>
                <option value="REJECTED">বাতিলকৃত (REJECTED)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-darkGreen text-white">
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">প্রেরকের নম্বর ও মাধ্যম</th>
                  <th className="p-3">দাতার নাম</th>
                  <th className="p-3">প্রকল্প</th>
                  <th className="p-3">পরিমাণ</th>
                  <th className="p-3">অবস্থা</th>
                  <th className="p-3">তারিখ</th>
                  <th className="p-3">মন্তব্য ও পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody>
                {filteredDonations.map((d) => (
                  <tr key={d.id} className="border-b border-gray-200 hover:bg-surfaceBg/60">
                    <td className="p-3 font-mono font-bold text-darkGreen">{d.transactionId}</td>
                    <td className="p-3">
                      <span className="font-semibold">{d.provider}</span>: {d.senderPhone}
                    </td>
                    <td className="p-3">{d.donorName || 'গোপন'}</td>
                    <td className="p-3">{d.projectName}</td>
                    <td className="p-3 font-bold text-primary">{formatBdt(d.amountBdt)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                    <td className="p-3 text-textMuted">{new Date(d.createdAt).toLocaleDateString('bn-BD')}</td>
                    <td className="p-3">
                      {d.status === 'PENDING' ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="যাচাইয়ের মন্তব্য (ঐচ্ছিক)"
                            value={actionNotes[d.id] || ''}
                            onChange={(e) =>
                              setActionNotes({ ...actionNotes, [d.id]: e.target.value })
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerifyDonation(d.id, 'approve')}
                              className="px-2.5 py-1 rounded bg-primary text-white font-bold text-[11px] hover:bg-darkGreen transition-colors"
                            >
                              অনুমোদন
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifyDonation(d.id, 'reject')}
                              className="px-2.5 py-1 rounded border border-red-500 text-red-600 font-bold text-[11px] hover:bg-red-50 transition-colors"
                            >
                              বাতিল
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-textMuted">সম্পন্ন</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES MANAGEMENT */}
      {activeTab === 'expenses' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-darkGreen">২. খরচের রেকর্ড ব্যবস্থাপনা</h2>
              <p className="text-xs text-textMuted">
                শুধুমাত্র অনুমোদিত (APPROVED) খরচ আর্থিক স্বচ্ছতার প্রতিবেদনে অন্তর্ভুক্ত হয়।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="px-4 py-2 rounded-lg bg-primary text-white font-semibold text-xs hover:bg-darkGreen"
            >
              + নতুন খরচ এন্ট্রি করুন
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-darkGreen text-white">
                  <th className="p-3">তারিখ</th>
                  <th className="p-3">প্রকল্প</th>
                  <th className="p-3">ক্যাটাগরি</th>
                  <th className="p-3">টাকার পরিমাণ</th>
                  <th className="p-3">উদ্দেশ্য</th>
                  <th className="p-3">পাবলিক ডিসক্লোজার</th>
                  <th className="p-3">অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-gray-200 hover:bg-surfaceBg/60">
                    <td className="p-3 text-textMuted">{exp.expenseDate}</td>
                    <td className="p-3 font-semibold">{exp.projectName}</td>
                    <td className="p-3">{CATEGORY_LABELS_BN[exp.category] || exp.category}</td>
                    <td className="p-3 font-bold text-darkGreen">{formatBdt(exp.amountBdt)}</td>
                    <td className="p-3 max-w-xs">{exp.purpose}</td>
                    <td className="p-3">
                      {exp.publicDisclosure ? (
                        <span className="text-emerald-700 font-semibold">✓ উন্মুক্ত</span>
                      ) : (
                        <span className="text-gray-500">গোপনীয়</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          exp.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {exp.status === 'APPROVED' ? 'অনুমোদিত' : 'অপেক্ষমাণ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* New Expense Modal */}
          {showExpenseModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                  <h3 className="text-lg font-bold text-darkGreen">নতুন ব্যয়ের এন্ট্রি</h3>
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="text-gray-500 hover:text-black font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateExpense} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="expP" className="block text-xs font-semibold mb-1">
                        প্রকল্প *
                      </label>
                      <select
                        id="expP"
                        value={expProject}
                        onChange={(e) => setExpProject(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white"
                      >
                        <option value="proj_medical">চিকিৎসা সহায়তা</option>
                        <option value="proj_food">খাদ্য সহায়তা</option>
                        <option value="proj_water">বিশুদ্ধ পানি</option>
                        <option value="proj_orphan">এতিম ও শিশু সহায়তা</option>
                        <option value="proj_education">শিক্ষা সহায়তা</option>
                        <option value="proj_housing">ঘর মেরামত</option>
                        <option value="proj_emergency">জরুরি সহায়তা</option>
                        <option value="proj_ramadan">ইফতার ও রমজান</option>
                        <option value="proj_general">সাধারণ সাদাকা</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="expCat" className="block text-xs font-semibold mb-1">
                        ক্যাটাগরি *
                      </label>
                      <select
                        id="expCat"
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white"
                      >
                        <option value="MEDICAL">চিকিৎসা (Medical)</option>
                        <option value="FOOD">খাদ্য (Food)</option>
                        <option value="CLEAN_WATER">বিশুদ্ধ পানি (Water)</option>
                        <option value="ORPHAN_CHILD">এতিম ও শিশু</option>
                        <option value="EDUCATION">শিক্ষা (Education)</option>
                        <option value="HOUSING">ঘর মেরামত</option>
                        <option value="EMERGENCY">জরুরি (Emergency)</option>
                        <option value="RAMADAN_IFTAR">ইফতার ও রমজান</option>
                        <option value="GENERAL_SADAQAH">সাধারণ সাদাকা</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="expAmt" className="block text-xs font-semibold mb-1">
                        টাকার পরিমাণ (৳) *
                      </label>
                      <input
                        id="expAmt"
                        type="number"
                        min={1}
                        value={expAmount}
                        onChange={(e) => setExpAmount(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="expD" className="block text-xs font-semibold mb-1">
                        ব্যয়ের তারিখ *
                      </label>
                      <input
                        id="expD"
                        type="date"
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="expPur" className="block text-xs font-semibold mb-1">
                      বিস্তারিত উদ্দেশ্য *
                    </label>
                    <textarea
                      id="expPur"
                      rows={2}
                      value={expPurpose}
                      onChange={(e) => setExpPurpose(e.target.value)}
                      placeholder="যেমন: রোগীর প্রয়োজনীয় ওষুধ ক্রয় ভাউচার নং #৮২১"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="expRef" className="block text-xs font-semibold mb-1">
                      উপকারভোগীর গোপন রেফারেন্স (অভ্যন্তরীণ)
                    </label>
                    <input
                      id="expRef"
                      type="text"
                      placeholder="যেমন: কেইস আইডি #১২৩৪"
                      value={expRecipientRef}
                      onChange={(e) => setExpRecipientRef(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label htmlFor="expSt" className="block text-xs font-semibold mb-1">
                        অনুমোদন স্ট্যাটাস
                      </label>
                      <select
                        id="expSt"
                        value={expStatus}
                        onChange={(e) => setExpStatus(e.target.value as 'APPROVED' | 'PENDING')}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white"
                      >
                        <option value="APPROVED">সরাসরি অনুমোদিত (APPROVED)</option>
                        <option value="PENDING">অপেক্ষমাণ (PENDING)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        id="expPub"
                        type="checkbox"
                        checked={expPublic}
                        onChange={(e) => setExpPublic(e.target.checked)}
                        className="h-4 w-4 text-primary rounded border-gray-300"
                      />
                      <label htmlFor="expPub" className="text-xs text-textMain cursor-pointer">
                        স্বচ্ছতা পাতায় প্রকাশ্যে প্রদর্শন
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg bg-primary text-white font-bold text-xs hover:bg-darkGreen"
                    >
                      খরচ সেভ করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExpenseModal(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold"
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

      {/* TAB 3: HELP REQUESTS REVIEW */}
      {activeTab === 'help' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-darkGreen">৩. মানবিক সাহায্য আবেদন পর্যালোচনা</h2>
            <p className="text-xs text-textMuted">
              যাচাইকৃত আবেদনসমূহ শুধুমাত্র জনসমক্ষে প্রকাশ পাবে যাতে সাধারণ দাতা সরাসরি সাহায্য করতে পারেন।
            </p>
          </div>

          <div className="space-y-4">
            {helpRequests.map((hr) => (
              <div key={hr.id} className="p-4 rounded-xl border border-gray-200 bg-surfaceBg/40 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-darkGreen text-base">{hr.title}</h3>
                    <p className="text-xs text-textMuted">
                      আবেদনকারী: <strong>{hr.applicantName}</strong> ({hr.applicantPhone}) | এলাকা: {hr.area}, {hr.district}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      hr.status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : hr.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {hr.status === 'VERIFIED' ? 'অনুমোদিত' : hr.status === 'REJECTED' ? 'বাতিল' : 'যাচাই চলছে'}
                  </span>
                </div>

                <p className="text-xs text-textMain">{hr.description}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    প্রয়োজনীয় অর্থ: <strong className="text-primary font-bold">{formatBdt(hr.requiredAmountBdt)}</strong>
                  </div>
                  {hr.documents && hr.documents.length > 0 && (
                    <div className="text-xs text-darkGreen font-semibold">
                      সংযুক্ত প্রমাণপত্র: {hr.documents.map((d) => d.fileName).join(', ')}
                    </div>
                  )}
                </div>

                {hr.status === 'PENDING' && (
                  <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      placeholder="অ্যাডমিন মন্তব্য লিখুন..."
                      value={hrNotes[hr.id] || ''}
                      onChange={(e) => setHrNotes({ ...hrNotes, [hr.id]: e.target.value })}
                      className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleReviewHelpRequest(hr.id, 'approve')}
                      className="px-3 py-1.5 rounded bg-primary text-white font-bold text-xs hover:bg-darkGreen"
                    >
                      যাচাইকৃত ঘোষণা করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewHelpRequest(hr.id, 'reject')}
                      className="px-3 py-1.5 rounded border border-red-500 text-red-600 font-bold text-xs hover:bg-red-50"
                    >
                      বাতিল
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BLOOD DONORS MODERATION */}
      {activeTab === 'donors' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-darkGreen">৪. রক্তদাতা নেটওয়ার্ক মডারেশন</h2>
            <p className="text-xs text-textMuted">
              অযাচিত বা ভুল প্রোফাইল নিষ্ক্রিয় (Deactivate) করুন এবং তালিকা নিরীক্ষণ করুন।
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-darkGreen text-white">
                  <th className="p-3">রক্তদাতার নাম</th>
                  <th className="p-3">রক্তের গ্রুপ</th>
                  <th className="p-3">জেলা ও এলাকা</th>
                  <th className="p-3">মোবাইল নম্বর</th>
                  <th className="p-3">পাবলিক কনসেন্ট</th>
                  <th className="p-3">উপলব্ধতা</th>
                  <th className="p-3">অবস্থা</th>
                  <th className="p-3">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((bd) => (
                  <tr key={bd.id} className="border-b border-gray-200 hover:bg-surfaceBg/60">
                    <td className="p-3 font-semibold">{bd.displayName}</td>
                    <td className="p-3 font-bold text-primary">{bd.bloodGroup}</td>
                    <td className="p-3">
                      {bd.area}, {bd.district}
                    </td>
                    <td className="p-3 font-mono">{bd.contactPhone}</td>
                    <td className="p-3">
                      {bd.publicPhoneConsent ? (
                        <span className="text-emerald-700">✓ অনুমোদিত</span>
                      ) : (
                        <span className="text-gray-400">লুকানো</span>
                      )}
                    </td>
                    <td className="p-3">{bd.isAvailable ? 'প্রস্তুত' : 'অনুপলব্ধ'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          bd.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {bd.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleToggleDonorActive(bd.id, bd.isActive)}
                        className={`px-2.5 py-1 rounded font-bold text-[11px] ${
                          bd.isActive
                            ? 'border border-red-500 text-red-600 hover:bg-red-50'
                            : 'bg-primary text-white hover:bg-darkGreen'
                        }`}
                      >
                        {bd.isActive ? 'নিষ্ক্রিয় করুন' : 'পুনরায় সক্রিয় করুন'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-darkGreen">৫. নিরাপত্তা ও প্রশাসনিক অডিট লগ</h2>
            <p className="text-xs text-textMuted">
              সকল প্রশাসনিক অনুমোদন, বাতিলকরণ ও অর্থ লেনদেনের অপরিবর্তনীয় ট্রেইল।
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-darkGreen text-white">
                  <th className="p-3">তারিখ ও সময়</th>
                  <th className="p-3">প্রশাসনিক পদক্ষেপ (Action)</th>
                  <th className="p-3">এনটিটি ধরন</th>
                  <th className="p-3">রেকর্ড আইডি</th>
                  <th className="p-3">প্রশাসক আইডি</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-200 hover:bg-surfaceBg/60">
                    <td className="p-3 text-textMuted font-mono">
                      {new Date(log.createdAt).toLocaleString('bn-BD')}
                    </td>
                    <td className="p-3 font-semibold text-primary">{log.action}</td>
                    <td className="p-3">{log.entityType}</td>
                    <td className="p-3 font-mono text-textMuted">{log.entityId}</td>
                    <td className="p-3 font-mono text-textMuted">{log.actorId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}