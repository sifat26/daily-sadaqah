'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { formatBdt } from '../../lib/format';

const ALL_PROJECTS = [
  { id: 'proj_general', name: 'সাধারণ সাদাকা (General Sadaqah)', category: 'সাধারণ' },
  { id: 'proj_medical', name: 'চিকিৎসা সহায়তা (অসহায় রোগীদের ওষুধ ও চিকিৎসা)', category: 'চিকিৎসা' },
  { id: 'proj_food', name: 'খাদ্য সহায়তা (অসচ্ছল পরিবারের চাল-ডাল বিতরণ)', category: 'খাদ্য' },
  { id: 'proj_water', name: 'বিশুদ্ধ পানি (প্রত্যন্ত অঞ্চলে টিউবওয়েল স্থাপন)', category: 'পানি' },
  { id: 'proj_orphan', name: 'এতিম ও শিশু সহায়তা (মাসিক সহায়তা ও শিক্ষা)', category: 'এতিম' },
  { id: 'proj_education', name: 'শিক্ষা সহায়তা (দরিদ্র শিক্ষার্থীদের শিক্ষাবৃত্তি)', category: 'শিক্ষা' },
  { id: 'proj_housing', name: 'ঘর মেরামত (দুর্যোগে ক্ষতিগ্রস্তদের ঘর নির্মাণ)', category: 'পুনর্বাসন' },
  { id: 'proj_emergency', name: 'জরুরি সহায়তা (বন্যা ও প্রাকৃতিক দুর্যোগ ত্রাণ)', category: 'জরুরি' },
  { id: 'proj_ramadan', name: 'ইফতার ও রমজান (রোজাদারদের ইফতার ও সাহরি)', category: 'রমজান' },
];

const QUICK_AMOUNTS = [20, 50, 100, 200, 500, 1000, 2000, 5000];

