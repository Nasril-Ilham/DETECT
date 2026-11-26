# Dettect — Bot & Disinformasi Detector

**Dettect** adalah ekstensi Google Chrome (Manifest V3) yang mendeteksi akun bot/buzzer dan potensi disinformasi secara real-time di **X (Twitter)**. Setiap tweet di timeline dipindai otomatis lalu diberi badge warna agar pengguna tahu mana yang aman dan mana yang perlu diwaspadai.

Proyek ini dibuat untuk hackathon.

## Fitur

- **Deteksi real-time** — tweet di `x.com` / `twitter.com` dipindai otomatis setiap 2,5 detik.
- **Badge warna** di samping username:
  - 🟢 **Aman** — tidak ada indikasi mencurigakan
  - 🟡 **Curiga** — ada beberapa ciri bot/buzzer
  - 🔴 **Bot!** — terindikasi kuat bot/buzzer
- **Tooltip alasan** — hover badge untuk melihat skor risiko dan alasan deteksi dalam bahasa awam.
- **Dashboard popup** — statistik jumlah tweet dipindai, ditandai, dan aman, plus 10 deteksi terbaru.
- **Badge counter di ikon** — jumlah akun yang ditandai (abu-abu = 0, kuning = 1–9, merah = ≥10).
- **Demo Mode** — menampilkan 4 tweet contoh di halaman X untuk presentasi tanpa harus scroll timeline asli.
- **Privasi** — semua data disimpan lokal di `chrome.storage.local`; tidak ada server, API berbayar, atau API key.

## Cara Kerja

Setiap tweet dinilai dengan beberapa heuristik. Bobot dari aturan yang terpicu dijumlahkan menjadi **skor risiko (maks. 100)**.

| # | Aturan | Bobot |
|---|--------|-------|
| 1 | Username berakhiran `_`/angka minimal 4 karakter (mis. `user88211`) | 25 |
| 2 | Akun tanpa bio / deskripsi | 15 |
| 3 | Foto profil default X | 20 |
| 4 | Teks tweet yang sama muncul ≥3 kali dalam satu sesi | 30 |
| 5 | ≥5 hashtag dalam satu tweet | 20 |
| 6 | Tweet hanya berisi link tanpa konteks | 10 |

| Skor | Level |
|------|-------|
| 0–39 | 🟢 Aman |
| 40–69 | 🟡 Curiga |
| 70–100 | 🔴 Bot! |

## Struktur Proyek

```
DETECT/
├── manifest.json   # Konfigurasi ekstensi (Chrome MV3)
├── content.js      # Logika deteksi: heuristik, skor, injeksi badge, Demo Mode
├── styles.css      # Styling badge & tooltip di halaman X
├── background.js   # Service worker: simpan statistik & update badge counter ikon
├── popup.html      # Tampilan dashboard popup
├── popup.css       # Styling popup
├── popup.js        # Logika popup: render statistik, Demo Mode, reset
├── icons/          # Ikon ekstensi (16, 48, 128 px)
└── PANDUAN.md      # Panduan pemasangan & demo lengkap
```

Alur data: `content.js` memindai tweet → mengirim pesan `SCAN_UPDATE` ke `background.js` → statistik disimpan di `chrome.storage.local` → `popup.js` membaca dan menampilkannya.

## Instalasi

1. Clone repo ini:
   ```bash
   git clone https://github.com/Nasril-Ilham/DETECT.git
   ```
2. Buka `chrome://extensions` di Chrome (atau browser berbasis Chromium seperti Edge/Brave).
3. Aktifkan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked**, lalu pilih folder `DETECT` (yang berisi `manifest.json`).
5. Pin ekstensi **Dettect** lewat ikon puzzle 🧩 di toolbar.

## Penggunaan

1. Buka [x.com](https://x.com) dan scroll timeline — badge akan muncul di setiap tweet.
2. Hover badge untuk melihat alasan deteksi.
3. Klik ikon Dettect untuk membuka dashboard statistik.
4. **Demo Mode:** dengan tab X.com aktif, klik ikon Dettect → **🎬 Aktifkan Demo Mode**.
5. **Reset statistik:** klik ikon Dettect → **🔄 Reset Statistik**.

Panduan lebih detail (termasuk tips demo untuk juri) ada di [PANDUAN.md](PANDUAN.md).

## Keterbatasan

- Hanya berjalan di `https://x.com/*` dan `https://twitter.com/*`.
- Deteksi berbasis heuristik sederhana, bukan machine learning — bisa ada false positive/negative.
- Struktur DOM X.com bisa berubah sewaktu-waktu; jika badge tidak muncul, cek apakah selector `article[data-testid="tweet"]` masih valid.
- Data bio dan rasio follower tidak tersedia di timeline, sehingga beberapa heuristik terbatas.

## Teknologi

JavaScript (vanilla), HTML, CSS, Chrome Extension API (Manifest V3: `storage`, `activeTab`, `scripting`).
