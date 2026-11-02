import React from 'react';
import { fetchProjectBySlug } from '../../../lib/api-client';
import { formatBdt } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = await fetchProjectBySlug(params.slug);

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">🔍</div>
        <h1 className="text-2xl font-bold text-darkGreen">প্রকল্পটি খুঁজে পাওয়া যায়নি</h1>
        <p className="text-textMuted text-sm">
          আপনি যে প্রকল্পটির সন্ধান করছেন তা সরানো হয়েছে অথবা লিংকটি সঠিক নয়।
        </p>
        <a
          href="/projects"
          className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm"
        >
          সকল প্রকল্পসমূহ দেখুন →
        </a>
      </div>
    );
  }

  const pct = Math.min(
    100,
    Math.round((project.collectedBdt / Math.max(1, project.targetAmountBdt)) * 100)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <a
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-darkGreen transition-colors"
      >
        <span>←</span>
        <span>সকল প্রকল্পে ফিরে যান</span>
      </a>

      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 md:p-8 shadow-sm space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-darkGreen border border-emerald-200">
              {project.category}
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-primary">
              স্ট্যাটাস: চলমান
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-darkGreen tracking-tight mb-3">
            {project.name}
          </h1>
          <p className="text-textMain text-sm sm:text-base leading-relaxed">
            {project.description}
          </p>
        </div>

        {/* Progress & Quick Donation Card */}
        <div className="bg-surfaceBg rounded-2xl p-5 sm:p-6 border border-emerald-900/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs text-textMuted block">যাচাইকৃত সংগৃহীত অনুদান</span>
              <span className="text-2xl font-extrabold text-darkGreen">{formatBdt(project.collectedBdt)}</span>
            </div>
            <div className="sm:text-right">
              <span className="text-xs text-textMuted block">প্রকল্পের লক্ষ্যমাত্রা</span>
              <span className="text-lg font-bold text-gray-700">{formatBdt(project.targetAmountBdt)}</span>
            </div>
          </div>

          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <span className="text-xs font-bold text-primary bg-white px-3 py-1 rounded-lg border border-gray-200">
              লক্ষ্যের {pct}% সম্পন্ন হয়েছে
            </span>
            <a
              href={`/donate?project=${encodeURIComponent(project.id)}`}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-sm shadow-sm transition-all"
            >
              এই প্রকল্পে সরাসরি দান করুন →
            </a>
          </div>
        </div>

        {/* Manual Payment Instruction Box */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 text-xs text-textMuted flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <span className="font-bold text-darkGreen block text-sm">ম্যানুয়াল বিকাশ ও নগদ নম্বর: 01681253714</span>
            ব্যক্তিগত বিকাশ বা নগদ অ্যাপ থেকে Send Money করার পর ট্রানজেকশন আইডি (TrxID) দিয়ে সাবমিট করলে অ্যাডমিন যাচাই শেষে এই প্রকল্পের তহবিলে যুক্ত করবে।
          </div>
        </div>

        {/* Field Updates */}
        <div className="pt-4 border-t border-gray-100">
          <h2 className="text-lg font-bold text-darkGreen mb-4 flex items-center gap-2">
            <span>📢</span>
            <span>মাঠ পর্যায়ের সাম্প্রতিক আপডেট ও অগ্রগতি</span>
          </h2>

          {project.updates && project.updates.length > 0 ? (
            <div className="space-y-3">
              {project.updates.map((u) => (
                <div key={u.id} className="p-4 rounded-xl border border-gray-200 bg-surfaceBg space-y-1">
                  <div className="font-bold text-darkGreen text-sm">{u.title}</div>
                  <p className="text-xs text-textMuted leading-relaxed">{u.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-textMuted bg-gray-50 p-4 rounded-xl text-center">
              এখনো কোনো নতুন আপডেট প্রকাশিত হয়নি। মাঠপর্যায়ে কার্যক্রম শুরু হলে বিস্তারিত আপডেট দেওয়া হবে।
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
