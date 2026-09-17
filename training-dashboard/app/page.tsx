"use client";

import { Activity, CalendarDays, HeartPulse, Route, Sparkles } from "lucide-react";
import { useState } from "react";

const bars = [35, 42, 68, 51, 87, 62, 70, 43, 57, 74, 61, 79];
const nextWorkouts = [
  { date: "Saturday, 19 September", title: "2x20 upper endurance", sport: "Bike", duration_planned: "1h 08m", tss_planned: "68.8", description: "No workout description supplied." },
  { date: "Sunday, 20 September", title: "2x20 upper endurance", sport: "Bike", duration_planned: "1h 08m", tss_planned: "68.8", description: "No workout description supplied." }
];
const todayWorkout = [
  ["TrainingPeaks ID", "3957199953"], ["Date", "17 September 2026"], ["Title", "2x20 upper endurance"], ["Type", "Completed"], ["Sport", "Bike"], ["Planned duration", "1h 08m"], ["Actual duration", "1h 09m"], ["Planned distance", "Not set"], ["Actual distance", "37.37 km"], ["Planned TSS", "68.8"], ["Actual TSS", "69.2"], ["Description", "Not supplied"]
];

export default function Home() {
  const [days, setDays] = useState(4);
  const [selectedWorkout, setSelectedWorkout] = useState(0);
  const workout = nextWorkouts[selectedWorkout];

  return <main className="min-h-screen bg-[#071b1b] text-[#edf7f4]">
    <div className="mx-auto max-w-7xl px-5 py-6 lg:px-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300 text-[#071b1b]"><Activity /></span><div><b>PaceLine</b><p className="text-xs text-white/45">Training intelligence</p></div></div>
        <span className="rounded-full border border-white/15 px-4 py-2 text-sm">Neville · Private pilot</span>
      </header>

      <section className="grid gap-6 py-8 lg:grid-cols-[1.5fr_.8fr]"><div><p className="text-sm text-lime-300">THURSDAY, 17 SEPTEMBER</p><h1 className="mt-2 text-4xl font-semibold">A solid endurance session, completed.</h1><p className="mt-3 max-w-2xl leading-7 text-white/65">Your 2×20 upper endurance ride matched the intended training stress closely: 69.2 actual TSS versus 68.8 planned.</p></div><div className="rounded-2xl bg-[#103131] p-5"><p className="text-sm text-white/55">Coach recommendation</p><p className="mt-2 font-medium">You completed today’s prescribed work. Recover well before the next planned endurance session.</p></div></section>

      <section className="grid gap-4 md:grid-cols-3"><Metric t="Fitness" v="51.6" s="CTL · down 16.9 from peak" /><Metric t="Fatigue" v="34.1" s="ATL · low recent load" /><Metric t="Form" v="+22.9" s="TSB · fresh / race ready" lime /></section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.5fr_.8fr]"><div className="rounded-2xl bg-[#0d2929] p-6"><p className="font-medium">Fitness & form</p><p className="mt-1 text-sm text-white/45">Last 12 weeks · TrainingPeaks</p><div className="mt-8 flex h-44 items-end gap-2">{bars.map((height, index) => <i key={index} className="flex-1 rounded-t bg-gradient-to-t from-cyan-500 to-lime-300" style={{ height: `${height}%`, opacity: index > 8 ? 1 : .55 }} />)}</div></div><div className="rounded-2xl border border-white/10 p-6"><div className="flex items-center gap-2"><CalendarDays className="text-lime-300" /><b>This week</b></div><p className="mt-2 text-sm text-white/55">2 planned rides · 138 TSS</p><div className="mt-5 space-y-3">{nextWorkouts.map((item, index) => <button onClick={() => setSelectedWorkout(index)} className={`w-full rounded-xl p-3 text-left text-sm ${selectedWorkout === index ? "bg-lime-300 text-[#071b1b]" : "bg-white/5"}`} key={item.date}>{item.date.split(",")[0]} · {item.title}</button>)}</div></div></section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl border border-lime-300/30 bg-[#0d2929] p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-lime-300">TODAY'S WORKOUT</p><h2 className="mt-1 text-xl font-semibold">2x20 upper endurance</h2></div><span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-medium text-[#071b1b]">Completed</span></div><p className="mt-3 max-w-xl text-sm leading-6 text-white/55">Here is the complete record returned by TrainingPeaks for today. Actual load was 0.4 TSS above plan, effectively right on target.</p><div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-white/10 pt-5 text-sm">{todayWorkout.map(([label, value]) => <Data key={label} t={label} v={value} />)}</div><div className="mt-6 border-t border-white/10 pt-5"><p className="text-sm font-medium">Next planned workout</p><button onClick={() => setSelectedWorkout((selectedWorkout + 1) % nextWorkouts.length)} className="mt-3 w-full rounded-xl bg-white/5 p-4 text-left hover:bg-white/10"><p className="font-medium">{workout.title}</p><p className="mt-1 text-sm text-white/50">{workout.date} · {workout.sport}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Data t="Planned duration" v={workout.duration_planned} /><Data t="Planned TSS" v={workout.tss_planned} /><Data t="Description" v={workout.description} /><Data t="Workout type" v="Planned" /></div></button></div></div>
        <div className="rounded-2xl bg-[#0d2929] p-6"><div className="flex items-center justify-between"><div><b>Draft next week</b><p className="mt-1 text-sm text-white/45">Based on completed training load.</p></div><span className="text-xs text-lime-300">DRAFT ONLY</span></div><div className="mt-5 flex gap-2">{[3, 4, 5].map(value => <button onClick={() => setDays(value)} className={`rounded-lg px-4 py-2 ${days === value ? "bg-lime-300 text-[#071b1b]" : "bg-white/10"}`} key={value}>{value} days</button>)}</div><button className="mt-4 flex w-full justify-center gap-2 rounded-xl bg-lime-300 py-3 font-semibold text-[#071b1b]"><Sparkles size={17} />Create draft plan</button><div className="mt-7 border-t border-white/10 pt-5"><b>Data connections</b><Row icon={<Activity />} t="TrainingPeaks" s="Live training load & workout detail" /><Row icon={<HeartPulse />} t="Garmin" s="Connected · awaiting recovery data" /><Row icon={<Route />} t="Strava" s="Next integration" /></div></div></section>
    </div>
  </main>;
}

function Metric({ t, v, s, lime = false }: { t: string; v: string; s: string; lime?: boolean }) { return <div className="rounded-2xl bg-[#0d2929] p-5"><p className="text-sm text-white/50">{t}</p><p className={`mt-2 text-4xl font-semibold ${lime ? "text-lime-300" : ""}`}>{v}</p><p className="mt-2 text-sm text-white/45">{s}</p></div>; }
function Data({ t, v }: { t: string; v: string }) { return <div><p className="text-xs text-white/45">{t}</p><p className="mt-1 text-white/80">{v}</p></div>; }
function Row({ icon, t, s }: { icon: React.ReactNode; t: string; s: string }) { return <div className="mt-5 flex gap-3"><span className="text-lime-300">{icon}</span><div><p className="text-sm font-medium">{t}</p><p className="text-xs text-white/45">{s}</p></div></div>; }
