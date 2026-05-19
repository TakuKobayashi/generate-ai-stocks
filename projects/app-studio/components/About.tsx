'use client';

import { motion } from 'framer-motion';
import styles from './About.module.css';

const About = () => {
  const features = [
    {
      icon: '🎯',
      title: 'User-Focused',
      text: 'Every decision we make starts with understanding what our users need and love.',
    },
    {
      icon: '⚡',
      title: 'Innovation First',
      text: "We're always exploring new technologies and creative solutions to push boundaries.",
    },
    {
      icon: '🌍',
      title: 'Global Reach',
      text: 'Our apps are loved by millions of users across the globe in 150+ countries.',
    },
  ];

  return (
    <section id="about" className={styles.about}>
      <div className={styles.container}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <span className={styles.badge}>Who We Are</span>
          <h2 className={styles.title}>
            Building the <span className={styles.highlight}>Future</span> of
            Mobile Apps
          </h2>
          <p className={styles.text}>
            At Pixel Studio, we're passionate about creating mobile experiences
            that bring joy to millions of users worldwide. Our team of creative
            designers and talented developers work together to craft apps that
            are not just functional, but truly delightful to use.
          </p>
          <p className={styles.text}>
            From addictive games to powerful productivity tools, we believe that
            great apps can make a real difference in people's lives. That's why
            we pour our hearts into every pixel, every interaction, and every
            feature.
          </p>

          <div className={styles.features}>
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className={styles.feature}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
                whileHover={{ x: 10 }}
              >
                <motion.div
                  className={styles.featureIcon}
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.6 }}
                >
                  {feature.icon}
                </motion.div>
                <div>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureText}>{feature.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className={styles.visual}
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className={styles.visualCard}
            animate={{
              y: [0, -15, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {[
              { icon: '🚀', label: 'Innovation', value: 'Cutting-edge tech' },
              { icon: '❤️', label: 'Passion', value: 'Love what we do' },
              { icon: '🎨', label: 'Design', value: 'Beautiful UX' },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                className={styles.visualItem}
                whileHover={{
                  x: 15,
                  scale: 1.05,
                }}
                transition={{ duration: 0.3 }}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                style={{ transitionDelay: `${index * 0.1}s` }}
              >
                <span className={styles.visualIcon}>{item.icon}</span>
                <div>
                  <div className={styles.visualLabel}>{item.label}</div>
                  <div className={styles.visualValue}>{item.value}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default About;
