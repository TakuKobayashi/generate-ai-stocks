"use client";
import { useEffect, useRef, useState } from "react";
type LatLng = { lat: number; lng: number };
type Props = { center?: LatLng; zoom?: number; height?: number | string; selectable?: boolean; selectedPos?: LatLng | null; onSelect?: (pos: LatLng) => void; onAddressChange?: (addr: string) => void };

export default function LocationMap({ center = { lat: 35.6812, lng: 139.7671 }, zoom = 13, height = 400, selectable = false, selectedPos, onSelect, onAddressChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const selMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [address, setAddress] = useState("");
  const [coord, setCoord] = useState<LatLng | null>(selectedPos ?? null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let map: import("leaflet").Map;
    (async () => {
      const L = (await import("leaflet")).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" });
      map = L.map(ref.current!, { center: [center.lat, center.lng], zoom });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      if (selectable) {
        map.on("click", async (e) => {
          const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
          setCoord(pos); onSelect?.(pos);
          if (selMarkerRef.current) selMarkerRef.current.remove();
          selMarkerRef.current = L.marker([pos.lat, pos.lng]).addTo(map);
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`, { headers: { "Accept-Language": "ja" } });
            const d = await r.json() as { display_name?: string };
            const a = d.display_name ?? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            setAddress(a); onAddressChange?.(a);
          } catch { /**/ }
        });
      }
    })();
    return () => { map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, { headers: { "Accept-Language": "ja" } });
      const d = await r.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (d[0] && mapRef.current) {
        const L = (await import("leaflet")).default;
        const pos = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
        mapRef.current.setView([pos.lat, pos.lng], 16);
        setAddress(d[0].display_name); onAddressChange?.(d[0].display_name);
        if (selectable) {
          setCoord(pos); onSelect?.(pos);
          if (selMarkerRef.current) selMarkerRef.current.remove();
          selMarkerRef.current = L.marker([pos.lat, pos.lng]).addTo(mapRef.current);
        }
      }
    } finally { setSearching(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {selectable && (
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="住所または場所名を入力..." style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={handleSearch} disabled={searching}>{searching ? "検索中..." : "決定"}</button>
        </div>
      )}
      {address && <div style={{ fontSize: 13, color: "var(--muted)", padding: "6px 12px", background: "var(--space-2)", borderRadius: "var(--radius-m)", border: "1px solid var(--space-3)" }}>📍 {address}</div>}
      {coord && <div className="map-coord-display">緯度: <strong style={{ color: "var(--cyan)" }}>{coord.lat.toFixed(7)}</strong> / 経度: <strong style={{ color: "var(--cyan)" }}>{coord.lng.toFixed(7)}</strong></div>}
      <div className="map-container" ref={ref} style={{ height, width: "100%", cursor: selectable ? "crosshair" : "grab" }} />
      {selectable && <p className="hint">地図をクリックして位置を選択してください</p>}
    </div>
  );
}
