/* =================================================================
   content.js — Otak Utama Ekstensi Dettect
   =================================================================
   File ini berjalan di dalam halaman x.com / twitter.com.
   Tugasnya:
   1. Memindai tweet yang muncul di DOM (setiap interval).
   2. Menjalankan beberapa HEURISTIK untuk menilai apakah akun
      di balik tweet itu adalah bot / buzzer / penyebar disinfo.
   3. Menghitung skor risiko 0-100, lalu menempelkan BADGE
      berwarna (hijau/kuning/merah) + tooltip alasan.
   4. Melaporkan statistik ke background.js (service worker)
      untuk ditampilkan di popup & badge ikon.
   5. Mendukung "Demo Mode" — menampilkan tweet contoh agar
      juri hackathon bisa langsung melihat hasil tanpa harus
      scroll X.com nyata.

   Catatan struktur DOM X.com (per Nov 2025):
   - Tweet container:   article[data-testid="tweet"]
   - Username area:     [data-testid="User-Name"]
   - Avatar:            [data-testid="TweetAvatar"] img
   - Tweet text:        [data-testid="tweetText"]
   - Handle @xxx:       <a href="/username">
   ================================================================= */

(() => {
  "use strict";

  // === Konfigurasi global ===
  const SCAN_INTERVAL_MS = 2500;   // interval pemindaian (ms)
  const MAX_RECENT = 10;            // max deteksi terbaru disimpan
  const FLAG_ATTRIBUTE = "data-dettect-scanned"; // penanda agar tweet tidak di-scan ulang

  // Cache untuk deteksi duplikasi konten
  const seenTweetTexts = new Map(); // text -> count

  // Statistik inkremental sejak scan terakhir
  let delta = { scanned: 0, flagged: 0, safe: 0 };

  /* =================================================================
     BAGIAN 1: KUMPULAN HEURISTIK DETEKSI
     Setiap fungsi mengembalikan:
       { hit: boolean, weight: number, reason: string }
     - hit     = true jika aturan terpicu
     - weight  = bobot kontribusi ke skor (0-30)
     - reason  = alasan yang ditampilkan ke user (bahasa awam)
     ================================================================= */

  /**
   * Heuristik 1: Pola username mencurigakan
   * Contoh: andi_2847, user88392, bot12345
   * Regex: berakhir dengan _ atau angka, minimal 4 digit
   */
  function checkUsernamePattern(username) {
    // Regex: akhiran _ atau angka, minimal 4 digit
    const re = /[_0-9]{4,}$/;
    if (re.test(username)) {
      return {
        hit: true,
        weight: 25,
        reason: `Username berakhir dengan deretan angka/acak ("${username}") — ciri khas akun bot otomatis.`
      };
    }
    return { hit: false, weight: 0, reason: "" };
  }

  /**
   * Heuristik 2: Bio kosong
   * Akun bot sering tidak punya bio sama sekali.
   * Catatan: di halaman timeline, bio tidak tampil; kita pakai
   * atribut tambahan di profil bila ada, atau lewati.
   */
  function checkBioEmpty(tweetEl) {
    // Di timeline, bio tidak tersedia; kita cek aria-label avatar
    // Kadang X menempel info "No description" pada akun baru
    const avatar = tweetEl.querySelector('[data-testid="TweetAvatar"]');
    if (avatar) {
      const label = avatar.getAttribute("aria-label") || "";
      if (/no\s*bio|no\s*description|no\s*name/i.test(label)) {
        return {
          hit: true,
          weight: 15,
          reason: "Akun ini tidak memiliki bio / deskripsi profil."
        };
      }
    }
    return { hit: false, weight: 0, reason: "" };
  }

  /**
   * Heuristik 3: Avatar default
   * Akun baru/bot sering pakai avatar default X (abu-abu).
   * URL avatar default mengandung: "default_profile_images"
   */
  function checkDefaultAvatar(tweetEl) {
    const avatarImg = tweetEl.querySelector('[data-testid="TweetAvatar"] img');
    if (avatarImg) {
      const src = avatarImg.getAttribute("src") || "";
      if (/default_profile_images/i.test(src)) {
        return {
          hit: true,
          weight: 20,
          reason: "Menggunakan foto profil default X (abu-abu) — akun belum di-customize."
        };
      }
    }
    return { hit: false, weight: 0, reason: "" };
  }

  /**
   * Heuristik 4: Duplikasi konten
   * Jika teks tweet yang sama muncul >= 3 kali di sesi ini,
   * kemungkinan besar ini spam koordinasi (buzzer).
   */
  function checkDuplicateContent(text) {
    const normalized = text.trim().toLowerCase().slice(0, 200); // potong untuk efisiensi
    if (!normalized) return { hit: false, weight: 0, reason: "" };

    const count = (seenTweetTexts.get(normalized) || 0) + 1;
    seenTweetTexts.set(normalized, count);

    if (count >= 3) {
      return {
        hit: true,
        weight: 30,
        reason: `Teks tweet yang sama muncul ${count} kali — kemungkinan spam terkoordinasi (buzzer).`
      };
    }
    return { hit: false, weight: 0, reason: "" };
  }

  /**
   * Heuristik 5: Hashtag spam
   * Tweet dengan >= 5 hashtag cenderung promosi/spam.
   */
  function checkHashtagSpam(text) {
    const hashtags = text.match(/#[\w\u00C0-\u024F]+/g) || [];
    if (hashtags.length >= 5) {
      return {
        hit: true,
        weight: 20,
        reason: `Tweet berisi ${hashtags.length} hashtag — pola spam promosi.`
      };
    }
    return { hit: false, weight: 0, reason: "" };
  }

  /**
   * Heuristik 6: Rasio follower/following ekstrem
   * Akun bot sering following >> follower.
   * Catatan: di timeline ini tidak langsung tersedia, jadi kita
   * pakai ciri proxy — username dengan angka tinggi + tweet pendek
   * repetitive. Fungsi ini sebagai placeholder ekspansi future.
   */
  function checkFollowerRatio(tweetEl) {
    // Implementasi sederhana: jika tweet sangat pendek (<20 char)
    // dan hanya berisi emoji/link, anggap mencurigakan ringan
    const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
    if (textEl) {
      const txt = (textEl.textContent || "").trim();
      if (txt.length > 0 && txt.length < 20 && /^(\s*https?:\/\/\S+\s*)$/i.test(txt)) {
        return {
          hit: true,
          weight: 10,
          reason: "Tweet hanya berisi link tanpa konteks — ciri spam link."
        };
      }
    }
    return { hit: false, weight: 0, reason: "" };
  }

  /* =================================================================
     BAGIAN 2: FUNGSI UTAMA — Analisis satu tweet
     ================================================================= */

  /**
   * Analisis satu elemen tweet, kembalikan objek hasil:
   * { username, score, level, reasons: [], badgeEl }
   * - level: "safe" | "warning" | "danger"
   */
  function analyzeTweet(tweetEl) {
    const reasons = [];
    let score = 0;

    // 1) Ambil username dari link [data-testid="User-Name"] a[href^="/"]
    const userNameArea = tweetEl.querySelector('[data-testid="User-Name"]');
    let username = "";
    if (userNameArea) {
      const links = userNameArea.querySelectorAll('a[href^="/"]');
      for (const a of links) {
        const href = a.getAttribute("href") || "";
        // href berbentuk "/username" (bukan "/username/status/...")
        if (/^\/[^/]+$/.test(href) && !href.includes("/home")) {
          username = href.replace("/", "").trim();
          break;
        }
      }
    }

    // 2) Ambil teks tweet
    const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
    const tweetText = textEl ? (textEl.textContent || "").trim() : "";

    // 3) Jalankan semua heuristik dan akumulasi skor
    const checks = [
      checkUsernamePattern(username),
      checkBioEmpty(tweetEl),
      checkDefaultAvatar(tweetEl),
      checkDuplicateContent(tweetText),
      checkHashtagSpam(tweetText),
      checkFollowerRatio(tweetEl)
    ];

    for (const c of checks) {
      if (c.hit) {
        score += c.weight;
        reasons.push(c.reason);
      }
    }

    // Cap skor di 100
    score = Math.min(score, 100);

    // 4) Tentukan level berdasarkan skor
    let level = "safe";
    if (score >= 70) level = "danger";
    else if (score >= 40) level = "warning";

    return { username, score, level, reasons };
  }

  /* =================================================================
     BAGIAN 3: INJECT BADGE VISUAL KE DOM
     ================================================================= */

  /**
   * Buat elemen badge + tooltip dan tempel setelah area username.
   */
  function injectBadge(tweetEl, result) {
    // Cari area username untuk tempat menempel badge
    const userNameArea = tweetEl.querySelector('[data-testid="User-Name"]');
    if (!userNameArea) return;

    // Buat badge
    const badge = document.createElement("span");
    badge.className = `dettect-badge dettect-${result.level}`;
    const icon = result.level === "safe" ? "✅" : result.level === "warning" ? "⚠️" : "🚨";
    const label = result.level === "safe"
      ? "Aman"
      : result.level === "warning"
        ? "Curiga"
        : "Bot!";
    badge.textContent = `${icon} ${label}`;
    badge.setAttribute("data-dettect-score", String(result.score));

    // Buat score bar
    const scoreBar = document.createElement("span");
    scoreBar.className = "dettect-score-bar";
    const fill = document.createElement("span");
    fill.className = "dettect-score-fill";
    fill.style.width = `${result.score}%`;
    const fillColor = result.level === "safe" ? "#22c55e"
                    : result.level === "warning" ? "#f59e0b" : "#ef4444";
    fill.style.background = fillColor;
    scoreBar.appendChild(fill);

    // Buat tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "dettect-tooltip";
    const levelText = result.level === "safe" ? "Aman"
                    : result.level === "warning" ? "Mencurigakan" : "Terdeteksi Bot/Buzzer";
    const reasonsHtml = result.reasons.length
      ? `<ul><li>${result.reasons.join("</li><li>")}</li></ul>`
      : "<p>Tidak ada indikasi mencurigakan.</p>";
    tooltip.innerHTML = `
      <div class="dettect-tooltip-title">Dettect — ${levelText}</div>
      <p>Skor risiko: <strong>${result.score}/100</strong></p>
      ${reasonsHtml}
    `;
    document.body.appendChild(tooltip);

    // Event hover badge → tampilkan tooltip di posisi badge
    badge.addEventListener("mouseenter", () => {
      const rect = badge.getBoundingClientRect();
      tooltip.style.left = `${rect.left + window.scrollX}px`;
      tooltip.style.top  = `${rect.bottom + window.scrollY + 6}px`;
      tooltip.classList.add("dettect-show");
    });
    badge.addEventListener("mouseleave", () => {
      tooltip.classList.remove("dettect-show");
    });

    // Tempel badge & score bar ke area username
    userNameArea.appendChild(badge);
    userNameArea.appendChild(scoreBar);
  }

  /* =================================================================
     BAGIAN 4: LOOP PEMINDAIAN (INFINITE SCROLL)
     ================================================================= */

  /**
   * Pindai semua tweet di halaman yang belum ditandai.
   * Dipanggil oleh setInterval setiap SCAN_INTERVAL_MS.
   */
  function scanAllTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    let newCount = 0;

    tweets.forEach((tweet) => {
      // Lewati tweet yang sudah di-scan
      if (tweet.getAttribute(FLAG_ATTRIBUTE)) return;
      tweet.setAttribute(FLAG_ATTRIBUTE, "1");
      newCount++;

      const result = analyzeTweet(tweet);
      injectBadge(tweet, result);

      // Update statistik inkremental
      delta.scanned++;
      if (result.level === "safe") delta.safe++;
      else delta.flagged++;

      // Simpan ke "recent" jika flagged
      if (result.level !== "safe") {
        sendToBackground({
          scanned: delta.scanned,
          flagged: delta.flagged,
          safe: delta.safe,
          recentItem: {
            username: result.username || "(unknown)",
            level: result.level,
            score: result.score,
            reasons: result.reasons,
            time: new Date().toLocaleTimeString("id-ID")
          }
        });
        // reset delta setelah kirim
        delta = { scanned: 0, flagged: 0, safe: 0 };
      }
    });

    // Jika ada scan baru tapi tidak ada flagged, tetap kirim update statistik
    if (newCount > 0 && delta.scanned > 0) {
      sendToBackground({
        scanned: delta.scanned,
        flagged: delta.flagged,
        safe: delta.safe,
        recentItem: null
      });
      delta = { scanned: 0, flagged: 0, safe: 0 };
    }
  }

  /**
   * Kirim pesan statistik ke background.js (service worker).
   */
  function sendToBackground(payload) {
    try {
      chrome.runtime.sendMessage({ type: "SCAN_UPDATE", payload });
    } catch (e) {
      // extension context bisa invalidated saat reload — diam-diam lewati
      console.warn("[Dettect] Gagal kirim ke background:", e);
    }
  }

  /* =================================================================
     BAGIAN 5: DEMO MODE
     Dipicu dari popup → background → pesan "RUN_DEMO" ke sini.
     Menampilkan 4 tweet contoh dengan karakteristik berbeda
     supaya juri hackathon langsung lihat hasil deteksi.
     ================================================================= */

  const DEMO_TWEETS = [
    {
      avatar: "🤖",
      name: "Pendukung Setia 8829",
      handle: "@pendukung_8829",
      text: "BANTU RETWEET!! #PILIHAN #MENANG #BESAR #SEMUA #ORANG #SUARA #2024 #PARTAI #JAYA #INDONESIA"
    },
    {
      avatar: "👤",
      name: "User88211",
      handle: "@user88211",
      text: "https://bit.ly/3xAmple-link-tidak-jelas"
    },
    {
      avatar: "📢",
      name: "Buzzer Jaya 1928",
      handle: "@buzzer1928",
      text: "TOLONG SEBARKAN INI KE SEMUA ORANG!!! JANGAN SAMPAI KEHILANGAN MOMENTUM!!! #SEBAR #VIRAL #TRENDING #NOW #SEMUA"
    },
    {
      avatar: "🙋",
      name: "Andi Pratama",
      handle: "@andipratama",
      text: "Baru saja menonton film bagus di bioskop, recommended banget buat akhir pekan."
    }
  ];

  function runDemoMode() {
    // Tampilkan banner notifikasi
    const banner = document.createElement("div");
    banner.className = "dettect-demo-banner";
    banner.textContent = "🎬 Demo Mode Aktif — Lihat tweet contoh di bawah ini!";
    document.body.appendChild(banner);

    // Hapus banner setelah 5 detik
    setTimeout(() => banner.remove(), 5000);

    // Buat kontainer tweet demo di atas body
    const container = document.createElement("div");
    container.id = "dettect-demo-container";
    container.style.cssText = "padding: 20px 12px; max-width: 600px; margin: 20px auto;";

    DEMO_TWEETS.forEach((t) => {
      const tweet = document.createElement("article");
      tweet.className = "dettect-demo-tweet";
      tweet.setAttribute("data-testid", "tweet"); // biar ikut di-scan
      tweet.innerHTML = `
        <div class="dettect-demo-user">
          <div class="dettect-demo-avatar">${t.avatar}</div>
          <div>
            <div class="dettect-demo-name">${t.name}</div>
            <div class="dettect-demo-handle">${t.handle}</div>
          </div>
        </div>
        <div class="dettect-demo-text">${t.text}</div>
      `;

      // Inject atribut TweetAvatar & User-Name mock agar heuristik jalan
      const avatarMock = document.createElement("div");
      avatarMock.setAttribute("data-testid", "TweetAvatar");
      avatarMock.style.display = "none";
      tweet.appendChild(avatarMock);

      const userNameMock = document.createElement("div");
      userNameMock.setAttribute("data-testid", "User-Name");
      userNameMock.style.display = "none";
      const link = document.createElement("a");
      link.setAttribute("href", "/" + t.handle.replace("@", ""));
      userNameMock.appendChild(link);
      tweet.appendChild(userNameMock);

      const textMock = document.createElement("div");
      textMock.setAttribute("data-testid", "tweetText");
      textMock.textContent = t.text;
      textMock.style.display = "none";
      tweet.appendChild(textMock);

      container.appendChild(tweet);
    });

    // Sisipkan di awal body
    document.body.insertBefore(container, document.body.firstChild);

    // Hapus atribut "sudah di-scan" agar demo dipindai ulang
    document.querySelectorAll('#dettect-demo-container article[data-testid="tweet"]')
      .forEach(el => el.removeAttribute(FLAG_ATTRIBUTE));

    // Paksa pindai segera
    setTimeout(scanAllTweets, 300);
  }

  // Listener untuk pesan dari background.js (Demo Mode)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RUN_DEMO") {
      runDemoMode();
      sendResponse({ ok: true });
    }
    return true;
  });

  /* =================================================================
     BAGIAN 6: STARTUP — Mulai pemindaian berkala
     ================================================================= */

  // Pindai sekali saat load
  scanAllTweets();

  // Pindai berkala untuk infinite scroll / lazy load
  setInterval(scanAllTweets, SCAN_INTERVAL_MS);

  // Log konfirmasi di console untuk debugging
  console.log("[Dettect] Content script aktif. Memindai tweet setiap", SCAN_INTERVAL_MS, "ms.");
})();
