'use client';

import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Apps from '@/components/Apps';
import About from '@/components/About';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Apps />
        <About />
      </main>
      <Footer />
    </>
  );
}
