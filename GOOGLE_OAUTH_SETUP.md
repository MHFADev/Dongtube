# 🔐 Google OAuth Setup Guide - Dongtube API

## ✅ Apa yang Sudah Saya Perbaiki:

### 1. **Error "Endpoint not found" - SOLVED** ✅
- **Masalah**: Endpoint signup salah (`/auth/register` instead of `/auth/signup`)
- **Solusi**: Sudah diperbaiki di `public/login.html` line 557
- **Status**: Signup sekarang sudah berfungsi dengan benar!

### 2. **Google OAuth Login - READY** ✅
- ✅ Backend Google OAuth sudah ditambahkan di `routes/auth.js`
- ✅ Tombol "Sign in with Google" sudah ditambahkan di halaman login
- ✅ Database model sudah diupdate dengan field `googleId`
- ⚠️ **PERLU SETUP**: Google OAuth Credentials (lihat langkah di bawah)

---

## 📋 Langkah-Langkah Setup Google OAuth

### **Step 1: Buat Google OAuth Credentials** 

1. **Buka Google Cloud Console**
   - Pergi ke: https://console.cloud.google.com/

2. **Buat Project Baru (atau gunakan yang ada)**
   - Klik "Select a project" di bagian atas
   - Klik "NEW PROJECT"
   - Beri nama: `Dongtube API`
   - Klik "CREATE"

3. **Enable Google+ API**
   - Di sidebar kiri, klik "APIs & Services" > "Library"
   - Cari "Google+ API"
   - Klik dan tekan "ENABLE"

4. **Buat OAuth Consent Screen**
   - Di sidebar kiri, klik "OAuth consent screen"
   - Pilih "External" (untuk testing publik)
   - Klik "CREATE"
   - Isi form:
     - **App name**: `Dongtube API`
     - **User support email**: Email kamu
     - **Developer contact**: Email kamu
   - Klik "SAVE AND CONTINUE"
   - Di "Scopes", klik "ADD OR REMOVE SCOPES"
     - Pilih: `email` dan `profile`
     - Klik "UPDATE" > "SAVE AND CONTINUE"
   - Di "Test users", tambahkan email kamu
   - Klik "SAVE AND CONTINUE" > "BACK TO DASHBOARD"

5. **Buat OAuth Client ID**
   - Di sidebar kiri, klik "Credentials"
   - Klik "+ CREATE CREDENTIALS" > "OAuth client ID"
   - **Application type**: Web application
   - **Name**: `Dongtube Web Client`
   - **Authorized JavaScript origins**:
     ```
     https://n-sisko.replit.dev
     http://localhost:5000
     ```
   - **Authorized redirect URIs**:
     ```
     https://n-sisko.replit.dev/auth/google/callback
     http://localhost:5000/auth/google/callback
     ```
   - Klik "CREATE"
   - **SIMPAN**: 
     - `Client ID` (seperti: `123456789-abc.apps.googleusercontent.com`)
     - `Client Secret` (seperti: `GOCSPX-xxxxx`)

---

### **Step 2: Setup Environment Variables di Replit**

1. **Buka Replit Secrets**
   - Di Replit, klik tab "Tools" > "Secrets"
   - Atau langsung klik ikon 🔒 di sidebar

2. **Tambahkan 2 Secrets Baru**:
   
   **Secret 1:**
   ```
   Key: GOOGLE_CLIENT_ID
   Value: [PASTE Client ID dari Google Console]
   ```
   
   **Secret 2:**
   ```
   Key: GOOGLE_CLIENT_SECRET
   Value: [PASTE Client Secret dari Google Console]
   ```

3. **Restart Server**
   - Server akan otomatis restart setelah menambahkan secrets
   - Atau klik tombol "Stop" lalu "Run" di Replit

---

### **Step 3: Test Google OAuth Login** 🧪

1. **Buka halaman login**:
   ```
   https://n-sisko.replit.dev/login.html
   ```

2. **Klik tombol "Sign in with Google"**
   - Akan muncul popup Google login
   - Pilih akun Google kamu
   - Klik "Allow" untuk memberikan akses

3. **Setelah berhasil login**:
   - Jika role kamu `admin`: redirect ke `/admin-panel.html`
   - Jika role kamu `user`: redirect ke `/`

---

## 🎯 Cara Kerja Google OAuth

```
User klik "Sign in with Google"
          ↓
Redirect ke Google Login (/auth/google)
          ↓
User login & approve di Google
          ↓
Google redirect kembali ke /auth/google/callback
          ↓
Backend cek: 
  - Email sudah ada di DB? → Login
  - Email baru? → Buat user baru
          ↓
Generate JWT token & set cookie
          ↓
Redirect ke dashboard (admin-panel atau home)
```

---

## 🔍 Troubleshooting

### ❌ Error: "redirect_uri_mismatch"
**Solusi**: 
- Pastikan URL di Google Console **persis sama** dengan URL Replit kamu
- Format: `https://nama-repl.username.replit.dev/auth/google/callback`

### ❌ Error: "Access blocked: This app's request is invalid"
**Solusi**:
- Pastikan sudah enable Google+ API
- Pastikan OAuth consent screen sudah disetup
- Tambahkan email kamu sebagai test user

### ❌ Error: "invalid_client"
**Solusi**:
- Cek apakah `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` sudah benar di Secrets
- Restart server setelah menambahkan secrets

### ❌ Tombol Google tidak muncul
**Solusi**:
- Clear browser cache
- Hard refresh: `Ctrl + Shift + R` (Windows) atau `Cmd + Shift + R` (Mac)

---

## 📝 Fitur yang Tersedia

### ✅ **Login dengan Email & Password**
- Endpoint: `POST /auth/login`
- Signup: `POST /auth/signup`
- Minimum password: 6 karakter

### ✅ **Login dengan Google OAuth**
- Endpoint: `GET /auth/google`
- Callback: `GET /auth/google/callback`
- Auto-create user jika belum ada
- Link Google account jika email sudah ada

### ✅ **Security Features**
- Password hashing dengan bcryptjs (12 rounds)
- JWT token dengan expiry 7 hari
- HTTP-only cookies
- Email validation
- Google ID stored securely

---

## 🚀 Next Steps (Optional)

1. **Publish OAuth App** (untuk production):
   - Di Google Console > OAuth consent screen
   - Klik "PUBLISH APP"
   - Isi verification form (butuh waktu review ~1-2 minggu)

2. **Add More OAuth Providers**:
   - GitHub OAuth
   - Facebook OAuth
   - Twitter OAuth

3. **Enhanced Security**:
   - Two-factor authentication (2FA)
   - Email verification
   - Password reset via email

---

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Cek console log di browser (F12 > Console)
2. Cek server log di Replit
3. Pastikan semua environment variables sudah benar

**Happy Coding! 🎉**
