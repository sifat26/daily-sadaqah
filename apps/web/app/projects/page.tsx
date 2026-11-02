import React from 'react';
import { fetchPublicProjects } from '../../lib/api-client';
import { formatBdt } from '../../lib/format';

export default async function ProjectsPage() {
  const projects = await fetchPublicProjects();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-darkGreen font-bold text-xs uppercase tracking-wider">
          সাদাকা ও অনুদান প্রকল্পসমূহ
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-darkGreen tracking-tight">
          আমাদের চলমান ৯টি স্থায়ী প্রকল্প
        </h1>
        <p className="text-textMuted text-sm leading-relaxed">
          ডেইলি সাদাকা প্ল্যাটফর্মের প্রতিটি খাতের অনুদান সরাসরি মাঠপর্যায়ে অসহায় মানুষদের সেবায় ব্যয় করা হয়। আপনার সামর্থ্য অনুযায়ী যেকোনো খাতে অংশ নিন।
        </p>
      </div>

      {/* Manual Send Money Notice Banner */}
      <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <div className="font-bold text-darkGreen text-sm">
              বিকাশ ও নগদ পার্সোনাল নম্বর: <span className="font-mono text-primary text-base font-extrabold select-all">01681253714</span>
            </div>
            <div className="text-xs text-textMuted">
              যেকোনো প্রকল্পে অনুদানের জন্য Send Money করে প্রাপ্ত TrxID ফর্মের মাধ্যমে জমা দিন।
            </div>
          </div>
        </div>
        <a
          href="/donate"
          className="px-4 py-2 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-xs shadow-xs transition-all"
        >
          সরাসরি দান করুন →
        </a>
      </div>

      {/* Projects Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => {
          const pct = Math.min(
            100,
            Math.round((p.collectedBdt / Math.max(1, p.targetAmountBdt)) * 100)
          );
          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-darkGreen border border-emerald-200">
                    {p.category}
                  </span>
                  <span className="text-xs font-bold text-primary bg-emerald-50/50 px-2 py-0.5 rounded">
                    {pct}% সংগৃহীত
                  </span>
                </div>

                <h2 className="text-xl font-bold text-darkGreen mb-2 leading-snug">{p.name}</h2>
                <p className="text-xs text-textMuted mb-5 leading-relaxed">{p.description}</p>
              </div>

              <div>
                {/* Progress Details */}
                <div className="bg-surfaceBg p-3 rounded-xl border border-gray-100 mb-4">
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-textMain">যাচাইকৃত সংগৃহীত: {formatBdt(p.collectedBdt)}</span>
                    <span className="text-textMuted">লক্ষ্য: {formatBdt(p.targetAmountBdt)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2">
                  <a
                    href={`/projects/${p.slug}`}
                    className="flex-1 text-center py-2.5 rounded-xl border border-primary/40 text-darkGreen font-bold text-xs hover:bg-emerald-50 transition-colors"
                  >
                    বিস্তারিত দেখুন
                  </a>
                  <a
                    href={`/donate?project=${encodeURIComponent(p.id)}`}
                    className="flex-1 text-center py-2.5 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    দান করুন
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
