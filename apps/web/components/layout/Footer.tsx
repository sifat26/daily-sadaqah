import React from 'react';

export function Footer() {
  return (
    <footer className="bg-darkGreen text-white pt-12 pb-8 mt-16 border-t-4 border-gold">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-emerald-800/80">
          {/* Column 1: Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-3">
              <img
                src="/assets/logo.png"
                alt="ডেইলি সাদাকা লোগো"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg bg-white p-0.5 object-contain"
              />
              <span className="font-bold text-lg text-white tracking-tight">ডেইলি সাদাকা</span>
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed">
              বাংলাদেশের সাধারণ মানুষের জন্য সহজ, স্বচ্ছ ও নিরাপদ ইসলামিক চ্যারিটি ও মানবিক কল্যাণ প্ল্যাটফর্ম।
            </p>
            <p className="text-[11px] text-gold font-medium">
              &ldquo;প্রতিদিনের ছোট্ট দান, কারও জীবনে বড় পরিবর্তন।&rdquo;
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-bold text-sm text-gold mb-3 uppercase tracking-wider">দ্রুত লিংক</h4>
            <ul className="space-y-2 text-xs text-emerald-100">
              <li>
                <a href="/projects" className="hover:text-gold transition-colors">
                  চলমান প্রকল্পসমূহ
                </a>
              </li>
              <li>
                <a href="/transparency" className="hover:text-gold transition-colors">
                  আর্থিক স্বচ্ছতা ও অডিট হিসাব
                </a>
              </li>
              <li>
                <a href="/blood-donors" className="hover:text-gold transition-colors">
                  রক্তদাতা নেটওয়ার্ক
                </a>
              </li>
              <li>
                <a href="/help-requests" className="hover:text-gold transition-colors">
                  জরুরি সাহায্যের আবেদন
                </a>
              </li>
              <li>
                <a href="/account" className="hover:text-gold transition-colors">
                  আমার অ্যাকাউন্ট ও দৈনিক সাদাকা
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Verified Manual Payment Details */}
          <div>
            <h4 className="font-bold text-sm text-gold mb-3 uppercase tracking-wider">
              অনুদানের অফিসিয়াল নম্বর
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="bg-emerald-900/60 p-2.5 rounded-lg border border-emerald-700/60">
                <div className="text-[11px] text-pink-300 font-semibold flex items-center justify-between">
                  <span>বিকাশ পার্সোনাল (Send Money)</span>
                  <span className="text-[10px] bg-pink-950/80 text-pink-200 px-1.5 py-0.5 rounded">bKash</span>
                </div>
                <div className="font-mono text-sm font-bold text-white mt-0.5 select-all">
                  01681253714
                </div>
              </div>

              <div className="bg-emerald-900/60 p-2.5 rounded-lg border border-emerald-700/60">
                <div className="text-[11px] text-amber-300 font-semibold flex items-center justify-between">
                  <span>নগদ পার্সোনাল (Send Money)</span>
                  <span className="text-[10px] bg-amber-950/80 text-amber-200 px-1.5 py-0.5 rounded">Nagad</span>
                </div>
                <div className="font-mono text-sm font-bold text-white mt-0.5 select-all">
                  01681253714
                </div>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-normal">
                * সেন্ড মানি শেষে ফিরতি SMS-এর TrxID জমা দিন।
              </p>
            </div>
          </div>

          {/* Column 4: Trust & Transparency Guarantee */}
          <div>
            <h4 className="font-bold text-sm text-gold mb-3 uppercase tracking-wider">আমাদের অঙ্গীকার</h4>
            <ul className="space-y-2 text-xs text-emerald-100">
              <li className="flex items-start gap-2">
                <span className="text-gold font-bold">✓</span>
                <span>১০০% ম্যানুয়াল ভেরিফিকেশন ও স্বচ্ছ হিসাব</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold font-bold">✓</span>
                <span>প্রমাণ্য ভাউচার সহ খরচের হিসাব উন্মুক্ত</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold font-bold">✓</span>
                <span>কোনো গোপন বা অটোমেটিক চার্জ নেই</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold font-bold">✓</span>
                <span>দাতা ও গ্রহীতার ব্যক্তিগত তথ্যের সর্বোচ্চ নিরাপত্তা</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-200/90 text-center sm:text-left">
          <div>
            © ২০২৬ ডেইলি সাদাকা (Daily Sadaqah) — সর্বস্বত্ব সংরক্ষিত।
          </div>
          <div className="text-[11px] text-emerald-300">
            স্বচ্ছতা নিশ্চয়তা: সকল আর্থিক হিসাব যাচাইকৃত রেকর্ড ও অনুমোদিত ভাউচারের ভিত্তিতে সরাসরি প্রদর্শিত।
          </div>
        </div>
      </div>
    </footer>
  );
}
