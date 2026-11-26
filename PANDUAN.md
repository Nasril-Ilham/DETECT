# 🛡️ Panduan Memasang & Menggunakan Dettect

> **Dettect** adalah ekstensi Chrome yang mendeteksi akun bot/buzzer dan disinformasi secara real-time di X (Twitter).

---

## 📦 Isi Folder

```
Dettect/
├── manifest.json     ← Konfigurasi ekstensi (Chrome MV3)
├── content.js        ← Otak deteksi (heuristik + badge injection)
├── styles.css        ← Styling badge & tooltip di X.com
├── background.js     ← Service worker + badge counter ikon
├── popup.html        ← Dashboard popup
├── popup.css         ← Styling popup
├── popup.js          ← Logika popup + Demo Mode
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── PANDUAN.md        ← File ini
```

---

## 🚀 Cara Memasang (Load Unpacked)

1. **Buka Google Chrome** (atau Edge/Brave yang berbasis Chromium).
2. Ketik di address bar:
   ```
   chrome://extensions
   ```
   lalu tekan Enter.
3. Aktifkan **Developer mode** (toggle di pojok kanan atas).
4. Klik tombol **Load unpacked** (pojok kiri atas).
5. Pilih folder **`Dettect`** (folder yang berisi `manifest.json`).
6. Ekstensi akan muncul di daftar dengan ikon perisai+lup 🛡️.
7. Klik ikon puzzle 🧩 di toolbar Chrome → pin **Dettect** agar selalu terlihat.

✅ Selesai! Ekstensi sudah aktif.

---

## 🧪 Cara Menggunakan

### Mode Real-time (X.com asli)
1. Buka **https://x.com** atau **https://twitter.com**.
2. Login ke akun X kamu (atau cuma lihat timeline publik).
3. Scroll timeline — setiap tweet akan otomatis dipindai.
4. Lihat **badge warna** di samping username:
   - 🟢 **Aman** — tidak ada indikasi mencurigakan
   - 🟡 **Curiga** — ada beberapa ciri bot/buzzer
   - 🔴 **Bot!** — terindikasi kuat bot/buzzer
5. **Hover mouse ke badge** untuk melihat tooltip berisi alasan deteksi.
6. Klik ikon ekstensi untuk melihat **dashboard statistik**.

### Mode Demo (untuk presentasi hackathon)
1. Buka tab X.com (harus di domain x.com atau twitter.com).
2. Klik ikon **Dettect** di toolbar.
3. Klik tombol **🎬 Aktifkan Demo Mode**.
4. Popup tertutup otomatis, halaman X.com akan menampilkan:
   - Banner ungu "Demo Mode Aktif"
   - 4 tweet contoh dengan karakteristik berbeda
5. Lihat badge yang muncul di tiap tweet contoh:
   - Tweet 1 (`@pendukung_8829`) → 🔴 Bot! (username angka + hashtag spam)
   - Tweet 2 (`@user88211`) → 🔴 Bot! (username angka + link tanpa konteks)
   - Tweet 3 (`@buzzer1928`) → 🔴 Bot! (username angka + hashtag spam)
   - Tweet 4 (`@andipratama`) → 🟢 Aman (username normal + teks wajar)

### Reset Statistik
- Klik ikon Dettect → tombol **🔄 Reset Statistik** → konfirmasi.
- Semua counter kembali ke 0.

---

## 🔍 Heuristik Deteksi yang Digunakan

| # | Aturan | Bobot | Bahasa Awam |
|---|--------|-------|-------------|
| 1 | Username berakhir `_`/angka ≥4 digit | 25 | "Username dengan deretan angka acak" |
| 2 | Bio kosong / no description | 15 | "Akun tidak punya bio" |
| 3 | Avatar default X (abu-abu) | 20 | "Foto profil default" |
| 4 | Tweet sama muncul ≥3 kali | 30 | "Spam terkoordinasi / buzzer" |
| 5 | ≥5 hashtag dalam 1 tweet | 20 | "Pola spam promosi" |
| 6 | Tweet cuma link tanpa konteks | 10 | "Spam link" |

**Skor risiko** = total bobot (max 100).
- 0–39 → 🟢 Aman
- 40–69 → 🟡 Curiga
- 70–100 → 🔴 Bot!

---

## 🧭 Tips Demo untuk Juri Hackathon

1. **Buka X.com dulu** sebelum klik Demo Mode (wajib domain x.com).
2. Jelaskan alur: "Setiap tweet dipindai otomatis, badge muncul real-time."
3. Tunjukkan badge merah pada 3 tweet bot contoh.
4. Hover salah satu badge untuk lihat tooltip alasan.
5. Klik ikon ekstensi → tunjukkan dashboard statistik + daftar deteksi.
6. Tunjukkan badge counter di ikon (angka merah di sudut ikon).

---

## ⚠️ Catatan Teknis

- Ekstensi hanya berjalan di `https://x.com/*` dan `https://twitter.com/*`.
- DOM X.com bisa berubah sewaktu-waktu; jika badge tidak muncul,
  periksa selector `[data-testid="tweet"]` masih valid.
- Statistik disimpan di `chrome.storage.local` — aman, tidak dikirim ke server.
- Tidak ada API berbayar / tidak butuh API key X.

Selamat hackathon! 🚀
