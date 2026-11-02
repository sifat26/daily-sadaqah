import React from 'react';
import { apiRequest, fetchTransparencySummary } from '../../lib/api-client';
import { CATEGORY_LABELS_BN, formatBdt } from '../../lib/format';

interface PublicExpenseItem {
  id: string;
  projectName: string;
  category: string;
  amountBdt: number;
  expenseDate: string;
  purpose: string;
  evidence: { fileName: string; mimeType: string } | null;
}

export default async function TransparencyPage() {
  const [summary, expensesRes] = await Promise.all([
    fetchTransparencySummary(),
    apiRequest<PublicExpenseItem[]>('/transparency/expenses', { cache: 'no-store' }),
  ]);

  const expenses = expensesRes.success ? expensesRes.data : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-darkGreen font-bold text-xs uppercase tracking-wider">
          ১০০% উন্মুক্ত অডিট হিসাব
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-darkGreen tracking-tight">
          আর্থিক স্বচ্ছতা ও ব্যয়ের হিসাব
        </h1>
        <p className="text-textMuted text-xs sm:text-sm leading-relaxed">
          ডেইলি সাদাকা প্ল্যাটফর্মের প্রতিটি পাই-পয়সার হিসাব উন্মুক্ত। অবশিষ্ট ফান্ড = মোট যাচাইকৃত দান (VERIFIED) − মোট অনুমোদিত খরচ (APPROVED)।
        </p>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid sm:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs border-t-4 border-t-primary">
          <div className="text-xs font-bold text-textMuted uppercase tracking-wider mb-1">মোট যাচাইকৃত দান</div>
          <div className="text-3xl font-extrabold text-darkGreen">
            {formatBdt(summary?.totalVerifiedDonationsBdt ?? 0)}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-2">
            ✓ সকল ভেরিফাইড ম্যানুয়াল অনুদান
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs border-t-4 border-t-gold">
          <div className="text-xs font-bold text-textMuted uppercase tracking-wider mb-1">মোট অনুমোদিত খরচ</div>
          <div className="text-3xl font-extrabold text-darkGreen">
            {formatBdt(summary?.totalApprovedExpensesBdt ?? 0)}
          </div>
          <p className="text-[11px] text-amber-800 font-medium mt-2">
            ✓ প্রমাণ্য ভাউচার সহ মাঠপর্যায়ে ব্যয়
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs border-t-4 border-t-emerald-600">
          <div className="text-xs font-bold text-textMuted uppercase tracking-wider mb-1">বর্তমান অবশিষ্ট ফান্ড</div>
          <div className="text-3xl font-extrabold text-primary">
            {formatBdt(summary?.remainingBalanceBdt ?? 0)}
          </div>
          <p className="text-[11px] text-textMuted font-medium mt-2">
            = সংগৃহীত ফান্ড − অনুমোদিত মোট ব্যয়
          </p>
        </div>
      </div>

      {/* Project Allocations Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-darkGreen">প্রকল্পভিত্তিক সংগৃহীত দান ও ব্যয়ের হিসাব</h2>
          <span className="text-xs text-textMuted">রিয়েল-টাইম তথ্য</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surfaceBg text-darkGreen text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-4">প্রকল্পের নাম</th>
                <th className="py-3 px-4">যাচাইকৃত সংগৃহীত দান</th>
                <th className="py-3 px-4">অনুমোদিত খরচ</th>
                <th className="py-3 px-4">প্রকল্পের নিট ফান্ড</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {(summary?.projectAllocations ?? []).map((item) => {
                const net = item.verifiedDonationsBdt - item.approvedExpensesBdt;
                return (
                  <tr key={item.projectId} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-darkGreen">{item.projectName}</td>
                    <td className="py-3 px-4 font-medium text-emerald-800">{formatBdt(item.verifiedDonationsBdt)}</td>
                    <td className="py-3 px-4 font-medium text-gray-700">{formatBdt(item.approvedExpensesBdt)}</td>
                    <td className="py-3 px-4 font-bold text-primary">{formatBdt(net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved Expense Vouchers Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-darkGreen">অনুমোদিত খরচের তালিকা ও ভাউচার বিবরণ</h2>
          <span className="text-xs text-textMuted">{expenses.length}টি অনুমোদিত রেকর্ড</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surfaceBg text-darkGreen text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-4">তারিখ</th>
                <th className="py-3 px-4">খাত / প্রকল্প</th>
                <th className="py-3 px-4">টাকার পরিমাণ</th>
                <th className="py-3 px-4">ব্যয়ের সুনির্দিষ্ট উদ্দেশ্য</th>
                <th className="py-3 px-4">ভাউচার প্রমাণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-4 text-textMuted font-mono text-xs">{exp.expenseDate}</td>
                  <td className="py-3 px-4 font-bold text-darkGreen">
                    <span className="px-2 py-0.5 rounded bg-surfaceBg border border-gray-200 text-xs">
                      {CATEGORY_LABELS_BN[exp.category] || exp.projectName}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-darkGreen">{formatBdt(exp.amountBdt)}</td>
                  <td className="py-3 px-4 text-textMain max-w-md leading-relaxed">{exp.purpose}</td>
                  <td className="py-3 px-4">
                    {exp.evidence ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-darkGreen border border-primary/30">
                        <span>📄</span>
                        <span>{exp.evidence.fileName}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-textMuted">ভাউচার সংরক্ষিত</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
