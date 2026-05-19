'use client';

import { motion } from 'framer-motion';
import styles from './Hero.module.css';

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

  const floatingVariants = {
    animate: {
      y: [0, -20, 0],
      rotate: [0, 5, 0, -5, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const cards = [
    { icon: '🎮', color: 'cyan', delay: 0 },
    { icon: '🎨', color: 'green', delay: 0.2 },
    { icon: '🎵', color: 'yellow', delay: 0.4 },
    { icon: '📱', color: 'purple', delay: 0.6 },
  ];

  return (
    <section id="home" className={styles.hero}>
      <motion.div
        className={styles.container}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className={styles.content}>
          <motion.div className={styles.badge} variants={itemVariants}>
            <motion.span
              className={styles.badgeIcon}
              animate={{ rotate: 360 }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              ⚡
            </motion.span>
            <span>Creating Amazing Apps</span>
          </motion.div>

          <motion.h1 className={styles.title} variants={itemVariants}>
            Welcome to
            <motion.span
              className={styles.titleGradient}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              {' '}
              Pixel Studio
            </motion.span>
          </motion.h1>

          <motion.p className={styles.subtitle} variants={itemVariants}>
            We craft delightful mobile experiences that millions love. From
            gaming to productivity, we build apps that make life more fun! 🚀
          </motion.p>

          <motion.div className={styles.buttons} variants={itemVariants}>
            <motion.a
              href="#apps"
              className={`${styles.button} ${styles.buttonPrimary}`}
              whileHover={{ scale: 1.05, boxShadow: 'var(--glow-cyan)' }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Explore Our Apps</span>
              <motion.span
                className={styles.buttonIcon}
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </motion.a>
            <motion.a
              href="#about"
              className={`${styles.button} ${styles.buttonSecondary}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Learn More</span>
            </motion.a>
          </motion.div>

          <motion.div className={styles.stats} variants={itemVariants}>
            {[
              { number: '10M+', label: 'Downloads' },
              { number: '50+', label: 'Apps' },
              { number: '4.8★', label: 'Rating' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                className={styles.stat}
                whileHover={{ scale: 1.1 }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + index * 0.1 }}
              >
                <div className={styles.statNumber}>{stat.number}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className={styles.visual}>
          {cards.map((card, index) => (
            <motion.div
              key={index}
              className={`${styles.floatingCard} ${styles[`card${index + 1}`]}`}
              variants={floatingVariants}
              animate="animate"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{
                delay: card.delay,
                duration: 0.5,
                type: 'spring',
              }}
              whileHover={{ scale: 1.2, rotate: 10 }}
            >
              <span className={styles.cardIcon}>{card.icon}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className={styles.particles}>
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className={styles.particle}
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
            }}
            animate={{
              y: [-100, -1000],
              opacity: [0, 0.8, 0.8, 0],
              scale: [0, 1, 1, 0.5],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
