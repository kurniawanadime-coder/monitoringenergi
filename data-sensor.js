// =====================================================================
// DATA SENSOR BERSAMA (dipakai halaman Perbandingan dan Pemantauan harian)
// Semua data diolah di browser ini dan tidak dikirim ke mana pun.
// Satu baris = satu menit: {t, rad, wind, temp, hum, pres(hPa), rain, pm25, pm10}
// =====================================================================
window.DataSensor = (function () {
  const KUNCI_RIWAYAT = 'stasiun_riwayat_v2';
  let menit = [];

  // Angka sensor yang sah; sentinel firmware (-999, 9999) dan sel kosong = tidak ada
  function angka(str) {
    if (str === undefined || str === null || String(str).trim() === '') return null;
    const v = parseFloat(str);
    if (isNaN(v) || v <= -999 || v >= 9999) return null;
    return v;
  }

  // Mengenali DATALOG.csv dari kartu SD (10, 11, 12, atau 14 kolom; tanggal d/m/yyyy)
  // dan CSV harian StationLogger (kolom pertama Waktu_Alat yyyy-MM-dd HH:mm:ss).
  // Baris dengan tanggal tidak masuk akal (jam alat salah) dilewati.
  function bacaCSV(teks) {
    const hasil = [];
    const lewati = { format: 0, tanggal: 0 };
    const sekarang = Date.now() + 24 * 3600 * 1000;
    const awalWajar = new Date(2024, 0, 1).getTime();
    let logger = false;

    for (const b of teks.split(/\r?\n/)) {
      if (!b.trim()) continue;
      const f = b.split(',');
      if (f[0] === 'Waktu_Alat') { logger = true; continue; }
      if (f[0] === 'Tanggal') { logger = false; continue; }

      let t = NaN, rad, temp, hum, presKpa, wind, rain, pm25, pm10, flag = '';
      if (logger) {
        // Waktu_Alat,Waktu_Terima,Rad,Suhu,RH,Tekanan,Hujan,Angin,AnginMax,Arah,Mata,Flag,[PM2.5,PM10],Sumber
        if (f.length < 12) { lewati.format++; continue; }
        const m = f[0].match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (m) t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
        [rad, temp, hum, presKpa, rain, wind] = [f[2], f[3], f[4], f[5], f[6], f[7]];
        flag = f[11] || '';
        if (f.length >= 15) { pm25 = f[12]; pm10 = f[13]; }
      } else {
        // tgl,jam,rad,suhu,rh,tekanan,hujan,angin,[anginMax],arah,mata,[flag],[pm25,pm10]
        if (![10, 11, 12, 14].includes(f.length)) { lewati.format++; continue; }
        const d = f[0].split('/').map(Number), j = f[1].split(':').map(Number);
        if (d.length === 3 && j.length === 3 && d[1] >= 1 && d[1] <= 12 && d[0] >= 1 && d[0] <= 31 &&
            j[0] <= 23 && j[1] <= 59 && j[2] <= 59) {
          t = new Date(d[2], d[1] - 1, d[0], j[0], j[1], j[2]).getTime();
        }
        [rad, temp, hum, presKpa, rain, wind] = [f[2], f[3], f[4], f[5], f[6], f[7]];
        if (f.length >= 12) flag = f[11] || '';
        if (f.length === 14) { pm25 = f[12]; pm10 = f[13]; }
      }
      if (!isFinite(t) || t < awalWajar || t > sekarang) { lewati.tanggal++; continue; }

      const ok = (i) => flag.length <= i || flag[i] !== 'S';
      const pres = ok(2) ? angka(presKpa) : null;
      hasil.push({
        t,
        rad:  ok(0) ? angka(rad) : null,
        temp: ok(1) ? angka(temp) : null,
        hum:  ok(1) ? angka(hum) : null,
        pres: pres === null ? null : pres * 10,        // kPa -> hPa
        rain: ok(3) ? angka(rain) : null,
        wind: angka(wind),
        pm25: ok(4) ? angka(pm25) : null,
        pm10: ok(4) ? angka(pm10) : null
      });
    }
    return { hasil, lewati };
  }

  // Riwayat yang direkam dashboard di browser ini (7 hari terakhir)
  function dariRiwayat() {
    let simpanan = [];
    try { simpanan = JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) || '[]'); } catch (e) { simpanan = []; }
    if (!Array.isArray(simpanan)) return [];
    const n = (v) => (v === undefined ? null : v);
    return simpanan.filter(r => Array.isArray(r)).map(r => ({
      t: r[0], rad: n(r[1]), wind: n(r[2]), temp: n(r[3]), hum: n(r[4]),
      pres: n(r[5]), rain: n(r[6]), pm25: n(r[7]), pm10: n(r[8])
    }));
  }

  // Gabungkan data baru ke kumpulan; baris dengan waktu sama saling melengkapi
  function gabung(dataBaru) {
    const peta = new Map();
    menit.forEach(r => peta.set(r.t, r));
    dataBaru.forEach(r => {
      const lama = peta.get(r.t);
      if (!lama) { peta.set(r.t, r); return; }
      Object.keys(r).forEach(k => { if (lama[k] === null || lama[k] === undefined) lama[k] = r[k]; });
    });
    menit = Array.from(peta.values()).sort((a, b) => a.t - b.t);
    return menit.length;
  }

  async function muatFile(daftarFile) {
    let semua = [], format = 0, tanggal = 0;
    for (const file of daftarFile) {
      const { hasil, lewati } = bacaCSV(await file.text());
      semua = semua.concat(hasil); format += lewati.format; tanggal += lewati.tanggal;
    }
    gabung(semua);
    const catatan = [];
    if (tanggal) catatan.push(`${tanggal.toLocaleString('id-ID')} baris dilewati karena tanggalnya tidak masuk akal (jam alat salah).`);
    if (format) catatan.push(`${format.toLocaleString('id-ID')} baris dilewati karena formatnya tidak dikenali.`);
    return { dibaca: semua.length, catatan: catatan.join(' ') };
  }

  return {
    KUNCI_RIWAYAT, angka, bacaCSV, dariRiwayat, gabung, muatFile,
    get menit() { return menit; },
    kosongkan() { menit = []; }
  };
})();
