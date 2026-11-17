// =====================================================================
// HALAMAN PEMANTAUAN HARIAN
// Sumber data: riwayat yang direkam dashboard di browser ini (otomatis)
// dan file CSV yang dimuat (kartu SD / StationLogger). Diolah di browser.
// =====================================================================
(function () {
  const DS = window.DataSensor;
  const el = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const tglISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const GRAFIK = [
    { id: 'rad',  judul: 'Radiasi matahari (W/m²)', seri: [['rad', 'Radiasi', '#ffb703']], nol: true },
    { id: 'temp', judul: 'Suhu udara (°C)',          seri: [['temp', 'Suhu', '#f72585']] },
    { id: 'hum',  judul: 'Kelembapan (%)',           seri: [['hum', 'Kelembapan', '#9d6bff']] },
    { id: 'pres', judul: 'Tekanan udara (hPa)',      seri: [['pres', 'Tekanan', '#a7c957']] },
    { id: 'wind', judul: 'Kecepatan angin (m/s)',    seri: [['wind', 'Rata-rata', '#06d6a0'], ['windMax', 'Tertinggi', '#4cc9f0']], nol: true },
    { id: 'pm',   judul: 'Partikulat (µg/m³)',       seri: [['pm25', 'PM2.5', '#ff7b54'], ['pm10', 'PM10', '#c77dff']], nol: true },
    { id: 'rain', judul: 'Bacaan sensor hujan (mm)', seri: [['rain', 'Hujan', '#4cc9f0']], nol: true }
  ];

  let rentangHari = 1;
  let sudahDibuka = false;
  const grafik = {};

  function fmt(v, des) {
    return (v === null || v === undefined || !isFinite(v)) ? '--'
      : v.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des });
  }
  function status(teks, jenis) {
    const s = el('hr-status');
    if (!s) return;
    s.innerText = teks;
    s.style.color = jenis === 'galat' ? 'var(--merah-muda)' : (jenis === 'ok' ? 'var(--hijau)' : 'var(--text-secondary)');
  }

  // Statistik sekumpulan baris menit
  function ringkas(baris) {
    const kol = ['rad', 'temp', 'hum', 'pres', 'wind', 'pm25', 'pm10', 'rain'];
    const a = {};
    kol.forEach(k => a[k] = { s: 0, n: 0, min: Infinity, max: -Infinity });
    baris.forEach(r => kol.forEach(k => {
      const v = r[k];
      if (v === null || v === undefined) return;
      const o = a[k]; o.s += v; o.n++; if (v < o.min) o.min = v; if (v > o.max) o.max = v;
    }));
    const h = { n: baris.length };
    kol.forEach(k => {
      const o = a[k];
      h[k] = o.n ? { rata: o.s / o.n, min: o.min, max: o.max, n: o.n } : null;
    });
    return h;
  }

  // Energi surya (kWh/m²): jumlah rata-rata radiasi tiap jam. Jam tanpa data tidak dihitung.
  function energiSurya(baris) {
    const jam = {};
    baris.forEach(r => {
      if (r.rad === null || r.rad === undefined) return;
      const d = new Date(r.t), k = `${tglISO(d)}T${p2(d.getHours())}`;
      const g = jam[k] || (jam[k] = { s: 0, n: 0 });
      g.s += r.rad; g.n++;
    });
    const kunci = Object.keys(jam);
    if (!kunci.length) return null;
    const hari = new Set(kunci.map(k => k.slice(0, 10))).size;
    return { kwh: kunci.reduce((t, k) => t + jam[k].s / jam[k].n, 0) / 1000, jam: kunci.length, hari };
  }

  function kategoriPM(jenis, nilai) {
    if (!window.ISPU || nilai === null || nilai === undefined) return null;
    return { nama: window.ISPU.kategori(jenis, nilai).nama, warna: window.ISPU.kategori(jenis, nilai).warna, indeks: window.ISPU.hitung(jenis, nilai) };
  }

  function batasRentang() {
    const akhirStr = el('hr-tanggal').value;
    if (!akhirStr) return null;
    const akhir = new Date(akhirStr + 'T00:00:00');
    const sampai = akhir.getTime() + 24 * 3600 * 1000;
    const dari = sampai - rentangHari * 24 * 3600 * 1000;
    return { dari, sampai };
  }

  function gambar() {
    const batas = batasRentang();
    if (!batas) return;
    const baris = DS.menit.filter(r => r.t >= batas.dari && r.t < batas.sampai);
    const ada = baris.length > 0;
    el('hr-kosong').style.display = ada ? 'none' : 'block';
    el('hr-isi').style.display = ada ? 'grid' : 'none';
    document.querySelectorAll('[data-hr-rentang]').forEach(b => b.classList.toggle('aktif', +b.dataset.hrRentang === rentangHari));
    if (!ada) {
      el('hr-kosong').innerText = DS.menit.length
        ? 'Tidak ada data sensor pada tanggal ini. Pilih tanggal lain, atau muat file data yang mencakup tanggal ini.'
        : 'Belum ada data sensor. Biarkan dashboard terbuka agar data terekam, atau muat file dari kartu SD.';
      return;
    }

    // ---- Kartu ringkasan
    const r = ringkas(baris);
    const e = energiSurya(baris);
    const menitHarap = rentangHari * 1440;
    el('hr-energi').innerText = e ? fmt(rentangHari === 1 ? e.kwh : e.kwh / e.hari, 2) : '--';
    el('hr-energi-ket').innerText = e ? (rentangHari === 1 ? `dari ${e.jam} jam yang punya data` : `rata-rata per hari dari ${e.hari} hari yang punya data`) : 'tidak ada data radiasi';
    el('hr-suhu').innerText = r.temp ? `${fmt(r.temp.min, 1)} – ${fmt(r.temp.max, 1)}` : '--';
    el('hr-suhu-ket').innerText = r.temp ? `rata-rata ${fmt(r.temp.rata, 1)} °C` : 'tidak ada data suhu';
    el('hr-angin').innerText = r.wind ? fmt(r.wind.rata, 2) : '--';
    el('hr-angin-ket').innerText = r.wind ? `tertinggi ${fmt(r.wind.max, 2)} m/s` : 'tidak ada data angin';
    const kat = r.pm25 ? kategoriPM('pm25', r.pm25.rata) : null;
    el('hr-pm').innerText = r.pm25 ? fmt(r.pm25.rata, 1) : '--';
    el('hr-pm-ket').innerText = kat ? `${kat.nama.toLowerCase()}, ISPU ${kat.indeks}` : 'tidak ada data PM2.5';
    el('hr-pm-ket').style.color = kat ? kat.warna : 'var(--text-secondary)';
    el('hr-lengkap').innerText = fmt(Math.min(100, r.n / menitHarap * 100), 0);
    el('hr-lengkap-ket').innerText = `${r.n.toLocaleString('id-ID')} dari ${menitHarap.toLocaleString('id-ID')} menit`;

    // ---- Grafik: 10 menit per titik (1 hari) atau 1 jam per titik (7 hari)
    const langkah = (rentangHari === 1 ? 10 : 60) * 60000;
    const jumlah = Math.round((batas.sampai - batas.dari) / langkah);
    const ember = Array.from({ length: jumlah }, () => []);
    baris.forEach(b => { const i = Math.floor((b.t - batas.dari) / langkah); if (i >= 0 && i < jumlah) ember[i].push(b); });
    const label = ember.map((_, i) => {
      const d = new Date(batas.dari + i * langkah);
      return rentangHari === 1 ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : `${HARI[d.getDay()]} ${p2(d.getHours())}:00`;
    });
    const deret = {};
    ['rad', 'temp', 'hum', 'pres', 'wind', 'pm25', 'pm10', 'rain'].forEach(k => {
      deret[k] = ember.map(g => { const s = ringkas(g)[k]; return s ? +s.rata.toFixed(2) : null; });
    });
    deret.windMax = ember.map(g => { const s = ringkas(g).wind; return s ? +s.max.toFixed(2) : null; });

    if (typeof Chart !== 'undefined') {
      const kisi = { color: TEMA.warna('--grafik-garis') }, tik = { color: TEMA.warna('--grafik-teks'), font: { size: 10 } };
      GRAFIK.forEach(g => {
        const kanvas = el(`hr-grafik-${g.id}`);
        if (!kanvas) return;
        const dataset = g.seri.map(([k, nama, warna], i) => ({
          label: nama, data: deret[k], borderColor: warna, backgroundColor: warna,
          borderWidth: i === 0 ? 2 : 1.5, borderDash: i === 0 ? [] : [5, 4], pointRadius: 0, tension: 0.25, spanGaps: false
        }));
        if (grafik[g.id]) grafik[g.id].destroy();
        grafik[g.id] = new Chart(kanvas, {
          type: 'line', data: { labels: label, datasets: dataset },
          options: { responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: g.seri.length > 1, labels: { color: TEMA.warna('--grafik-legenda'), font: { size: 10 }, boxWidth: 16, boxHeight: 2 } } },
            scales: { x: { grid: kisi, ticks: { ...tik, maxTicksLimit: 7, maxRotation: 0 } }, y: { grid: kisi, ticks: tik, beginAtZero: !!g.nol } } }
        });
      });
    }

    // ---- Tabel per hari
    const tb = el('hr-tabel');
    tb.innerHTML = '';
    for (let h = 0; h < rentangHari; h++) {
      const a = batas.dari + h * 86400000, z = a + 86400000;
      const bh = baris.filter(b => b.t >= a && b.t < z);
      const d = new Date(a);
      const s = ringkas(bh), en = energiSurya(bh);
      const k = s.pm25 ? kategoriPM('pm25', s.pm25.rata) : null;
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${HARI[d.getDay()]}, ${p2(d.getDate())}/${p2(d.getMonth() + 1)}</td>` +
        `<td>${en ? fmt(en.kwh, 2) : '--'}</td>` +
        `<td>${s.temp ? `${fmt(s.temp.min, 1)} / ${fmt(s.temp.rata, 1)} / ${fmt(s.temp.max, 1)}` : '--'}</td>` +
        `<td>${s.hum ? fmt(s.hum.rata, 0) : '--'}</td>` +
        `<td>${s.wind ? `${fmt(s.wind.rata, 2)} / ${fmt(s.wind.max, 2)}` : '--'}</td>` +
        `<td>${s.pm25 ? fmt(s.pm25.rata, 1) : '--'}${k ? ` <span style="color:${k.warna}">${k.nama.toLowerCase()}</span>` : ''}</td>` +
        `<td>${fmt(Math.min(100, s.n / 1440 * 100), 0)}%</td>`;
      tb.appendChild(tr);
    }
  }

  function setelTanggalAwal() {
    const m = DS.menit;
    if (!el('hr-tanggal').value) el('hr-tanggal').value = tglISO(m.length ? new Date(m[m.length - 1].t) : new Date());
  }

  // Dipanggil saat halaman dibuka dari bilah kiri
  window.harianBuka = function () {
    const sebelum = DS.menit.length;
    DS.gabung(DS.dariRiwayat());
    setelTanggalAwal();
    if (!sudahDibuka) {
      sudahDibuka = true;
      const m = DS.menit;
      status(m.length
        ? `${m.length.toLocaleString('id-ID')} baris data tersedia, dari ${tglISO(new Date(m[0].t))} sampai ${tglISO(new Date(m[m.length - 1].t))}.`
        : 'Belum ada data yang terekam di browser ini.', m.length ? 'ok' : undefined);
    } else if (DS.menit.length !== sebelum) {
      status(`${DS.menit.length.toLocaleString('id-ID')} baris data tersedia.`, 'ok');
    }
    gambar();
  };

  // Dipanggil dashboard tiap ada data baru; hanya menggambar ulang bila halaman ini terbuka
  window.harianSegarkan = function () {
    const hal = el('page-daily');
    if (!hal || hal.style.display === 'none') return;
    DS.gabung(DS.dariRiwayat());
    gambar();
  };

  window.harianMuatFile = async function (input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const { dibaca, catatan } = await DS.muatFile(files);
    input.value = '';
    const m = DS.menit;
    if (!dibaca) { status(`Tidak ada baris yang bisa dipakai dari file itu. ${catatan}`, 'galat'); return; }
    el('hr-tanggal').value = tglISO(new Date(m[m.length - 1].t));
    status(`${dibaca.toLocaleString('id-ID')} baris dibaca dari file. ${catatan}`, 'ok');
    gambar();
  };

  window.harianRentang = function (hari) { rentangHari = hari; gambar(); };
  window.harianGantiTanggal = function () { gambar(); };

  window.harianUnduh = function () {
    const batas = batasRentang();
    if (!batas) return;
    const kepala = 'Tanggal,Energi_surya_kWh_m2,Suhu_min,Suhu_rata,Suhu_maks,Kelembapan_rata,Tekanan_rata_hPa,Angin_rata,Angin_maks,PM2.5_rata,PM10_rata,Menit_data';
    const baris = [kepala];
    const f = (o, k, d) => (o ? o[k].toFixed(d) : '');
    for (let h = 0; h < rentangHari; h++) {
      const a = batas.dari + h * 86400000, z = a + 86400000;
      const bh = DS.menit.filter(b => b.t >= a && b.t < z);
      if (!bh.length) continue;
      const s = ringkas(bh), en = energiSurya(bh);
      baris.push([tglISO(new Date(a)), en ? en.kwh.toFixed(3) : '', f(s.temp, 'min', 1), f(s.temp, 'rata', 1), f(s.temp, 'max', 1),
        f(s.hum, 'rata', 1), f(s.pres, 'rata', 1), f(s.wind, 'rata', 2), f(s.wind, 'max', 2), f(s.pm25, 'rata', 1), f(s.pm10, 'rata', 1), s.n].join(','));
    }
    if (baris.length === 1) { status('Tidak ada data pada rentang ini untuk diunduh.', 'galat'); return; }
    const blob = new Blob([baris.join('\n')], { type: 'text/csv' });
    const tautan = document.createElement('a');
    tautan.href = URL.createObjectURL(blob);
    tautan.download = `ringkasan_harian_sampai_${el('hr-tanggal').value}.csv`;
    tautan.click();
    URL.revokeObjectURL(tautan.href);
  };
})();
