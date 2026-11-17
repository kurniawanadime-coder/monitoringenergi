// Halaman "Tentang stasiun": mengisi lokasi dan angka model dari pengaturan yang sedang berlaku
(function () {
  window.tentangIsi = function () {
    const lokasi = window.STASIUN || {};
    const el = (id) => document.getElementById(id);
    const angka = (v) => (typeof v === 'number' ? v.toLocaleString('id-ID') : '--');
    if (el('tentang-lokasi-nama')) el('tentang-lokasi-nama').innerText = lokasi.nama || '--';
    if (el('tentang-lokasi-lat')) el('tentang-lokasi-lat').innerText = angka(lokasi.lat);
    if (el('tentang-lokasi-lon')) el('tentang-lokasi-lon').innerText = angka(lokasi.lon);

    const m = window.MODEL_POTENSI;
    if (!m) return;
    const nilai = { ...m, porsiAngin: 1 - m.porsiSurya };
    document.querySelectorAll('[data-model]').forEach(span => {
      const v = nilai[span.dataset.model];
      if (typeof v !== 'number') return;
      span.innerText = span.hasAttribute('data-persen')
        ? `${Math.round(v * 100)}%`
        : v.toLocaleString('id-ID');
    });
  };
})();
