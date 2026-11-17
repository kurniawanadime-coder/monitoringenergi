// Environment Dashboard Interactivity - FINAL TERKALIBRASI (Versi Transmisi Gabungan CSV & Offline Mode)

document.addEventListener('DOMContentLoaded', () => {
  // Satuan suhu tampilan (°C atau °F). Data tetap disimpan dan diolah dalam °C;
  // pilihan ini hanya mengubah angka yang tampil di halaman beranda.
  const KUNCI_SATUAN_SUHU = 'stasiun_satuan_suhu_v1';
  let satuanSuhu = 'C';
  try { if (localStorage.getItem(KUNCI_SATUAN_SUHU) === 'F') satuanSuhu = 'F'; } catch (e) { /* pakai °C */ }
  const keSuhu = (c) => (satuanSuhu === 'F' ? c * 9 / 5 + 32 : c);
  const labelSuhu = () => `°${satuanSuhu}`;
  // 1. Variabel Status Online
  let isSensorOnline = false;

  // 2. Fungsi Penyapu Bersih (Offline Mode)
  function setSensorOffline(statusText = 'MENUNGGU...') {
    isSensorOnline = false;
    const statusBadges = document.querySelectorAll('.ctrl-head .status');
    statusBadges.forEach(badge => {
      if (!badge.dataset.color) badge.dataset.color = badge.style.color; 
      badge.innerText = statusText;
      badge.style.color = 'var(--text-secondary)'; 
    });

    const cards = document.querySelectorAll('.ctrl-card');
    cards.forEach(card => {
      card.style.opacity = '0.4'; 
      card.style.filter = 'grayscale(100%)'; 
    });

    const masterBadge = document.getElementById('master-status-badge');
    if (masterBadge) {
      masterBadge.innerText = statusText;
      masterBadge.style.background = 'var(--lembut-2)';
      masterBadge.style.color = 'var(--text-secondary)';
    }

    // Ganti angka bawaan (dummy) menjadi tanda strip saat menunggu
    const cardValues = ['val-rad-card', 'val-wind-card', 'val-temp-card', 'val-hum-card', 'val-pres-card', 'val-rain-card', 'val-pm25-card', 'val-pm10-card'];
    cardValues.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `-- <small style="font-weight: 400; color: var(--text-secondary); font-size: 10px; letter-spacing: 0;">menunggu data</small>`;
    });

    const masterValue = document.getElementById('master-value');
    if (masterValue) masterValue.innerHTML = `--<span></span>`;
  }

  // 3. Fungsi Penghidup Layar (Online Mode)
  //    label: 'LIVE' untuk data baru, 'TERAKHIR' untuk pesan retained (data lama dari broker)
  function setSensorOnline(label = 'LIVE') {
    isSensorOnline = true;
    const statusBadges = document.querySelectorAll('.ctrl-head .status');
    statusBadges.forEach(badge => {
      if (!badge.dataset.color) badge.dataset.color = badge.style.color;
      if (badge.innerText !== label) {
        badge.innerText = label;
        badge.style.color = badge.dataset.color;
      }
    });

    const cards = document.querySelectorAll('.ctrl-card');
    cards.forEach(card => {
      card.style.opacity = '1';
      card.style.filter = 'grayscale(0%)';
    });
  }

  // JALANKAN MODE OFFLINE SAAT WEB PERTAMA DIBUKA
  setSensorOffline();

  // 4. Update Date
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const today = new Date();
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    dateEl.innerText = `Hari Ini (${today.toLocaleDateString('id-ID', options)})`;
  }

  // 5. Bank Data Global
  let globalSatData = { rad: null, wind: null, temp: null, hum: null, pres: null, rain: null, windDirDeg: null, windDirText: 'Utara' };
  window.globalSensorData = { temp: 0, hum: 0, pres: 0, rad: 0, wind: 0, rain: 0, windDirDeg: 0, windDirText: 'Utara', pm25: null, pm10: null };

  // Kategori ISPU (Permen LHK P.14/MENLHK/SETJEN/KUM.1/7/2020, Lampiran I tabel A & Lampiran II),
  // batas atas konsentrasi µg/m³ — sudah dicocokkan dengan dokumen resmi.
  // CATATAN: ISPU resmi memakai rata-rata 24 jam; di sini dihitung dari rata-rata
  // 1 menit SPS30, jadi kategorinya bersifat INDIKATIF.
  const ISPU_KATEGORI = [
    { nama: 'BAIK',               singkat: 'BAIK',      warna: 'var(--hijau)' },
    { nama: 'SEDANG',             singkat: 'SEDANG',    warna: 'var(--biru)' },
    { nama: 'TIDAK SEHAT',        singkat: 'T. SEHAT',  warna: 'var(--kuning)' },
    { nama: 'SANGAT TIDAK SEHAT', singkat: 'S.T. SEHAT',warna: '#ef233c' },
    { nama: 'BERBAHAYA',          singkat: 'BAHAYA',    warna: '#9d0208' }
  ];
  const ISPU_BATAS = {
    pm25: [15.5, 55.4, 150.4, 250.4],
    pm10: [50, 150, 350, 420]
  };
  // Batas "> 300" pada tabel Lampiran I = 500 µg/m³ untuk PM10 maupun PM2.5
  const ISPU_KONS_MAKS = 500;
  const ISPU_INDEKS = [0, 50, 100, 200, 300, 500];

  // Persamaan (1) Lampiran I: I = (Ia - Ib)/(Xa - Xb) * (Xx - Xb) + Ib
  function hitungISPU(jenis, nilai) {
    const x = [0, ...ISPU_BATAS[jenis], ISPU_KONS_MAKS];
    const v = Math.min(Math.max(nilai, 0), ISPU_KONS_MAKS);
    let i = 1;
    while (i < x.length - 1 && v > x[i]) i++;
    const Ia = ISPU_INDEKS[i], Ib = ISPU_INDEKS[i - 1];
    const Xa = x[i], Xb = x[i - 1];
    return Math.round((Ia - Ib) / (Xa - Xb) * (v - Xb) + Ib);
  }
  window.ISPU = { kategori: kategoriISPU, hitung: hitungISPU };   // dipakai halaman Pemantauan harian
  function kategoriISPU(jenis, nilai) {
    const batas = ISPU_BATAS[jenis];
    let i = 0;
    while (i < batas.length && nilai > batas[i]) i++;
    return ISPU_KATEGORI[i];
  }

  // Elemen UI Matahari
  const sunGroup = document.getElementById('sun-group');
  const sunArea = document.getElementById('sun-area');
  const sunProgress = document.getElementById('sun-arc-progress');

  // 6. Kalkulasi Deviasi (Satelit vs Sensor Lokal)
  // =====================================================================
  // MODEL POTENSI ENERGI (kajian potensi, tanpa spesifikasi pembangkit)
  // Semua keluaran dinyatakan sebagai PERSEN DARI KAPASITAS TERPASANG.
  // Ubah angka di sini untuk menyesuaikan dengan definisi penelitian Anda.
  // =====================================================================
  const MODEL = {
    rasioKinerjaPLTS: 0.80,   // rugi-rugi sistem surya (performance ratio)
    anginMulai: 3,            // m/s, turbin mulai menghasilkan daya (cut-in)
    anginPenuh: 12,           // m/s, turbin mencapai daya penuh (rated)
    anginBerhenti: 25,        // m/s, turbin berhenti demi keamanan (cut-out)
    porsiSurya: 0.5,          // bagian kapasitas terpasang yang berupa PLTS (sisanya PLTB)
    ambang: 0.10,             // kekeringan energi: keluaran gabungan di bawah 10% kapasitas
    durasiKritisJam: 24       // KRITIS bila di bawah ambang selama >= 24 jam berturut-turut
  };
  window.MODEL_POTENSI = MODEL;   // dipakai halaman Tentang stasiun

  const batas01 = (x) => Math.min(Math.max(x, 0), 1);
  // PLTS: 1000 W/m2 = 100% kapasitas puncak, dikali rasio kinerja
  function potensiSurya(rad) { return batas01((rad / 1000) * MODEL.rasioKinerjaPLTS); }
  // PLTB: kurva daya kubik antara cut-in dan rated
  function potensiAngin(v) {
    if (v < MODEL.anginMulai || v >= MODEL.anginBerhenti) return 0;
    if (v >= MODEL.anginPenuh) return 1;
    const a = Math.pow(MODEL.anginMulai, 3), b = Math.pow(MODEL.anginPenuh, 3);
    return batas01((Math.pow(v, 3) - a) / (b - a));
  }
  function potensiGabungan(rad, v) {
    return MODEL.porsiSurya * potensiSurya(rad) + (1 - MODEL.porsiSurya) * potensiAngin(v);
  }
  const persen = (x) => `${(x * 100).toFixed(0)} <small>%</small>`;

  // ---------------------------------------------------------------------
  // Riwayat sensor di browser ini (48 jam terakhir). Belum ada penyimpanan
  // cloud, jadi riwayat hanya terisi selama dashboard dibuka di browser ini.
  // ---------------------------------------------------------------------
  const KUNCI_RIWAYAT = 'stasiun_riwayat_v2';
  const UMUR_RIWAYAT_MS = 7 * 24 * 3600 * 1000;
  // [waktuMs, radiasi, angin, suhu, kelembapan, tekanan(hPa), hujan, pm25, pm10]; null = tidak ada
  let riwayatSensor = [];
  try {
    const simpanan = JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) || '[]');
    if (Array.isArray(simpanan)) riwayatSensor = simpanan.filter(r => Array.isArray(r) && r.length >= 3);
    // Bawa serta riwayat format lama (hanya radiasi dan angin) bila ada
    if (!riwayatSensor.length) {
      const lama = JSON.parse(localStorage.getItem('stasiun_riwayat_v1') || '[]');
      if (Array.isArray(lama)) riwayatSensor = lama.filter(r => Array.isArray(r) && r.length === 3);
    }
  } catch (e) { riwayatSensor = []; }
  riwayatSensor = riwayatSensor.filter(r => r[0] <= Date.now() + 86400000);

  function catatRiwayat(waktuMs, rad, angin, suhu, lembap, tekananKpa, hujan, pm25, pm10) {
    if (!isFinite(waktuMs)) return;
    if (riwayatSensor.some(r => r[0] === waktuMs)) return;   // pesan retained/duplikat
    const n = (v) => (v === undefined || v === null || isNaN(v)) ? null : v;
    riwayatSensor.push([waktuMs, n(rad), n(angin), n(suhu), n(lembap),
                        n(tekananKpa) === null ? null : n(tekananKpa) * 10, n(hujan), n(pm25), n(pm10)]);
    riwayatSensor.sort((a, b) => a[0] - b[0]);
    const batas = Date.now() - UMUR_RIWAYAT_MS;
    // Buang data lebih dari 7 hari dan data bertanggal masa depan (dari jam alat yang salah)
    riwayatSensor = riwayatSensor.filter(r => r[0] >= batas && r[0] <= Date.now() + 86400000);
    try { localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayatSensor)); } catch (e) { /* penyimpanan penuh/diblokir */ }
  }

  // Kunci jam lokal "YYYY-MM-DDTHH:00", sama dengan format waktu Open-Meteo
  function kunciJam(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
  }

  // Rata-rata sensor per jam: { kunciJam: {rad, angin} }
  function rataSensorPerJam() {
    const kumpul = {};
    riwayatSensor.forEach(([t, rad, angin]) => {
      const k = kunciJam(new Date(t));
      const g = kumpul[k] || (kumpul[k] = { sr: 0, nr: 0, sa: 0, na: 0 });
      if (rad !== null) { g.sr += rad; g.nr++; }
      if (angin !== null) { g.sa += angin; g.na++; }
    });
    const hasil = {};
    Object.keys(kumpul).forEach(k => {
      const g = kumpul[k];
      hasil[k] = { rad: g.nr ? g.sr / g.nr : null, angin: g.na ? g.sa / g.na : null };
    });
    return hasil;
  }

  // Deret satelit per jam dari Open-Meteo: { kunciJam: {rad, angin} }
  let satPerJam = {};

  // Berapa jam berturut-turut (sampai jam ini) keluaran gabungan di bawah ambang.
  // Tiap jam memakai data sensor bila ada, selain itu data satelit.
  function hitungDurasiKering() {
    const sensor = rataSensorPerJam();
    let jam = 0, pakaiSensor = 0;
    const t = new Date(); t.setMinutes(0, 0, 0);
    for (let i = 0; i < 72; i++) {
      const k = kunciJam(t);
      const s = sensor[k] || {}, sat = satPerJam[k] || {};
      const rad = (s.rad != null) ? s.rad : sat.rad;
      const angin = (s.angin != null) ? s.angin : sat.angin;
      if (rad == null || angin == null) break;            // tidak ada data: berhenti menghitung
      if (potensiGabungan(rad, angin) >= MODEL.ambang) break;
      jam++;
      if (s.rad != null || s.angin != null) pakaiSensor++;
      t.setHours(t.getHours() - 1);
    }
    return { jam, pakaiSensor };
  }

  function calculateDelta() {
    const data = window.globalSensorData;
    const adaSat = globalSatData.rad !== null && globalSatData.wind !== null;
    const adaSensor = isSensorOnline && data.radOk === true && data.windOk === true;

    // --- Selisih sensor terhadap satelit ---
    const isiDelta = (idVal, idDesc, sensorOk, nilaiSensor, nilaiSat, toleransi) => {
      const elVal = document.getElementById(idVal), elDesc = document.getElementById(idDesc);
      if (!elVal || !elDesc) return;
      if (!adaSat || !isSensorOnline || !sensorOk) {
        elVal.innerText = '--';
        elVal.style.color = 'var(--text-secondary)';
        elDesc.innerText = !adaSat ? 'Menunggu data satelit' : 'Menunggu data sensor';
        return;
      }
      const d = nilaiSensor - nilaiSat;
      elVal.innerText = `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
      elVal.style.color = Math.abs(d) < toleransi ? 'var(--hijau)' : 'var(--merah-muda)';
      elDesc.innerText = d > 0 ? 'Sensor lebih tinggi' : (d < 0 ? 'Sensor lebih rendah' : 'Sama dengan satelit');
    };
    isiDelta('delta-rad-val', 'delta-rad-desc', data.radOk === true, data.rad, globalSatData.rad, 50);
    isiDelta('delta-wind-val', 'delta-wind-desc', data.windOk === true, data.wind, globalSatData.wind, 3);

    // --- Potensi keluaran (% kapasitas terpasang) ---
    const isiPotensi = (akhiran, ada, rad, angin) => {
      const elS = document.getElementById(`est-solar-${akhiran}`);
      const elW = document.getElementById(`est-wind-${akhiran}`);
      const elT = document.getElementById(`est-total-${akhiran}`);
      if (!ada) {
        [elS, elW, elT].forEach(el => { if (el) el.innerHTML = '-- <small>%</small>'; });
        if (elT) elT.style.color = 'var(--text-secondary)';
        return null;
      }
      const total = potensiGabungan(rad, angin);
      if (elS) elS.innerHTML = persen(potensiSurya(rad));
      if (elW) elW.innerHTML = persen(potensiAngin(angin));
      if (elT) { elT.innerHTML = persen(total); elT.style.color = total < MODEL.ambang ? 'var(--merah-muda)' : 'var(--hijau)'; }
      return total;
    };
    const totalSat = isiPotensi('sat', adaSat, globalSatData.rad, globalSatData.wind);
    const totalSen = isiPotensi('sen', adaSensor, data.rad, data.wind);

    // --- Risiko kekeringan energi: sensor diutamakan, satelit sebagai cadangan ---
    const riskCard = document.getElementById('risk-card');
    const riskStatus = document.getElementById('risk-status');
    const riskDetail = document.getElementById('risk-detail');
    if (riskCard && riskStatus) {
      const total = totalSen !== null ? totalSen : totalSat;
      const sumber = totalSen !== null ? 'sensor' : 'satelit';
      if (total === null) {
        riskCard.classList.remove('danger');
        riskStatus.innerText = 'MENUNGGU';
        if (riskDetail) riskDetail.innerText = 'Belum ada data sensor maupun satelit';
      } else {
        const { jam } = hitungDurasiKering();
        const kering = total < MODEL.ambang;
        const kritis = kering && jam >= MODEL.durasiKritisJam;
        riskCard.classList.toggle('danger', kritis);
        riskStatus.innerText = kritis ? 'KRITIS' : (kering ? 'SIAGA' : 'AMAN');
        kondisi.risiko = { status: riskStatus.innerText, rincian: `keluaran ${(total * 100).toFixed(0)}% kapasitas` + (kering ? ` selama ${Math.max(jam, 1)} jam` : '') };
        if (riskDetail) {
          const pct = (total * 100).toFixed(0);
          const amb = (MODEL.ambang * 100).toFixed(0);
          riskDetail.innerText = kering
            ? `Keluaran ${pct}% kapasitas (${sumber}), di bawah ambang ${amb}% selama ${Math.max(jam, 1)} jam`
            : `Keluaran ${pct}% kapasitas (${sumber}), ambang ${amb}%`;
        }
      }
    }
  }

  // =====================================================================
  // KONDISI STASIUN: daftar hal yang perlu perhatian (hanya tampil di dashboard)
  // =====================================================================
  const kondisi = {
    alat: 'menunggu',        // menunggu | live | terakhir | basi | terputus
    waktuDataAlat: '',       // tanggal dan jam dari alat pada data yang sedang tampil
    sensorGagal: [],         // nama sensor yang gagal dibaca pada data terakhir
    jamAlatSalah: false,     // RTC alat mengirim tanggal tidak valid
    udara: [],               // [{teks, tingkat}]
    risiko: null,            // {status, rincian}
    satelitGagal: false
  };
  const WARNA_TINGKAT = { bahaya: 'var(--merah-muda)', waspada: 'var(--kuning)', info: 'var(--biru)' };

  function perbaruiKondisi() {
    const daftar = document.getElementById('kondisi-daftar');
    const ringkas = document.getElementById('kondisi-ringkas');
    if (!daftar || !ringkas) return;
    const butir = [];
    const tambah = (tingkat, teks) => butir.push({ tingkat, teks });

    if (kondisi.alat === 'menunggu') tambah('waspada', 'Belum ada data dari alat sejak halaman dibuka');
    else if (kondisi.alat === 'terputus') tambah('bahaya', 'Koneksi dashboard ke broker terputus, sedang menyambung lagi');
    else if (kondisi.alat === 'basi') tambah('bahaya', `Alat berhenti mengirim. Data terakhir: ${kondisi.waktuDataAlat || 'tidak diketahui'}`);
    else if (kondisi.alat === 'terakhir') tambah('waspada', `Menampilkan data tersimpan (${kondisi.waktuDataAlat || 'waktu tidak diketahui'}), belum ada kiriman baru`);

    const adaData = kondisi.alat === 'live' || kondisi.alat === 'terakhir' || kondisi.alat === 'basi';
    if (adaData) {
      kondisi.sensorGagal.forEach(n => tambah('bahaya', `Sensor ${n} gagal dibaca`));
      if (kondisi.jamAlatSalah) tambah('waspada', 'Jam alat (RTC) tidak valid, cek baterai CR2032');
      else if (kondisi.selisihJamMenit !== null && kondisi.selisihJamMenit !== undefined && Math.abs(kondisi.selisihJamMenit) > 10) {
        const m = Math.abs(kondisi.selisihJamMenit);
        const lama = m >= 2880 ? `${Math.round(m / 1440)} hari` : (m >= 120 ? `${Math.round(m / 60)} jam` : `${m} menit`);
        tambah('waspada', `Jam alat ${kondisi.selisihJamMenit > 0 ? 'lebih cepat' : 'lebih lambat'} ${lama} dari jam sebenarnya. Grafik memakai jam saat data diterima; setel ulang RTC alat.`);
      }
      kondisi.udara.forEach(u => tambah(u.tingkat, u.teks));
    }
    if (kondisi.risiko && kondisi.risiko.status === 'KRITIS') tambah('bahaya', `Kekeringan energi: ${kondisi.risiko.rincian}`);
    else if (kondisi.risiko && kondisi.risiko.status === 'SIAGA') tambah('waspada', `Potensi energi rendah: ${kondisi.risiko.rincian}`);
    if (kondisi.satelitGagal) tambah('info', 'Data satelit gagal diambil, akan dicoba lagi');

    const urutan = { bahaya: 0, waspada: 1, info: 2 };
    butir.sort((a, b) => urutan[a.tingkat] - urutan[b.tingkat]);

    daftar.innerHTML = '';
    if (!butir.length) {
      ringkas.innerText = 'Semua normal';
      ringkas.style.color = 'var(--hijau)';
      const li = document.createElement('li');
      li.className = 'kondisi-normal';
      li.innerText = 'Alat mengirim data dan tidak ada sensor yang gagal.';
      daftar.appendChild(li);
      return;
    }
    const terburuk = butir[0].tingkat;
    ringkas.innerText = `${butir.length} perlu perhatian`;
    ringkas.style.color = WARNA_TINGKAT[terburuk];
    butir.forEach(b => {
      const li = document.createElement('li');
      li.style.setProperty('--warna-butir', WARNA_TINGKAT[b.tingkat]);
      li.innerText = b.teks;
      daftar.appendChild(li);
    });
  }

  function perbaruiTombolSatuan() {
    ['C', 'F'].forEach(sat => {
      const b = document.getElementById(`satuan-${sat.toLowerCase()}`);
      if (!b) return;
      b.classList.toggle('aktif', satuanSuhu === sat);
      b.setAttribute('aria-pressed', satuanSuhu === sat ? 'true' : 'false');
    });
  }
  window.gantiSatuanSuhu = function (sat) {
    satuanSuhu = sat === 'F' ? 'F' : 'C';
    try { localStorage.setItem(KUNCI_SATUAN_SUHU, satuanSuhu); } catch (e) { /* abaikan */ }
    perbaruiTombolSatuan();
    perbaruiKartuCuaca();
    const kecil = 'style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;"';
    const satTemp = document.getElementById('sat-temp');
    if (satTemp && globalSatData.temp !== null) satTemp.innerHTML = `${keSuhu(Number(globalSatData.temp)).toFixed(1)}<small ${kecil}>${labelSuhu()}</small>`;
    const data = window.globalSensorData;
    const kartu = document.getElementById('val-temp-card');
    if (kartu && data && data.tempOk === true) {
      kartu.innerHTML = `${keSuhu(data.temp).toFixed(1)} <small style="font-weight: 400; color: var(--text-secondary); font-size: 10px; letter-spacing: 0;">${labelSuhu()}</small>`;
    }
    if (window.currentSelectedSensor === 'temp') window.selectSensor('temp');
  };
  perbaruiTombolSatuan();

  // Kartu cuaca tengah: suhu utama dari sensor bila ada, selain itu dari satelit
  const cuacaSat = { kode: null, terasa: null, maks: null, min: null };
  const KODE_CUACA = [
    [[0], 'Cerah'], [[1], 'Cerah berawan'], [[2], 'Berawan sebagian'], [[3], 'Berawan'],
    [[45, 48], 'Berkabut'], [[51, 53, 55, 56, 57], 'Gerimis'], [[61, 66], 'Hujan ringan'],
    [[63], 'Hujan sedang'], [[65, 67], 'Hujan lebat'], [[80], 'Hujan lokal ringan'],
    [[81], 'Hujan lokal'], [[82], 'Hujan lokal lebat'], [[95, 96, 99], 'Hujan petir'],
    [[71, 73, 75, 77, 85, 86], 'Salju']
  ];
  function perbaruiKartuCuaca() {
    const data = window.globalSensorData;
    const elSuhu = document.getElementById('hero-temp');
    const elSumber = document.getElementById('hero-sumber');
    const elMaksMin = document.getElementById('hero-maksmin');
    const elKet = document.getElementById('hero-kondisi');
    const elTerasa = document.getElementById('hero-terasa');
    const sensorAda = isSensorOnline && data.tempOk === true;
    if (elSuhu) {
      if (sensorAda) elSuhu.innerText = `${keSuhu(data.temp).toFixed(1)}${labelSuhu()}`;
      else if (globalSatData.temp !== null) elSuhu.innerText = `${keSuhu(Number(globalSatData.temp)).toFixed(1)}${labelSuhu()}`;
      else elSuhu.innerText = `--${labelSuhu()}`;
    }
    if (elSumber) elSumber.innerText = sensorAda ? 'Suhu dari sensor' : (globalSatData.temp !== null ? 'Suhu dari satelit' : 'Menunggu data');
    if (elMaksMin) elMaksMin.innerText = (cuacaSat.maks !== null && cuacaSat.min !== null)
      ? `Hari ini ${Math.round(keSuhu(cuacaSat.min))}° sampai ${Math.round(keSuhu(cuacaSat.maks))}° (satelit)` : '';
    if (elKet) {
      const cocok = KODE_CUACA.find(([kode]) => kode.includes(cuacaSat.kode));
      elKet.innerText = cuacaSat.kode === null ? 'Menunggu satelit' : (cocok ? cocok[1] : 'Tidak diketahui');
    }
    if (elTerasa) elTerasa.innerText = cuacaSat.terasa !== null ? `Terasa seperti ${Math.round(keSuhu(cuacaSat.terasa))}${labelSuhu()} (satelit)` : '';
  }

  // 7. Update UI Otomatis (Hanya Animasi Matahari)
  function updateData() {
    if (sunGroup && sunArea && sunProgress) {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      let angle = 0;
      if (hours <= 6) { angle = 0; } 
      else if (hours >= 18) { angle = 180; } 
      else { angle = ((hours - 6) / 12) * 180; }

      sunGroup.style.transform = `rotate(${angle}deg)`;
      const rad = (180 - angle) * Math.PI / 180;
      const sunX = 100 + 90 * Math.cos(rad);
      const sunY = 90 - 90 * Math.sin(rad);

      sunArea.setAttribute('d', `M 10 90 A 90 90 0 0 1 ${sunX} ${sunY} L ${sunX} 90 Z`);
      const totalLength = 282.74;
      const offset = totalLength - (angle / 180) * totalLength;
      sunProgress.style.strokeDashoffset = offset;
    }
    calculateDelta();
    perbaruiKartuCuaca();
    perbaruiKondisi();
  }

  // 8. Setup MQTT HiveMQ
  const brokerUrl = "broker.hivemq.com";
  const brokerPort = 8884;
  const clientId = "dashboard-client-" + Math.random().toString(16).substr(2, 8);
  const mainTopic = "stasiun/6c95111dae96/all";  // topik acak, harus sama dengan topicAll di firmware
  let mqttClient;

  // Firmware kirim tiap 60 dtk. Jika > 3 menit tanpa data baru -> tandai basi.
  const STALE_MS = 3 * 60 * 1000;
  let lastLiveMsgTime = 0;

  // Sentinel dari firmware saat sensor gagal dibaca (radiasi=9999, lainnya=-999.0)
  function nilaiSensor(str, validFlag) {
    const v = parseFloat(str);
    if (isNaN(v) || validFlag === false) return NaN;
    if (v <= -999 || v >= 9999) return NaN;
    return v;
  }

  function tampilkanError(cardId) {
    const el = document.getElementById(cardId);
    if (el) el.innerHTML = `ERR <small style="font-weight: 400; color: var(--merah-muda); font-size: 10px; letter-spacing: 0;">sensor gagal</small>`;
  }

  function connectMQTT() {
    mqttClient.connect({
      onSuccess: onConnect,
      onFailure: (err) => {
        console.log("Gagal konek MQTT, coba lagi 5 dtk...", err && err.errorMessage);
        setTimeout(connectMQTT, 5000);
      },
      useSSL: true,
      keepAliveInterval: 30,
      timeout: 10
    });
  }

  try {
    mqttClient = new Paho.MQTT.Client(brokerUrl, brokerPort, "/mqtt", clientId);
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;
    connectMQTT();
  } catch (e) { console.error("MQTT Error:", e); }

  function onConnect() {
    console.log("Terhubung ke MQTT Broker!");
    mqttClient.subscribe(mainTopic);
  }

  function onConnectionLost(res) {
    if (res.errorCode !== 0) {
      console.log("MQTT Terputus. Reconnecting...");
      setSensorOffline('TERPUTUS'); // Panggil fungsi redup saat putus
      kondisi.alat = 'terputus';
      perbaruiKondisi();
      setTimeout(connectMQTT, 5000);
    }
  }

  // Deteksi alat berhenti mengirim walau koneksi broker masih hidup
  setInterval(() => {
    if (isSensorOnline && lastLiveMsgTime > 0 && Date.now() - lastLiveMsgTime > STALE_MS) {
      setSensorOnline('BASI');
      kondisi.alat = 'basi';
      perbaruiKondisi();
      document.querySelectorAll('.ctrl-card').forEach(card => { card.style.opacity = '0.6'; });
      if (window.currentSelectedSensor) window.selectSensor(window.currentSelectedSensor);
    }
  }, 30000);

  // 9. Tangkap Data MQTT & Update Kartu Utama dan Kecil
  function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    const smallStyle = 'style="font-weight: 400; color: var(--text-secondary); font-size: 10px; letter-spacing: 0;"';
    const circleLen = 106.81; 

    if (topic === mainTopic) {
      const dataArray = payload.split(',');
      
      // Format Arduino v2.1 (12 field):
      // Index: 0=tanggal, 1=waktu, 2=rad, 3=suhu, 4=rh, 5=pres, 6=rain, 7=wind, 8=windMax, 9=arah(°), 10=mataAngin, 11=flag
      // Flag 4 huruf: [Radiasi][Suhu+RH][Tekanan][Hujan], V = valid, S = gagal/stale
      if (dataArray.length >= 11) {

        // Pesan retained = data terakhir yang disimpan broker (mungkin sudah lama)
        if (message.retained) {
          setSensorOnline('TERAKHIR');
          if (kondisi.alat !== 'live') kondisi.alat = 'terakhir';
          console.log(`Data retained dari alat: ${dataArray[0]} ${dataArray[1]}`);
        } else {
          setSensorOnline('LIVE');
          lastLiveMsgTime = Date.now();
          kondisi.alat = 'live';
        }

        const flag = (dataArray[11] || 'VVVV').trim();
        const ok = (i) => flag.charAt(i) !== 'S';

        const valRad  = nilaiSensor(dataArray[2], ok(0));
        const valTemp = nilaiSensor(dataArray[3], ok(1));
        const valHum  = nilaiSensor(dataArray[4], ok(1));
        const valPres = nilaiSensor(dataArray[5], ok(2));
        const valRain = nilaiSensor(dataArray[6], ok(3));
        const valWind = nilaiSensor(dataArray[7], true);
        const valDir  = nilaiSensor(dataArray[9], true);

        // Field PM (firmware v2.2+): 12 = PM2.5, 13 = PM10, flag huruf ke-5
        const adaPM = dataArray.length >= 14;
        const valPM25 = adaPM ? nilaiSensor(dataArray[12], ok(4)) : NaN;
        const valPM10 = adaPM ? nilaiSensor(dataArray[13], ok(4)) : NaN;
        [['pm25', valPM25], ['pm10', valPM10]].forEach(([jenis, v]) => {
          const card = document.getElementById(`val-${jenis}-card`);
          const dial = document.getElementById(`dial-${jenis}`);
          const cat  = document.getElementById(`cat-${jenis}-card`);
          if (!adaPM) {            // firmware lama tanpa SPS30
            window.globalSensorData[jenis] = null;
            if (card) card.innerHTML = `-- <small ${smallStyle}>tidak ada sensor</small>`;
            if (cat) cat.innerText = '';
            return;
          }
          if (isNaN(v)) {
            window.globalSensorData[jenis] = null;
            tampilkanError(`val-${jenis}-card`);
            if (cat) cat.innerText = '';
            return;
          }
          window.globalSensorData[jenis] = v;
          const k = kategoriISPU(jenis, v);
          const skala = jenis === 'pm25' ? 250 : 420;
          if (card) card.innerHTML = `${v.toFixed(1)} <small ${smallStyle}>µg/m³</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - Math.min(v / skala, 1) * circleLen;
          if (cat) { cat.innerText = k.singkat; cat.style.color = k.warna; }
        });

        // Validitas untuk perhitungan potensi & risiko
        window.globalSensorData.radOk = !isNaN(valRad);
        window.globalSensorData.windOk = !isNaN(valWind);
        window.globalSensorData.tempOk = !isNaN(valTemp);

        // Ringkasan untuk panel Kondisi stasiun
        kondisi.sensorGagal = [];
        if (isNaN(valRad)) kondisi.sensorGagal.push('radiasi');
        if (isNaN(valTemp) || isNaN(valHum)) kondisi.sensorGagal.push('suhu dan kelembapan');
        if (isNaN(valPres)) kondisi.sensorGagal.push('tekanan');
        if (isNaN(valRain)) kondisi.sensorGagal.push('hujan');
        if (adaPM && (isNaN(valPM25) || isNaN(valPM10))) kondisi.sensorGagal.push('debu (PM)');
        kondisi.udara = [];
        [['pm25', 'PM2.5', valPM25], ['pm10', 'PM10', valPM10]].forEach(([jenis, label, v]) => {
          if (isNaN(v)) return;
          const tingkatISPU = ISPU_KATEGORI.indexOf(kategoriISPU(jenis, v));
          if (tingkatISPU >= 2) {
            kondisi.udara.push({
              tingkat: tingkatISPU >= 3 ? 'bahaya' : 'waspada',
              teks: `${label} ${v.toFixed(1)} µg/m³, kategori ${kategoriISPU(jenis, v).nama.toLowerCase()}`
            });
          }
        });

        // Catat ke riwayat memakai waktu alat (d/m/yyyy,HH:MM:SS); bila RTC alat
        // tidak valid, pakai waktu terima untuk pesan live saja.
        const tgl = (dataArray[0] || '').trim().split('/').map(Number);
        const jamAlat = (dataArray[1] || '').trim().split(':').map(Number);
        let waktuAlat = NaN;
        if (tgl.length === 3 && tgl[2] >= 2024 && jamAlat.length === 3) {
          waktuAlat = new Date(tgl[2], tgl[1] - 1, tgl[0], jamAlat[0], jamAlat[1], jamAlat[2]).getTime();
        }
        const selisihJamMs = isFinite(waktuAlat) ? waktuAlat - Date.now() : NaN;
        let waktuData = waktuAlat;
        if (!message.retained) {
          // Data baru: bila jam alat meleset lebih dari 10 menit, pakai jam saat data diterima
          // agar grafik dan riwayat tetap jatuh di jam yang benar.
          if (!isFinite(waktuAlat) || Math.abs(selisihJamMs) > 10 * 60000) waktuData = Date.now();
          kondisi.selisihJamMenit = isFinite(selisihJamMs) ? Math.round(selisihJamMs / 60000) : null;
        } else if (!isFinite(waktuAlat) || selisihJamMs > 10 * 60000 || selisihJamMs < -3 * 86400000) {
          waktuData = NaN;   // data tersimpan dengan tanggal tidak masuk akal: tidak dicatat
        }
        catatRiwayat(waktuData, valRad, valWind, valTemp, valHum, valPres, valRain, valPM25, valPM10);
        if (window.harianSegarkan) window.harianSegarkan();
        perbaruiGrafikRadiasi();
        kondisi.jamAlatSalah = !(tgl.length === 3 && tgl[2] >= 2024);
        kondisi.waktuDataAlat = kondisi.jamAlatSalah ? '' : `${(dataArray[0] || '').trim()} ${(dataArray[1] || '').trim()}`;

        if (isNaN(valRad))  tampilkanError('val-rad-card');
        if (isNaN(valTemp)) tampilkanError('val-temp-card');
        if (isNaN(valHum))  tampilkanError('val-hum-card');
        if (isNaN(valPres)) tampilkanError('val-pres-card');
        if (isNaN(valRain)) tampilkanError('val-rain-card');

        if (!isNaN(valTemp)) {
          window.globalSensorData.temp = valTemp;
          const card = document.getElementById('val-temp-card');
          const dial = document.getElementById('dial-temp');
          if (card) card.innerHTML = `${keSuhu(valTemp).toFixed(1)} <small ${smallStyle}>${labelSuhu()}</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valTemp / 50) * circleLen;
        }
        
        if (!isNaN(valHum)) {
          window.globalSensorData.hum = valHum;
          const card = document.getElementById('val-hum-card');
          const dial = document.getElementById('dial-hum');
          if (card) card.innerHTML = `${Math.round(valHum)} <small ${smallStyle}>%</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valHum / 100) * circleLen;
        }

        if (!isNaN(valPres)) {
          window.globalSensorData.pres = valPres;
          const card = document.getElementById('val-pres-card');
          const dial = document.getElementById('dial-pres');
          if (card) card.innerHTML = `${valPres.toFixed(1)} <small ${smallStyle}>kPa</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - ((valPres-90) / 20) * circleLen;
        }

        if (!isNaN(valRain)) {
          window.globalSensorData.rain = valRain;
          const card = document.getElementById('val-rain-card');
          const dial = document.getElementById('dial-rain');
          if (card) card.innerHTML = `${valRain.toFixed(1)} <small ${smallStyle}>mm</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valRain / 50) * circleLen;
        }

        if (!isNaN(valWind)) {
          window.globalSensorData.wind = valWind;
          const card = document.getElementById('val-wind-card');
          const dial = document.getElementById('dial-wind');
          if (card) card.innerHTML = `${valWind.toFixed(1)} <small ${smallStyle}>m/s</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valWind / 30) * circleLen;
        }

        if (!isNaN(valDir)) {
          window.globalSensorData.windDirDeg = valDir;
          const windDirs = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
          const windDegs = [0, 45, 90, 135, 180, 225, 270, 315];
          let minDiff = 360; let dirText = "Utara";
          
          windDegs.forEach((deg, i) => {
            let diff = Math.abs(valDir - deg);
            if (diff > 180) diff = 360 - diff;
            if (diff < minDiff) { minDiff = diff; dirText = windDirs[i]; }
          });
          window.globalSensorData.windDirText = dirText;

          const windDegVal = document.getElementById('wind-deg-val');
          const windDirVal = document.getElementById('wind-dir-val');
          const windCompass = document.getElementById('wind-compass-icon');
          if (windDegVal) windDegVal.innerText = `${valDir.toFixed(0)}°`;
          if (windDirVal) windDirVal.innerText = dirText;
          if (windCompass) windCompass.style.transform = `rotate(${valDir - 45}deg)`;
        }

        if (!isNaN(valRad)) {
          window.globalSensorData.rad = valRad;
          const card = document.getElementById('val-rad-card');
          const dial = document.getElementById('dial-rad');
          if (card) card.innerHTML = `${valRad.toFixed(1)} <small ${smallStyle}>W/m²</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valRad / 1200) * circleLen;
        }

        if (window.currentSelectedSensor) { window.selectSensor(window.currentSelectedSensor); }
        calculateDelta();
        perbaruiKartuCuaca();
        perbaruiKondisi();
      }
    }
  }

  updateData();
  setInterval(updateData, 60000); 

  // 10. Data Lokasi & Satelit
  function updateWeatherUI() {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const dayName = document.getElementById('w-day-name');
    const dateFull = document.getElementById('w-date-full');
    if (dayName) dayName.innerText = days[now.getDay()];
    if (dateFull) dateFull.innerText = `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;

    const locName = document.getElementById('loc-name');
    if (locName) {
      // -------------------------------------------------------------
      // LOKASI ALAT
      // Nilai bawaan di bawah ini dipakai semua pengunjung. Tiap browser
      // juga bisa menyimpan lokasinya sendiri lewat tombol lokasi di dashboard.
      // -------------------------------------------------------------
      const LOKASI_BAWAAN = { nama: "Yogyakarta, Indonesia", lat: -7.7, lon: 110.6 };
      const KUNCI_LOKASI = 'stasiun_lokasi_v1';

      let lokasi = { ...LOKASI_BAWAAN };
      try {
        const simpanan = JSON.parse(localStorage.getItem(KUNCI_LOKASI) || 'null');
        if (simpanan && isFinite(simpanan.lat) && isFinite(simpanan.lon) && simpanan.nama) lokasi = simpanan;
      } catch (e) { /* pakai bawaan */ }

      const terapkanLokasi = () => {
        window.STASIUN = { lat: lokasi.lat, lon: lokasi.lon, nama: lokasi.nama };  // dipakai halaman lain
        locName.innerText = lokasi.nama;
        satPerJam = {};
        fetchSatelliteData(lokasi.lat, lokasi.lon);
        if (window.tentangIsi) window.tentangIsi();
      };
      terapkanLokasi();
      // Data satelit diperbarui tiap 15 menit (sebelumnya hanya sekali saat halaman dibuka)
      setInterval(() => fetchSatelliteData(window.STASIUN.lat, window.STASIUN.lon), 15 * 60 * 1000);

      // --- Dialog pengaturan lokasi ---
      const dialog = document.getElementById('lokasi-dialog');
      const pesan = document.getElementById('lokasi-pesan');
      const isiForm = (l) => {
        document.getElementById('lokasi-nama').value = l.nama;
        document.getElementById('lokasi-lat').value = l.lat;
        document.getElementById('lokasi-lon').value = l.lon;
      };
      window.lokasiBuka = () => {
        if (!dialog) return;
        isiForm(lokasi);
        pesan.innerText = '';
        if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
      };
      window.lokasiTutup = () => { if (dialog) dialog.close ? dialog.close() : dialog.removeAttribute('open'); };
      window.lokasiSimpan = () => {
        const nama = document.getElementById('lokasi-nama').value.trim();
        const lat = parseFloat(String(document.getElementById('lokasi-lat').value).replace(',', '.'));
        const lon = parseFloat(String(document.getElementById('lokasi-lon').value).replace(',', '.'));
        if (!nama) { pesan.innerText = 'Isi nama lokasi.'; return; }
        if (!isFinite(lat) || lat < -90 || lat > 90) { pesan.innerText = 'Lintang harus angka antara -90 dan 90. Lintang selatan bernilai negatif.'; return; }
        if (!isFinite(lon) || lon < -180 || lon > 180) { pesan.innerText = 'Bujur harus angka antara -180 dan 180.'; return; }
        lokasi = { nama, lat, lon };
        try { localStorage.setItem(KUNCI_LOKASI, JSON.stringify(lokasi)); } catch (e) { /* tetap dipakai sampai halaman ditutup */ }
        terapkanLokasi();
        window.lokasiTutup();
      };
      window.lokasiBawaan = () => {
        lokasi = { ...LOKASI_BAWAAN };
        try { localStorage.removeItem(KUNCI_LOKASI); } catch (e) { /* abaikan */ }
        terapkanLokasi();
        window.lokasiTutup();
      };
      window.lokasiPerangkat = () => {
        if (!navigator.geolocation) { pesan.innerText = 'Browser ini tidak bisa membaca posisi perangkat. Isi koordinat secara manual.'; return; }
        pesan.innerText = 'Meminta posisi perangkat…';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            document.getElementById('lokasi-lat').value = pos.coords.latitude.toFixed(5);
            document.getElementById('lokasi-lon').value = pos.coords.longitude.toFixed(5);
            pesan.innerText = 'Koordinat perangkat ini terisi. Periksa, beri nama lokasi, lalu simpan.';
          },
          () => { pesan.innerText = 'Posisi perangkat tidak bisa dibaca (izin ditolak atau tidak tersedia). Isi koordinat secara manual.'; },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      };
    }
  }

  function fetchSatelliteData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,shortwave_radiation,precipitation,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&hourly=shortwave_radiation,wind_speed_10m&past_days=3&forecast_days=1&timezone=auto&wind_speed_unit=ms`; // m/s agar setara dengan anemometer
    fetch(url).then(res => res.json()).then(data => {
        if (data && data.current) {
          const d = data.current;
          
          const satTemp = document.getElementById('sat-temp');
          const satHum = document.getElementById('sat-humidity');
          const satWindSpeed = document.getElementById('sat-windspeed');
          const satWindDir = document.getElementById('sat-winddir');
          const satRad = document.getElementById('sat-rad');
          const satPres = document.getElementById('sat-pressure');
          const satRain = document.getElementById('sat-rain');

          if (satTemp) satTemp.innerHTML = `${keSuhu(d.temperature_2m).toFixed(1)}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">${labelSuhu()}</small>`;
          if (satHum) satHum.innerHTML = `${d.relative_humidity_2m}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">%</small>`;
          if (satWindSpeed) satWindSpeed.innerHTML = `${d.wind_speed_10m}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">m/s</small>`;
          if (satWindDir) satWindDir.innerHTML = `${d.wind_direction_10m}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">°</small>`;
          if (satRad) satRad.innerHTML = `${d.shortwave_radiation}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">W/m²</small>`;
          if (satPres) satPres.innerHTML = `${d.surface_pressure}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">hPa</small>`;
          if (satRain) satRain.innerHTML = `${d.precipitation}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">mm</small>`;

          globalSatData.rad = d.shortwave_radiation;
          globalSatData.wind = d.wind_speed_10m;
          globalSatData.temp = d.temperature_2m;
          globalSatData.hum = d.relative_humidity_2m;
          globalSatData.pres = d.surface_pressure;
          globalSatData.windDirDeg = d.wind_direction_10m;
          globalSatData.rain = d.precipitation;
          kondisi.satelitGagal = false;
          cuacaSat.kode = (d.weather_code !== undefined) ? d.weather_code : null;
          cuacaSat.terasa = (d.apparent_temperature !== undefined) ? d.apparent_temperature : null;
          if (data.daily && Array.isArray(data.daily.time)) {
            const p2 = (n) => String(n).padStart(2, '0'), n = new Date();
            const i = data.daily.time.indexOf(`${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}`);
            if (i >= 0) { cuacaSat.maks = data.daily.temperature_2m_max[i]; cuacaSat.min = data.daily.temperature_2m_min[i]; }
          }

          // Deret per jam (3 hari ke belakang + hari ini) untuk grafik dan durasi kekeringan
          if (data.hourly && Array.isArray(data.hourly.time)) {
            const h = data.hourly;
            satPerJam = {};
            h.time.forEach((t, i) => {
              satPerJam[t] = { rad: h.shortwave_radiation[i], angin: h.wind_speed_10m[i] };
            });
            perbaruiGrafikRadiasi();
          }

          calculateDelta();
          perbaruiKartuCuaca();
          perbaruiKondisi();
          if (!window.currentSelectedSensor) { window.selectSensor('temp'); } 
          else { window.selectSensor(window.currentSelectedSensor); }
        }
      })
      .catch(err => { console.error(err); kondisi.satelitGagal = true; perbaruiKondisi(); });
  }

  updateWeatherUI();

  // 11. Logika Master Dial (Visual Tengah)
  window.selectSensor = function (type) {
    window.currentSelectedSensor = type;
    const cards = document.querySelectorAll('.ctrl-card');
    cards.forEach(c => c.classList.remove('active')); 
    
    const clickedCard = Array.from(cards).find(c => c.getAttribute('onclick').includes(type));
    if (clickedCard) clickedCard.classList.add('active'); 

    const dialH2 = document.getElementById('master-value');
    const dialP = document.getElementById('master-label');
    const dialSvg = document.querySelector('.dial-svg circle:nth-child(3)');
    const masterIcon = document.getElementById('master-icon-wrap');
    const badge = document.getElementById('master-status-badge');
    const minmax = document.getElementById('master-minmax');
    const sT = document.getElementById('scale-top');
    const sR = document.getElementById('scale-right');
    const sB = document.getElementById('scale-bottom');
    const sL = document.getElementById('scale-left');
    const outerDashed = document.querySelector('.dial-svg circle:nth-child(1)');

    function updateScale(t, r, b, l, mmin, mmax) {
      if (sT) sT.innerText = t; if (sR) sR.innerText = r;
      if (sB) sB.innerText = b; if (sL) sL.innerText = l;
      if (minmax) minmax.innerText = `Min: ${mmin} | Max: ${mmax}`;
    }
    function updateBadge(text, hex, rgba) {
      if (badge) { badge.innerText = text; badge.style.color = hex; badge.style.background = rgba; }
      if (outerDashed) { outerDashed.style.stroke = hex; outerDashed.style.opacity = '0.4'; }
    }

    const data = window.globalSensorData;
    if (!data) return;

    if (type === 'temp') {
      dialH2.innerHTML = `${keSuhu(data.temp).toFixed(1)}<span>${labelSuhu()}</span>`; dialP.innerText = 'Suhu Udara';
      dialSvg.style.stroke = 'var(--merah-muda)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-thermometer"></i>'; masterIcon.style.color = 'var(--merah-muda)'; }
      dialSvg.style.strokeDashoffset = 440 - (data.temp / 50) * 440;
      if (satuanSuhu === 'F') updateScale('32', '54.5', '77', '99.5', '32', '122');
      else updateScale('0', '12.5', '25', '37.5', '0', '50');
      let status = 'NORMAL'; if (data.temp > 35) status = 'PANAS'; if (data.temp < 20) status = 'DINGIN';
      updateBadge(status, 'var(--merah-muda)', 'rgba(247,37,133,0.15)');
    } else if (type === 'hum') {
      dialH2.innerHTML = `${Math.round(data.hum)}<span>%</span>`; dialP.innerText = 'Kelembapan';
      dialSvg.style.stroke = 'var(--ungu)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-drop"></i>'; masterIcon.style.color = 'var(--ungu)'; }
      dialSvg.style.strokeDashoffset = 440 - (data.hum / 100) * 440;
      updateScale('0', '25', '50', '75', '0', '100');
      let status = 'NORMAL'; if (data.hum > 80) status = 'LEMBAP'; if (data.hum < 40) status = 'KERING';
      updateBadge(status, 'var(--ungu)', 'rgba(114,9,183,0.15)');
    } else if (type === 'pres') {
      dialH2.innerHTML = `${data.pres.toFixed(1)}<span>kPa</span>`; dialP.innerText = 'Tekanan Udara';
      dialSvg.style.stroke = 'var(--hijau-daun)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-arrows-in"></i>'; masterIcon.style.color = 'var(--hijau-daun)'; }
      dialSvg.style.strokeDashoffset = 440 - ((data.pres - 90) / 20) * 440;
      updateScale('90', '95', '100', '105', '90', '110');
      let status = 'NORMAL'; if (data.pres > 102) status = 'TINGGI'; if (data.pres < 100) status = 'RENDAH';
      updateBadge(status, 'var(--hijau-daun)', 'rgba(167,201,87,0.15)');
    } else if (type === 'rad') {
      dialH2.innerHTML = `${data.rad.toFixed(1)}<span>W/m²</span>`; dialP.innerText = 'Radiasi Matahari';
      dialSvg.style.stroke = 'var(--kuning)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-sun"></i>'; masterIcon.style.color = 'var(--kuning)'; }
      dialSvg.style.strokeDashoffset = 440 - (data.rad / 1200) * 440;
      updateScale('0', '300', '600', '900', '0', '1200');
      let status = 'NORMAL'; if (data.rad > 800) status = 'TINGGI'; if (data.rad < 300) status = 'RENDAH';
      updateBadge(status, 'var(--kuning)', 'rgba(255,183,3,0.15)');
    } else if (type === 'wind') {
      dialH2.innerHTML = `${data.wind.toFixed(1)}<span>m/s</span>`; dialP.innerText = 'Kecepatan Angin';
      dialSvg.style.stroke = 'var(--hijau)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-wind"></i>'; masterIcon.style.color = 'var(--hijau)'; }
      dialSvg.style.strokeDashoffset = 440 - (data.wind / 30) * 440;
      updateScale('0', '7.5', '15', '22.5', '0', '30');
      let status = 'NORMAL'; if (data.wind > 10) status = 'KENCANG';
      updateBadge(status, 'var(--hijau)', 'rgba(6,214,160,0.15)');
    } else if (type === 'winddir') {
      dialH2.innerHTML = `${data.windDirDeg.toFixed(0)}<span>°</span>`; dialP.innerText = data.windDirText;
      dialSvg.style.stroke = 'var(--biru)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-navigation-arrow"></i>'; masterIcon.style.color = 'var(--biru)'; }
      dialSvg.style.strokeDashoffset = 440 - (data.windDirDeg / 360) * 440;
      updateScale('U', 'T', 'S', 'B', '0°', '360°');
      updateBadge(data.windDirText, 'var(--biru)', 'rgba(76,201,240,0.15)');
    } else if (type === 'pm25' || type === 'pm10') {
      const v = data[type];
      const label = type === 'pm25' ? 'Partikulat PM2.5' : 'Partikulat PM10';
      const warna = type === 'pm25' ? 'var(--oranye)' : 'var(--ungu-muda)';
      const skala = type === 'pm25' ? 250 : 420;
      dialP.innerText = label;
      dialSvg.style.stroke = warna;
      if (masterIcon) {
        masterIcon.innerHTML = `<i class="ph-fill ${type === 'pm25' ? 'ph-circles-three' : 'ph-dots-nine'}"></i>`;
        masterIcon.style.color = warna;
      }
      if (type === 'pm25') updateScale('0', '62.5', '125', '187.5', '0', '250');
      else updateScale('0', '105', '210', '315', '0', '420');
      if (v === null || v === undefined) {
        dialH2.innerHTML = `--<span>µg/m³</span>`;
        dialSvg.style.strokeDashoffset = 440;
        updateBadge('TIDAK ADA DATA', 'var(--text-secondary)', 'var(--lembut-2)');
      } else {
        dialH2.innerHTML = `${v.toFixed(1)}<span>µg/m³</span>`;
        dialSvg.style.strokeDashoffset = 440 - Math.min(v / skala, 1) * 440;
        const k = kategoriISPU(type, v);
        updateBadge(`${k.nama} · ISPU ${hitungISPU(type, v)}`, k.warna, 'var(--lembut-3)');
      }
    } else if (type === 'rain') {
      dialH2.innerHTML = `${(data.rain || 0).toFixed(1)}<span>mm</span>`; dialP.innerText = 'Curah Hujan';
      dialSvg.style.stroke = 'var(--biru)';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-cloud-rain"></i>'; masterIcon.style.color = 'var(--biru)'; }
      dialSvg.style.strokeDashoffset = 440 - ((data.rain || 0) / 50) * 440;
      updateScale('0', '12.5', '25', '37.5', '0', '50');
      let status = 'KERING'; if ((data.rain || 0) > 10) status = 'HUJAN';
      updateBadge(status, 'var(--biru)', 'rgba(76,201,240,0.15)');
    }

    // Memastikan label Master Dial tetap tertulis OFFLINE jika sensor mati
    if (!isSensorOnline) {
      updateBadge('OFFLINE', 'var(--text-secondary)', 'var(--lembut-2)');
    }
  };

  // 12. Grafik radiasi hari ini: satelit per jam vs rata-rata sensor per jam
  let grafikRadiasi = null;
  const LABEL_JAM = Array.from({ length: 24 }, (_, j) => `${String(j).padStart(2, '0')}:00`);

  function dataRadiasiHariIni() {
    const sensor = rataSensorPerJam();
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const sat = [], sen = [];
    for (let j = 0; j < 24; j++) {
      const k = kunciJam(t);
      sat.push(satPerJam[k] && satPerJam[k].rad != null ? satPerJam[k].rad : null);
      sen.push(sensor[k] && sensor[k].rad != null ? Math.round(sensor[k].rad) : null);
      t.setHours(t.getHours() + 1);
    }
    return { sat, sen };
  }

  function perbaruiGrafikRadiasi() {
    if (!grafikRadiasi) return;
    const { sat, sen } = dataRadiasiHariIni();
    grafikRadiasi.data.datasets[0].data = sen;
    grafikRadiasi.data.datasets[1].data = sat;
    grafikRadiasi.update('none');
  }

  const ctx = document.getElementById('radiationChart');
  if (ctx && typeof Chart !== 'undefined') {
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(255, 77, 77, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 77, 77, 0.03)');
    grafikRadiasi = new Chart(ctx, {
      type: 'line',
      data: {
        labels: LABEL_JAM,
        datasets: [
          {
            label: 'Sensor, rata-rata per jam (W/m²)', data: [],
            borderColor: '#ff4d4d', backgroundColor: gradient, borderWidth: 2,
            pointBackgroundColor: '#fff', pointBorderColor: '#ff4d4d', pointBorderWidth: 2, pointRadius: 3,
            fill: true, tension: 0.35, spanGaps: false
          },
          {
            label: 'Satelit (W/m²)', data: [],
            borderColor: '#8b8b9b', borderWidth: 1.5, borderDash: [5, 4],
            pointRadius: 0, fill: false, tension: 0.35, spanGaps: true
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', align: 'end',
                    labels: { color: TEMA.warna('--grafik-teks'), font: { size: 10 }, boxWidth: 18, boxHeight: 2, padding: 6 } },
          title: { display: false }
        },
        scales: {
          x: { grid: { color: TEMA.warna('--grafik-garis') }, ticks: { color: TEMA.warna('--grafik-teks'), font: { size: 10 }, maxTicksLimit: 8 } },
          y: { grid: { color: TEMA.warna('--grafik-garis') }, ticks: { color: TEMA.warna('--grafik-teks'), font: { size: 10 } }, beginAtZero: true }
        }
      }
    });
    perbaruiGrafikRadiasi();
  }

  // ==========================================
  // 13. LOGIKA HALAMAN HISTORY & EXPORT
  // ==========================================
  window.switchPage = function(pageId) {
    const pageHome = document.getElementById('page-home');
    const pageHistory = document.getElementById('page-history');
    const navHome = document.getElementById('nav-home');
    const navHistory = document.getElementById('nav-history');
    // Halaman tambahan v3: perbandingan dan pemantauan harian
    const halamanTambahan = ['compare', 'daily', 'about'];
    halamanTambahan.forEach(id => {
      const hal = document.getElementById(`page-${id}`), nav = document.getElementById(`nav-${id}`);
      if (hal) hal.style.display = pageId === id ? 'flex' : 'none';
      if (nav) nav.classList.toggle('active', pageId === id);
    });
    if (halamanTambahan.includes(pageId)) {
      pageHome.style.display = 'none';
      pageHistory.style.display = 'none';
      if (navHome) navHome.classList.remove('active');
      if (navHistory) navHistory.classList.remove('active');
      if (pageId === 'daily' && window.harianBuka) window.harianBuka();
      if (pageId === 'about' && window.tentangIsi) window.tentangIsi();
      return;
    }

    if (pageId === 'home') {
      pageHome.style.display = 'contents';
      pageHistory.style.display = 'none';
      if (navHome) navHome.classList.add('active');
      if (navHistory) navHistory.classList.remove('active');
    } else if (pageId === 'history') {
      pageHome.style.display = 'none';
      pageHistory.style.display = 'flex';
      if (navHome) navHome.classList.remove('active');
      if (navHistory) navHistory.classList.add('active');
      
      // Set default dates if empty
      const startDateInput = document.getElementById('hist-start-date');
      const endDateInput = document.getElementById('hist-end-date');
      if (!startDateInput.value) {
        const today = new Date();
        endDateInput.value = today.toISOString().split('T')[0];
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        startDateInput.value = lastWeek.toISOString().split('T')[0];
      }
    }
  };

  let historyData = null;
  let historyChart = null;
  let currentHistoryVar = 'rad';

  window.fetchHistoryData = function() {
    const startDate = document.getElementById('hist-start-date').value;
    const endDate = document.getElementById('hist-end-date').value;
    if (!startDate || !endDate) return alert("Pilih tanggal mulai dan selesai!");

    const lat = (window.STASIUN || {}).lat ?? -7.7;   // mengikuti lokasi alat yang diatur di dashboard
    const lon = (window.STASIUN || {}).lon ?? 110.6;
    // Gunakan Open-Meteo Archive API untuk data masa lalu tanpa batas
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,precipitation,wind_speed_10m,shortwave_radiation,wind_direction_10m`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert("Gagal menarik data: " + data.reason);
          return;
        }
        historyData = data.hourly;
        renderHistoryChart(currentHistoryVar);
      })
      .catch(err => {
        console.error(err);
        alert("Gagal terhubung ke satelit Open-Meteo.");
      });
  };

  window.selectHistoryVar = function(type) {
    currentHistoryVar = type;
    const cards = document.querySelectorAll('#page-history .ctrl-card');
    cards.forEach(c => c.classList.remove('active'));
    const clickedCard = document.getElementById('hist-card-' + type);
    if (clickedCard) clickedCard.classList.add('active');
    
    if (historyData) renderHistoryChart(type);
  };

  function renderHistoryChart(type) {
    if (!historyData) return;

    const ctx = document.getElementById('historicalChart');
    if (!ctx) return;
    
    if (historyChart) historyChart.destroy();

    let chartData = [];
    let label = '';
    let color = '';
    let bgColor = '';
    const timeLabels = historyData.time.map(t => {
      const d = new Date(t);
      return `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2, '0')}:00`;
    });

    if (type === 'rad') {
      chartData = historyData.shortwave_radiation; label = 'Radiasi Matahari (W/m²)'; color = '#ffb703'; bgColor = 'rgba(255,183,3,0.1)';
    } else if (type === 'temp') {
      chartData = historyData.temperature_2m; label = 'Suhu Udara (°C)'; color = '#f72585'; bgColor = 'rgba(247,37,133,0.1)';
    } else if (type === 'hum') {
      chartData = historyData.relative_humidity_2m; label = 'Kelembapan (%)'; color = '#7209b7'; bgColor = 'rgba(114,9,183,0.1)';
    } else if (type === 'pres') {
      chartData = historyData.surface_pressure; label = 'Tekanan (hPa)'; color = '#a7c957'; bgColor = 'rgba(167,201,87,0.1)';
    } else if (type === 'wind') {
      chartData = historyData.wind_speed_10m; label = 'Kecepatan Angin (km/h)'; color = '#06d6a0'; bgColor = 'rgba(6,214,160,0.1)';
    } else if (type === 'rain') {
      chartData = historyData.precipitation; label = 'Curah Hujan (mm)'; color = '#4cc9f0'; bgColor = 'rgba(76,201,240,0.1)';
    }

    document.getElementById('hist-chart-title').innerText = `Grafik Riwayat: ${label}`;

    historyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [{
          label: label,
          data: chartData,
          borderColor: color,
          backgroundColor: bgColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: TEMA.warna('--grafik-garis') }, ticks: { color: TEMA.warna('--grafik-teks'), maxTicksLimit: 10 } },
          y: { grid: { color: TEMA.warna('--grafik-garis') }, ticks: { color: TEMA.warna('--grafik-teks') } }
        }
      }
    });
  }

  window.downloadHistoryCSV = function() {
    if (!historyData) {
      alert("Silakan klik 'Tarik Data' terlebih dahulu sebelum mengunduh CSV!");
      return;
    }

    let csvContent = "Tanggal/Waktu,Radiasi(W/m2),Suhu(C),Kelembapan(%),Tekanan(hPa),Hujan(mm),Kecepatan_Angin(km/h),Arah_Angin(Derajat)\n";
    
    for (let i = 0; i < historyData.time.length; i++) {
      // Format waktu agar Excel ramah: YYYY-MM-DD HH:MM:SS
      const t = historyData.time[i];
      const timeExcel = t.replace('T', ' '); 
      
      const rad = historyData.shortwave_radiation[i];
      const temp = historyData.temperature_2m[i];
      const hum = historyData.relative_humidity_2m[i];
      const pres = historyData.surface_pressure[i];
      const rain = historyData.precipitation[i];
      const wind = historyData.wind_speed_10m[i];
      const windDir = historyData.wind_direction_10m[i];
      
      csvContent += `${timeExcel},${rad},${temp},${hum},${pres},${rain},${wind},${windDir}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Satelit_${document.getElementById('hist-start-date').value}_ke_${document.getElementById('hist-end-date').value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

});