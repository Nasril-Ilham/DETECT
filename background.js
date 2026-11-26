/* =================================================================
   background.js — Service Worker (Manifest V3)
   =================================================================
   Tugas utama:
   1. Menerima pesan "SCAN_UPDATE" dari content.js
      berisi jumlah tweet yang sudah dipindai, ditandai, dan aman.
   2. Menyimpan statistik ke chrome.storage.local agar bisa
      ditampilkan di popup.
   3. Mengupdate badge counter (angka merah di ikon ekstensi)
      sesuai jumlah akun yang ditandai.
   4. Menampilkan warna badge berbeda: abu-abu (0), kuning (1-9),
      merah (>=10) supaya user langsung tahu intensitas.
   ================================================================= */

// Saat service worker pertama kali dijalankan, set badge default
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
  chrome.action.setBadgeText({ text: "" });

  // Inisialisasi statistik default di storage
  chrome.storage.local.get("dettectStats", (data) => {
    if (!data.dettectStats) {
      chrome.storage.local.set({
        dettectStats: {
          scanned: 0,    // total tweet dipindai
          flagged: 0,    // total ditandai (kuning + merah)
          safe: 0,       // total aman (hijau)
          recent: []     // daftar deteksi terbaru (max 10)
        }
      });
    }
  });
});

// Listener untuk pesan dari content.js atau popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // === Pesan: Update statistik dari content.js ===
  if (message.type === "SCAN_UPDATE") {
    const { scanned, flagged, safe, recentItem } = message.payload;

    // Ambil statistik lama, tambahkan dengan yang baru
    chrome.storage.local.get("dettectStats", (data) => {
      const old = data.dettectStats || { scanned: 0, flagged: 0, safe: 0, recent: [] };

      // Karena content.js mengirim inkremental (selisih), kita jumlahkan
      const newStats = {
        scanned: old.scanned + scanned,
        flagged: old.flagged + flagged,
        safe:    old.safe    + safe,
        recent:  recentItem
          ? [recentItem, ...old.recent].slice(0, 10)  // tambah di depan, max 10
          : old.recent
      };

      chrome.storage.local.set({ dettectStats: newStats });

      // Update badge counter = total flagged
      const total = newStats.flagged;
      const badgeText = total > 99 ? "99+" : String(total);
      const badgeColor = total === 0 ? "#64748b" : total < 10 ? "#f59e0b" : "#ef4444";

      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: badgeColor });

      sendResponse({ ok: true });
    });

    return true; // penting: agar sendResponse dipanggil secara async
  }

  // === Pesan: Reset statistik dari popup.js ===
  if (message.type === "RESET_STATS") {
    const fresh = { scanned: 0, flagged: 0, safe: 0, recent: [] };
    chrome.storage.local.set({ dettectStats: fresh });
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true, stats: fresh });
    return true;
  }

  // === Pesan: Aktifkan Demo Mode (kirim ke tab aktif) ===
  if (message.type === "TOGGLE_DEMO") {
    // Ambil tab aktif saat ini
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "RUN_DEMO" }, (resp) => {
          sendResponse(resp || { ok: true });
        });
      } else {
        sendResponse({ ok: false, error: "Tidak ada tab aktif" });
      }
    });
    return true;
  }
});
