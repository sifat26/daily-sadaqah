import React from 'react';
import './globals.css';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

export const metadata = {
  title: 'ডেইলি সাদাকা (Daily Sadaqah) — প্রতিদিনের ছোট্ট দান, কারও জীবনে বড় পরিবর্তন',
  description:
    'বাংলাদেশের সাধারণ মানুষের জন্য সহজ, স্বচ্ছ ও নিরাপদ ইসলামিক চ্যারিটি এবং মানবিক সহায়তা প্ল্যাটফর্ম।',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-surfaceBg text-textMain">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
