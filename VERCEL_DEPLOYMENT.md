# Panduan Deployment ke Vercel

## 📋 Persiapan Sebelum Deploy

### 1. Environment Variables yang Diperlukan

Sebelum deploy ke Vercel, Anda harus menyiapkan environment variables berikut di dashboard Vercel:

#### **Environment Variables Wajib:**

```bash
# JWT Secret untuk autentikasi
JWT_SECRET=your-secure-random-string-here

# Database PostgreSQL (gunakan Vercel Postgres atau Neon/Supabase)
DATABASE_URL=postgresql://user:password@host:port/database
PGHOST=your-db-host
PGPORT=5432
PGUSER=your-db-user
PGPASSWORD=your-db-password
PGDATABASE=your-db-name

# Node Environment
NODE_ENV=production

# Base URL untuk OAuth callbacks (URL Vercel Anda)
BASE_URL=https://your-app.vercel.app
```

#### **Environment Variables untuk GitHub OAuth (Opsional):**

```bash
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
```

#### **Environment Variables untuk Endpoint Database (Opsional):**

```bash
# Jika menggunakan database terpisah untuk endpoint management
ENDPOINT_DATABASE_URL=postgresql://user:password@host:port/endpoint_database
```

---

## 🚀 Langkah-langkah Deployment

### Step 1: Persiapkan Repository

1. Push kode Anda ke GitHub/GitLab/Bitbucket
2. Pastikan file `vercel.json` sudah ada di root directory
3. Pastikan `.gitignore` sudah mengabaikan file `.env` dan `node_modules/`

### Step 2: Setup Vercel Project

1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik tombol **"Add New Project"**
3. Import repository GitHub Anda
4. Vercel akan otomatis mendeteksi bahwa ini adalah Node.js project

### Step 3: Configure Environment Variables

Di Vercel Dashboard:

1. Pergi ke **Settings** → **Environment Variables**
2. Tambahkan semua environment variables yang diperlukan (lihat daftar di atas)
3. **PENTING:** Set `BASE_URL` ke URL deployment Vercel Anda (contoh: `https://your-app.vercel.app`)

**Cara mendapatkan JWT_SECRET yang aman:**

```bash
# Generate JWT secret dengan Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Setup Database PostgreSQL

Pilih salah satu opsi berikut:

#### **Opsi A: Vercel Postgres (Recommended)**

1. Di Vercel Dashboard, pergi ke **Storage** → **Create Database**
2. Pilih **Postgres**
3. Ikuti setup wizard
4. Environment variables akan otomatis ditambahkan ke project Anda

#### **Opsi B: External Database (Neon, Supabase, Railway, dll)**

1. Buat database PostgreSQL di provider pilihan Anda
2. Ambil connection string (DATABASE_URL)
3. Tambahkan ke environment variables di Vercel

### Step 5: Setup GitHub OAuth (Opsional)

Jika ingin mengaktifkan login dengan GitHub:

1. Pergi ke [GitHub Developer Settings](https://github.com/settings/developers)
2. Klik **"New OAuth App"**
3. Isi form:
   - **Application name:** Nama aplikasi Anda
   - **Homepage URL:** `https://your-app.vercel.app`
   - **Authorization callback URL:** `https://your-app.vercel.app/auth/github/callback`
4. Setelah dibuat, copy **Client ID** dan **Client Secret**
5. Tambahkan ke environment variables Vercel:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

### Step 6: Deploy

1. Klik tombol **"Deploy"**
2. Vercel akan mulai build dan deploy aplikasi Anda
3. Tunggu sampai deployment selesai (biasanya 1-3 menit)

### Step 7: Verifikasi Deployment

Setelah deployment berhasil:

1. Buka URL deployment Anda
2. Cek endpoint health: `https://your-app.vercel.app/health`
3. Cek API docs: `https://your-app.vercel.app/api/docs`
4. Test beberapa endpoint untuk memastikan semuanya berfungsi

---