export default function DonatePage() {
  const [projectId, setProjectId] = useState('proj_general');
  const [amountBdt, setAmountBdt] = useState<number>(100);
  const [provider, setProvider] = useState<'BKASH' | 'NAGAD'>('BKASH');
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [donorName, setDonorName] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [receivingNumbers, setReceivingNumbers] = useState<{ bkash: string; nagad: string }>({
    bkash: '01681253714',
    nagad: '01681253714',
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    // Read query parameters (?project=... & ?amount=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const projParam = params.get('project');
      const amtParam = params.get('amount');
      if (projParam) setProjectId(projParam);
      if (amtParam && !Number.isNaN(Number(amtParam))) setAmountBdt(Number(amtParam));
    }

    // Fetch live designated receiving numbers from API
    void apiRequest<{ receivingNumbers: { bkash: string; nagad: string } }>('/transparency/summary')
      .then((res) => {
        if (res.success && res.data?.receivingNumbers) {
          setReceivingNumbers({
            bkash: res.data.receivingNumbers.bkash || '01681253714',
            nagad: res.data.receivingNumbers.nagad || '01681253714',
          });
        }
      })
      .catch(() => {});
  }, []);

  function handleCopy(num: string, key: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(num);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await apiRequest<{ message: string; donation: { id: string } }>('/donations', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          amountBdt: Number(amountBdt),
          provider,
          senderPhone: senderPhone.trim(),
          transactionId: transactionId.trim().toUpperCase(),
          donorName: donorName.trim(),
          message: message.trim(),
          isAnonymous,
          isDailySadaqah: false,
        }),
      });

      if (!res.success) {
        setErrorMsg(res.error.message);
        return;
      }

      setStatusMsg(
        res.data.message ||
          'আলহামদুলিল্লাহ! আপনার দানের তথ্য সফলভাবে জমা দেওয়া হয়েছে। অ্যাডমিন ভেরিফিকেশন সম্পন্ন হলে মূল তহবিলে যুক্ত হবে।'
      );
      setTransactionId('');
      setSenderPhone('');
      setMessage('');
    } catch {
      setErrorMsg('সার্ভারে যোগাযোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surfaceBg py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Page Title & Tagline */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-300 text-darkGreen font-bold text-xs uppercase tracking-wider mb-2">
            <span>🤲</span>
            <span>ম্যানুয়াল Send Money পদ্ধতি</span>
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-darkGreen tracking-tight">
            সহজ ও বিশ্বস্ত পদ্ধতিতে দান করুন
          </h1>
          <p className="text-textMuted text-sm md:text-base max-w-2xl mx-auto mt-2">
            আমাদের নিজস্ব কোনো স্বয়ংক্রিয় পেমেন্ট গেটওয়ে বা অতিরিক্ত চার্জ নেই। নিচের ব্যক্তিগত বিকাশ বা নগদ নম্বরে Send Money করার পর TrxID জমা দিন।
          </p>
        </div>

        {/* 1. Official Receiving Payment Cards (bKash & Nagad) */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {/* bKash Card */}
          <div
            onClick={() => setProvider('BKASH')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative ${
              provider === 'BKASH'
                ? 'border-[#E2136E] bg-white shadow-md ring-2 ring-[#E2136E]/20'
                : 'border-pink-200 bg-white/70 hover:bg-white hover:border-[#E2136E]/60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#E2136E] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  bK
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">বিকাশ পার্সোনাল</h3>
                  <span className="text-[11px] text-[#E2136E] font-semibold">Send Money অপশন</span>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold ${
                  provider === 'BKASH'
                    ? 'bg-[#E2136E] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {provider === 'BKASH' ? '✓ নির্বাচিত' : 'সিলেক্ট করুন'}
              </span>
            </div>

            <div className="bg-pink-50/70 border border-pink-200/80 rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-gray-600 block">প্রাপক বিকাশ নম্বর:</span>
                <span className="font-mono text-lg font-extrabold text-gray-900 tracking-wider">
                  {receivingNumbers.bkash}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(receivingNumbers.bkash, 'bkash');
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  copiedKey === 'bkash'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-[#E2136E] text-[#E2136E] hover:bg-[#E2136E] hover:text-white'
                }`}
              >
                {copiedKey === 'bkash' ? '✓ কপি হয়েছে!' : 'নম্বর কপি'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              * আপনার বিকাশ অ্যাপ ওপেন করুন &gt; &ldquo;Send Money&rdquo; নির্বাচন করুন &gt; নম্বর দিন
            </p>
          </div>

          {/* Nagad Card */}
          <div
            onClick={() => setProvider('NAGAD')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative ${
              provider === 'NAGAD'
                ? 'border-[#F7941D] bg-white shadow-md ring-2 ring-[#F7941D]/20'
                : 'border-amber-200 bg-white/70 hover:bg-white hover:border-[#F7941D]/60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#F7941D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  ন
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">নগদ পার্সোনাল</h3>
                  <span className="text-[11px] text-[#F7941D] font-semibold">Send Money অপশন</span>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold ${
                  provider === 'NAGAD'
                    ? 'bg-[#F7941D] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {provider === 'NAGAD' ? '✓ নির্বাচিত' : 'সিলেক্ট করুন'}
              </span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-gray-600 block">প্রাপক নগদ নম্বর:</span>
                <span className="font-mono text-lg font-extrabold text-gray-900 tracking-wider">
                  {receivingNumbers.nagad}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(receivingNumbers.nagad, 'nagad');
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  copiedKey === 'nagad'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-[#F7941D] text-[#F7941D] hover:bg-[#F7941D] hover:text-white'
                }`}
              >
                {copiedKey === 'nagad' ? '✓ কপি হয়েছে!' : 'নম্বর কপি'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              * আপনার নগদ অ্যাপ ওপেন করুন &gt; &ldquo;Send Money&rdquo; নির্বাচন করুন &gt; নম্বর দিন
            </p>
          </div>
        </div>

        {/* 2. Step-by-Step Instructions Bar */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-900/10 shadow-xs mb-8">
          <h2 className="text-sm font-bold text-darkGreen uppercase tracking-wider mb-3">
            দান করার ৪টি সহজ ধাপ:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-surfaceBg p-3 rounded-xl border border-gray-100 flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                ১
              </span>
              <div>
                <div className="font-bold text-darkGreen">খাত ও পরিমাণ</div>
                <div className="text-textMuted text-[11px] mt-0.5">নিচের ফর্মে প্রজেক্ট ও পরিমাণ নির্ধারণ করুন</div>
              </div>
            </div>

            <div className="bg-surfaceBg p-3 rounded-xl border border-gray-100 flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                ২
              </span>
              <div>
                <div className="font-bold text-darkGreen">Send Money</div>
                <div className="text-textMuted text-[11px] mt-0.5">01681253714 নম্বরে টাকা পাঠান</div>
              </div>
            </div>

            <div className="bg-surfaceBg p-3 rounded-xl border border-gray-100 flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                ৩
              </span>
              <div>
                <div className="font-bold text-darkGreen">TrxID কপি</div>
                <div className="text-textMuted text-[11px] mt-0.5">লেনদেন শেষে মেসেজ থেকে TrxID সংগ্রহ করুন</div>
              </div>
            </div>

            <div className="bg-surfaceBg p-3 rounded-xl border border-gray-100 flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                ৪
              </span>
              <div>
                <div className="font-bold text-darkGreen">ফর্ম সাবমিট</div>
                <div className="text-textMuted text-[11px] mt-0.5">তথ্য দিলে অ্যাডমিন যাচাই করে তহবিলে যোগ করবে</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. The Main Donation Submission Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div>
              <label htmlFor="projectId" className="block text-sm font-bold text-darkGreen mb-1.5">
                ১. কোন প্রকল্পে দান করতে চান? *
              </label>
              <select
                id="projectId"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-white text-textMain font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm"
              >
                {ALL_PROJECTS.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="amountBdt" className="text-sm font-bold text-darkGreen">
                  ২. অনুদানের পরিমাণ *
                </label>
                <span className="text-sm font-extrabold text-primary bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {formatBdt(amountBdt || 0)}
                </span>
              </div>

              {/* Quick Pills */}
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountBdt(amt)}
                    className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
                      amountBdt === amt
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surfaceBg text-darkGreen border border-gray-200 hover:border-primary hover:bg-emerald-50/50'
                    }`}
                  >
                    {formatBdt(amt)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">
                  ৳
                </span>
                <input
                  id="amountBdt"
                  type="number"
                  min={1}
                  step={1}
                  value={amountBdt || ''}
                  onChange={(e) => setAmountBdt(Math.max(1, Number(e.target.value)))}
                  placeholder="অন্য যেকোনো পরিমাণ লিখুন (যেমন: ১০০)"
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-xl font-bold text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  required
                />
              </div>
            </div>

            {/* Provider and Sender Mobile Number */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="paymentProvider" className="block text-sm font-bold text-darkGreen mb-1.5">
                  ৩. মাধ্যম নির্বাচন করুন *
                </label>
                <select
                  id="paymentProvider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'BKASH' | 'NAGAD')}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 bg-white text-textMain font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm"
                >
                  <option value="BKASH">bKash (বিকাশ Send Money)</option>
                  <option value="NAGAD">Nagad (নগদ Send Money)</option>
                </select>
              </div>

              <div>
                <label htmlFor="senderPhone" className="block text-sm font-bold text-darkGreen mb-1.5">
                  ৪. যে মোবাইল থেকে টাকা পাঠিয়েছেন *
                </label>
                <input
                  id="senderPhone"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-medium text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  required
                />
              </div>
            </div>

            {/* Transaction ID */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="transactionId" className="text-sm font-bold text-darkGreen">
                  ৫. Transaction ID (TrxID) *
                </label>
                <span className="text-[11px] text-textMuted">ফিরতি SMS এ প্রাপ্ত ৮-১০ অক্ষরের কোড</span>
              </div>
              <input
                id="transactionId"
                type="text"
                placeholder="যেমন: BKS728190 বা 9XJ2K8"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 uppercase font-mono font-bold tracking-wider text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                required
              />
            </div>

            {/* Optional Donor Name and Message */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="donorName" className="block text-sm font-bold text-darkGreen mb-1.5">
                  আপনার নাম (ঐচ্ছিক)
                </label>
                <input
                  id="donorName"
                  type="text"
                  placeholder="যেমন: আব্দুল্লাহ"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-bold text-darkGreen mb-1.5">
                  বার্তা বা দোয়া (ঐচ্ছিক)
                </label>
                <input
                  id="message"
                  type="text"
                  placeholder="যেমন: আল্লাহ এই সাদাকা কবুল করুন"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
            </div>

            {/* Anonymous Donation Checkbox */}
            <div className="p-3 rounded-xl bg-surfaceBg border border-gray-200 flex items-center gap-3">
              <input
                id="isAnonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300 cursor-pointer"
              />
              <label htmlFor="isAnonymous" className="text-xs text-textMain cursor-pointer select-none">
                <span className="font-bold text-darkGreen">আমার নাম জনসমক্ষে প্রকাশ করবেন না</span> (Anonymous Donation) — আপনার অনুদান তালিকায় নাম গোপন রাখা হবে।
              </label>
            </div>

            {/* Error and Success Alerts */}
            {errorMsg && (
              <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-sm flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div>{errorMsg}</div>
              </div>
            )}

            {statusMsg && (
              <div role="status" className="p-5 rounded-xl bg-emerald-50 border-2 border-primary text-darkGreen text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-base text-primary">
                  <span>✓</span>
                  <span>{statusMsg}</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  আপনার জমা দেওয়া তথ্য অ্যাডমিন প্যানেলে যাচাই চলছে। অ্যাডমিন ট্রানজেকশন নিশ্চিত করলে তা সরাসরি প্রকল্প ও স্বচ্ছতা তহবিলে প্রদর্শিত হবে।
                </p>
                <div className="pt-2 flex gap-3">
                  <a
                    href="/account"
                    className="inline-block px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-darkGreen transition-colors"
                  >
                    আমার দানের ইতিহাস দেখুন →
                  </a>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-base shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>যাচাইয়ের জন্য পাঠানো হচ্ছে...</span>
              ) : (
                <>
                  <span>দানের তথ্য জমা দিন</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
