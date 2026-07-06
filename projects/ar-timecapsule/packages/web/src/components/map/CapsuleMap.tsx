"use client";
import { useEffect, useRef } from "react";
import type { TimeCapsuleItem } from "@/lib/api";
type Props = { capsules: TimeCapsuleItem[]; height?: number | string; center?: { lat: number; lng: number }; zoom?: number; onCapsuleClick?: (c: TimeCapsuleItem) => void };

export default function CapsuleMap({ capsules, height = 500, center = { lat: 35.6812, lng: 139.7671 }, zoom = 12, onCapsuleClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  const draw = async (L: typeof import("leaflet"), layer: import("leaflet").LayerGroup, caps: TimeCapsuleItem[]) => {
    layer.clearLayers();
    for (const c of caps) {
      const color = c.status === "removed" ? "#E05263" : c.mediaType === "audio" ? "#00D4C8" : "#6B3FA0";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="${color}" opacity="0.9"/><circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/></svg>`;
      const icon = L.divIcon({ html: svg, className: "", iconSize: [28, 40], iconAnchor: [14, 40], popupAnchor: [0, -40] });
      const m = L.marker([c.latitude, c.longitude], { icon }).addTo(layer).bindPopup(`<strong>${c.title.replace(/</g,"&lt;")}</strong><br/><span style="color:#8890A4;font-size:12px">${c.status} · ${c.mediaType}</span>`);
      if (onCapsuleClick) m.on("click", () => onCapsuleClick(c));
    }
  };

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let map: import("leaflet").Map;
    (async () => {
      const L = (await import("leaflet")).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" });
      const initCenter: [number, number] = capsules.length > 0 ? [capsules[0]!.latitude, capsules[0]!.longitude] : [center.lat, center.lng];
      map = L.map(ref.current!, { center: initCenter, zoom });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;
      await draw(L, layer, capsules);
      if (capsules.length > 1) map.fitBounds(L.latLngBounds(capsules.map((c) => [c.latitude, c.longitude])), { padding: [40, 40] });
    })();
    return () => { map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      await draw(L, layerRef.current!, capsules);
      if (capsules.length > 1) mapRef.current!.fitBounds(L.latLngBounds(capsules.map((c) => [c.latitude, c.longitude])), { padding: [40, 40] });
      else if (capsules.length === 1) mapRef.current!.setView([capsules[0]!.latitude, capsules[0]!.longitude], 14);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsules]);

  return <div className="map-container" ref={ref} style={{ height, width: "100%" }} />;
}
