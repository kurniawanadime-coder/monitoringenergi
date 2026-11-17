// =====================================================================
// TATA LETAK MENYESUAIKAN LAYAR
//
// Dua mode, dipilih otomatis dari ukuran jendela browser:
//
//  - mode-app  : laptop, monitor, dan tablet mendatar. Seluruh dashboard
//                diperbesar/diperkecil agar pas satu layar, tanpa scroll.
//                Lebar kanvas ikut melebar di layar lebar (sampai batas),
//                tinggi kanvas selalu memenuhi layar.
//  - mode-alir : HP dan tablet tegak. Kartu disusun 1 atau 2 kolom dan
//                halaman di-scroll seperti situs biasa.
//
// File ini juga mengatur tema gelap/terang (window.TEMA).
// File ini dimuat di <head> agar mode dan tema sudah terpasang sebelum halaman tampil.
// =====================================================================
(function () {
  const TINGGI_DESAIN = 760;      // tinggi minimum kanvas (px desain) yang memuat semua kartu beranda
  const LEBAR_DESAIN_MIN = 1240;  // lebar minimum kanvas
  const LEBAR_DESAIN_MAKS = 1640; // di layar sangat lebar, kanvas tidak melebar lagi dan ditengahkan

  const root = document.documentElement;
  let skalaSekarang = 1;

  function pilihMode() {
    const w = window.innerWidth, h = window.innerHeight;
    // Mode app butuh layar cukup lebar, mendatar, dan tidak terlalu pendek
    return w >= 1000 && h >= 540 && w / h >= 1.15;
  }

  function terapkan() {
    const app = pilihMode();
    root.classList.toggle('mode-app', app);
    root.classList.toggle('mode-alir', !app);

    const kotak = document.querySelector('.dashboard-container');
    if (!kotak) return;

    if (!app) {
      ['width', 'height', 'transform', 'left', 'top'].forEach(p => { kotak.style[p] = ''; });
      aturKetajamanGrafik(1);
      return;
    }

    const w = window.innerWidth, h = window.innerHeight;
    const tepi = w >= 1600 ? 20 : 10;                   // jarak kanvas ke tepi layar
    const lebarTersedia = w - 2 * tepi, tinggiTersedia = h - 2 * tepi;
    const skala = Math.min(tinggiTersedia / TINGGI_DESAIN, lebarTersedia / LEBAR_DESAIN_MIN);
    const lebar = Math.min(lebarTersedia / skala, LEBAR_DESAIN_MAKS);
    const tinggi = tinggiTersedia / skala;

    kotak.style.width = `${lebar}px`;
    kotak.style.height = `${tinggi}px`;
    kotak.style.transform = `scale(${skala})`;
    kotak.style.left = `${(w - lebar * skala) / 2}px`;
    kotak.style.top = `${(h - tinggi * skala) / 2}px`;
    aturKetajamanGrafik(skala);
  }

  // Grafik digambar pada ukuran desain lalu ikut diperbesar; resolusinya
  // dinaikkan sesuai skala agar tidak buram di monitor besar.
  function aturKetajamanGrafik(skala) {
    skalaSekarang = Math.max(1, skala);
    if (typeof Chart === 'undefined') return;
    const dpr = (window.devicePixelRatio || 1) * skalaSekarang;
    Chart.defaults.devicePixelRatio = dpr;
    Object.values(Chart.instances || {}).forEach(g => {
      if (g.options.devicePixelRatio !== dpr) { g.options.devicePixelRatio = dpr; g.resize(); }
    });
  }

  // ===================================================================
  // TEMA GELAP / TERANG
  // Pilihan disimpan di browser ini. Bawaan: gelap.
  // ===================================================================
  const KUNCI_TEMA = 'stasiun_tema_v1';
  let temaAwal = 'gelap';
  try {
    const t = localStorage.getItem(KUNCI_TEMA);
    if (t === 'terang' || t === 'gelap') temaAwal = t;
  } catch (e) { /* penyimpanan tidak tersedia: pakai bawaan */ }
  root.dataset.tema = temaAwal;

  function perbaruiTombolTema() {
    const terang = root.dataset.tema === 'terang';
    const tombol = document.getElementById('tombol-tema');
    if (tombol) {
      const label = terang ? 'Ganti ke mode gelap' : 'Ganti ke mode terang';
      tombol.title = label;
      tombol.setAttribute('aria-label', label);
      tombol.innerHTML = `<i class="ph ${terang ? 'ph-moon' : 'ph-sun'}"></i>`;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', terang ? '#eef1f6' : '#1a1a24');
  }

  // Warna sumbu, garis bantu, dan legenda grafik yang sudah tergambar ikut berganti
  function warnaiGrafik() {
    if (typeof Chart === 'undefined') return;
    const teks = TEMA.warna('--grafik-teks'), garis = TEMA.warna('--grafik-garis'), legenda = TEMA.warna('--grafik-legenda');
    Object.values(Chart.instances || {}).forEach(g => {
      const o = g.options;
      Object.values(o.scales || {}).forEach(sk => {
        if (sk.ticks) sk.ticks.color = teks;
        if (sk.grid) sk.grid.color = garis;
        if (sk.title) sk.title.color = teks;
      });
      if (o.plugins && o.plugins.legend && o.plugins.legend.labels) o.plugins.legend.labels.color = legenda;
      g.update('none');
    });
  }

  window.TEMA = {
    nama: () => root.dataset.tema,
    // Nilai variabel warna dari CSS, untuk dipakai grafik (kanvas tidak bisa membaca var())
    warna: (nama) => getComputedStyle(root).getPropertyValue(nama).trim() || '#8b8b9b',
    ganti() {
      root.dataset.tema = root.dataset.tema === 'terang' ? 'gelap' : 'terang';
      try { localStorage.setItem(KUNCI_TEMA, root.dataset.tema); } catch (e) { /* abaikan */ }
      perbaruiTombolTema();
      warnaiGrafik();
    }
  };

  // Pasang kelas mode sedini mungkin (sebelum <body> digambar)
  root.classList.add(pilihMode() ? 'mode-app' : 'mode-alir');

  let jeda = null;
  window.addEventListener('resize', () => { clearTimeout(jeda); jeda = setTimeout(terapkan, 60); });
  window.addEventListener('orientationchange', () => setTimeout(terapkan, 200));
  // Didaftarkan sebelum script.js, jadi berjalan sebelum grafik pertama dibuat
  document.addEventListener('DOMContentLoaded', () => {
    terapkan();
    perbaruiTombolTema();
    // Menu samping bisa dipakai dengan keyboard (Enter atau Spasi)
    document.querySelectorAll('.nav-links li[data-halaman]').forEach(li => {
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
      });
    });
  });
  window.addEventListener('load', terapkan);
  window.terapkanTataLetak = terapkan;
})();
