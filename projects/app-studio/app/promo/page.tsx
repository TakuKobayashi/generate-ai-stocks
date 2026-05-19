'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import styles from './promo.module.css';

export default function PromoPage() {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'ViewContent', {
        content_name: 'Promo Page',
        content_category: 'Landing Page',
      });
    }
  }, []);

  const handleDownloadClick = (appName: string) => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: appName,
        value: 1.0,
        currency: 'USD',
      });
    }
  };

  const apps = [
    { name: 'Color Blast', icon: '🎨', desc: 'Addictive puzzle game' },
    { name: 'Music Wave', icon: '🎵', desc: 'Unlimited music streaming' },
    { name: 'Fit Journey', icon: '💪', desc: 'Personal fitness coach' },
    { name: 'Brain Quest', icon: '🧠', desc: 'Daily brain training' },
    { name: 'Photo Magic', icon: '📸', desc: 'Pro photo editing' },
    { name: 'Recipe Box', icon: '🍳', desc: '1000+ recipes' },
  ];

  return (
    <div className={styles.promo}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎮</span>
            <span className={styles.logoText}>PIXEL STUDIO</span>
          </div>
        </motion.div>

        <motion.div
          className={styles.hero}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.span
            className={styles.badge}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className={styles.badgeIcon}>🎉</span>
            Special Offer
          </motion.span>
          <h1 className={styles.title}>
            Get Our <span className={styles.highlight}>Premium Apps</span>
            <br />
            Free for Limited Time!
          </h1>
          <p className={styles.subtitle}>
            Join millions of happy users enjoying our amazing collection of
            apps. Download now and discover what everyone is talking about! 🚀
          </p>

          <div className={styles.cta}>
            <motion.button
              className={styles.ctaButton}
              onClick={() => handleDownloadClick('All Apps Bundle')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span>Download Now - It&apos;s Free!</span>
              <span className={styles.arrow}>→</span>
            </motion.button>
            <p className={styles.trust}>⭐ Rated 4.8/5 by 10M+ users</p>
          </div>
        </motion.div>

        <motion.div
          className={styles.apps}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className={styles.appsTitle}>What You&apos;ll Get:</h2>
          <div className={styles.appGrid}>
            {apps.map((app, index) => (
              <motion.div
                key={app.name}
                className={styles.appCard}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ x: 10, scale: 1.02 }}
              >
                <div className={styles.appIcon}>{app.icon}</div>
                <div className={styles.appInfo}>
                  <h3 className={styles.appName}>{app.name}</h3>
                  <p className={styles.appDesc}>{app.desc}</p>
                </div>
                <motion.button
                  className={styles.miniButton}
                  onClick={() => handleDownloadClick(app.name)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  Get
                </motion.button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className={styles.features}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          {[
            {
              title: '100% Free',
              text: 'No hidden costs or subscriptions',
            },
            { title: 'No Ads', text: 'Enjoy uninterrupted experience' },
            {
              title: 'Regular Updates',
              text: 'New features added weekly',
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              className={styles.feature}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + index * 0.1 }}
            >
              <div className={styles.featureIcon}>✓</div>
              <div className={styles.featureText}>
                <strong>{feature.title}</strong>
                <span>{feature.text}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className={styles.finalCta}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <h2 className={styles.finalTitle}>
            Don&apos;t Miss Out on This Exclusive Offer!
          </h2>
          <motion.button
            className={styles.finalButton}
            onClick={() => handleDownloadClick('Final CTA')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>Claim Your Free Apps Now</span>
            <span className={styles.arrow}>→</span>
          </motion.button>
          <motion.p
            className={styles.urgency}
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ⏰ Limited time offer - Download before it expires!
          </motion.p>
        </motion.div>

        <footer className={styles.footer}>
          <p>© 2026 Pixel Studio. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
