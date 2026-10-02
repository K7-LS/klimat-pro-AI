# Восстановление КЛИМАТ-ПРО — 02.10.2026, DANIILPC

## Результат

Сайт: https://83-217-214-234.sslip.io. MCP: https://83-217-214-234.sslip.io/mcp.
Прежний VPS удалён владельцем; старый IP193.124.130.236 больше не использовать.
Создан VDSina №3261797, «КЛИМАТ-ПРО»: Москва, Ubuntu26.04, стандартный
1core/1GB/10GB/1TB за **5 ₽/день**. При оформлении опция платного автоматического
backup была отключена основным исполнителем; новое расписание/копия не создавались.
автозапуск/автопродление включены. Подтверждённый текущий баланс928 ₽.
Тариф подтверждён выбранным тарифом в панели VDSina; скриншот сохранён локально:
`C:/Users/Даниил ПК/.codex/visualizations/2026/10/02/klimat-recovery/vdsina-tariff.png`.
На вкладке резервных копий показана активная **прежняя** копия №3245492,
`v3245250.hosted-by-vdsina.ru — week (10 Gb)`, дата18.09.26 01:15:07.
Показанная цена копии4 ₽/день/10GB — отдельная от нового тарифа5 ₽/день.
Кнопка «Создать расписание» доступна; новое расписание не оформлялось.
Независимый reviewer подтвердил старую копию, но не наблюдал создание нового
сервера/checkbox; утверждение об отказе от новых автобэкапов — receipt исполнителя,
не самостоятельное подтверждение reviewer. Копия оставлена без изменений.
Локальный скриншот:
`C:/Users/Даниил ПК/.codex/visualizations/2026/10/02/klimat-recovery/vdsina-backups.png`.

## Изменения и сохранность

- Новый VPS остаётся внешним шлюзом; Supabase, nginx, MCP, Nextcloud и данные —
  в прежней WSL на ПК. Схема БД не изменялась. Пароли существующих пользователей не менялись.
- Caddy2.11.6 установлен из официального подписанного apt-репозитория по
  [инструкции Caddy](https://caddyserver.com/docs/install).
- FRP0.69.0 соответствует прежнему клиенту; архив
  [официального релиза](https://github.com/fatedier/frp/releases/tag/v0.69.0)
  проверен SHA256 по digest GitHub API до распаковки.
- Прежний SSH-ключ WSL использован без замены. SSH password/Kbd authentication
  отключены; второй key-only вход прошёл. Firewall только22/80/443/7000,
  proxy8000/8080 только loopback. frps работает от отдельного системного пользователя,
  требует TLS/token, разрешает только два proxy-порта.
- Новый случайный FRP token хранится только в закрытой live-конфигурации;
  секреты не записаны в Git. Auth SITE_URL/API_EXTERNAL_URL, MCP origin/issuer,
  `.env.production`, справка и README переключены на новый origin.
- Windows `/32` маршрут через Ethernet192.168.1.1 подтверждён в ActiveStore и
  PersistentStore. Настройки Happ и остальные сетевые маршруты не менялись.
- Backup перед изменением: `/srv/daniil-deploy/backups/vps-recovery-20261002T115406Z`:
  frpc, Supabase.env, web-compose, frontend.env.production, предыдущий web.
  Это backup конфигурации/frontend, не полный backup пользовательской БД/файлов.
- Legacy MCP rollback блокирует backups другого origin или отсутствующую
  копию Caddy до любых мутаций. Исторический backup удалённого VPS нельзя
  механически применить к новому серверу.

## Приёмка

| Проверка | Результат |
|---|---|
| Frontend `npm test` | 165/165 PASS |
| MCP Vitest | 59/59 PASS |
| `npm run build` | exit0; существующее предупреждение о размере чанка |
| `deploy/nextcloud/deploy-web.sh` | exit0, свежий dist развёрнут |
| dist/local nginx/public HTTPS | index-BJJ_MVWa.js + index-DegNOVBM.css совпадают |
| HTTPS /, JS, CSS, sw.js | HTTP200 с обычной проверкой TLS |
| `deploy/mcp/verify-remote-mcp-http.sh` | REMOTE_MCP_HTTP_OK |
| Public OAuth E2E | DCR/PKCE/consent/refresh/5tools/read-deny/write/revoke PASS |
| Cleanup OAuth E2E | аккаунт/запись удалены, активных test OAuth clients0; 1 soft-deleted tombstone GoTrue |
| Контроль данных после E2E | 6 аккаунтов / 22 проекта, как до проверки |
| Docker | Auth v2.195.0, MCP, DB healthy; nginx работает |
| Браузер | новый экран входа отображается, console errors отсутствуют |

Байты public JS/CSS дополнительно сравнены с `dist` по SHA256:
`index-BJJ_MVWa.js` = `3DF24D1D3017A1F126A96B0DCBCA46FC05D963BBE485521A4FCE2CF01D2922CE`,
`index-DegNOVBM.css` = `A084894787C86C752F97576E1D06B3580CA2739F1221BF2345166AD4E1841C0F`.

OAuth-тест запускался `KP_E2E_BASE_URL=https://83-217-214-234.sslip.io node mcp/scripts/recovery-live-e2e.mjs`.
Helper использует локальный service key только для временного тестового пользователя/cleanup;
сами OAuth/MCP запросы проходят по публичному HTTPS с пользовательским токеном и RLS.
Никакие существующие аккаунты не использовались для тестовой записи.

## Ограничения и дальнейшее использование

Нужно открыть новый адрес и войти обычным логином/паролем; старые browser sessions
не переносятся между origins. LLM переподключить по новому MCP URL; Admin-гранты
сохранены в прежней БД. Публичный consent/backend проверены протокольным E2E,
полная visual QA под реальным аккаунтом владельца не выполнялась.
Для работы сайта ПК/WSL должны быть включены. VPS за5 ₽/день не заменяет этот ПК.
Новый собственный домен/перенос БД на VPS не входили в поручение.

Консольный receipt OAuth: `oauth-e2e-receipt.json`. Результат выполнения подтверждён
основным исполнителем; reviewer независимо сверяет исходный тест и live cleanup,
не повторяя запись в production.

Независимый read-only reviewer: **PASSED** после исправления ошибочной подписи
о пустых backups. Самостоятельно подтверждены выбранный тариф, HTTPS/MCP smoke,
live security/маршрут, frontend165/MCP59 tests и live counts/cleanup.
OAuth выполнение принято по receipt и исходнику, без повторной production-записи.
Checkbox при покупке reviewer не наблюдал; предел раскрыт выше и не отмечен PASS.
