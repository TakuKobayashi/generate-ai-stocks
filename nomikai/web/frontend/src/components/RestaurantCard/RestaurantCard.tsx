import type { Restaurant } from '@/lib/api';
import styles from './RestaurantCard.module.css';

interface RestaurantCardProps {
  restaurant: Restaurant;
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  return (
    <article className={styles.card}>
      {restaurant.photo && (
        <div className={styles.photoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={restaurant.photo}
            alt={restaurant.name}
            className={styles.photo}
            loading="lazy"
          />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.topRow}>
          <h3 className={styles.name}>{restaurant.name}</h3>
          <span className={styles.genre}>{restaurant.genre}</span>
        </div>

        {restaurant.catchCopy && (
          <p className={styles.catch}>{restaurant.catchCopy}</p>
        )}

        <div className={styles.meta}>
          {restaurant.budget && (
            <span className={styles.metaItem}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>
              </svg>
              {restaurant.budget}
            </span>
          )}
          {restaurant.access && (
            <span className={styles.metaItem}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {restaurant.access}
            </span>
          )}
        </div>

        <a
          href={restaurant.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cta}
        >
          詳細・予約はこちら
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </article>
  );
}
