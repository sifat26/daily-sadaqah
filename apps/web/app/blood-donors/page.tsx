'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';

interface PublicDonor {
  id: string;
  displayName: string;
  bloodGroup: string;
  district: string;
  area: string;
  contactPhone: string | null;
  maskedPhone: string;
  publicPhoneConsent: boolean;
  estimatedNextDate: string | null;
  isAvailable: boolean;
  medicalDisclaimer: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodDonorsPage() {
  const [donors, setDonors] = useState<PublicDonor[]>([]);
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');
  const [area, setArea] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function loadDonors() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (bloodGroup) params.set('bloodGroup', bloodGroup);
      if (district) params.set('district', district);
      if (area) params.set('area', area);
      const res = await apiRequest<PublicDonor[]>(`/blood-donors?${params.toString()}`);
      if (res.success) setDonors(res.data);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDonors();
  }, [bloodGroup, district, area]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 font-bold text-xs uppercase tracking-wider mb-2">
            জরুরি সেবা
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-darkGreen tracking-tight">
            স্বেচ্ছাসেবী রক্তদাতা নেটওয়ার্ক
          </h1>
          <p className="text-textMuted text-xs sm:text-sm mt-1 max-w-xl">
            জরুরি প্রয়োজনে রক্তের গ্রুপ ও জেলা অনুযায়ী রক্তদাতা খুঁজুন। রক্তদাতার স্পষ্ট অনুমতি ছাড়া ফোন নম্বর প্রকাশ করা হয় না।
          </p>
        </div>
        <a
          href="/account"
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-sm shadow-xs transition-all shrink-0 self-start md:self-auto"
        >
          + নিজে রক্তদাতা হিসেবে যুক্ত হন
        </a>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
        {/* Quick Blood Group Filter Pills */}
        <div>
          <label className="block text-xs font-bold text-darkGreen uppercase tracking-wider mb-2">
            রক্তের গ্রুপ দিয়ে ফিল্টার করুন:
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBloodGroup('')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                bloodGroup === ''
                  ? 'bg-darkGreen text-white shadow-xs'
                  : 'bg-surfaceBg text-darkGreen border border-gray-200 hover:border-primary'
              }`}
            >
              সকল গ্রুপ
            </button>
            {BLOOD_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setBloodGroup(g === bloodGroup ? '' : g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  bloodGroup === g
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-surfaceBg text-red-700 border border-gray-200 hover:border-red-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* District and Area inputs */}
        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label htmlFor="districtInput" className="block text-xs font-bold text-darkGreen mb-1">
              জেলা খুঁজুন:
            </label>
            <input
              id="districtInput"
              type="text"
              placeholder="যেমন: ঢাকা, টাঙ্গাইল, চট্টগ্রাম, সিলেট"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="areaInput" className="block text-xs font-bold text-darkGreen mb-1">
              উপজেলা / এলাকা:
            </label>
            <input
              id="areaInput"
              type="text"
              placeholder="যেমন: মিরপুর, সদর, আগ্রাবাদ, জিন্দাবাজার"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Donors Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-textMuted text-sm">তথ্য লোড হচ্ছে...</div>
      ) : donors.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-2">
          <div className="text-3xl">🩸</div>
          <div className="font-bold text-darkGreen text-base">এই ফিল্টারে কোনো রক্তদাতা পাওয়া যায়নি</div>
          <p className="text-xs text-textMuted">অনুগ্রহ করে ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {donors.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-red-300 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-600 text-white font-extrabold flex items-center justify-center text-lg shadow-xs shrink-0">
                    {d.bloodGroup}
                  </div>
                  <div>
                    <h2 className="font-bold text-darkGreen text-base leading-tight">
                      {d.displayName}
                    </h2>
                    <span className="text-xs text-textMuted block mt-0.5">
                      📍 {d.area}, {d.district}
                    </span>
                  </div>
                </div>

                <div className="bg-surfaceBg p-3 rounded-xl border border-gray-100 space-y-2 mb-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-textMuted">স্ট্যাটাস:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ● রক্তদানে প্রস্তুত
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-textMuted">যোগাযোগ:</span>
                    {d.publicPhoneConsent && d.contactPhone ? (
                      <a
                        href={`tel:${d.contactPhone}`}
                        className="font-mono font-bold text-primary hover:underline"
                      >
                        📞 {d.contactPhone}
                      </a>
                    ) : (
                      <span className="font-mono text-gray-500">
                        {d.maskedPhone} (গোপন)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-textMuted italic mb-3">
                  {d.medicalDisclaimer}
                </p>
                {d.publicPhoneConsent && d.contactPhone ? (
                  <a
                    href={`tel:${d.contactPhone}`}
                    className="w-full block text-center py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    সরাসরি কল করুন
                  </a>
                ) : (
                  <div className="w-full text-center py-2 rounded-xl bg-gray-100 text-gray-600 font-semibold text-xs border border-gray-200">
                    জরুরি নম্বরের জন্য অ্যাডমিনে নক দিন
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
