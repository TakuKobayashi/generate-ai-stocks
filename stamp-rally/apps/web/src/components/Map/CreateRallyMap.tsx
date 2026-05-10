'use client';

import { useEffect, useRef, useState } from 'react';
import type { CreateRallyLocation } from '@/types';
import styles from './CreateRallyMap.module.css';

interface Props {
  onPinAdded: (pin: Omit<CreateRallyLocation, 'id'>) => void;
  existingLocations: CreateRallyLocation[];
}

interface PendingPin {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

// Leaflet は SSR 非対応のため dynamic import
export default function CreateRallyMap({ onPinAdded, existingLocations }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLFormElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const userAdjustedMapRef = useRef(false);
  const markersRef = useRef<L.Marker[]>([]);
  const pendingMarkerRef = useRef<L.Marker | null>(null);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [editName, setEditName] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || leafletMapRef.current) return;

    import('leaflet').then(L => {
      // デフォルトアイコン修正
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [35.6812, 139.7671],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      if (searchBoxRef.current) {
        L.DomEvent.disableClickPropagation(searchBoxRef.current);
        L.DomEvent.disableScrollPropagation(searchBoxRef.current);
      }

      leafletMapRef.current = map;

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          position => {
            if (userAdjustedMapRef.current) return;
            map.setView(
              [position.coords.latitude, position.coords.longitude],
              16
            );
          },
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 }
        );
      }

      map.on('dragstart zoomstart', () => {
        userAdjustedMapRef.current = true;
      });

      // クリックでピン留め
      map.on('click', async (e: L.LeafletMouseEvent) => {
        userAdjustedMapRef.current = true;
        const { lat, lng } = e.latlng;

        // 既存の仮ピンを削除
        if (pendingMarkerRef.current) {
          pendingMarkerRef.current.remove();
        }

        // 仮ピンを追加
        const pendingIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:32px;height:32px;border-radius:50% 50% 50% 0;
            background:var(--amber);border:3px solid #fff;
            transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const marker = L.marker([lat, lng], { icon: pendingIcon }).addTo(map);
        pendingMarkerRef.current = marker;

        // 逆ジオコーディング
        setGeocoding(true);
        setPendingPin({ latitude: lat, longitude: lng, name: '', address: '' });
        setEditName('');

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`
          );
          const data = await res.json();
          const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          const name = data.name || data.address?.road || '場所を選択中';

          setPendingPin({ latitude: lat, longitude: lng, name, address });
          setEditName(name);
        } catch {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setPendingPin({ latitude: lat, longitude: lng, name: fallback, address: fallback });
          setEditName(fallback);
        } finally {
          setGeocoding(false);
        }
      });
    });

    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 既存ピンを地図に表示
  useEffect(() => {
    if (!leafletMapRef.current) return;
    import('leaflet').then(L => {
      // 既存マーカーをクリア
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      existingLocations.forEach((loc, index) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            position:relative;width:36px;height:36px;
          ">
            <div style="
              width:36px;height:36px;border-radius:50% 50% 50% 0;
              background:#4caf82;border:3px solid #fff;
              transform:rotate(-45deg);
              box-shadow:0 2px 8px rgba(0,0,0,0.5);
            "></div>
            <span style="
              position:absolute;top:6px;left:50%;transform:translateX(-50%) rotate(45deg);
              font-size:11px;font-weight:700;color:#fff;line-height:1;
            ">${index + 1}</span>
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(leafletMapRef.current!)
          .bindPopup(`<strong>${loc.name}</strong><br/><small>${loc.address || ''}</small>`);
        markersRef.current.push(marker);
      });
    });
  }, [existingLocations]);

  const handleAdd = () => {
    if (!pendingPin || !editName.trim()) return;
    onPinAdded({ ...pendingPin, name: editName.trim() });

    // 仮ピンを削除
    pendingMarkerRef.current?.remove();
    pendingMarkerRef.current = null;
    setPendingPin(null);
    setEditName('');
  };

  const handleCancel = () => {
    pendingMarkerRef.current?.remove();
    pendingMarkerRef.current = null;
    setPendingPin(null);
    setEditName('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const query = searchQuery.trim();
    if (!query || !leafletMapRef.current) return;

    setSearching(true);
    setSearchError('');
    userAdjustedMapRef.current = true;

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
        addressdetails: '1',
        'accept-language': 'ja',
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');

      const data: Array<{ lat: string; lon: string }> = await res.json();
      const result = data[0];
      if (!result) {
        setSearchError('場所が見つかりませんでした');
        return;
      }

      leafletMapRef.current.setView(
        [Number(result.lat), Number(result.lon)],
        16
      );
    } catch {
      setSearchError('検索に失敗しました');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div ref={mapRef} className={styles.map} />

      <form
        ref={searchBoxRef}
        className={styles.searchBox}
        onSubmit={handleSearch}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={styles.searchRow}>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="場所名・住所で検索"
            aria-label="場所名・住所で検索"
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '検索'}
          </button>
        </div>
        {searchError && <div className={styles.searchError}>{searchError}</div>}
      </form>

      {/* ピン追加パネル */}
      {pendingPin && (
        <div className={styles.pinPanel}>
          {geocoding ? (
            <div className={styles.geocoding}>
              <span className="spinner" style={{ width: 16, height: 16 }} />
              <span>住所を取得中...</span>
            </div>
          ) : (
            <>
              <div className={styles.pinCoords}>
                📍 {pendingPin.latitude.toFixed(5)}, {pendingPin.longitude.toFixed(5)}
              </div>
              <div className={styles.pinAddress}>{pendingPin.address}</div>
              <div className={styles.pinNameInput}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="場所の名前を入力"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                />
              </div>
              <div className={styles.pinActions}>
                <button className="btn btn-ghost btn-sm" onClick={handleCancel}>キャンセル</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAdd}
                  disabled={!editName.trim()}
                >
                  リストに追加
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.hint}>
        地図をクリックしてスポットを追加
      </div>
    </div>
  );
}
