# СтройРадар — DATA SEO: 5 страниц + sitemap

Дата: 21.08.2026. Источник — шаблон `data-seo-template.html`, цифры — детерминированная заглушка как в `scanner.js` (без рандома), потом заменятся живыми агрегатами пайплайна.

## Что сгенерировано

- `data/moskva-remont-kvartir/index.html` — Ремонт квартир · Москва — 47/9 · 1,65 млн
- `data/moskva-elektrika/index.html` — Электрика · Москва — 52/11 · 320 тыс
- `data/moskva-ventilyatsiya/index.html` — Вентиляция · Москва — 31/6 · 1,45 млн
- `data/spb-remont-kvartir/index.html` — Ремонт квартир · СПб — 33/6 · ~1,2 млн (×0.71)
- `data/spb-krovlya/index.html` — Кровля · СПб — 24/5 · ~600 тыс (×0.71)
- `sitemap.xml` в корне `construction-hunter/` и `data/sitemap.xml`

Каждая страница — копия `data-seo-template.html` с подставленными {{NICHE}}, {{CITY}}, {{COUNT_7D}}, {{HOT_COUNT}}, {{AVG_BUDGET}}, {{EXAMPLES}}, {{CANONICAL}}, {{UPDATED_AT}}. Canonical на `https://stroy-radar.ru/<city>/<niche>/`.

## Как деплоить

Статика — на тот же `stroy-radar-site` репо. Структура папок `/moskva/remont-kvartir/index.html` уже готова для Pages (legacy build). После подключения пайплайна — генерить скриптом `tools/generate_data_pages.py` из `factory.db`.

## Правило (раздел 23)

Страница создаётся только если COUNT_7D ≥10. Сейчас все 5 проходят. До 600 потенциальных ниша×город — но генерим только где есть данные.
