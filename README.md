# PSB FM — PWA Hosting

Repository ini khusus untuk menyajikan frontend Progressive Web App (PWA) PSB Fathan Mubina melalui GitHub Pages.

## Batas repository

- Hanya berisi file frontend statis yang diperlukan oleh browser.
- Source backend Google Apps Script, file database, kredensial, token, dan arsip internal tidak disimpan di sini.
- URL Web App Apps Script dikonfigurasi melalui menu **Pengaturan Koneksi** di aplikasi, bukan ditanam di source.
- Repository pengembangan utama tetap privat: https://github.com/appfathanmubina/ppsb-fm

## Hosting

Target URL GitHub Pages:
https://appfathanmubina.github.io/psbfm2027/

Workflow `.github/workflows/deploy-pages.yml` menerbitkan isi repository melalui GitHub Pages saat ada perubahan pada branch `main`.

## Catatan operasional

1. Pastikan GitHub Pages diaktifkan dengan sumber **GitHub Actions** pada Settings → Pages.
2. Setelah deployment workflow berhasil, buka URL hosting di atas melalui HTTPS.
3. Masukkan URL Web App Apps Script yang telah disetujui melalui menu Pengaturan Koneksi.
4. Pengujian koneksi Bridge dan seluruh alur tetap harus dilakukan pada lingkungan staging sebelum penggunaan produksi.

Pendaftaran akun Wali masih dikunci pada source sampai pembukaan PSB disetujui.
