// =====================================================================
// HALAMAN PERBANDINGAN SENSOR vs SATELIT (per jam)
// Semua pengolahan berjalan di browser ini: file yang dimuat TIDAK
// dikirim ke mana pun. Hanya koordinat dan rentang tanggal yang dikirim
// ke Open-Meteo untuk mengambil data satelit.
// =====================================================================
(function () {
  const MIN_SAMPEL_PER_JAM = 20;   // jam dengan data sensor lebih sedikit dari ini diabaikan
  const DS = window.DataSensor;

  // Parameter yang dibandingkan. "sat" = nama variabel Open-Meteo.
  const PARAM = {
    rad:  { nama: 'Radiasi matahari', satuan: 'W/m²', sat: 'shortwave_radiation', warna: '#ffb703', desimal: 0 },
    wind: { nama: 'Kecepatan angin',  satuan: 'm/s',  sat: 'wind_speed_10m',      warna: '#06d6a0', desimal: 2 },
    temp: { nama: 'Suhu udara',       satuan: '°C',   sat: 'temperature_2m',      warna: '#f72585', desimal: 1 },
    hum:  { nama: 'Kelembapan',       satuan: '%',    sat: 'relative_humidity_2m', warna: '#7209b7', desimal: 1 },
    pres: { nama: 'Tekanan udara',    satuan: 'hPa',  sat: 'surface_pressure',    warna: '#a7c957', desimal: 1 }
  };

  let pasangan = {};       // per parameter: [{jam, sensor, satelit}]
  let paramAktif = 'rad';
  let grafikDeret = null, grafikSebar = null;

  const el = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const kunciJam = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`;
  const tglISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

  function status(teks, jenis) {
    const s = el('cmp-status');
    if (!s) return;
    s.innerText = teks;
    s.style.color = jenis === 'galat' ? 'var(--merah-muda)' : (jenis === 'ok' ? 'var(--hijau)' : 'var(--text-secondary)');
  }

  function setelahMuat(keterangan) {
    const menit = DS.menit;
    if (!menit.length) { status(`Tidak ada baris yang bisa dipakai. ${keterangan}`, 'galat'); return; }
    el('cmp-start').value = tglISO(new Date(menit[0].t));
    el('cmp-end').value = tglISO(new Date(menit[menit.length - 1].t));
    status(`${menit.length.toLocaleString('id-ID')} baris data sensor tersedia. ${keterangan} Atur rentang tanggal lalu tekan Bandingkan.`, 'ok');
  }

  window.cmpMuatFile = async function (input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const { catatan } = await DS.muatFile(files);
    setelahMuat(catatan);
    input.value = '';
  };

  window.cmpPakaiRiwayat = function () {
    DS.gabung(DS.dariRiwayat());
    setelahMuat('Termasuk riwayat yang direkam dashboard di browser ini (7 hari terakhir).');
  };

  // ------------------------------------------------------------------
  // Rata-rata sensor per jam
  // ------------------------------------------------------------------
  function sensorPerJam(dariMs, sampaiMs) {
    const kumpul = {};
    DS.menit.forEach(r => {
      if (r.t < dariMs || r.t >= sampaiMs) return;
      const k = kunciJam(new Date(r.t));
      const g = kumpul[k] || (kumpul[k] = {});
      Object.keys(PARAM).forEach(p => {
        if (r[p] === null || r[p] === undefined) return;
        const a = g[p] || (g[p] = { s: 0, n: 0 });
        a.s += r[p]; a.n++;
      });
    });
    const hasil = {};
    Object.keys(kumpul).forEach(k => {
      hasil[k] = {};
      Object.keys(PARAM).forEach(p => {
        const a = kumpul[k][p];
        hasil[k][p] = (a && a.n >= MIN_SAMPEL_PER_JAM) ? a.s / a.n : null;
      });
    });
    return hasil;
  }

  // ------------------------------------------------------------------
  // Data satelit per jam dari Open-Meteo. Data lama (> 85 hari) diambil
  // dari arsip, data baru dari layanan prakiraan (yang menyimpan ~3 bulan).
  // ------------------------------------------------------------------
  async function ambilSatelit(mulai, akhir) {
    const lokasi = window.STASIUN || { lat: -7.7, lon: 110.6 };
    const variabel = Object.values(PARAM).map(p => p.sat).join(',');
    const umum = `latitude=${lokasi.lat}&longitude=${lokasi.lon}&hourly=${variabel}&wind_speed_unit=ms&timezone=auto`;
    const batas = new Date(); batas.setDate(batas.getDate() - 85);
    const batasISO = tglISO(batas);
    const hariIni = tglISO(new Date());
    if (akhir > hariIni) akhir = hariIni;

    const permintaan = [];
    if (mulai < batasISO) {
      const sampai = akhir < batasISO ? akhir : batasISO;
      permintaan.push(`https://archive-api.open-meteo.com/v1/archive?${umum}&start_date=${mulai}&end_date=${sampai}`);
    }
    if (akhir >= batasISO) {
      const dari = mulai > batasISO ? mulai : batasISO;
      permintaan.push(`https://api.open-meteo.com/v1/forecast?${umum}&start_date=${dari}&end_date=${akhir}`);
    }

    const peta = {};
    for (const url of permintaan) {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.hourly) throw new Error(data.reason || `Open-Meteo menjawab ${res.status}`);
      data.hourly.time.forEach((t, i) => {
        const o = peta[t] || (peta[t] = {});
        Object.keys(PARAM).forEach(p => {
          const v = data.hourly[PARAM[p].sat][i];
          if (v !== null && v !== undefined) o[p] = v;
        });
      });
    }
    return peta;
  }

  // ------------------------------------------------------------------
  // Memasangkan sensor dan satelit untuk jam yang sama.
  // Rata-rata sensor jam H mencakup H:00 sampai H:59.
  //  - Radiasi Open-Meteo adalah rata-rata satu jam SEBELUM cap waktunya,
  //    jadi pasangannya adalah nilai satelit bercap waktu H+1.
  //  - Variabel lain bernilai sesaat, jadi dipakai rata-rata nilai H dan H+1.
  // ------------------------------------------------------------------
  function pasangkan(sensor, satelit) {
    const hasil = {};
    Object.keys(PARAM).forEach(p => hasil[p] = []);
    Object.keys(sensor).sort().forEach(k => {
      const t = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), +k.slice(11, 13));
      const berikut = new Date(t); berikut.setHours(berikut.getHours() + 1);
      const a = satelit[k] || {}, b = satelit[kunciJam(berikut)] || {};
      Object.keys(PARAM).forEach(p => {
        const s = sensor[k][p];
        if (s === null || s === undefined) return;
        let sat = null;
        if (p === 'rad') sat = (b.rad !== undefined) ? b.rad : null;
        else if (a[p] !== undefined && b[p] !== undefined) sat = (a[p] + b[p]) / 2;
        else if (a[p] !== undefined) sat = a[p];
        if (sat === null) return;
        hasil[p].push({ jam: k, sensor: s, satelit: sat });
      });
    });
    return hasil;
  }

  function statistik(data) {
    const n = data.length;
    if (!n) return null;
    let sd = 0, sa = 0, sq = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    data.forEach(({ sensor: y, satelit: x }) => {
      const d = y - x;
      sd += d; sa += Math.abs(d); sq += d * d;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    });
    const kov = n * sxy - sx * sy;
    const penyebut = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
    return { n, bias: sd / n, mae: sa / n, rmse: Math.sqrt(sq / n), r: penyebut > 0 ? kov / penyebut : null };
  }

  // ------------------------------------------------------------------
  // Tampilan
  // ------------------------------------------------------------------
  function fmt(v, des) { return (v === null || v === undefined || !isFinite(v)) ? '--' : v.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des }); }

  function tampilkan() {
    const p = PARAM[paramAktif];
    const data = pasangan[paramAktif] || [];
    const st = statistik(data);
    const tanda = (v) => (v > 0 ? '+' : '');

    el('cmp-n').innerText = st ? st.n.toLocaleString('id-ID') : '0';
    el('cmp-bias').innerText = st ? `${tanda(st.bias)}${fmt(st.bias, Math.max(p.desimal, 1))}` : '--';
    el('cmp-mae').innerText = st ? fmt(st.mae, Math.max(p.desimal, 1)) : '--';
    el('cmp-rmse').innerText = st ? fmt(st.rmse, Math.max(p.desimal, 1)) : '--';
    el('cmp-r').innerText = st && st.r !== null ? fmt(st.r, 2) : '--';
    document.querySelectorAll('.cmp-satuan').forEach(e => e.innerText = p.satuan);
    el('cmp-bias-ket').innerText = !st ? '' : (Math.abs(st.bias) < 1e-9 ? 'Sama dengan satelit'
      : (st.bias > 0 ? 'Sensor rata-rata lebih tinggi dari satelit' : 'Sensor rata-rata lebih rendah dari satelit'));
    el('cmp-judul-deret').innerText = `${p.nama} per jam, sensor dan satelit (${p.satuan})`;
    el('cmp-judul-sebar').innerText = `Sebaran ${p.nama.toLowerCase()}: sensor terhadap satelit`;

    document.querySelectorAll('[data-cmp-param]').forEach(k => k.classList.toggle('active', k.dataset.cmpParam === paramAktif));
    el('cmp-kosong').style.display = st ? 'none' : 'block';
    el('cmp-hasil').style.display = st ? 'grid' : 'none';

    // Tabel ringkasan semua parameter
    const tb = el('cmp-tabel');
    tb.innerHTML = '';
    Object.keys(PARAM).forEach(k => {
      const q = PARAM[k], s = statistik(pasangan[k] || []);
      const d = Math.max(q.desimal, 1);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${q.nama} <span class="cmp-redup">(${q.satuan})</span></td>` +
        `<td>${s ? s.n.toLocaleString('id-ID') : 0}</td>` +
        `<td>${s ? tanda(s.bias) + fmt(s.bias, d) : '--'}</td><td>${s ? fmt(s.mae, d) : '--'}</td>` +
        `<td>${s ? fmt(s.rmse, d) : '--'}</td><td>${s && s.r !== null ? fmt(s.r, 2) : '--'}</td>`;
      tb.appendChild(tr);
    });

    if (!st || typeof Chart === 'undefined') return;
    const label = data.map(d => d.jam.replace('T', ' '));
    const kisi = { color: TEMA.warna('--grafik-garis') }, tik = { color: TEMA.warna('--grafik-teks'), font: { size: 10 } };

    if (grafikDeret) grafikDeret.destroy();
    grafikDeret = new Chart(el('cmp-grafik-deret'), {
      type: 'line',
      data: { labels: label, datasets: [
        { label: 'Sensor', data: data.map(d => d.sensor), borderColor: p.warna, backgroundColor: p.warna, borderWidth: 2, pointRadius: data.length > 72 ? 0 : 2, tension: 0.25 },
        { label: 'Satelit', data: data.map(d => d.satelit), borderColor: TEMA.warna('--grafik-teks'), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0.25 }
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: TEMA.warna('--grafik-legenda'), font: { size: 11 }, boxWidth: 18, boxHeight: 2 } } },
        scales: { x: { grid: kisi, ticks: { ...tik, maxTicksLimit: 8, maxRotation: 0 } }, y: { grid: kisi, ticks: tik } } }
    });

    const semua = data.flatMap(d => [d.sensor, d.satelit]);
    const lo = Math.min(...semua), hi = Math.max(...semua);
    if (grafikSebar) grafikSebar.destroy();
    grafikSebar = new Chart(el('cmp-grafik-sebar'), {
      type: 'scatter',
      data: { datasets: [
        { label: 'Tiap titik = satu jam', data: data.map(d => ({ x: d.satelit, y: d.sensor })), backgroundColor: p.warna + 'b0', pointRadius: 3 },
        { label: 'Garis sensor = satelit', type: 'line', data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: TEMA.warna('--grafik-teks'), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 }
      ] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: TEMA.warna('--grafik-legenda'), font: { size: 11 }, boxWidth: 18, boxHeight: 2 } } },
        scales: {
          x: { grid: kisi, ticks: tik, title: { display: true, text: `Satelit (${p.satuan})`, color: TEMA.warna('--grafik-teks'), font: { size: 11 } } },
          y: { grid: kisi, ticks: tik, title: { display: true, text: `Sensor (${p.satuan})`, color: TEMA.warna('--grafik-teks'), font: { size: 11 } } } } }
    });
  }

  window.cmpPilih = function (param) { paramAktif = param; tampilkan(); };

  window.cmpBandingkan = async function () {
    if (!DS.menit.length) { status('Muat file data sensor dulu, atau pakai riwayat browser.', 'galat'); return; }
    const mulai = el('cmp-start').value, akhir = el('cmp-end').value;
    if (!mulai || !akhir || mulai > akhir) { status('Rentang tanggal belum benar.', 'galat'); return; }
    const dari = new Date(mulai + 'T00:00:00').getTime();
    const sampai = new Date(akhir + 'T00:00:00').getTime() + 24 * 3600 * 1000;
    if ((sampai - dari) / 86400000 > 370) { status('Rentang paling lama satu tahun per perbandingan.', 'galat'); return; }

    status('Mengambil data satelit dari Open-Meteo…');
    try {
      const sensor = sensorPerJam(dari, sampai);
      // satelit sampai satu hari sesudahnya, karena radiasi jam 23 berpasangan dengan cap 00:00 esoknya
      const esok = new Date(sampai);
      const satelit = await ambilSatelit(mulai, tglISO(esok));
      pasangan = pasangkan(sensor, satelit);
      const total = Object.values(pasangan).reduce((a, b) => a + b.length, 0);
      if (!total) {
        status(`Tidak ada jam yang bisa dipasangkan. Tiap jam butuh minimal ${MIN_SAMPEL_PER_JAM} data sensor yang sah.`, 'galat');
      } else {
        const jam = Object.keys(sensor).length;
        status(`Selesai: ${jam.toLocaleString('id-ID')} jam data sensor dibandingkan dengan satelit.`, 'ok');
        if (!(pasangan[paramAktif] || []).length) paramAktif = Object.keys(PARAM).find(k => pasangan[k].length) || paramAktif;
      }
      tampilkan();
    } catch (e) {
      status(`Gagal mengambil data satelit: ${e.message}. Periksa koneksi internet lalu coba lagi.`, 'galat');
    }
  };

  window.cmpUnduh = function () {
    const jamSet = new Set();
    Object.values(pasangan).forEach(arr => arr.forEach(d => jamSet.add(d.jam)));
    if (!jamSet.size) { status('Belum ada hasil untuk diunduh. Tekan Bandingkan dulu.', 'galat'); return; }
    const kunci = Object.keys(PARAM);
    const indeks = {};
    kunci.forEach(k => { indeks[k] = {}; (pasangan[k] || []).forEach(d => indeks[k][d.jam] = d); });
    const kepala = ['Jam'].concat(kunci.flatMap(k => [`${k}_sensor`, `${k}_satelit`]));
    const baris = [kepala.join(',')];
    Array.from(jamSet).sort().forEach(j => {
      baris.push([j.replace('T', ' ')].concat(kunci.flatMap(k => {
        const d = indeks[k][j];
        return d ? [d.sensor.toFixed(3), d.satelit.toFixed(3)] : ['', ''];
      })).join(','));
    });
    const blob = new Blob([baris.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perbandingan_sensor_satelit_${el('cmp-start').value}_${el('cmp-end').value}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
})();
