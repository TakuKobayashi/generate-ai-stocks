'use client';

import { useEffect, useRef } from 'react';
import type { Location } from '@/types';

interface Props {
  locations: Location[];
  stampedIds: string[];
  userPosition: GeolocationPosition | null;
  onLocationSelect: (loc: Location) => void;
  selectedLocation: Location | null;
}

const STAMP_RADIUS_M = 200;

export default function StampMap({
  locations,
  stampedIds,
  userPosition,
  onLocationSelect,
  selectedLocation,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const locationMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const rangeCirclesRef = useRef<Map<string, L.Circle>>(new Map());

  // 地図初期化
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || leafletMapRef.current) return;

    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

      const center: [number, number] = locations.length > 0
        ? [
            locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
            locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
          ]
        : [35.6812, 139.7671];

      const map = L.map(mapRef.current!, {
        center,
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;

      // スポットマーカーを追加
      locations.forEach((loc, index) => {
        const stamped = stampedIds.includes(loc.id);
        const marker = makeLocationMarker(L, loc, index, stamped, false);
        marker.addTo(map);
        marker.on('click', () => onLocationSelect(loc));
        locationMarkersRef.current.set(loc.id, marker);

        // スタンプ可能範囲サークル
        const circle = L.circle([loc.latitude, loc.longitude], {
          radius: STAMP_RADIUS_M,
          color: stamped ? '#4caf82' : '#d4a847',
          fillColor: stamped ? '#4caf82' : '#d4a847',
          fillOpacity: 0.06,
          weight: 1.5,
          opacity: 0.4,
        }).addTo(map);
        rangeCirclesRef.current.set(loc.id, circle);
      });
    });

    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      locationMarkersRef.current.clear();
      rangeCirclesRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // スタンプ状態の更新
  useEffect(() => {
    if (!leafletMapRef.current) return;
    import('leaflet').then(L => {
      locations.forEach((loc, index) => {
        const stamped = stampedIds.includes(loc.id);
        const selected = selectedLocation?.id === loc.id;

        const existing = locationMarkersRef.current.get(loc.id);
        if (existing) {
          existing.remove();
          locationMarkersRef.current.delete(loc.id);
        }

        const marker = makeLocationMarker(L, loc, index, stamped, selected);
        marker.addTo(leafletMapRef.current!);
        marker.on('click', () => onLocationSelect(loc));
        locationMarkersRef.current.set(loc.id, marker);

        // サークルの色更新
        const circle = rangeCirclesRef.current.get(loc.id);
        if (circle) {
          const color = stamped ? '#4caf82' : selected ? '#5b8bdf' : '#d4a847';
          circle.setStyle({ color, fillColor: color });
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampedIds, selectedLocation]);

  // ユーザー位置マーカー
  useEffect(() => {
    if (!leafletMapRef.current || !userPosition) return;
    import('leaflet').then(L => {
      const { latitude, longitude, accuracy } = userPosition.coords;

      // 既存マーカー削除
      userMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();

      // 精度サークル
      accuracyCircleRef.current = L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#5b8bdf',
        fillColor: '#5b8bdf',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(leafletMapRef.current!);

      // ユーザーマーカー
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:16px;height:16px;
          border-radius:50%;
          background:#5b8bdf;
          border:3px solid #fff;
          box-shadow:0 0 10px rgba(91,139,223,0.6);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
        .addTo(leafletMapRef.current!)
        .bindPopup('現在地');
    });
  }, [userPosition]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
  );
}

function makeLocationMarker(
  L: typeof import('leaflet'),
  loc: Location,
  index: number,
  stamped: boolean,
  selected: boolean
): L.Marker {
  const bgColor = stamped ? '#4caf82' : selected ? '#5b8bdf' : '#d4a847';
  const content = stamped ? '✓' : String(index + 1);

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:36px;height:42px;
    ">
      <div style="
        width:36px;height:36px;
        border-radius:50% 50% 50% 0;
        background:${bgColor};
        border:3px solid #fff;
        transform:rotate(-45deg);
        box-shadow:0 2px 10px rgba(0,0,0,0.5);
        ${selected ? 'box-shadow:0 2px 16px rgba(91,139,223,0.7);' : ''}
      "></div>
      <span style="
        position:absolute;
        top:6px;left:50%;
        transform:translateX(-50%) rotate(45deg);
        font-size:${stamped ? '14px' : '11px'};
        font-weight:800;
        color:#fff;
        line-height:1;
        text-shadow:0 1px 2px rgba(0,0,0,0.3);
      ">${content}</span>
    </div>`,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  });

  return L.marker([loc.latitude, loc.longitude], { icon })
    .bindPopup(`<strong>${loc.name}</strong>${loc.address ? `<br/><small>${loc.address}</small>` : ''}`);
}
