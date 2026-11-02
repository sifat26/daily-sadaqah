import React from 'react';
import { fetchPublicProjects, fetchTransparencySummary } from '../lib/api-client';
import { formatBdt } from '../lib/format';

export default async function HomePage() {
  const [projects, summary] = await Promise.all([
    fetchPublicProjects(),
    fetchTransparencySummary(),
  ]);

  const totalDonated = summary?.totalVerifiedDonationsBdt ?? 0;
  const totalExpenses = summary?.totalApprovedExpensesBdt ?? 0;
  const remaining = summary?.remainingBalanceBdt ?? 0;

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Banner Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-surfaceBg border-b border-emerald-900/10 py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-darkGreen font-bold text-xs uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span>Small Daily Giving. Lasting Impact.</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-darkGreen leading-[1.2] tracking-tight">
              প্রতিদিনের ছোট্ট দান, <br className="hidden sm:inline" />
              কারও জীবনে <span className="text-primary underline decoration-gold/60 decoration-wavy">বড় পরিবর্তন</span>।
            </h1>

            <p className="text-base sm:text-lg text-textMuted leading-relaxed max-w-xl">
              বাংলাদেশের সাধারণ মানুষের জন্য সহজ, সম্পূর্ণ স্বচ্ছ ও ১০০% প্রমাণযোগ্য চ্যারিটি প্ল্যাটফর্ম। প্রতিদিন অল্প অল্প করে সাদাকা করুন এবং প্রতিটি পয়সার প্রকৃত ব্যয় দেখুন।
            </p>

            {/* Quick Send Money Pill Banner */}
            <div className="p-3 rounded-xl bg-white border border-emerald-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 max-w-xl">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-1">
                  <span className="w-6 h-6 rounded-full bg-[#E2136E] text-white flex items-center justify-center font-bold text-[10px]">bK</span>
                  <span className="w-6 h-6 rounded-full bg-[#F7941D] text-white flex items-center justify-center font-bold text-[10px]">ন</span>
                </div>
                <div className="text-xs">
                  <span className="text-textMuted block text-[10px]">বিকাশ ও নগদ পার্সোনাল নম্বর:</span>
                  <span className="font-mono font-bold text-darkGreen text-sm select-all">01681253714</span>
                </div>
              </div>
              <a
                href="/donate"
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100/80 text-darkGreen font-bold hover:bg-emerald-200 transition-colors"
              >
                Send Money করুন →
              </a>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="/donate"
                className="px-6 py-3 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-base shadow-sm hover:shadow transition-all flex items-center gap-2"
              >
                <span>এখনই দান করুন</span>
                <span>৳</span>
              </a>
              <a
                href="/projects"
                className="px-5 py-3 rounded-xl bg-white border border-gray-300 hover:border-primary text-darkGreen font-bold text-base transition-colors"
              >
                প্রকল্পসমূহ দেখুন
              </a>
              <a
                href="/transparency"
                className="px-4 py-3 text-primary font-semibold text-sm hover:underline"
              >
                হিসাবের স্বচ্ছতা →
              </a>
            </div>
          </div>

          {/* Hero Banner Image */}
          <div className="md:col-span-5">
            <div className="relative rounded-2xl overflow-hidden border-2 border-gold/40 shadow-lg bg-white group">
              <img
                src="/assets/banner.jpg"
                alt="ডেইলি সাদাকা ব্যানার"
                className="w-full h-auto object-cover max-h-[380px] group-hover:scale-102 transition-transform duration-300"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 text-white">
                <span className="text-xs bg-gold text-darkGreen px-2 py-0.5 rounded font-bold">যাচাইকৃত উদ্যোগ</span>
                <p className="text-sm font-semibold mt-1">
                  &ldquo;দান মানুষের বিপদ দূর করে এবং অন্তরে প্রশান্তি এনে দেয়।&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Live Financial Transparency Summary */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-primary bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            রিয়েল-টাইম অডিট রিপোর্ট
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-darkGreen mt-2 tracking-tight">
            দানের সম্পূর্ণ স্বচ্ছ হিসাব (যাচাইকৃত)
          </h2>
          <p className="text-textMuted text-xs sm:text-sm mt-1">
            কোনো অনুমান বা আনুমানিক তথ্য নয়। শুধুমাত্র অ্যাডমিন কর্তৃক যাচাইকৃত (VERIFIED) অনুদান ও অনুমোদিত ভাউচার খরচ এখানে দেখানো হয়।
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {/* Total Verified Donations */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs border-t-4 border-t-primary relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">মোট যাচাইকৃত দান</span>
              <span className="text-xl">🤲</span>
            </div>
            <div className="text-3xl font-extrabold text-darkGreen tracking-tight">
              {formatBdt(totalDonated)}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-2 flex items-center gap-1">
              <span>✓</span>
              <span>সকল যাচাইকৃত দাতার মোট অনুদান</span>
            </p>
          </div>

          {/* Total Approved Expenses */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs border-t-4 border-t-gold relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">মোট অনুমোদিত খরচ</span>
              <span className="text-xl">📋</span>
            </div>
            <div className="text-3xl font-extrabold text-darkGreen tracking-tight">
              {formatBdt(totalExpenses)}
            </div>
            <p className="text-[11px] text-amber-800 font-medium mt-2 flex items-center gap-1">
              <span>✓</span>
              <span>রসিদ ও ভাউচারসহ মাঠপর্যায়ে ব্যয়</span>
            </p>
          </div>

          {/* Remaining Balance */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs border-t-4 border-t-emerald-600 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">বর্তমান অবশিষ্ট তহবিল</span>
              <span className="text-xl">💰</span>
            </div>
            <div className="text-3xl font-extrabold text-primary tracking-tight">
              {formatBdt(remaining)}
            </div>
            <p className="text-[11px] text-textMuted mt-2 flex items-center gap-1">
              <span>=</span>
              <span>সংগৃহীত তহবিল − মোট ব্যয়</span>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a
            href="/transparency"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-darkGreen bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200/60 hover:border-primary transition-all"
          >
            <span>প্রকল্পভিত্তিক ব্যয়ের সম্পূর্ণ ভাউচার ও অডিট দেখুন</span>
            <span>→</span>
          </a>
        </div>
      </section>

      {/* 3. Donation Projects Grid */}
      <section className="bg-white border-y border-gray-200/80 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                আমাদের ৯টি মূল খাত
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-darkGreen mt-2 tracking-tight">
                চলমান কল্যাণমূলক প্রকল্পসমূহ
              </h2>
              <p className="text-textMuted text-xs sm:text-sm mt-1">
                আপনার পছন্দের যে কোনো খাতে সরাসরি অনুদান দিয়ে অসহায় মানুষের পাশে দাঁড়ান।
              </p>
            </div>
            <a
              href="/projects"
              className="text-xs font-bold text-primary hover:underline shrink-0"
            >
              সকল প্রকল্প ব্রাউজ করুন →
            </a>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => {
              const pct = Math.min(
                100,
                Math.round((p.collectedBdt / Math.max(1, p.targetAmountBdt)) * 100)
              );
              return (
                <div
                  key={p.id}
                  className="bg-surfaceBg rounded-2xl border border-gray-200 p-5 flex flex-col hover:border-primary/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-darkGreen">
                      {p.category}
                    </span>
                    <span className="text-xs font-bold text-primary">{pct}% পূর্ণ</span>
                  </div>

                  <h3 className="text-lg font-bold text-darkGreen mb-1.5">{p.name}</h3>
                  <p className="text-xs text-textMuted mb-4 flex-1 line-clamp-3 leading-relaxed">
                    {p.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-4 bg-white p-3 rounded-xl border border-gray-100">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-textMain">সংগৃহীত: {formatBdt(p.collectedBdt)}</span>
                      <span className="text-textMuted">লক্ষ্য: {formatBdt(p.targetAmountBdt)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={`/projects/${p.slug}`}
                      className="flex-1 text-center py-2 rounded-xl border border-primary/40 text-darkGreen font-bold text-xs hover:bg-emerald-50 transition-colors"
                    >
                      বিস্তারিত
                    </a>
                    <a
                      href={`/donate?project=${encodeURIComponent(p.id)}`}
                      className="flex-1 text-center py-2 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-xs transition-colors"
                    >
                      দান করুন
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Daily Sadaqah Habit Section */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-r from-emerald-900 to-darkGreen text-white p-6 sm:p-10 rounded-3xl border-2 border-gold/60 shadow-md relative overflow-hidden">
          <div className="max-w-xl space-y-4">
            <span className="inline-block bg-gold text-darkGreen font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              দৈনিক সাদাকা রিমাইন্ডার
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              প্রতিদিন এক কাপ চায়ের খরচে <br className="hidden sm:inline" />
              কারও মুখে হাসি ফোটান
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              ৳৫, ৳১০, ৳২০ বা ৳৫০ নির্ধারণ করে প্রতিদিন সাদাকার অভ্যাস গড়ে তুলুন। কোনো ব্যাংক একাউন্ট বা অটোমেটিক টাকা কাটা হয় না — এটি সম্পূর্ণ স্বেচ্ছাসেবী ও সচেতন দানের জন্য।
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href="/account"
                className="px-6 py-2.5 rounded-xl bg-gold hover:bg-yellow-400 text-darkGreen font-extrabold text-sm shadow-sm transition-all"
              >
                দৈনিক সাদাকা সেটিংস সেট করুন →
              </a>
              <a
                href="/donate"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
              >
                এখনই দান করুন
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Community Welfare Links: Blood Donors & Help Requests */}
      <section className="max-w-6xl mx-auto px-4 grid sm:grid-cols-2 gap-6">
        {/* Blood Donors Teaser */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xl mb-3">
              🩸
            </div>
            <h3 className="text-xl font-bold text-darkGreen mb-1.5">
              স্বেচ্ছাসেবী রক্তদাতা নেটওয়ার্ক
            </h3>
            <p className="text-xs sm:text-sm text-textMuted leading-relaxed mb-4">
              টাঙ্গাইল, ঢাকা, চট্টগ্রাম, সিলেটসহ সারাদেশে রক্তের গ্রুপ ও জেলা অনুযায়ী জরুরি রক্তদাতা খুঁজুন। আপনিও রক্তদাতা হিসেবে নিবন্ধন করতে পারেন।
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <a
              href="/blood-donors"
              className="text-xs font-bold text-primary hover:text-darkGreen flex items-center gap-1"
            >
              <span>রক্তদাতা তালিকা দেখুন</span>
              <span>→</span>
            </a>
            <span className="text-gray-300">|</span>
            <a
              href="/account"
              className="text-xs font-medium text-textMuted hover:text-darkGreen"
            >
              নিবন্ধন করুন
            </a>
          </div>
        </div>

        {/* Community Help Requests Teaser */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-primary flex items-center justify-center font-bold text-xl mb-3">
              🤝
            </div>
            <h3 className="text-xl font-bold text-darkGreen mb-1.5">
              যাচাইকৃত মানবিক সাহায্য আবেদন
            </h3>
            <p className="text-xs sm:text-sm text-textMuted leading-relaxed mb-4">
              অসহায় পরিবারের জরুরি চিকিৎসা, ঘর মেরামত বা শিক্ষা সহায়তা আবেদনসমূহ সরাসরি মাঠপর্যায়ে যাচাই করে ওয়েবসাইটে প্রকাশ করা হয়।
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <a
              href="/help-requests"
              className="text-xs font-bold text-primary hover:text-darkGreen flex items-center gap-1"
            >
              <span>সাহায্যের আবেদনসমূহ দেখুন</span>
              <span>→</span>
            </a>
            <span className="text-gray-300">|</span>
            <a
              href="/account"
              className="text-xs font-medium text-textMuted hover:text-darkGreen"
            >
              আবেদন জমা দিন
            </a>
          </div>
        </div>
      </section>

      {/* 6. Quranic Ayah & Hadith Inspiration */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-gold/50 shadow-xs text-center space-y-3">
          <span className="text-2xl">✨</span>
          <blockquote className="text-base sm:text-lg font-bold text-darkGreen leading-relaxed max-w-2xl mx-auto">
            &ldquo;যারা রাতে ও দিনে, গোপনে ও প্রকাশ্যে আল্লাহর পথে ব্যয় করে, তাদের জন্য তাদের রবের কাছে প্রতিদান রয়েছে; তাদের কোনো ভয় নেই এবং তারা দুঃখিতও হবে না।&rdquo;
          </blockquote>
          <div className="text-xs font-semibold text-gold">
            — পবিত্র কুরআন, সূরা আল-বাকারা: ২৭৪
          </div>
        </div>
      </section>
    </div>
  );
}
