'use client';

import React, { useState } from 'react';
import { apiRequest } from '../../lib/api-client';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ phone: string; devOtp?: string }>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setDevOtpHint(res.data.devOtp || null);
      setStep('OTP');
    } catch {
      setError('সার্ভারে যোগাযোগ করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ user: { id: string; role: string } }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim(), name: name.trim() }),
      });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      window.location.href = res.data.user.role === 'ADMIN' ? '/admin' : '/account';
    } catch {
      setError('OTP যাচাই করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white p-7 sm:p-9 rounded-3xl border border-gray-200/90 shadow-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-darkGreen mx-auto flex items-center justify-center font-bold text-xl mb-3 border border-emerald-200/60">
            🔐
          </div>
          <h1 className="text-2xl font-extrabold text-darkGreen tracking-tight">
            মোবাইল নম্বর দিয়ে লগইন
          </h1>
          <p className="text-xs text-textMuted mt-1">
            পাসওয়ার্ড ছাড়াই আপনার মোবাইল নম্বরে পাঠানো ৬ সংখ্যার OTP দিয়ে নিরাপদে প্রবেশ করুন।
          </p>
        </div>

        {step === 'PHONE' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="loginPhone" className="block text-xs font-bold text-darkGreen mb-1.5">
                আপনার মোবাইল নম্বর *
              </label>
              <input
                id="loginPhone"
                type="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-medium text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                required
              />
              <span className="text-[11px] text-textMuted block mt-1">
                যেমন: 01700000001 (অ্যাডমিন) অথবা 01681253714 (ব্যবহারকারী)
              </span>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-sm shadow-xs transition-all disabled:opacity-60"
            >
              {isLoading ? 'কোড পাঠানো হচ্ছে...' : 'OTP কোড পাঠান →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {devOtpHint && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-gold/60 text-xs text-darkGreen space-y-1">
                <div className="font-bold">লোকাল টেস্ট OTP প্রিভিউ:</div>
                <div className="font-mono text-base font-extrabold text-primary tracking-widest">{devOtpHint}</div>
                <div className="text-[10px] text-textMuted">(টেস্টিংয়ের সুবিধার জন্য কোডটি স্ক্রিনে দেখানো হচ্ছে)</div>
              </div>
            )}

            <div>
              <label htmlFor="otpInput" className="block text-xs font-bold text-darkGreen mb-1.5">
                ৬ সংখ্যার OTP কোড লিখুন *
              </label>
              <input
                id="otpInput"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-mono text-center tracking-widest text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                required
              />
            </div>

            <div>
              <label htmlFor="userNameInput" className="block text-xs font-bold text-darkGreen mb-1.5">
                আপনার নাম (ঐচ্ছিক)
              </label>
              <input
                id="userNameInput"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: আব্দুল্লাহ"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-darkGreen text-white font-bold text-sm shadow-xs transition-all disabled:opacity-60"
            >
              {isLoading ? 'যাচাই করা হচ্ছে...' : 'যাচাই ও প্রবেশ করুন →'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('PHONE');
                setError(null);
              }}
              className="w-full text-center text-xs text-textMuted hover:text-darkGreen pt-1 font-semibold"
            >
              ← মোবাইল নম্বর পরিবর্তন করুন
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
