"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

type Point = [number, number];

function FitRoute({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24] });
  }, [map, points]);
  return null;
}

export function ActivityMap({ points }: { points: Point[] }) {
  if (points.length < 2) return <div className="grid h-72 place-items-center rounded-xl bg-white/5 p-6 text-center text-sm text-white/55">No GPS route was recorded for this activity.</div>;
  return <div className="h-72 overflow-hidden rounded-xl"><MapContainer center={points[0]} zoom={12} className="h-full w-full" scrollWheelZoom><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Polyline positions={points} pathOptions={{ color: "#bef264", weight: 4, opacity: .9 }} /><FitRoute points={points} /></MapContainer></div>;
}
