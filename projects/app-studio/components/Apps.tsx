'use client';

import { motion } from 'framer-motion';
import styles from './Apps.module.css';

interface App {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  icon: string;
  gradient: string;
  downloads: string;
  rating: string;
}

const apps: App[] = [
  {
    id: '1',
    name: 'Color Blast',
    tagline: 'Match & Crush',
    description:
      'An addictive puzzle game with vibrant colors and exciting power-ups!',
    category: 'Game',
    icon: '🎨',
    gradient: 'linear-gradient(135deg, #00d9ff, #ab47bc)',
    downloads: '5M+',
    rating: '4.9',
  },
  {
    id: '2',
    name: 'Music Wave',
    tagline: 'Your Soundtrack',
    description: 'Discover, create, and share playlists with millions of songs.',
    category: 'Music',
    icon: '🎵',
    gradient: 'linear-gradient(135deg, #00ff88, #00d9ff)',
    downloads: '3M+',
    rating: '4.8',
  },
  {
    id: '3',
    name: 'Fit Journey',
    tagline: 'Get Healthy',
    description: 'Track workouts, set goals, and achieve your fitness dreams.',
    category: 'Health',
    icon: '💪',
    gradient: 'linear-gradient(135deg, #ffeb3b, #ff9800)',
    downloads: '2M+',
    rating: '4.7',
  },
  {
    id: '4',
    name: 'Brain Quest',
    tagline: 'Train Your Mind',
    description: 'Challenge yourself with daily brain teasers and puzzles.',
    category: 'Education',
    icon: '🧠',
    gradient: 'linear-gradient(135deg, #ff9800, #ff4081)',
    downloads: '1.5M+',
    rating: '4.8',
  },
  {
    id: '5',
    name: 'Photo Magic',
    tagline: 'Edit Like a Pro',
    description: 'Professional photo editing tools in your pocket.',
    category: 'Photo',
    icon: '📸',
    gradient: 'linear-gradient(135deg, #ab47bc, #00d9ff)',
    downloads: '4M+',
    rating: '4.9',
  },
  {
    id: '6',
    name: 'Recipe Box',
    tagline: 'Cook Delicious',
    description: 'Thousands of recipes, meal planning, and shopping lists.',
    category: 'Lifestyle',
    icon: '🍳',
    gradient: 'linear-gradient(135deg, #00ff88, #ffeb3b)',
    downloads: '2.5M+',
    rating: '4.7',
  },
];

const Apps = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  return (
    <section id="apps" className={styles.apps}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <span className={styles.badge}>Our Portfolio</span>
          <h2 className={styles.title}>
            Explore Our <span className={styles.highlight}>Amazing Apps</span>
          </h2>
          <p className={styles.subtitle}>
            From entertainment to productivity, we create apps that people love
            to use every day.
          </p>
        </motion.div>

        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {apps.map((app) => (
            <motion.div
              key={app.id}
              className={styles.card}
              variants={cardVariants}
              whileHover={{ y: -10, scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.cardInner}>
                <div className={styles.cardHeader}>
                  <motion.div
                    className={styles.icon}
                    style={{ background: app.gradient }}
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span>{app.icon}</span>
                  </motion.div>
                  <div className={styles.category}>{app.category}</div>
                </div>

                <h3 className={styles.appName}>{app.name}</h3>
                <p className={styles.tagline}>{app.tagline}</p>
                <p className={styles.description}>{app.description}</p>

                <div className={styles.stats}>
                  <div className={styles.statItem}>
                    <span className={styles.statIcon}>⬇️</span>
                    <span>{app.downloads}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statIcon}>⭐</span>
                    <span>{app.rating}</span>
                  </div>
                </div>

                <motion.button
                  className={styles.downloadButton}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>Download Now</span>
                  <motion.span
                    className={styles.arrow}
                    animate={{ x: [0, 5, 0] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  >
                    →
                  </motion.span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Apps;
