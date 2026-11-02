'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';

export interface NavbarProps {
  currentPath?: string;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}

export function Navbar({
  currentPath = '/',
  isAuthenticated: initialAuth = false,
  isAdmin: initialAdmin = false,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(initialAuth);
  const [isAdminUser, setIsAdminUser] = useState(initialAdmin);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ user: { id: string; phone: string; name?: string; role: string } }>('/auth/me')
      .then((res) => {
        if (res.success && res.data?.user) {
          setIsAuth(true);
          setIsAdminUser(res.data.user.role === 'ADMIN' || res.data.user.role === 'MODERATOR');
          setUserName(res.data.user.name || res.data.user.phone);
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    setIsAuth(false);
    setIsAdminUser(false);
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }

  const navItems = [
    { href: '/', label: 'হোম' },
    { href: '/projects', label: 'প্রকল্পসমূহ' },
    { href: '/transparency', label: 'দানের হিসাব' },
    { href: '/blood-donors', label: 'রক্তদাতা' },
    { href: '/help-requests', label: 'সাহায্যের আবেদন' },
    { href: '/account', label: 'আমার অ্যাকাউন্ট' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-900/10 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <img
            src="/assets/logo.png"
            alt="ডেইলি সাদাকা লোগো"
            width={46}
            height={46}
            className="w-11 h-11 rounded-xl border border-emerald-200/60 object-contain shrink-0 p-0.5 bg-white shadow-xs group-hover:scale-105 transition-transform"
          />
          <div>
            <span className="block font-bold text-lg md:text-xl text-darkGreen leading-tight tracking-tight">
              ডেইলি সাদাকা
            </span>
            <span className="block text-[11px] text-textMuted font-normal leading-none mt-0.5">
              প্রতিদিনের ছোট্ট দান, কারও জীবনে বড় পরিবর্তন
            </span>
          </div>
        </a>

        {/* Mobile menu hamburger button */}
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মোবাইল মেনু খুলুন'}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 text-darkGreen hover:bg-emerald-50 focus:outline-none"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="প্রধান নেভিগেশন">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold shadow-xs'
                    : 'text-textMain hover:text-primary hover:bg-emerald-50/60'
                }`}
              >
                {item.label}
              </a>
            );
          })}
          {isAdminUser && (
            <a
              href="/admin"
              className="px-3 py-1.5 rounded-lg font-semibold text-xs text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200 transition-colors"
            >
              ★ অ্যাডমিন
            </a>
          )}
        </nav>

        {/* Desktop Auth & Donate Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          {isAuth ? (
            <div className="flex items-center gap-2">
              <a
                href="/account"
                className="text-xs px-3 py-1.5 rounded-lg bg-surfaceBg border border-gray-200 text-darkGreen font-semibold max-w-[130px] truncate hover:border-primary"
                title={userName || 'ব্যবহারকারী'}
              >
                👤 {userName || 'অ্যাকাউন্ট'}
              </a>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition-colors"
              >
                লগআউট
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="px-3.5 py-1.5 rounded-lg border border-primary/40 text-darkGreen font-semibold text-sm hover:bg-emerald-50 transition-colors"
            >
              লগইন
            </a>
          )}
          <a
            href="/donate"
            className="px-4 py-2 rounded-lg bg-primary hover:bg-darkGreen text-white font-bold text-sm shadow-sm hover:shadow transition-all inline-flex items-center gap-1.5"
          >
            <span>দান করুন</span>
            <span className="text-xs bg-white/20 px-1 rounded">৳</span>
          </a>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-1 shadow-lg animate-fadeIn">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg font-semibold text-sm ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-textMain hover:bg-surfaceBg'
                }`}
              >
                {item.label}
              </a>
            );
          })}
          {isAdminUser && (
            <a
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg font-semibold text-sm text-amber-900 bg-amber-50 border border-amber-200"
            >
              ★ অ্যাডমিন প্যানেল
            </a>
          )}
          <div className="pt-3 border-t border-gray-200 flex gap-2">
            {isAuth ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
                className="flex-1 text-center py-2 rounded-lg border border-red-300 text-red-600 font-semibold text-sm"
              >
                লগআউট
              </button>
            ) : (
              <a
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-lg border border-primary text-darkGreen font-semibold text-sm"
              >
                লগইন
              </a>
            )}
            <a
              href="/donate"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 rounded-lg bg-primary text-white font-bold text-sm"
            >
              দান করুন
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