## 🔧 Troubleshooting

### Issue: "FUNCTION_INVOCATION_FAILED"

**Penyebab:** Biasanya terjadi karena:
- Environment variables tidak ter-set dengan benar
- Database connection gagal
- JWT_SECRET tidak ada

**Solusi:**
1. Cek Vercel Logs di dashboard
2. Pastikan semua environment variables sudah di-set
3. Test database connection string

### Issue: GitHub OAuth Error - "redirect_uri not associated"

**Penyebab:** Callback URL di GitHub OAuth App tidak match dengan URL aplikasi

**Solusi:**
1. Pastikan `BASE_URL` environment variable di Vercel sudah benar
2. Update callback URL di GitHub OAuth App settings ke: `https://your-app.vercel.app/auth/github/callback`
3. Redeploy aplikasi

### Issue: Database Connection Failed

**Penyebab:** Connection string salah atau database tidak accessible

**Solusi:**
1. Verifikasi DATABASE_URL format: `postgresql://user:password@host:port/database`
2. Pastikan database server mengizinkan koneksi dari Vercel IPs
3. Cek database credentials

### Issue: Static Files (CSS/JS) Tidak Load

**Penyebab:** Routing configuration tidak benar

**Solusi:**
- File `vercel.json` sudah dikonfigurasi untuk handle static files
- Pastikan folder `public/` dan `asset/` ada di repository

---

## 📊 Monitoring dan Logs

### Melihat Logs

1. Pergi ke Vercel Dashboard → Project Anda
2. Klik tab **"Deployments"**
3. Pilih deployment yang ingin di-check
4. Klik **"View Function Logs"**

### Real-time Logs

Anda bisa monitor logs secara real-time dengan Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Monitor logs
vercel logs your-app-url --follow
```

---

## 🔄 Update dan Redeploy

Setiap kali Anda push ke branch utama (main/master), Vercel akan otomatis:
1. Detect perubahan
2. Build aplikasi
3. Deploy versi baru

Untuk manual redeploy:
1. Pergi ke Vercel Dashboard
2. Klik **"Redeploy"** pada deployment terakhir

---

## 🌍 Custom Domain

Untuk menggunakan custom domain:

1. Pergi ke **Settings** → **Domains**
2. Klik **"Add"**
3. Masukkan domain Anda (contoh: `api.yourdomain.com`)
4. Ikuti instruksi DNS configuration
5. **PENTING:** Update `BASE_URL` environment variable ke custom domain Anda
6. **PENTING:** Update GitHub OAuth callback URL jika menggunakan OAuth

---

## ✅ Checklist Deployment

- [ ] Repository sudah di push ke GitHub/GitLab/Bitbucket
- [ ] File `vercel.json` ada di root directory
- [ ] Environment variables sudah di-set di Vercel Dashboard
- [ ] Database PostgreSQL sudah dibuat dan connection string sudah benar
- [ ] `BASE_URL` environment variable di-set ke URL deployment
- [ ] (Opsional) GitHub OAuth App sudah dibuat dan credentials di-set
- [ ] Deployment berhasil tanpa error
- [ ] Health endpoint (`/health`) berfungsi
- [ ] API endpoints berfungsi dengan baik
- [ ] Login/Authentication berfungsi (jika diaktifkan)

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Node.js on Vercel](https://vercel.com/docs/runtimes/node-js)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 💡 Tips

1. **Gunakan Vercel Postgres** untuk kemudahan - otomatis terkoneksi tanpa perlu setup manual
2. **Set maxDuration** di `vercel.json` sesuai kebutuhan (default 60 detik untuk serverless functions)
3. **Monitor usage** di Vercel Dashboard untuk menghindari over-limit
4. **Enable caching** untuk endpoint yang jarang berubah untuk performance lebih baik
5. **Gunakan environment** yang berbeda (Development, Preview, Production) untuk testing

---

**Status:** ✅ Aplikasi ini sudah siap untuk di-deploy ke Vercel!
