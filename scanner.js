/* ============================================================
   СТРОЙРАДАР (StroyRadar) — логика free-сканера
   ------------------------------------------------------------
   - Читает UTM-параметры из URL, сохраняет в localStorage.
   - Отправляет форму сканера: ниша + регион + UTM (+ заготовка
     fetch к /api/scan — позже подключится к пайплайну).
   - Результат — ДЕТЕРМИНИРОВАННАЯ заглушка: фиксированные
     правдоподобные значения по каждой нише (БЕЗ Math.random,
     чтобы цифры были честными при проверке и демо).
   ============================================================ */

(function () {
  'use strict';

  // ---------- 1. UTM attribution ----------
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function captureUtm() {
    var stored = {};
    try {
      var params = new URLSearchParams(window.location.search);
      UTM_KEYS.forEach(function (key) {
        var value = params.get(key);
        if (value) {
          stored[key] = value;
          try { localStorage.setItem(key, value); } catch (e) { /* приватный режим — молча */ }
        } else {
          // если в URL нет, пробуем достать сохранённое
          try {
            var prev = localStorage.getItem(key);
            if (prev) stored[key] = prev;
          } catch (e) { /* ignore */ }
        }
      });
    } catch (e) { /* ignore */ }
    return stored;
  }

  function getUtm() {
    var result = {};
    UTM_KEYS.forEach(function (key) {
      try {
        var value = localStorage.getItem(key);
        if (value) result[key] = value;
      } catch (e) { /* ignore */ }
    });
    return result;
  }

  // ---------- 2. Детерминированные заглушки по нишам ----------
  // Формат: { total, hot (скоринг>=75), mid (50-74), low (<50), avgBudget }
  // Цифры правдоподобные для МСК-базы; регионы — множители ниже.
  var NICHE_DATA = {
    repair_flat: {
      label: 'Ремонт квартир под ключ',
      total: 47, hot: 9, mid: 17, low: 21, avgBudget: 1650000,
      examples: [
        'Ремонт 3-комн. 82 м² под ключ, ЖК «Некрасовка» — бюджет ~1,8 млн, сроки 3 мес',
        'Косметика + замена электрики, 54 м², Химки — бюджет ~650 тыс',
        'Ремонт новостройки 68 м², Бутово — нужен сметчик, бюджет обсуждается от 1,2 млн'
      ]
    },
    build_house: {
      label: 'Строительство домов',
      total: 28, hot: 5, mid: 11, low: 12, avgBudget: 4200000,
      examples: [
        'Дом 140 м² из газобетона под ключ, Истра — коробка + кровля, ~4,5 млн',
        'Каркасный дом 96 м², Всеволожск — фундамент готов, ~2,8 млн',
        'Пристройка 40 м² к дому, Одинцово — ~900 тыс'
      ]
    },
    roof: {
      label: 'Кровля',
      total: 34, hot: 7, mid: 13, low: 14, avgBudget: 780000,
      examples: [
        'Металлочерепица 210 м², Котельники — замена старой, ~750 тыс',
        'Плоская кровля гаражного комплекса 480 м², СПб — от 1,2 млн',
        'Ремонт конька и замена 40 м² покрытия, Гатчина — ~180 тыс'
      ]
    },
    foundation: {
      label: 'Фундамент',
      total: 19, hot: 3, mid: 8, low: 8, avgBudget: 950000,
      examples: [
        'Ленточный фундамент 10×12 м, Дмитров — ~1,1 млн',
        'Свайно-ростверковый, Ломоносовский р-н — ~850 тыс',
        'Усиление фундамента старого дома, Пушкин — оценка ~600 тыс'
      ]
    },
    electric: {
      label: 'Электрика',
      total: 52, hot: 11, mid: 19, low: 22, avgBudget: 320000,
      examples: [
        'Электрика под ключ в квартире 74 м², Кузьминки — ~340 тыс',
        'Замена щитовой + разводка в частном доме 160 м², Раменское — ~520 тыс',
        'Аварийная замена проводки в офисе 120 м², СПб Центр — ~180 тыс'
      ]
    },
    ventilation: {
      label: 'Вентиляция / ОВиК',
      total: 31, hot: 6, mid: 12, low: 13, avgBudget: 1450000,
      examples: [
        'Монтаж вентиляции торгового помещения 350 м², ТЦ «Афимолл»-район — ~2,1 млн',
        'Обслуживание ОВиК складского комплекса, Домодедово — договорная от 800 тыс/год',
        'Приточно-вытяжная система в офис 220 м², СПб Петроградка — ~1,3 млн'
      ]
    },
    commercial: {
      label: 'Коммерческий ремонт',
      total: 24, hot: 4, mid: 10, low: 10, avgBudget: 2800000,
      examples: [
        'Отделка офиса 380 м², Москва-Сити район — под ключ, ~3,5 млн',
        'Ремонт кофейни 64 м², Невский — срок 45 дней, ~900 тыс',
        'Косметика склада 1200 м² + офисная часть, Подольск — ~1,8 млн'
      ]
    }
  };

  // множители по регионам (МСК — база)
  var REGION_MULT = {
    msk: 1.00,
    mo: 0.62,
    spb: 0.71,
    lo: 0.44
  };

  var REGION_LABEL = {
    msk: 'Москва',
    mo: 'Московская область',
    spb: 'Санкт-Петербург',
    lo: 'Ленинградская область'
  };

  function fmtMoney(n) {
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  // детерминированное масштабирование: база ниши × множитель региона
  function getResult(nicheKey, regionKey) {
    var base = NICHE_DATA[nicheKey];
    if (!base) return null;
    var mult = REGION_MULT[regionKey] || 1;

    var total = Math.round(base.total * mult);
    var hot = Math.round(base.hot * mult);
    var mid = Math.round(base.mid * mult);
    var low = Math.max(0, total - hot - mid);
    // средний бюджет чуть выше в МСК, ниже в областях — тоже детерминированно
    var avgBudget = Math.round((base.avgBudget * (0.72 + 0.28 * mult)) / 1000) * 1000;

    return {
      nicheLabel: base.label,
      regionLabel: REGION_LABEL[regionKey] || regionKey,
      total: total,
      hot: hot,
      mid: mid,
      low: low,
      avgBudget: avgBudget,
      examples: base.examples
    };
  }

  // ---------- 3. Заготовка отправки на API пайплайна ----------
  // Когда подключим пайплайн: эндпоинт вернёт живые цифры вместо заглушки.
  var API_URL = '/api/scan';

  function submitScan(payload) {
    // Пытаемся отправить на будущий бэкенд. Если его нет (статика на GitHub Pages) —
    // просто тихо падаем и показываем локальную заглушку. Таймаут 4 сек.
    try {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 4000);
      return fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
        .then(function (res) {
          clearTimeout(timer);
          if (!res.ok) throw new Error('api ' + res.status);
          return res.json();
        })
        .catch(function () {
          clearTimeout(timer);
          return null; // API пока нет — используем локальную заглушку
        });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // ---------- 4. Отрисовка результата ----------
  function renderResult(r) {
    document.getElementById('rTotal').textContent = r.total;
    document.getElementById('rHot').textContent = r.hot;
    document.getElementById('rBudget').textContent = fmtMoney(r.avgBudget);

    document.getElementById('rBreakdown').innerHTML =
      '<span>Высокая релевантность (≥75): <b>' + r.hot + '</b></span>' +
      '<span>Средняя (50–74): <b>' + r.mid + '</b></span>' +
      '<span>Низкая (&lt;50): <b>' + r.low + '</b></span>' +
      '<span>Регион: <b>' + r.regionLabel + '</b></span>';

    var list = document.getElementById('rExamples');
    list.innerHTML = '';
    r.examples.forEach(function (ex) {
      var li = document.createElement('li');
      li.textContent = ex;
      list.appendChild(li);
    });

    document.getElementById('scanResult').classList.add('on');
    document.getElementById('scanResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- 5. Инициализация и обработчик формы ----------
  document.addEventListener('DOMContentLoaded', function () {
    captureUtm(); // сохраняем UTM сразу при заходе

    var form = document.getElementById('scanForm');
    var progress = document.getElementById('scanProgress');
    var btn = document.getElementById('scanBtn');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();

      var niche = document.getElementById('niche').value;
      var region = document.getElementById('region').value;
      var contact = document.getElementById('contact').value.trim();

      if (!niche || !region) {
        btn.textContent = 'Выберите нишу и регион';
        setTimeout(function () { btn.textContent = 'Показать заказы за 7 дней'; }, 1600);
        return;
      }

      var utm = getUtm();
      var payload = {
        product: 'construction-hunter',
        niche: niche,
        region: region,
        contact: contact || null,
        utm: utm,
        ts: new Date().toISOString()
      };

      btn.disabled = true;
      btn.textContent = 'Сканируем…';
      progress.classList.add('on');

      submitScan(payload).then(function (apiData) {
        // если бэкенд жив и вернул данные — используем их, иначе заглушка
        var r = (apiData && apiData.total != null)
          ? apiData
          : getResult(niche, region);

        progress.classList.remove('on');
        btn.disabled = false;
        btn.textContent = 'Показать заказы за 7 дней';

        renderResult(r);

        document.getElementById('rParams').textContent =
          'Запрос: ' + r.nicheLabel + ' · ' + r.regionLabel +
          (utm.utm_source ? ' · Источник: ' + utm.utm_source : '') +
          (utm.utm_campaign ? ' · Кампания: ' + utm.utm_campaign : '');
      });
    });
  });
})();
