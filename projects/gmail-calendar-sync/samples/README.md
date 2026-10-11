# samples/ — サンプルメール (架空のデータ)

ここにある `.eml` はすべて **動作確認用に作った架空のメール** です。実在の予約・人物・番号とは関係ありません。

- `MOCK_GOOGLE=true` で実行すると Gmail の代わりにこのディレクトリのメールを読み、メモリ上の偽カレンダーに登録します。
- `tests/` のユニットテストでも一部を使用しています。

| ファイル | 内容 |
|---|---|
| 01-jetstar-itinerary.eml | ジェットスター風 旅程表 (GK11 2026/11/02 成田→札幌) |
| 02-tripcom-hotel.eml | Trip.com 風 ホテル予約確認 (ウィーン、HTML のみ、現地時間) |
| 03-airbnb-request.eml | Airbnb 風 予約リクエスト (承認待ち → 要確認) |
| 04-getyourguide-ticket.eml | GetYourGuide 風 チケット (英語、ウィーン現地時間) |
| 05-sake-forwarded.eml | yahoo.co.jp から転送された 日本酒会の案内 (18:00-21:00) |
| 06-clinic.eml | クリニックの予約 (令和表記・午前) |
| 07-newsletter.eml | メルマガ (予定ではない) |
| 08-tripcom-hotel-change.eml | 02 のホテル予約の日程変更 (同じ予約番号 → 更新) |
