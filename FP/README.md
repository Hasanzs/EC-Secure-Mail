EC-Secure Mail — README Sementara

Ringkasan
--------
Proyek ini adalah demo EC-Secure Mail (simulasi EC-ElGamal) yang awalnya menggunakan Firestore. Saya telah memisah kode ke tiga file:
- `EC Secure Mail.html` — markup utama
- `app.js` — logic (module ES). Mendukung dua mode: Firebase (jika konfigurasi tersedia) dan MOCK (localStorage) bila tidak ada konfigurasi.
- `styles.css` — styling tambahan (mengisi rule kecil selain Tailwind).

Tujuan README
-------------
Instruksi singkat untuk menjalankan aplikasi secara lokal, menguji alur pembuatan kunci, pengiriman, dan penerimaan pesan menggunakan MOCK (localStorage) tanpa perlu konfigurasi Firebase.

Cara cepat menjalankan (PowerShell)
----------------------------------
1. Buka PowerShell dan masuk ke folder proyek:

```powershell
cd D:\Kuliah\sem5\Kripto\FP
```

2. Jalankan server HTTP sederhana (diperlukan karena app.js adalah module ES):

```powershell
python -m http.server 8000
```

3. Buka browser dan buka URL:

http://localhost:8000/EC%20Secure%20Mail.html

Catatan: beberapa browser membatasi import module dari file:// sehingga wajib menggunakan HTTP server.

MOCK mode (default ketika Firebase tidak dikonfigurasi)
-----------------------------------------------------
- Jika `firebaseConfig` tidak tersedia, aplikasi otomatis berjalan di MOCK mode.
- MOCK menyimpan data di `localStorage` untuk memudahkan testing tanpa Firebase:
  - `mock_userid` — ID pengguna yang dibuat secara acak per browser
  - `mock_pk_<id>` — private key (string) untuk user
  - `mock_pub_<id>` — public key (string)
  - `mock_inbox_<id>` — array pesan untuk user

Langkah testing (contoh antar-dua-pengguna)
-------------------------------------------
1. Buka URL pada satu tab.
2. Klik "Generate & Simpan Pasangan Kunci ECC". Ini menyimpan kunci ke localStorage dan menampilkan ID Anda.
3. Untuk memerankan pengguna lain: buka browser lain (Chrome vs Firefox) atau buka private window, lalu buka URL yang sama. (Setiap profil browser punya localStorage terpisah sehingga akan jadi user berbeda.)
4. Di jendela pertama, salin ID user A. Di jendela kedua, klik Generate key untuk user B juga.
5. Di jendela B, masukkan ID A sebagai penerima, ketik pesan, klik "Enkripsi & Kirim Pesan".
6. Kembali ke jendela A, tunggu inbox (halaman melakukan polling setiap ~1.5s). Pesan harus muncul dan didekripsi jika kunci privat tersedia.

Tips debugging
--------------
- Buka DevTools (F12) → Console: lihat error JS.
- Lihat Local Storage (DevTools → Application → Local Storage) untuk kunci/pesan mock.
- Jika tombol tidak merespon, cek Network apakah `app.js` dimuat tanpa error (200).

Mengaktifkan Firebase (opsional)
--------------------------------
Jika Anda ingin memakai Firebase yang asli:
1. Siapkan project Firebase dan dapatkan config object (apiKey, authDomain, projectId, dsb.).
2. Cara cepat: buka `app.js` dan ganti baris pembacaan `firebaseConfig` (atau set global `__firebase_config`) sehingga `firebaseConfig` berisi object konfigurasi Anda.
3. Pastikan Firestore rules mengijinkan operasi yang diperlukan atau gunakan Firebase Emulator untuk pengujian lokal.
4. Refresh halaman, bila konfigurasi valid app akan mencoba inisialisasi Firebase.

Membersihkan mock data
----------------------
- Dari DevTools → Application → Local Storage: hapus `mock_userid`, `mock_pk_*`, `mock_pub_*`, `mock_inbox_*` untuk reset lingkungan mock.

File penting
------------
- `EC Secure Mail.html` — entry HTML
- `app.js` — logic utama (periksa constant `IS_MOCK` dan helper mock bila perlu)
- `styles.css` — styling kecil

Langkah selanjutnya (opsional)
-----------------------------
- Ganti inline `onclick` ke event listeners di `app.js` untuk style lebih modern.
- Tambahkan tombol "Simulate new user" untuk cepat membuat session user lain dalam satu browser (bila ingin).
- Tambahkan README lebih lengkap dan instruksi Firebase Emulator.

Jika mau, saya bisa otomatis:
- Mengganti inline onclick menjadi event listeners, atau
- Menambahkan tombol "Simulate user" dan helper UI.

-- README sementara dibuat otomatis oleh tool bantu proyek
