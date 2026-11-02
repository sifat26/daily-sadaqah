'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { formatBdt } from '../../lib/format';

interface PublicHelpRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  district: string;
  area: string;
  requiredAmountBdt: number;
  applicantName: string;
  status: string;
}

export default function HelpRequestsPage() {
  const [requests, setRequests] = useState<PublicHelpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    void apiRequest<PublicHelpRequest[]>('/help-requests')
      .then((res) => {
        if (res.success) setRequests(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-darkGreen font-bold text-xs uppercase tracking-wider mb-2">
            যাচাইকৃত আবেদন
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-darkGreen tracking-tight">
            মানবিক সাহায্যের আবেদনসমূহ
          </h1>
          <p className="text-textMuted text-xs sm:text-sm mt-1 max-w-xl">
            অসহায় মানুষদের চিকিৎসা, খাদ্য ও ঘর মেরামত সংক্রান্ত আবেদন মাঠপর্যায়ে যাচাই করে এখানে প্রকাশ করা হয়।
          </p>
        </div>
        <a
          href="/account"
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-sm shadow-xs transition-all shrink-0 self-start md:self-auto"
        >
          + সাহায্যের আবেদন জমা দিন
        </a>
      </div>

      {/* Requests Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-textMuted text-sm">আবেদনসমূহ লোড হচ্ছে...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-2">
          <div className="text-3xl">🤝</div>
          <div className="font-bold text-darkGreen text-base">বর্তমানে কোনো প্রকাশ্য সাহায্য আবেদন নেই</div>
          <p className="text-xs text-textMuted">নতুন আবেদন যাচাই সম্পন্ন হলে এখানে প্রদর্শিত হবে।</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-darkGreen border border-emerald-200">
                    যাচাইকৃত কেস
                  </span>
                  <span className="text-xs text-textMuted font-medium">
                    📍 {r.area}, {r.district}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-darkGreen mb-2 leading-snug">
                  {r.title}
                </h2>
                <div className="text-xs text-textMuted mb-3">
                  আবেদনকারী: <span className="font-semibold text-gray-800">{r.applicantName}</span>
                </div>

                <p className="text-xs text-textMain leading-relaxed mb-5 line-clamp-4">
                  {r.description}
                </p>
              </div>

              <div>
                <div className="p-3 rounded-xl bg-surfaceBg border border-gray-100 flex items-center justify-between mb-4">
                  <span className="text-xs text-textMuted font-medium">প্রয়োজনীয় অর্থ:</span>
                  <span className="font-extrabold text-primary text-base">
                    {formatBdt(r.requiredAmountBdt)}
                  </span>
                </div>

                <a
                  href={`/donate?amount=${r.requiredAmountBdt}`}
                  className="w-full block text-center py-2.5 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-xs shadow-xs transition-all"
                >
                  এই আবেদনে সরাসরি সহায়তা করুন
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
