// Environment Dashboard Interactivity - FINAL TERKALIBRASI (Versi Transmisi Gabungan CSV)

document.addEventListener('DOMContentLoaded', () => {
  // 1. Update Date
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const today = new Date();
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    dateEl.innerText = `Hari Ini (${today.toLocaleDateString('id-ID', options)})`;
  }

  // 2. Bank Data Global
  let globalSatData = { rad: null, wind: null, temp: null, hum: null, pres: null, rain: null, windDirDeg: null, windDirText: 'Utara' };
  window.globalSensorData = { temp: 0, hum: 0, pres: 0, rad: 0, wind: 0, rain: 0, windDirDeg: 0, windDirText: 'Utara' };

  // Elemen UI Matahari
  const sunGroup = document.getElementById('sun-group');
  const sunArea = document.getElementById('sun-area');
  const sunProgress = document.getElementById('sun-arc-progress');

  // 3. Kalkulasi Deviasi (Satelit vs Sensor Lokal)
  function calculateDelta() {
    if (globalSatData.rad === null || globalSatData.wind === null) return;

    const data = window.globalSensorData;
    const deltaRad = data.rad - globalSatData.rad;
    const deltaWind = data.wind - globalSatData.wind;

    const dRadVal = document.getElementById('delta-rad-val');
    const dRadDesc = document.getElementById('delta-rad-desc');
    if (dRadVal && dRadDesc) {
      dRadVal.innerText = `${deltaRad > 0 ? '+' : ''}${deltaRad.toFixed(1)}`;
      dRadVal.style.color = Math.abs(deltaRad) < 50 ? '#06d6a0' : '#f72585';
      dRadDesc.innerText = deltaRad > 0 ? 'Sensor lebih tinggi' : (deltaRad < 0 ? 'Sensor lebih rendah' : 'Sama dengan satelit');
    }

    const dWindVal = document.getElementById('delta-wind-val');
    const dWindDesc = document.getElementById('delta-wind-desc');
    if (dWindVal && dWindDesc) {
      dWindVal.innerText = `${deltaWind > 0 ? '+' : ''}${deltaWind.toFixed(1)}`;
      dWindVal.style.color = Math.abs(deltaWind) < 3 ? '#06d6a0' : '#f72585';
      dWindDesc.innerText = deltaWind > 0 ? 'Sensor lebih tinggi' : (deltaWind < 0 ? 'Sensor lebih rendah' : 'Sama dengan satelit');
    }

    // Logic Risiko
    const riskCard = document.getElementById('risk-card');
    const riskStatus = document.getElementById('risk-status');
    if (riskCard && riskStatus) {
      if (globalSatData.rad < 200 && globalSatData.wind < 10) {
        riskCard.classList.add('danger');
        riskStatus.innerText = 'KRITIS';
      } else if (globalSatData.rad < 400 || globalSatData.wind < 15) {
        riskCard.classList.remove('danger');
        riskStatus.innerText = 'SIAGA';
      } else {
        riskCard.classList.remove('danger');
        riskStatus.innerText = 'AMAN';
      }
    }

    // Estimasi Energi Satelit
    const solarKWSat = (globalSatData.rad * 10 * 0.15) / 1000;
    let windKWSat = 0;
    if (globalSatData.wind > 10) {
      windKWSat = (globalSatData.wind - 10) * 0.2;
      if (windKWSat > 5) windKWSat = 5;
    }
    const totalKWSat = solarKWSat + windKWSat;

    const estSolarSat = document.getElementById('est-solar-sat');
    const estWindSat = document.getElementById('est-wind-sat');
    const estTotalSat = document.getElementById('est-total-sat');
    if (estSolarSat) estSolarSat.innerHTML = `${solarKWSat.toFixed(2)} <small>kW</small>`;
    if (estWindSat) estWindSat.innerHTML = `${windKWSat.toFixed(2)} <small>kW</small>`;
    if (estTotalSat) {
      estTotalSat.innerHTML = `${totalKWSat.toFixed(2)} <small>kW</small>`;
      estTotalSat.style.color = totalKWSat < 2.0 ? '#f72585' : '#06d6a0';
    }

    // Estimasi Energi Sensor Lokal
    const solarKWSen = (data.rad * 10 * 0.15) / 1000;
    let windKWSen = 0;
    if (data.wind > 10) {
      windKWSen = (data.wind - 10) * 0.2;
      if (windKWSen > 5) windKWSen = 5;
    }
    const totalKWSen = solarKWSen + windKWSen;

    const estSolarSen = document.getElementById('est-solar-sen');
    const estWindSen = document.getElementById('est-wind-sen');
    const estTotalSen = document.getElementById('est-total-sen');
    if (estSolarSen) estSolarSen.innerHTML = `${solarKWSen.toFixed(2)} <small>kW</small>`;
    if (estWindSen) estWindSen.innerHTML = `${windKWSen.toFixed(2)} <small>kW</small>`;
    if (estTotalSen) {
      estTotalSen.innerHTML = `${totalKWSen.toFixed(2)} <small>kW</small>`;
      estTotalSen.style.color = totalKWSen < 2.0 ? '#f72585' : '#06d6a0';
    }
  }

  // 4. Update UI Otomatis (Hanya Animasi Matahari)
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
  }

  // 5. Setup MQTT HiveMQ
  const brokerUrl = "broker.hivemq.com";
  const brokerPort = 8000;
  const clientId = "dashboard-client-" + Math.random().toString(16).substr(2, 8);
  const mainTopic = "cuaca/adi/all"; // Topik gabungan baru
  let mqttClient;

  try {
    mqttClient = new Paho.MQTT.Client(brokerUrl, brokerPort, clientId);
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;
    
    mqttClient.connect({
      onSuccess: onConnect,
      useSSL: false
    });
  } catch (e) { console.error("MQTT Error:", e); }

  function onConnect() {
    console.log("Terhubung ke MQTT Broker!");
    // Hanya subscribe ke satu topik utama
    mqttClient.subscribe(mainTopic);
  }

  function onConnectionLost(res) {
    if (res.errorCode !== 0) {
      console.log("MQTT Terputus. Reconnecting...");
      setTimeout(() => { mqttClient.connect({ onSuccess: onConnect, useSSL: false }); }, 5000);
    }
  }

  // 6. Tangkap Data MQTT & Update Kartu Utama dan Kecil
  function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    const smallStyle = 'style="font-weight: 400; color: var(--text-secondary); font-size: 10px; letter-spacing: 0;"';
    const circleLen = 106.81; // Panjang keliling mini dial

    if (topic === mainTopic) {
      // Pecah kalimat gabungan CSV menjadi array
      const dataArray = payload.split(',');
      
      // Pastikan data yang dikirim lengkap (7 variabel)
      if (dataArray.length >= 7) {
        // Konversi ke angka secara berurutan: Suhu(0), Kelembapan(1), Tekanan(2), Hujan(3), Angin(4), Arah(5), Radiasi(6)
        const valTemp = parseFloat(dataArray[0]);
        const valHum  = parseFloat(dataArray[1]);
        const valPres = parseFloat(dataArray[2]);
        const valRain = parseFloat(dataArray[3]);
        const valWind = parseFloat(dataArray[4]);
        const valDir  = parseFloat(dataArray[5]);
        const valRad  = parseFloat(dataArray[6]);

        // [1] Update Suhu
        if (!isNaN(valTemp)) {
          window.globalSensorData.temp = valTemp;
          const card = document.getElementById('val-temp-card');
          const dial = document.getElementById('dial-temp');
          if (card) card.innerHTML = `${valTemp.toFixed(1)} <small ${smallStyle}>°C</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valTemp / 50) * circleLen;
        }
        
        // [2] Update Kelembapan
        if (!isNaN(valHum)) {
          window.globalSensorData.hum = valHum;
          const card = document.getElementById('val-hum-card');
          const dial = document.getElementById('dial-hum');
          if (card) card.innerHTML = `${Math.round(valHum)} <small ${smallStyle}>%</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valHum / 100) * circleLen;
        }

        // [3] Update Tekanan
        if (!isNaN(valPres)) {
          window.globalSensorData.pres = valPres;
          const card = document.getElementById('val-pres-card');
          const dial = document.getElementById('dial-pres');
          if (card) card.innerHTML = `${valPres.toFixed(1)} <small ${smallStyle}>kPa</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - ((valPres-90) / 20) * circleLen;
        }

        // [4] Update Curah Hujan
        if (!isNaN(valRain)) {
          window.globalSensorData.rain = valRain;
          const card = document.getElementById('val-rain-card');
          const dial = document.getElementById('dial-rain');
          if (card) card.innerHTML = `${valRain.toFixed(1)} <small ${smallStyle}>mm</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valRain / 50) * circleLen;
        }

        // [5] Update Kecepatan Angin
        if (!isNaN(valWind)) {
          window.globalSensorData.wind = valWind;
          const card = document.getElementById('val-wind-card');
          const dial = document.getElementById('dial-wind');
          if (card) card.innerHTML = `${valWind.toFixed(1)} <small ${smallStyle}>m/s</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valWind / 30) * circleLen;
        }

        // [6] Update Arah Angin
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

        // [7] Update Radiasi Matahari
        if (!isNaN(valRad)) {
          window.globalSensorData.rad = valRad;
          const card = document.getElementById('val-rad-card');
          const dial = document.getElementById('dial-rad');
          if (card) card.innerHTML = `${valRad.toFixed(1)} <small ${smallStyle}>W/m²</small>`;
          if (dial) dial.style.strokeDashoffset = circleLen - (valRad / 1200) * circleLen;
        }

        // Sinkronisasi otomatis ke Master Dial dan Deviasi
        if (window.currentSelectedSensor) { window.selectSensor(window.currentSelectedSensor); }
        calculateDelta();
      } else {
        console.warn("Format data gabungan tidak lengkap:", payload);
      }
    }
  }

  updateData();
  setInterval(updateData, 60000); 

  // 7. Data Lokasi & Satelit
  function updateWeatherUI() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = document.getElementById('w-day-name');
    const dateFull = document.getElementById('w-date-full');
    if (dayName) dayName.innerText = days[now.getDay()];
    if (dateFull) dateFull.innerText = `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;

    const locName = document.getElementById('loc-name');
    if (locName) {
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          let lat = -7.7, lon = 110.6;
          if (data.city && data.country_name) {
            locName.innerText = `${data.city}, ${data.country_name}`;
            lat = data.latitude; lon = data.longitude;
          } else { locName.innerText = "Yogyakarta, Indonesia"; }
          fetchSatelliteData(lat, lon);
        })
        .catch(() => {
          locName.innerText = "Yogyakarta, Indonesia";
          fetchSatelliteData(-7.7, 110.6);
        });
    }
  }

  function fetchSatelliteData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,shortwave_radiation,precipitation`;
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

          if (satTemp) satTemp.innerHTML = `${d.temperature_2m}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">°C</small>`;
          if (satHum) satHum.innerHTML = `${d.relative_humidity_2m}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">%</small>`;
          if (satWindSpeed) satWindSpeed.innerHTML = `${d.wind_speed_10m}<small style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left:2px;">km/h</small>`;
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

          calculateDelta();
          if (!window.currentSelectedSensor) { window.selectSensor('temp'); } 
          else { window.selectSensor(window.currentSelectedSensor); }
        }
      })
      .catch(err => console.error(err));
  }

  updateWeatherUI();

  // 8. Logika Master Dial (Visual Tengah)
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
      dialH2.innerHTML = `${data.temp.toFixed(1)}<span>°C</span>`; dialP.innerText = 'Suhu Udara';
      dialSvg.style.stroke = '#f72585';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-thermometer"></i>'; masterIcon.style.color = '#f72585'; }
      dialSvg.style.strokeDashoffset = 440 - (data.temp / 50) * 440;
      updateScale('0', '12.5', '25', '37.5', '0', '50');
      let status = 'NORMAL'; if (data.temp > 35) status = 'PANAS'; if (data.temp < 20) status = 'DINGIN';
      updateBadge(status, '#f72585', 'rgba(247,37,133,0.15)');
    } else if (type === 'hum') {
      dialH2.innerHTML = `${Math.round(data.hum)}<span>%</span>`; dialP.innerText = 'Kelembapan';
      dialSvg.style.stroke = '#7209b7';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-drop"></i>'; masterIcon.style.color = '#7209b7'; }
      dialSvg.style.strokeDashoffset = 440 - (data.hum / 100) * 440;
      updateScale('0', '25', '50', '75', '0', '100');
      let status = 'NORMAL'; if (data.hum > 80) status = 'LEMBAP'; if (data.hum < 40) status = 'KERING';
      updateBadge(status, '#7209b7', 'rgba(114,9,183,0.15)');
    } else if (type === 'pres') {
      dialH2.innerHTML = `${data.pres.toFixed(1)}<span>kPa</span>`; dialP.innerText = 'Tekanan Udara';
      dialSvg.style.stroke = '#a7c957';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-arrows-in"></i>'; masterIcon.style.color = '#a7c957'; }
      dialSvg.style.strokeDashoffset = 440 - ((data.pres - 90) / 20) * 440;
      updateScale('90', '95', '100', '105', '90', '110');
      let status = 'NORMAL'; if (data.pres > 102) status = 'TINGGI'; if (data.pres < 100) status = 'RENDAH';
      updateBadge(status, '#a7c957', 'rgba(167,201,87,0.15)');
    } else if (type === 'rad') {
      dialH2.innerHTML = `${data.rad.toFixed(1)}<span>W/m²</span>`; dialP.innerText = 'Radiasi Matahari';
      dialSvg.style.stroke = '#ffb703';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-sun"></i>'; masterIcon.style.color = '#ffb703'; }
      dialSvg.style.strokeDashoffset = 440 - (data.rad / 1200) * 440;
      updateScale('0', '300', '600', '900', '0', '1200');
      let status = 'NORMAL'; if (data.rad > 800) status = 'TINGGI'; if (data.rad < 300) status = 'RENDAH';
      updateBadge(status, '#ffb703', 'rgba(255,183,3,0.15)');
    } else if (type === 'wind') {
      dialH2.innerHTML = `${data.wind.toFixed(1)}<span>m/s</span>`; dialP.innerText = 'Kecepatan Angin';
      dialSvg.style.stroke = '#06d6a0';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-wind"></i>'; masterIcon.style.color = '#06d6a0'; }
      dialSvg.style.strokeDashoffset = 440 - (data.wind / 30) * 440;
      updateScale('0', '7.5', '15', '22.5', '0', '30');
      let status = 'NORMAL'; if (data.wind > 10) status = 'KENCANG';
      updateBadge(status, '#06d6a0', 'rgba(6,214,160,0.15)');
    } else if (type === 'winddir') {
      dialH2.innerHTML = `${data.windDirDeg.toFixed(0)}<span>°</span>`; dialP.innerText = data.windDirText;
      dialSvg.style.stroke = '#4cc9f0';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-navigation-arrow"></i>'; masterIcon.style.color = '#4cc9f0'; }
      dialSvg.style.strokeDashoffset = 440 - (data.windDirDeg / 360) * 440;
      updateScale('U', 'T', 'S', 'B', '0°', '360°');
      updateBadge(data.windDirText, '#4cc9f0', 'rgba(76,201,240,0.15)');
    } else if (type === 'rain') {
      dialH2.innerHTML = `${(data.rain || 0).toFixed(1)}<span>mm</span>`; dialP.innerText = 'Curah Hujan';
      dialSvg.style.stroke = '#4cc9f0';
      if (masterIcon) { masterIcon.innerHTML = '<i class="ph-fill ph-cloud-rain"></i>'; masterIcon.style.color = '#4cc9f0'; }
      dialSvg.style.strokeDashoffset = 440 - ((data.rain || 0) / 50) * 440;
      updateScale('0', '12.5', '25', '37.5', '0', '50');
      let status = 'KERING'; if ((data.rain || 0) > 10) status = 'HUJAN';
      updateBadge(status, '#4cc9f0', 'rgba(76,201,240,0.15)');
    }
  };

  // 9. Chart Area Statis
  const ctx = document.getElementById('radiationChart');
  if (ctx) {
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(255, 77, 77, 0.5)'); 
    gradient.addColorStop(1, 'rgba(255, 77, 77, 0.05)');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        datasets: [{
          label: 'Radiasi (W/m²)', data: [250, 480, 850, 720, 390, 150, 0],
          borderColor: '#ff4d4d', backgroundColor: gradient, borderWidth: 2,
          pointBackgroundColor: '#fff', pointBorderColor: '#ff4d4d', pointBorderWidth: 2, pointRadius: 3, fill: true, tension: 0.4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b8b9b', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b8b9b', font: { size: 10 } }, beginAtZero: true }
        }
      }
    });
  }

  // 10. Background Cuaca Hujan Animasi
  const weatherCanvas = document.getElementById('weatherCanvas');
  if (weatherCanvas) {
    const wCtx = weatherCanvas.getContext('2d');
    weatherCanvas.width = window.innerWidth; weatherCanvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < 100; i++) {
      particles.push({ x: Math.random() * weatherCanvas.width, y: Math.random() * weatherCanvas.height, l: Math.random() * 20 + 10, s: Math.random() * 5 + 5 });
    }
    function drawWeather() {
      wCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
      wCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; wCtx.lineWidth = 1; wCtx.lineCap = 'round';
      particles.forEach(p => {
        wCtx.beginPath(); wCtx.moveTo(p.x, p.y); wCtx.lineTo(p.x + p.l * 0.1, p.y + p.l); wCtx.stroke();
        p.y += p.s; p.x += p.s * 0.1;
        if (p.y > weatherCanvas.height) { p.y = -20; p.x = Math.random() * weatherCanvas.width; }
      });
      requestAnimationFrame(drawWeather);
    }
    drawWeather();
    window.addEventListener('resize', () => { weatherCanvas.width = window.innerWidth; weatherCanvas.height = window.innerHeight; });
  }
});