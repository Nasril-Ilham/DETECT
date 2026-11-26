/* =================================================================
   popup.js — Logika dashboard popup Dettect
   =================================================================
   Tugas:
   1. Saat popup dibuka, ambil statistik dari chrome.storage.local
      dan tampilkan di kartu + daftar deteksi terbaru.
   2. Tombol "Demo Mode" → kirim pesan ke background.js yang
      meneruskannya ke content.js di tab aktif.
   3. Tombol "Reset Statistik" → kosongkan semua statistik.
   4. Dengarkan perubahan storage agar popup selalu fresh.
   ================================================================= */

// === Referensi elemen DOM ===
const statScanned = document.getElementById("statScanned");
const statFlagged = document.getElementById("statFlagged");
const statSafe    = document.getElementById("statSafe");
const recentList  = document.getElementById("recentList");
const btnDemo     = document.getElementById("btnDemo");
const btnReset    = document.getElementById("btnReset");
const statusText  = document.getElementById("statusText");
const statusDot   = document.getElementById("statusDot");

/* =================================================================
   FUNGSI: Render ulang tampilan dari data statistik
   ================================================================= */
function renderStats(stats) {
  if (!stats) return;

  // Animasi angka naik (singkat) supaya terasa hidup
  animateNumber(statScanned, stats.scanned);
  animateNumber(statFlagged, stats.flagged);
  animateNumber(statSafe,    stats.safe);

  // Render daftar deteksi terbaru
  if (!stats.recent || stats.recent.length === 0) {
    recentList.innerHTML =
      '<p class="dettect-empty">Belum ada deteksi. Buka X.com lalu scroll, atau coba Demo Mode.</p>';
    return;
  }

  const html = stats.recent.map((item) => {
    const emoji = item.level === "danger" ? "🚨"
                : item.level === "warning" ? "⚠️" : "✅";
    const reason = (item.reasons && item.reasons[0]) || "Tidak ada detail.";
    return `
      <div class="dettect-recent-item">
        <div class="dettect-recent-emoji">${emoji}</div>
        <div class="dettect-recent-info">
          <div class="dettect-recent-user">@${escapeHtml(item.username)}</div>
          <div class="dettect-recent-reason">${escapeHtml(reason)}</div>
          <div class="dettect-recent-time">${item.time || ""} • Skor ${item.score}/100</div>
        </div>
      </div>
    `;
  }).join("");

  recentList.innerHTML = html;
}

/* =================================================================
   FUNGSI: Animasi angka naik dari 0 ke target (500ms)
   ================================================================= */
function animateNumber(el, target) {
  const start = parseInt(el.textContent, 10) || 0;
  if (start === target) return;
  const duration = 400;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.round(start + (target - start) * progress);
    el.textContent = String(value);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* =================================================================
   FUNGSI: Escape HTML agar aman dari XSS
   ================================================================= */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =================================================================
   FUNGSI: Ambil statistik dari storage & render
   ================================================================= */
function loadAndRender() {
  chrome.storage.local.get("dettectStats", (data) => {
    renderStats(data.dettectStats || { scanned: 0, flagged: 0, safe: 0, recent: [] });
  });
}

/* =================================================================
   EVENT LISTENERS
   ================================================================= */

// Tombol Demo Mode
btnDemo.addEventListener("click", () => {
  statusText.textContent = "Menjalankan Demo Mode...";
  statusDot.style.background = "#f59e0b";

  chrome.runtime.sendMessage({ type: "TOGGLE_DEMO" }, (resp) => {
    if (chrome.runtime.lastError || (resp && resp.ok === false)) {
      statusText.textContent = "⚠️ Buka tab X.com dulu, lalu coba lagi.";
      statusDot.style.background = "#ef4444";
      setTimeout(() => {
        statusText.textContent = "Memantau X.com...";
        statusDot.style.background = "#22c55e";
      }, 3000);
      return;
    }
    statusText.textContent = "✅ Demo Mode aktif! Lihat X.com.";
    statusDot.style.background = "#22c55e";
    // Tutup popup agar user langsung lihat halaman
    setTimeout(() => window.close(), 1200);
  });
});

// Tombol Reset Statistik
btnReset.addEventListener("click", () => {
  if (!confirm("Yakin ingin menghapus semua statistik?")) return;
  chrome.runtime.sendMessage({ type: "RESET_STATS" }, () => {
    loadAndRender();
    statusText.textContent = "Statistik direset.";
    setTimeout(() => {
      statusText.textContent = "Memantau X.com...";
    }, 2000);
  });
});

// Dengarkan perubahan storage → render ulang otomatis
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.dettectStats) {
    renderStats(changes.dettectStats.newValue);
  }
});

// === Saat popup dibuka, langsung load statistik ===
loadAndRender();
