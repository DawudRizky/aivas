"use client";


import { useEffect, useState } from "react";

export default function PpicDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [totalShipments, setTotalShipments] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [matchRate, setMatchRate] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);

  const [distMatch, setDistMatch] = useState(0);
  const [distMismatch, setDistMismatch] = useState(0);
  const [distMissing, setDistMissing] = useState(0);
  const [distOver, setDistOver] = useState(0);
  const [vendorsData, setVendorsData] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [dosRes, scansRes, ticketsRes] = await Promise.all([
          fetch('/api/delivery-order'),
          fetch('/api/inbound-scan'),
          fetch('/api/discrepancy-ticket')
        ]);

        if (!dosRes.ok || !scansRes.ok || !ticketsRes.ok) {
          throw new Error('Failed to fetch metrics')
        }

        const [dos, scans, tickets, vendors, qrCodes] = await Promise.all([dosRes.json(), scansRes.json(), ticketsRes.json(), fetch('/api/vendor').then(r=>r.json()), fetch('/api/qr-code').then(r=>r.json())]);

        if (!mounted) return;

        const totalD = Array.isArray(dos) ? dos.length : 0;
        const totalScans = Array.isArray(scans) ? scans.length : 0;
        const totalTickets = Array.isArray(tickets) ? tickets.length : 0;

        setTotalShipments(totalD);

        const verified = Array.isArray(scans) ? scans.filter(s => (s.status || '').toLowerCase() === 'received').length : 0;
        setVerifiedCount(verified);

        const match = totalScans > 0 ? Math.max(0, ((totalScans - totalTickets) / totalScans) * 100) : 0;
        setMatchRate(Number(match.toFixed(1)));

        const open = Array.isArray(tickets) ? tickets.filter(t => (t.status || '').toLowerCase() === 'open').length : 0;
        setOpenTickets(open);

        // distribution heuristics
        const dm = Math.max(0, totalScans - totalTickets);
        const dmm = totalTickets;
        const dmissing = Array.isArray(tickets) ? tickets.filter(t => (t.severity || '').toLowerCase() === 'missing').length : 0;
        const dover = Array.isArray(tickets) ? tickets.filter(t => (t.severity || '').toLowerCase() === 'over').length : 0;

        setDistMatch(dm);
        setDistMismatch(dmm);
        setDistMissing(dmissing);
        setDistOver(dover);

        // compute vendor performance
        const vendorList = Array.isArray(vendors) ? vendors : [];
        const qrList = Array.isArray(qrCodes) ? qrCodes : [];
        const vendorMetrics = vendorList.map(v => {
          const shipments = Array.isArray(dos) ? dos.filter(d => Number(d.vendor_id) === Number(v.id)).length : 0;
          // count tickets related to this vendor by tracing ticket -> inbound_scan -> qr_code -> delivery_order
          let ticketCount = 0;
          for (const t of (Array.isArray(tickets) ? tickets : [])) {
            const inbId = t.inbound_scan_id ?? (t.inbound_scan && t.inbound_scan.id);
            if (!inbId) continue;
            const inb = Array.isArray(scans) ? scans.find(s => Number(s.id) === Number(inbId)) : null;
            const qrId = inb?.qr_code_id;
            const qr = qrList.find(q => Number(q.id) === Number(qrId));
            const doId = qr?.delivery_order_id;
            const delivery = Array.isArray(dos) ? dos.find(d => Number(d.id) === Number(doId)) : null;
            if (delivery && Number(delivery.vendor_id) === Number(v.id)) ticketCount++;
          }

          const matches = Math.max(0, shipments - ticketCount);
          const score = shipments ? Math.round((matches / shipments) * 100) : 0;
          return { ...v, shipments, matches, discrepancies: ticketCount, score };
        });

        setVendorsData(vendorMetrics);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load metrics');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  function pct(part, total) {
    if (!total) return '0%';
    return `${Math.round((part / total) * 100)}%`;
  }

  return (
    <div className="space-y-6 text-black">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Monitoring performa supply chain & discrepancy secara real-time</p>
      </div>

      {/* 4 Cards (Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <div className="flex items-center text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 mr-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
              {loading ? '—' : pct(verifiedCount, totalShipments)}
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? '—' : totalShipments}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Total Shipment</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-emerald-200 transition-colors">
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex items-center text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 mr-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
              {loading ? '—' : verifiedCount}
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? '—' : verifiedCount}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Terverifikasi</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-emerald-200 transition-colors">
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div className="flex items-center text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 mr-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
              {loading ? '—' : `${matchRate}%`}
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? '—' : `${matchRate}%`}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Match Rate</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-rose-200 transition-colors">
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
            </div>
            <div className="flex items-center text-rose-500 text-xs font-bold bg-rose-50 px-2 py-0.5 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 mr-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
              {loading ? '—' : openTickets}
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? '—' : openTickets}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Open Tickets</p>
          </div>
        </div>
      </div>

      {/* Grid Bawah: Verifikasi Overview & Distribusi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel Kiri: Distribusi Discrepancy */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-6">
           <div className="flex items-center gap-2 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <h3 className="text-base font-bold text-slate-800">Distribusi Discrepancy</h3>
          </div>

          <div className="space-y-5">
            {/* Match */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-semibold text-slate-700">Match</span>
                <span className="text-sm font-bold text-slate-800">{distMatch} <span className="text-xs text-slate-400 font-medium">({loading ? '—' : pct(distMatch, distMatch + distMismatch + distMissing + distOver)})</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: loading ? '0%' : pct(distMatch, distMatch + distMismatch + distMissing + distOver) }}></div>
              </div>
            </div>
            {/* Mismatch */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-semibold text-slate-700">Mismatch</span>
                <span className="text-sm font-bold text-slate-800">{distMismatch} <span className="text-xs text-slate-400 font-medium">({loading ? '—' : pct(distMismatch, distMatch + distMismatch + distMissing + distOver)})</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full" style={{ width: loading ? '0%' : pct(distMismatch, distMatch + distMismatch + distMissing + distOver) }}></div>
              </div>
            </div>
            {/* Missing */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-semibold text-slate-700">Missing</span>
                <span className="text-sm font-bold text-slate-800">{distMissing} <span className="text-xs text-slate-400 font-medium">({loading ? '—' : pct(distMissing, distMatch + distMismatch + distMissing + distOver)})</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-amber-400 h-2 rounded-full" style={{ width: loading ? '0%' : pct(distMissing, distMatch + distMismatch + distMissing + distOver) }}></div>
              </div>
            </div>
            {/* Over */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-semibold text-slate-700">Over</span>
                <span className="text-sm font-bold text-slate-800">{distOver} <span className="text-xs text-slate-400 font-medium">({loading ? '—' : pct(distOver, distMatch + distMismatch + distMissing + distOver)})</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: loading ? '0%' : pct(distOver, distMatch + distMismatch + distMissing + distOver) }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Kanan: Vendor Performance Scorecard */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-6 flex flex-col h-full">
           <div className="flex items-center gap-2 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            <h3 className="text-base font-bold text-slate-800">Vendor Performance</h3>
          </div>

          <div className="space-y-4 flex-1">
            {vendorsData.length === 0 && (
              <div className="text-sm text-slate-500">No vendor data available</div>
            )}

            {vendorsData.slice(0,3).map((v) => (
              <div key={v.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-800">{v.name}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Score: {v.score}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${v.score}%` }}></div>
                </div>
                <div className="flex gap-3 text-[10px] text-slate-500 font-medium">
                  <span>{v.shipments} shipment</span>
                  <span className="text-emerald-500">{v.matches} match</span>
                  <span className="text-rose-500">{v.discrepancies} discrepancy</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Full Width Bawah: Ticket Discrepancy Terbaru */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-amber-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-base font-bold text-slate-800">Ticket Discrepancy Terbaru</h3>
        </div>
        <div className="p-2 space-y-1">
          {/* TODO: consider fetching and listing latest tickets here */}
          <div className="p-3 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{loading ? '—' : `${openTickets > 0 ? `Last ${openTickets} open tickets` : 'No open tickets'}`}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Overview</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-600 text-[10px] font-bold tracking-wide uppercase">Summary</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
