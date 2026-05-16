'use client';
import { useEffect, useRef, useState } from 'react';
import type { GeoPosition } from '@/hooks/useGeolocation';
import styles from './MapPicker.module.css';

interface MapPickerProps {
  center: GeoPosition;
  selected: GeoPosition | null;
  onSelect: (pos: GeoPosition) => void;
}

export default function MapPicker({ center, selected, onSelect }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Leaflet は SSR 非対応のため動的インポート
    import('leaflet').then(L => {
      // デフォルトアイコンのパス修正
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!).setView(
        [center.lat, center.lng], 15
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // 現在地ピン (青)
      const currentIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([center.lat, center.lng], { icon: currentIcon })
        .addTo(map)
        .bindPopup('現在地');

      // 選択済みピン
      const pos = selected ?? center;
      const marker = L.marker([pos.lat, pos.lng], { draggable: true })
        .addTo(map)
        .bindPopup('選択した場所');
      markerRef.current = marker;

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onSelect({ lat: p.lat, lng: p.lng });
      });

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        marker.setLatLng([p.lat, p.lng]);
        onSelect(p);
      });

      mapRef.current = map;
      setReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // selected が外部から変化した場合にマーカーを移動
  useEffect(() => {
    if (!markerRef.current || !selected) return;
    markerRef.current.setLatLng([selected.lat, selected.lng]);
  }, [selected]);

  return (
    <div className={styles.wrapper}>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      {!ready && (
        <div className={styles.placeholder}>
          <span>🗺️</span>
          <p>マップを読み込み中...</p>
        </div>
      )}
      <div
        ref={containerRef}
        className={styles.map}
        style={{ visibility: ready ? 'visible' : 'hidden' }}
      />
      <div className={styles.hint}>タップして場所を選択 · ピンをドラッグで微調整</div>
    </div>
  );
}
