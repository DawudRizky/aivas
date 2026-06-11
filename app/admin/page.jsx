"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

const parseLegacyQrPayload = (rawValue) => {
  const normalizedRawValue = String(rawValue || "").trim();
  if (!normalizedRawValue) return null;

  const segments = normalizedRawValue.split("|");
  const parsed = {};

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (key) parsed[key.toUpperCase()] = value;
  }

  if (!parsed.PO && !parsed.DO && !parsed.ITEM && !parsed.UID) {
    return {
      brand: "RAW",
      poNumber: "UNKNOWN",
      doNumber: "UNKNOWN",
      itemId: "UNKNOWN",
      uid: "UNKNOWN",
      rawValue: normalizedRawValue,
      isGeneric: true,
    };
  }

  return {
    brand: segments[0] || "",
    poNumber: parsed.PO || "UNKNOWN",
    doNumber: parsed.DO || "UNKNOWN",
    itemId: parsed.ITEM || "UNKNOWN",
    uid: parsed.UID || "UNKNOWN",
    rawValue: normalizedRawValue,
    isGeneric: false,
  };
};

// --- KEYBOARD MOCK COMPONENT (moved outside to prevent re-creation) ---
const VirtualKeyboard = ({ value, setValue, onKeyPressCustom }) => {
  const rows = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["SHIFT", "z", "x", "c", "v", "b", "n", "m", "⌫"],
  ];

  const handleKeyPress = (key) => {
    let newValue = value;
    if (key === "⌫") newValue = value.slice(0, -1);
    else if (key === "space") newValue = value + " ";
    else if (key !== "SHIFT" && key !== "↵") newValue = value + key;
    
    setValue(newValue);
    if (onKeyPressCustom) onKeyPressCustom(newValue);
  };

  return (
    <div className="flex flex-col gap-2 items-center w-full mt-2 select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 justify-center w-full">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`flex items-center justify-center bg-white border border-gray-200 shadow-sm rounded-[10px] text-[13px] font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all ${
                key === "SHIFT" || key === "⌫" ? "px-4 min-w-[60px]" : "w-10 h-10"
              }`}
            >
              {key === "⌫" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      ))}
      {/* Row 5: Space & Enter */}
      <div className="flex gap-2 justify-center w-full max-w-[440px]">
        <button
          onClick={() => handleKeyPress("space")}
          className="flex-1 h-10 bg-white border border-gray-200 shadow-sm rounded-[10px] text-[13px] font-medium text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
        >
          space
        </button>
        <button
          onClick={() => handleKeyPress("↵")}
          className="w-14 h-10 flex items-center justify-center bg-white border border-gray-200 shadow-sm rounded-[10px] text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default function InboundScannerPage() {
  // --- STATES ---
  const [activeTab, setActiveTab] = useState("scan"); // 'scan' | 'hitung'
  const [isScanned, setIsScanned] = useState(false); // Menandakan box sudah discan
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  
  // Debug modal state
  useEffect(() => {
    console.log('showFinishModal changed to:', showFinishModal);
  }, [showFinishModal]);
  const [qtyInput, setQtyInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [finishComment, setFinishComment] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const [decodedQr, setDecodedQr] = useState(null);
  const [cameraMode, setCameraMode] = useState("qr");
  const videoRef = useRef(null);
  const videoRefDesktop = useRef(null);
  const canvasRef = useRef(null);
  const scanAnimationRef = useRef(0);
  const lastDecodedQrRef = useRef("");
  
  // State untuk error handling reject
  const [rejectError, setRejectError] = useState(false);

  // State untuk Waktu Realtime
  const [currentTime, setCurrentTime] = useState("");

  // Local evidence storage
  const [evidences, setEvidences] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  // Data Item from QR
  const [currentItem, setCurrentItem] = useState(null);
  const currentUnit =
    currentItem?.unit ||
    decodedQr?.item?.unit ||
    decodedQr?.unit ||
    decodedQr?.itemUnit ||
    "PCS";
  const isQtyReady = Number(qtyInput) > 0;

  // --- EFFECT: GET GEOLOCATION ---
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const syncLandscapeMobile = () => {
      const mobile = window.innerWidth < 1024;
      const landscape = window.innerWidth > window.innerHeight;
      setIsMobileViewport(mobile);
      setIsLandscapeMobile(mobile && landscape);
    };
    syncLandscapeMobile();
    window.addEventListener("resize", syncLandscapeMobile);
    return () => window.removeEventListener("resize", syncLandscapeMobile);
  }, []);

  useEffect(() => {
    if (!saveNotice) return;
    const timeoutId = window.setTimeout(() => setSaveNotice(""), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [saveNotice]);

  // --- EFFECT: REALTIME CLOCK ---
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock(); 
    const intervalId = setInterval(updateClock, 1000); 

    return () => clearInterval(intervalId); 
  }, []);

  useEffect(() => {
    let stream = null;
    let cancelled = false;

    const startCamera = async () => {
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Browser ini tidak mendukung akses kamera.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Assign stream to both mobile and desktop video elements
        const assignStream = async (ref) => {
          if (ref.current) {
            ref.current.srcObject = stream;
            await ref.current.play().catch(() => {});
          }
        };
        await assignStream(videoRef);
        await assignStream(videoRefDesktop);
      } catch (error) {
        setCameraError("Akses kamera ditolak atau kamera tidak tersedia.");
      }
    };

    startCamera();

    return () => {
      cancelled = true;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (videoRefDesktop.current) {
        videoRefDesktop.current.srcObject = null;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraRetryKey]);

  useEffect(() => {
    if (activeTab !== "scan" || cameraError || !videoRef.current || !canvasRef.current) {
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }

      return undefined;
    }

    let cancelled = false;
    let intervalId = 0;

    const processDetectedCode = async (rawValue) => {
      const normalizedRawValue = String(rawValue || "").trim();
      if (!normalizedRawValue) return;

      if (normalizedRawValue === lastDecodedQrRef.current) return;
      lastDecodedQrRef.current = normalizedRawValue;

      let resolvedQr = null;

      try {
        const response = await fetch(`/api/qr-code/resolve?token=${encodeURIComponent(normalizedRawValue)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          resolvedQr = data;
        } else if (normalizedRawValue.startsWith("AIVAS|")) {
          const legacy = parseLegacyQrPayload(normalizedRawValue);
          if (legacy) {
            resolvedQr = legacy;
          } else {
            throw new Error(data?.error || "QR legacy tidak valid");
          }
        } else {
          throw new Error(data?.error || "QR tidak valid atau belum terdaftar");
        }
      } catch (error) {
        setCameraError(error?.message || "QR tidak valid atau belum terdaftar");
        return;
      }

      setDecodedQr(resolvedQr);
      setCameraError("");

      const itemName = resolvedQr?.itemName || resolvedQr?.item?.name || `Item ${resolvedQr?.itemId || '-'}`;
      const quantity = Number(resolvedQr?.quantity || resolvedQr?.deliveryOrderItem?.quantity || 1);
      const itemSku = resolvedQr?.itemSku || resolvedQr?.item?.sku || 'UNKNOWN';

      setCurrentItem({
        id: resolvedQr?.deliveryOrderItemId || resolvedQr?.itemId || normalizedRawValue,
        name: itemName,
        code: itemSku,
        unit: resolvedQr?.itemUnit || resolvedQr?.item?.unit || resolvedQr?.unit || "PCS",
        expected: quantity,
        actual: 0
      });

      setIsScanned(true);
      setActiveTab("hitung");
      setCameraMode("item");
      setQtyInput("");
      setEvidences([]);
    };

    const scanFrame = async () => {
      if (cancelled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return;
      }

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code?.data) {
        await processDetectedCode(code.data);
      }
    };

    intervalId = window.setInterval(scanFrame, 250);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }
    };
  }, [activeTab, cameraError]);

  // --- LOGIC HANDLERS ---
  const handleNextBatch = () => {
    setIsScanned(false);
    setActiveTab("scan");
    setCameraMode("qr");
    setQtyInput("");
    setDecodedQr(null);
    setCurrentItem(null);
    setEvidences([]);
    lastDecodedQrRef.current = "";
  };

  const handleResetSession = ({ preserveNotice = false } = {}) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith("aivas-admin") || key.startsWith("aivas_admin"))
          .forEach((key) => window.localStorage.removeItem(key));
      }
    } catch (error) {
      console.error("Failed clearing local storage keys:", error);
    }
    if (!preserveNotice) {
      setSaveNotice("Data lokal dibersihkan.");
    }
    handleNextBatch();
  };

  // Capture photo and save evidence locally
  const handleSimpanBukti = async () => {
    console.log('handleSimpanBukti called');
    const qty = Number(qtyInput);
    console.log('qty:', qty);
    
    if (!qty || qty <= 0) {
      setSaveNotice("Isi QTY aktual dulu.");
      return;
    }

    if (!videoRef.current) {
      setSaveNotice("Kamera belum siap, coba lagi.");
      return;
    }

    try {
      // Capture photo from video
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
      const timestamp = new Date().toISOString();

      console.log('Photo captured, size:', photoBase64.length);

      // Save evidence locally
      const evidence = {
        photo_base64: photoBase64,
        qty_in_photo: qty,
        timestamp,
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        accuracy: currentLocation?.accuracy
      };

      console.log('Evidence object:', evidence);

      setEvidences(prev => {
        const newEvidences = [...prev, evidence];
        console.log('New evidences array:', newEvidences);
        return newEvidences;
      });
      
      // Update actual qty
      if (currentItem) {
        setCurrentItem(prev => ({
          ...prev,
          actual: (prev.actual || 0) + qty
        }));
      }

      setQtyInput("");
      setSaveNotice(`Bukti tersimpan. Total: ${(currentItem?.actual || 0) + qty} ${currentUnit}.`);
    } catch (error) {
      console.error('Error capturing photo:', error);
      setSaveNotice("Gagal simpan bukti, coba lagi.");
    }
  };

  // Submit all evidences to server
  const handleFinish = async () => {
    console.log('handleFinish called');
    console.log('decodedQr:', decodedQr);
    console.log('currentItem:', currentItem);
    console.log('evidences:', evidences);

    if (!decodedQr || !currentItem) {
      setSaveNotice("Data QR belum lengkap.");
      return;
    }

    if (evidences.length === 0) {
      setSaveNotice("Minimal 1 bukti foto diperlukan.");
      return;
    }

    const totalQty = evidences.reduce((sum, e) => sum + e.qty_in_photo, 0);
    console.log('totalQty:', totalQty, 'currentItem.actual:', currentItem.actual);

    if (totalQty !== currentItem.actual) {
      setSaveNotice(`Total bukti (${totalQty}) belum sama dengan qty aktual (${currentItem.actual}).`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        qr_code_id: decodedQr.qrCode?.id,
        delivery_order_item_id: decodedQr.deliveryOrderItemId,
        qty_actual: currentItem.actual,
        location: 'WAREHOUSE',
        device_id: navigator.userAgent.substring(0, 100), // Truncate to fit VARCHAR(100)
        notes: finishComment || null,
        evidences
      };

      console.log('Sending payload:', payload);

      const response = await fetch('/api/inbound-scan/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      
      let result;
      try {
        result = await response.json();
      } catch (e) {
        // If response is not JSON (like "Forbidden" text), create error object
        const text = await response.text();
        result = { error: text || `HTTP ${response.status}` };
      }
      
      console.log('Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menyimpan data');
      }

      const finalStatus = String(result?.data?.status || "").toUpperCase();
      setSaveNotice(`Berhasil (${finalStatus || "UNKNOWN"}). ${result.data.photo_count} foto tersimpan.`);
      setShowFinishModal(false);
      setFinishComment("");
      handleResetSession({ preserveNotice: true });
    } catch (error) {
      console.error('Error submitting:', error);
      setSaveNotice(`Submit gagal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validasi & Submit Reject
  const handleSubmitReject = async () => {
    if (!reasonInput.trim()) {
      setRejectError(true);
      return;
    }
    
    if (!decodedQr || !currentItem) {
      setSaveNotice("Data QR belum lengkap.");
      return;
    }

    if (evidences.length === 0) {
      setSaveNotice("Reject tetap membutuhkan bukti foto.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/inbound-scan/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_code_id: decodedQr.qrCode?.id,
          delivery_order_item_id: decodedQr.deliveryOrderItemId,
          qty_actual: Number(currentItem?.actual || 0),
          mode: 'reject',
          reject_reason: reasonInput.trim(),
          location: 'WAREHOUSE',
          device_id: navigator.userAgent.substring(0, 100),
          notes: finishComment || null,
          evidences
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menyimpan reject');
      }

      setSaveNotice("Reject berhasil dikirim.");
      setShowRejectModal(false);
      setReasonInput("");
      setRejectError(false);
      setFinishComment("");
      handleResetSession({ preserveNotice: true });
    } catch (error) {
      console.error('Error submitting reject:', error);
      setSaveNotice(`Reject gagal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumpad = (num) => setQtyInput((prev) => prev + num);
  const handleClear = () => setQtyInput("");
  const handleDelete = () => setQtyInput((prev) => prev.slice(0, -1));

  const handleRetryCamera = () => {
    setCameraRetryKey((prev) => prev + 1);
  };

  const handleSidebarToggle = () => {
    window.dispatchEvent(new Event("aivas-toggle-admin-sidebar"));
  };

  const isPortraitMobile = isMobileViewport && !isLandscapeMobile;

  return (
    <>
      {saveNotice && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] px-3 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-semibold shadow-lg">
          {saveNotice}
        </div>
      )}
      <div className={`h-[100dvh] w-[100dvw] overflow-hidden bg-[#050b16] text-white flex ${isLandscapeMobile ? "flex-row" : "flex-col lg:flex-row"}`}>
        {/* LEFT BOX: Camera feed with overlay controls */}
        <section className={`relative min-w-0 overflow-hidden ${isLandscapeMobile ? "h-full flex-1" : "h-[48dvh] w-full lg:h-full lg:flex-1"}`}>
          {/* Camera feed - fits inside the box */}
          {cameraError ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-5 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-red-300 opacity-90">
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
                <path d="M10.3 4.3L2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3l-7.6-13.7a2 2 0 0 0-3.4 0z"></path>
              </svg>
              <p className="mb-1 text-sm font-semibold text-white">Kamera tidak aktif</p>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-300">{cameraError}</p>
              <button onClick={handleRetryCamera} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
                Coba lagi
              </button>
            </div>
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain" />
          )}

          {/* Overlay: Logo + Name and QR/ITEM toggle */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 p-2">
            <button
              type="button"
              onClick={handleSidebarToggle}
              className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm"
              aria-label="Buka atau tutup sidebar"
            >
              <img src="/logo.png" alt="AIVAS Logo" className="h-6 w-auto object-contain mix-blend-screen" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">AIVAS</span>
            </button>
            <div className="flex items-center">
              <div
                className={`rounded-l-full border border-white/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${cameraMode === "qr" ? "bg-white text-slate-900" : "bg-black/40 text-white/70 backdrop-blur-sm"}`}
              >
                QR
              </div>
              <div
                className={`rounded-r-full border-y border-r border-white/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${cameraMode === "item" ? "bg-white text-slate-900" : "bg-black/40 text-white/70 backdrop-blur-sm"}`}
              >
                ITEM
              </div>
            </div>
          </div>

        </section>

        {/* RIGHT BOX: Keypad & buttons - no rounded corners, hugs device edge */}
        <section className={`relative flex flex-col bg-white text-slate-900 overflow-y-auto ${
          isLandscapeMobile ? "h-full w-[45vw] max-w-[280px]" : "h-[52dvh] w-full max-w-none lg:h-full lg:w-[45vw] lg:max-w-[280px]"
        } ${cameraMode === "qr" ? "pointer-events-none" : ""}`}>
          {cameraMode === "qr" && (
            <div className="absolute inset-0 z-30 bg-white/85 backdrop-blur-[1px] flex items-center justify-center px-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Scan QR valid untuk mengaktifkan panel input
              </p>
            </div>
          )}
          {/* Item info - always visible, 2 columns */}
          <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-slate-100">
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Item</div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-800">{currentItem?.name || "-"}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Expected</div>
              <div className="mt-0.5 text-[11px] font-semibold text-slate-800">{currentItem?.expected ?? "-"} {currentUnit}</div>
            </div>
          </div>

          {/* Evidence count */}
          {evidences.length > 0 && (
            <div className="px-3 py-1 bg-blue-50 border-b border-blue-100">
              <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-600">
                {evidences.length} Bukti Tersimpan • Total: {currentItem?.actual || 0} {currentUnit}
              </div>
            </div>
          )}

          {/* QTY Display */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">QTY AKTUAL</p>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{qtyInput || (isScanned ? "0" : "-")}</span>
          </div>

          <div className="mx-3 mb-2 flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 shadow-inner">
            <span className="text-lg font-black text-slate-900">{qtyInput || (isScanned ? "0" : "-")}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">{currentUnit}</span>
          </div>

          {/* Numpad */}
          <div className="grid flex-1 min-h-0 grid-cols-3 auto-rows-fr gap-1.5 px-3 pb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumpad(num.toString())}
                className="min-h-[2.5rem] rounded-lg border border-slate-200/80 bg-white py-2 text-sm font-bold text-slate-700 shadow-sm transition-all active:scale-95 hover:bg-slate-50"
              >
                {num}
              </button>
            ))}
            <button onClick={handleClear} className="min-h-[2.5rem] rounded-lg border border-orange-200/60 bg-orange-50 py-2 text-sm font-bold text-orange-600 shadow-sm transition-all active:scale-95 hover:bg-orange-100">
              C
            </button>
            <button onClick={() => handleNumpad("0")} className="min-h-[2.5rem] rounded-lg border border-slate-200/80 bg-white py-2 text-sm font-bold text-slate-700 shadow-sm transition-all active:scale-95 hover:bg-slate-50">
              0
            </button>
            <button onClick={handleDelete} className="flex min-h-[2.5rem] items-center justify-center rounded-lg border border-slate-200/80 bg-white py-2 text-slate-600 shadow-sm transition-all active:scale-95 hover:bg-slate-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
            </button>
          </div>

          {/* Action buttons */}
          <div className="px-3 py-2 mt-auto space-y-1.5">
            {saveNotice && (
              <div className="rounded-lg bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-2">
                {saveNotice}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleSimpanBukti}
                disabled={!isQtyReady}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all active:scale-[0.98] ${
                  isQtyReady
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              >
                Simpan
              </button>
              <button
                onClick={handleResetSession}
                className="rounded-lg bg-slate-200 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-300"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setShowRejectModal(true)} className="rounded-lg bg-red-500 py-1.5 text-[10px] font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-red-600">
                Reject
              </button>
              <button 
                onClick={() => {
                  console.log('Finish button clicked');
                  console.log('evidences.length:', evidences.length);
                  console.log('isSubmitting:', isSubmitting);
                  setShowFinishModal(true);
                }} 
                className={`rounded-lg py-1.5 text-[10px] font-bold tracking-wide shadow-sm transition-colors ${
                  evidences.length === 0 || isSubmitting
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-300 text-emerald-950 hover:bg-emerald-200"
                }`} 
                disabled={evidences.length === 0 || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Finish'}
              </button>
            </div>
          </div>
        </section>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Modals - moved outside desktop container so they work on mobile too */}
      {/* ================================================================= */}
      {/* MODAL REJECT                                                      */}
      {/* ================================================================= */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-[760px] bg-white rounded-[24px] shadow-2xl flex flex-col p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="border border-gray-200 rounded-xl p-3 mb-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Alasan Reject (Wajib)
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => {
                  setReasonInput(e.target.value);
                  if (e.target.value.trim()) setRejectError(false);
                }}
                placeholder="Tulis alasan reject..."
                className={`w-full h-20 bg-transparent resize-none outline-none text-slate-900 text-[14px] placeholder:text-slate-400 ${
                  rejectError ? "border border-red-300 rounded-md p-2" : ""
                }`}
              />
              {rejectError && <p className="mt-1 text-[11px] font-semibold text-red-500">Alasan wajib diisi.</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
              <button onClick={() => { setShowRejectModal(false); setRejectError(false); }} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitReject} disabled={isSubmitting} className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL FINISH                                                      */}
      {/* ================================================================= */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className={`w-full bg-white rounded-[24px] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 ${isLandscapeMobile ? "max-w-[760px] p-4 max-h-[92vh]" : "max-w-[900px] max-h-[95vh] p-8 overflow-y-auto"}`}>
            <div className="grid grid-cols-2 gap-2 text-[13px] mb-4">
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DO</div>
                <div className="font-bold text-gray-800">{decodedQr?.doNumber || "-"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BOX</div>
                <div className="font-bold text-gray-800">{decodedQr?.boxNumber || "-"}</div>
              </div>
              <div className="col-span-2 border-t border-gray-200 my-1"></div>
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ITEM</div>
                <div className="font-bold text-gray-800">{currentItem?.name || "-"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">QTY AKTUAL</div>
                <div className="font-black text-gray-800">{currentItem?.actual ?? 0} {currentUnit}</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3 mb-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Komentar (Opsional)
              </label>
              <textarea
                value={finishComment}
                onChange={(e) => setFinishComment(e.target.value)}
                placeholder="Catatan singkat..."
                className="w-full h-14 bg-transparent resize-none outline-none text-slate-900 text-[14px] placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto pt-2">
              <button 
                onClick={() => setShowFinishModal(false)} 
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleFinish} 
                className="w-full px-4 py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  <>Submit</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
