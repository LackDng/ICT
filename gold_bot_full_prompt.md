# GOLD SIGNAL BOT — FULL PROMPT
> Python + MetaTrader 5 + Telegram
> XAU/USD Intraday | Price Action + SMC + Fibonacci
> Tài liệu này được tạo dựa trên thiết kế chi tiết đã thảo luận

---

# HƯỚNG DẪN SỬ DỤNG

## Thứ tự code
```
1. config.py
2. data_feed.py
3. market_structure.py
4. smc_analyzer.py
5. entry_trigger.py
6. risk_manager.py
7. telegram_notifier.py
8. news_filter.py
9. signal_manager.py
10. main.py
```

## Cách dùng prompt hiệu quả
```
Bước 1: Paste prompt từng module vào Claude/ChatGPT
Bước 2: Yêu cầu AI giải thích logic trước khi code
Bước 3: AI code từng hàm một
Bước 4: Test từng hàm nhỏ
Bước 5: Ghép lại test toàn module
Bước 6: Qua module tiếp theo
```

## Prompt mẫu khi bắt đầu mỗi module
```
Tôi đang xây dựng Gold Signal Bot Python+MT5.
Đây là thiết kế [tên module]: [paste nội dung module]
Đây là các file đã có: [đính kèm file]
Hãy:
1. Giải thích logic chính của module này
2. Viết code hoàn chỉnh với type hints và docstring
3. Giải thích phần phức tạp nhất
4. Viết test case đơn giản để kiểm tra
```

---

# MODULE 1 — config.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module đầu tiên: config.py

NHIỆM VỤ:
Viết file config.py tập trung toàn bộ tham số cấu hình.
Không hardcode bất kỳ giá trị nào trong các module khác.

YÊU CẦU KỸ THUẬT:
- Python 3.10+
- Type hints đầy đủ
- Docstring ngắn gọn
- Dùng python-dotenv để load các thông tin nhạy cảm
  (token, password) từ file .env
- Các tham số phân tích thì để trực tiếp trong file

CẤU TRÚC CẦN CÓ:

1. MT5 Connection
MT5_LOGIN    : int   (load từ .env)
MT5_PASSWORD : str   (load từ .env)
MT5_SERVER   : str   (load từ .env)
SYMBOL       : str   = "XAUUSD"

2. Telegram
TELEGRAM_TOKEN   : str (load từ .env)
TELEGRAM_CHAT_ID : str (load từ .env)

3. Timeframes
TF_D1      : mt5.TIMEFRAME_D1
TF_H4      : mt5.TIMEFRAME_H4
TF_H1      : mt5.TIMEFRAME_H1
TF_M15     : mt5.TIMEFRAME_M15
TF_M5      : mt5.TIMEFRAME_M5

4. Số nến lấy
CANDLES_D1  : int = 100
CANDLES_H4  : int = 200
CANDLES_H1  : int = 300
CANDLES_M15 : int = 500
CANDLES_M5  : int = 100

5. Swing Point
SWING_PIVOT_D1 : int = 5  (số nến mỗi bên để xác định swing D1)
SWING_PIVOT_H4 : int = 3  (số nến mỗi bên để xác định swing H4)
SWING_COUNT    : int = 3  (số swing tối thiểu để xác nhận trend)

6. Ranging Detection
RANGING_ATR_PERIOD   : int   = 14
RANGING_ATR_MULT     : float = 0.8
RANGING_ATR_MA       : int   = 20
RANGING_BOS_LOOKBACK : int   = 15

7. Fibonacci
FIB_LEVELS           : list  = [0.236, 0.382, 0.5, 0.618, 0.786, 0.886]
FIB_EXTENSIONS       : list  = [1.272, 1.618]
FIB_CONFLUENCE_PIPS  : float = 15.0
FIB_MAX_SETS_H4      : int   = 3

8. Order Block
OB_MIN_BODY_RATIO    : float = 0.6
OB_MAX_AGE_CANDLES   : int   = 40
OB_FVG_MAX_GAP       : float = 10.0

9. Fair Value Gap
FVG_MIN_PIPS         : float = 15.0
FVG_MAX_AGE_CANDLES  : int   = 40
FVG_FILL_PARTIAL     : float = 0.5
FVG_FILL_WEAK        : float = 0.8

10. Liquidity Sweep
SWEEP_MIN_PIPS       : float = 10.0
SWEEP_BODY_MIN       : float = 0.6
SWEEP_VOLUME_MULT    : float = 1.5
SWEEP_VALID_CANDLES  : int   = 5

11. Nến xác nhận M15
CONFIRM_BODY_MIN      : float = 0.6
CONFIRM_STRONG_CLOSE  : float = 0.8
CONFIRM_PINBAR_SHADOW : float = 2.0

12. Confluence Score
SCORE_BIAS        : int = 3
SCORE_OB_FVG      : int = 3
SCORE_CANDLE      : int = 2
SCORE_SWEEP       : int = 2
SCORE_FIB         : int = 2
SCORE_CHOCH       : int = 1
SCORE_VOLUME      : int = 1
SCORE_MIN_GROUP_A : int = 7
SCORE_MIN_GROUP_B : int = 3
SCORE_MIN_TOTAL   : int = 10

13. TP/SL
SL_MIN_PRICE  : float = 10.0
SL_MAX_PRICE  : float = 25.0
TP1_RR        : float = 1.8
TP2_RR        : float = 3.0
TP1_SL_TRAIL  : float = 0.8

14. Quản lý lệnh
MAX_ACTIVE_SIGNALS : int   = 3
MIN_ENTRY_DISTANCE : float = 15.0
SIGNAL_EXPIRE_HOURS: int   = 24

15. News Filter
NEWS_HIGH_BEFORE : int = 30
NEWS_HIGH_AFTER  : int = 30
NEWS_MED_BEFORE  : int = 15
NEWS_MED_AFTER   : int = 15
NEWS_API_KEY     : str (load từ .env)

16. Chu kỳ quét
SCAN_INTERVAL_SIGNAL : int = 900
SCAN_INTERVAL_TPSL   : int = 300

17. Thông báo định kỳ
DAILY_BRIEFING_HOUR : int = 7
DAILY_SUMMARY_HOUR  : int = 22
TIMEZONE            : str = "Asia/Ho_Chi_Minh"

18. Logging & State
LOG_FILE   : str = "logs/bot.log"
LOG_LEVEL  : str = "INFO"
STATE_FILE : str = "state/active_signals.json"

YÊU CẦU BỔ SUNG:
- Tạo file .env.example kèm theo
- Tạo hàm validate_config() kiểm tra giá trị bắt buộc
  khi bot khởi động, raise ValueError nếu thiếu
- Comment rõ đơn vị cho mỗi tham số
- Nhóm các tham số bằng comment section rõ ràng
```

---

# MODULE 2 — data_feed.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 2: data_feed.py

CONTEXT:
- Bot phân tích XAU/USD intraday
- Timeframe: D1, H4, H1, M15, M5
- Tất cả tham số import từ config.py
- Quote Gold: 3 chữ số thập phân (ví dụ: 4,531.012)

NHIỆM VỤ:
Viết module data_feed.py xử lý toàn bộ
kết nối MT5 và cung cấp dữ liệu nến.

YÊU CẦU KỸ THUẬT:
- Python 3.10+
- Type hints đầy đủ
- Docstring ngắn gọn
- Xử lý exception đầy đủ
- Log mọi sự kiện quan trọng
- Import tất cả tham số từ config.py

CÁC HÀM CẦN VIẾT:

1. connect_mt5() -> bool
- Dùng mt5.initialize()
- Login với MT5_LOGIN, MT5_PASSWORD, MT5_SERVER
- Retry tối đa 3 lần, mỗi lần chờ 5 giây
- Raise ConnectionError nếu thất bại sau 3 lần

2. disconnect_mt5() -> None
- Gọi mt5.shutdown()
- Log đã ngắt kết nối

3. get_candles(
     symbol: str,
     timeframe: int,
     count: int
   ) -> pd.DataFrame
- Dùng mt5.copy_rates_from_pos()
- Columns: time, open, high, low, close, tick_volume
- Convert time sang datetime UTC
- Loại bỏ nến cuối (chưa đóng)
- Sort tăng dần theo time
- Tính thêm: body, body_ratio, is_bullish
- Retry 3 lần nếu thất bại

4. get_current_price(symbol: str) -> float
- Dùng mt5.symbol_info_tick()
- Return (bid + ask) / 2

5. get_current_spread(symbol: str) -> float
- Dùng mt5.symbol_info()
- Tính spread pips cho Gold (1 pip = 0.010)

6. is_market_open() -> bool
- Forex mở: Thứ 2 00:00 – Thứ 6 23:59 UTC
- Đóng: Thứ 7 00:00 – Chủ nhật 22:00 UTC

7. check_connection() -> bool
- Dùng mt5.terminal_info()
- Nếu mất kết nối → tự động reconnect

8. get_all_timeframes(symbol: str) -> dict
- Gọi get_candles() cho D1, H4, H1, M15, M5
- Return dict:
  {
    "D1"           : pd.DataFrame,
    "H4"           : pd.DataFrame,
    "H1"           : pd.DataFrame,
    "M15"          : pd.DataFrame,
    "M5"           : pd.DataFrame,
    "current_price": float,
    "spread"       : float,
    "timestamp"    : datetime
  }

DATA STRUCTURE — get_candles output:
DataFrame columns:
- time        : datetime (UTC)
- open        : float
- high        : float
- low         : float
- close       : float
- tick_volume : int
- body        : float (close - open)
- body_ratio  : float (abs(body) / (high-low))
- is_bullish  : bool  (close > open)

LƯU Ý QUAN TRỌNG:
- Luôn kiểm tra mt5.last_error() sau mỗi lần gọi MT5
- Nến chưa đóng = nến cuối → luôn loại bỏ
- Nếu spread > MAX_SPREAD → log cảnh báo
- Tất cả thời gian xử lý theo UTC
```

---

# MODULE 3 — market_structure.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 3: market_structure.py

CONTEXT:
- Phân tích D1 và H4
- Xác định trend, swing points, Fibonacci
- Premium/Discount zone
- Tất cả tham số import từ config.py
- Input là DataFrame từ data_feed.get_candles()

NHIỆM VỤ:
Viết module market_structure.py phân tích
cấu trúc thị trường trên D1 và H4.

CÁC HÀM CẦN VIẾT:

1. find_swing_points(
     df: pd.DataFrame,
     pivot_bars: int
   ) -> dict
Tìm swing high và swing low.
- Swing High: high[i] cao hơn tất cả high
  trong pivot_bars nến trái và phải
- Swing Low: low[i] thấp hơn tất cả low
  trong pivot_bars nến trái và phải
- Chỉ lấy swing đã được xác nhận đủ nến
  (không lấy swing chưa đủ pivot_bars nến bên phải)
- Return:
  {
    "highs": [{"index": int, "price": float, "time": datetime}],
    "lows" : [{"index": int, "price": float, "time": datetime}]
  }

2. get_market_bias(
     df_d1: pd.DataFrame,
     df_h4: pd.DataFrame
   ) -> dict
Xác định xu hướng thị trường.

Logic:
- Tìm swing points trên D1 (pivot=SWING_PIVOT_D1=5)
- Tìm swing points trên H4 (pivot=SWING_PIVOT_H4=3)
- Cần ít nhất SWING_COUNT=3 swing để xác nhận

Uptrend D1/H4:
- 3 swing high liên tiếp: SH1 < SH2 < SH3 (HH)
- 3 swing low liên tiếp : SL1 < SL2 < SL3 (HL)

Downtrend D1/H4:
- 3 swing high liên tiếp: SH1 > SH2 > SH3 (LH)
- 3 swing low liên tiếp : SL1 > SL2 > SL3 (LL)

Ranging: không đủ swing hoặc không rõ xu hướng

Ranging detection (cả 2 điều kiện):
- ATR(14) H4 < 0.8 × ATR MA(20) H4
- Không có BOS trong 15 nến H4 gần nhất

Confidence:
- "high"  : D1 và H4 cùng hướng
- "medium": chỉ 1 timeframe rõ hướng
- "low"   : mâu thuẫn hoặc ranging

Return:
{
  "bias"            : "bullish"/"bearish"/"ranging",
  "d1_bias"         : "bullish"/"bearish"/"ranging",
  "h4_bias"         : "bullish"/"bearish"/"ranging",
  "confidence"      : "high"/"medium"/"low",
  "is_ranging"      : bool,
  "last_sh_d1"      : float,
  "last_sl_d1"      : float,
  "last_sh_h4"      : float,
  "last_sl_h4"      : float,
  "swing_highs_h4"  : list,
  "swing_lows_h4"   : list
}

3. calculate_fibonacci(
     swing_high: float,
     swing_low: float,
     direction: str
   ) -> dict
Tính các mức Fibonacci.
- Levels: 0.236, 0.382, 0.5, 0.618, 0.786, 0.886
- Extensions: 1.272, 1.618
- direction = "bullish": vẽ từ low lên high
- direction = "bearish": vẽ từ high xuống low

Return:
{
  "swing_high" : float,
  "swing_low"  : float,
  "direction"  : str,
  "levels": {
    "0.0"  : float,
    "0.236": float,
    "0.382": float,
    "0.5"  : float,
    "0.618": float,
    "0.786": float,
    "0.886": float,
    "1.0"  : float
  },
  "extensions": {
    "1.272": float,
    "1.618": float
  },
  "equilibrium": float  (mức 0.5)
}

4. get_fib_confluence_zones(
     fib_sets: list[dict],
     current_price: float,
     bias: str
   ) -> list[dict]
Tìm vùng confluence từ nhiều bộ Fibo.
- Tối đa FIB_MAX_SETS_H4=3 bộ Fibo H4
- Confluence: ≥ 2 mức từ các bộ khác nhau
  nằm trong FIB_CONFLUENCE_PIPS=15 pips
- Chỉ lấy zone phù hợp với bias:
  bullish → zone dưới current price (discount)
  bearish → zone trên current price (premium)

Return list:
[{
  "price_top"   : float,
  "price_bottom": float,
  "mid"         : float,
  "score"       : int,    (số mức confluence)
  "levels"      : list,   (các mức tạo nên zone)
  "bias"        : str
}]

5. get_price_zone(
     current_price: float,
     swing_high: float,
     swing_low: float
   ) -> dict
Xác định vùng Premium/Discount.
- Tính retracement = (swing_high - current_price)
                   / (swing_high - swing_low)
- Discount: retracement > 0.5 → BUY opportunities
- Premium : retracement < 0.5 → SELL opportunities
- Equilibrium: retracement = 0.5 ± 0.05

Return:
{
  "zone"       : "discount"/"premium"/"equilibrium",
  "retracement": float,
  "eq_level"   : float
}

6. get_h4_fib_sets(
     df_h4: pd.DataFrame,
     bias: str,
     swing_highs: list,
     swing_lows: list
   ) -> list[dict]
Tạo tối đa 3 bộ Fibo từ swing H4.
- Cặp 1: swing gần nhất (recent)
- Cặp 2: swing lớn nhất (major)
- Cặp 3: swing gần nhì (nếu có)
- Mỗi bộ gọi calculate_fibonacci()
- Return list tối đa 3 bộ Fibo

7. analyze_market_structure(
     df_d1: pd.DataFrame,
     df_h4: pd.DataFrame,
     current_price: float
   ) -> dict
Hàm tổng hợp — gọi tất cả hàm trên.
Return:
{
  "bias_data"    : dict,  (từ get_market_bias)
  "fib_d1"       : dict,  (Fibo D1)
  "fib_sets_h4"  : list,  (tối đa 3 bộ Fibo H4)
  "confluence_zones": list,
  "price_zone"   : dict,
  "can_trade"    : bool,  (False nếu ranging hoặc bias mâu thuẫn)
  "trade_direction": "buy"/"sell"/None
}

LƯU Ý QUAN TRỌNG:
- Ranging → can_trade = False → dừng phân tích
- D1 và H4 phải cùng hướng → mới trade
- Bullish bias + discount zone → trade_direction = "buy"
- Bearish bias + premium zone → trade_direction = "sell"
- Các trường hợp khác → can_trade = False
- Cập nhật Fibo khi có swing mới hoặc BOS
- "Swing mới" = swing point chưa từng dùng
  làm điểm vẽ Fibo VÀ đã đủ pivot_bars xác nhận
```

---

# MODULE 4 — smc_analyzer.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 4: smc_analyzer.py

CONTEXT:
- Phân tích H1
- Tìm Order Block, FVG, BOS, CHoCH
- Input là DataFrame H1 từ data_feed
- Tất cả tham số import từ config.py

NHIỆM VỤ:
Viết module smc_analyzer.py phân tích
SMC (Smart Money Concepts) trên H1.

CÁC HÀM CẦN VIẾT:

1. detect_bos_choch(
     df: pd.DataFrame,
     swing_highs: list,
     swing_lows: list,
     bias: str
   ) -> list[dict]
Phát hiện BOS và CHoCH trong 50 nến gần nhất.

BOS (Break of Structure):
- Bullish BOS: close vượt qua swing high trước
  → Xác nhận uptrend tiếp diễn
- Bearish BOS: close phá xuống dưới swing low trước
  → Xác nhận downtrend tiếp diễn

CHoCH (Change of Character):
- Đang uptrend: close phá swing low → CHoCH bearish
- Đang downtrend: close phá swing high → CHoCH bullish

Return list:
[{
  "type"         : "BOS"/"CHoCH",
  "direction"    : "bullish"/"bearish",
  "broken_level" : float,
  "candle_index" : int,
  "time"         : datetime,
  "is_recent"    : bool  (trong 10 nến gần nhất)
}]

2. find_fvg(
     df: pd.DataFrame,
     bias: str
   ) -> list[dict]
Phát hiện Fair Value Gap.

Bullish FVG: low[i+2] > high[i]
→ Khoảng trống tăng giữa nến i và i+2

Bearish FVG: high[i+2] < low[i]
→ Khoảng trống giảm

Điều kiện hợp lệ:
- Kích thước ≥ FVG_MIN_PIPS = 15 pips
- Tuổi ≤ FVG_MAX_AGE_CANDLES = 40 nến H1
- Phù hợp với bias

Mitigate check:
- fill_ratio = phần trăm FVG đã bị fill
- fill_ratio ≤ 0.5  → active, score bình thường
- fill_ratio 0.5-0.8 → weakened, score -1
- fill_ratio > 0.8  → mitigated, bỏ qua

Return list:
[{
  "type"      : "bullish"/"bearish",
  "top"       : float,
  "bottom"    : float,
  "mid"       : float,
  "size_pips" : float,
  "time"      : datetime,
  "age_candles": int,
  "fill_ratio": float,
  "status"    : "active"/"weakened"/"mitigated",
  "score_adj" : int   (0 = bình thường, -1 = weakened)
}]

3. find_order_blocks(
     df: pd.DataFrame,
     bos_list: list,
     bias: str
   ) -> list[dict]
Phát hiện Order Block 2 loại.

Loại 1 — Basic OB:
- Bullish OB: nến bearish (đỏ) body_ratio ≥ 0.6
  xuất hiện ngay TRƯỚC BOS bullish
- Bearish OB: nến bullish (xanh) body_ratio ≥ 0.6
  ngay TRƯỚC BOS bearish
- Vùng OB = [low, high] của nến đó

Loại 2 — Premium OB (ưu tiên cao hơn):
- Là OB loại 1 + có FVG trong 1-3 nến tiếp theo
- FVG phải overlap hoặc cách OB < OB_FVG_MAX_GAP=10 pips

Scoring:
- Premium OB (có FVG): score = 2
- Basic OB           : score = 1

Mitigate check:
- Wick chạm vào OB   → active, giữ score
- Close ≤ 50% vào OB → weakened, score -1
- Close > 50% vào OB → mitigated, bỏ qua

Điều kiện hợp lệ:
- Tuổi ≤ OB_MAX_AGE_CANDLES = 40 nến H1
- Chưa bị mitigate hoàn toàn

Return list:
[{
  "type"       : "bullish"/"bearish",
  "top"        : float,
  "bottom"     : float,
  "mid"        : float,
  "score"      : 1/2,
  "has_fvg"   : bool,
  "status"     : "active"/"weakened"/"mitigated",
  "score_adj"  : int,
  "time"       : datetime,
  "age_candles": int,
  "bos_ref"    : dict   (BOS liên quan)
}]

4. check_ob_fvg_confluence(
     ob_list: list,
     fvg_list: list
   ) -> list[dict]
Tìm vùng OB + FVG confluence.
- OB và FVG overlap hoặc cách nhau < OB_FVG_MAX_GAP
- Đây là vùng ưu tiên cao nhất

Return list confluence zones:
[{
  "ob"          : dict,
  "fvg"         : dict,
  "zone_top"    : float,
  "zone_bottom" : float,
  "zone_mid"    : float,
  "total_score" : int
}]

5. analyze_h1_smc(
     df_h1: pd.DataFrame,
     bias: str,
     swing_highs_h4: list,
     swing_lows_h4: list
   ) -> dict
Hàm tổng hợp H1 SMC.
Return:
{
  "bos_choch_list"    : list,
  "fvg_list"          : list,   (chỉ active + weakened)
  "ob_list"           : list,   (chỉ active + weakened)
  "confluence_zones"  : list,   (OB+FVG overlap)
  "active_zones"      : list,   (tất cả vùng còn hiệu lực)
  "has_choch"         : bool,
  "choch_direction"   : str/None,
  "best_zone"         : dict/None  (vùng tốt nhất gần giá nhất)
}

LƯU Ý QUAN TRỌNG:
- Sắp xếp OB theo score giảm dần
- Chỉ giữ tối đa 5 OB tốt nhất
- CHoCH H1 không override H4 bias
  → Đặt flag has_choch = True
  → Module entry_trigger sẽ xử lý
- best_zone = confluence zone gần giá nhất
  nếu không có confluence → lấy OB score cao nhất
```

---

# MODULE 5 — entry_trigger.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 5: entry_trigger.py

CONTEXT:
- Phân tích M15 để xác nhận entry
- Nhận kết quả từ market_structure và smc_analyzer
- Tính confluence score cuối cùng
- Tất cả tham số import từ config.py

NHIỆM VỤ:
Viết module entry_trigger.py xác nhận
điểm entry trên M15 và tính score tổng hợp.

CÁC HÀM CẦN VIẾT:

1. detect_candle_pattern(
     df: pd.DataFrame,
     index: int = -1
   ) -> dict
Nhận diện mô hình nến tại vị trí index.

Pinbar (ưu tiên):
- Bullish: lower_shadow ≥ CONFIRM_PINBAR_SHADOW × body
           upper_shadow nhỏ (< 0.3 × range)
           body_ratio ≥ CONFIRM_BODY_MIN
- Bearish: upper_shadow ≥ CONFIRM_PINBAR_SHADOW × body
           lower_shadow nhỏ (< 0.3 × range)

Engulfing:
- Bullish: nến xanh, body bao trùm body nến trước
           body_ratio ≥ CONFIRM_BODY_MIN
- Bearish: nến đỏ, body bao trùm body nến trước

Strong Close:
- Body ≥ CONFIRM_BODY_MIN = 0.6
- Bullish: close ở 80% trên của range (high-low)
- Bearish: close ở 20% dưới của range

Return:
{
  "pattern"  : "pinbar"/"engulfing"/"strong_close"/"none",
  "direction": "bullish"/"bearish"/"none",
  "strength" : float,  (0.0 - 1.0)
  "score_add": int     (pinbar=2, engulfing=2, strong_close=1)
}

2. detect_liquidity_sweep(
     df: pd.DataFrame,
     lookback: int = 10
   ) -> dict
Phát hiện Liquidity Sweep hợp lệ.

Điều kiện đủ cả 5 mới hợp lệ:
1. Spike qua đỉnh/đáy local ≥ SWEEP_MIN_PIPS = 10 pips
2. Đóng cửa ngược lại (body ≥ SWEEP_BODY_MIN = 60%)
3. Nến thứ 2 sau sweep đóng cùng hướng
   (không phải doji, body ≥ 40%)
4. Chỉ tính sweep trong SWEEP_VALID_CANDLES = 5 nến gần
5. Volume nến xác nhận > SWEEP_VOLUME_MULT × MA(10)

Return:
{
  "detected"     : bool,
  "valid"        : bool,   (đủ 5 điều kiện)
  "direction"    : "bullish"/"bearish"/None,
  "swept_level"  : float/None,
  "spike_pips"   : float,
  "candle_index" : int/None,
  "missing_conditions": list  (điều kiện còn thiếu)
}

3. check_fib_confluence(
     current_price: float,
     confluence_zones: list,
     tolerance_pips: float = 15.0
   ) -> dict
Kiểm tra giá có trong confluence Fibo zone không.

Return:
{
  "in_zone"       : bool,
  "zone"          : dict/None,
  "distance_pips" : float,
  "nearest_level" : str
}

4. check_candle_in_zone(
     current_price: float,
     active_zones: list
   ) -> dict
Kiểm tra nến M15 có trong vùng OB/FVG không.

Return:
{
  "in_zone"  : bool,
  "zone"     : dict/None,  (zone tốt nhất đang active)
  "zone_type": "confluence"/"ob"/"fvg"/None
}

5. check_volume_confirmation(
     df: pd.DataFrame,
     index: int = -1,
     ma_period: int = 10
   ) -> dict
Kiểm tra volume xác nhận.
- tick_volume[index] > SWEEP_VOLUME_MULT × MA(10)

Return:
{
  "confirmed"    : bool,
  "current_vol"  : float,
  "avg_vol"      : float,
  "ratio"        : float
}

6. calculate_confluence_score(
     bias_data       : dict,
     zone_check      : dict,
     candle_pattern  : dict,
     sweep_data      : dict,
     fib_check       : dict,
     choch_data      : dict,
     volume_check    : dict
   ) -> dict
Tính tổng điểm confluence.

Nhóm A (tối đa 8 điểm):
- D1+H4 bias đồng thuận (confidence=high): SCORE_BIAS = 3
  confidence=medium: 2 điểm
- OB+FVG confluence zone: SCORE_OB_FVG = 3
  Chỉ OB hoặc FVG: 2 điểm
- Nến xác nhận M15: SCORE_CANDLE = 2
  (pinbar/engulfing=2, strong_close=1)

Nhóm B (tối đa 6 điểm):
- Sweep hợp lệ (valid=True): SCORE_SWEEP = 2
- Confluence Fibo ≥ 2 mức: SCORE_FIB = 2
- CHoCH H1 đúng hướng: SCORE_CHOCH = 1
- Volume xác nhận: SCORE_VOLUME = 1

Ngưỡng phát tín hiệu:
- group_a ≥ SCORE_MIN_GROUP_A = 7
- group_b ≥ SCORE_MIN_GROUP_B = 3
- total   ≥ SCORE_MIN_TOTAL = 10

Return:
{
  "group_a"      : int,
  "group_b"      : int,
  "total"        : int,
  "max_total"    : 14,
  "signal_valid" : bool,
  "breakdown"    : dict  (chi tiết từng điểm)
}

7. check_entry_signal(
     df_m15         : pd.DataFrame,
     market_data    : dict,   (từ market_structure)
     smc_data       : dict,   (từ smc_analyzer)
     current_price  : float
   ) -> dict
Hàm tổng hợp — kiểm tra toàn bộ điều kiện entry.

Luồng xử lý:
1. Lấy bias, trade_direction từ market_data
2. Kiểm tra can_trade = True
3. Kiểm tra CHoCH H1 (nếu có → cẩn thận hơn)
4. Kiểm tra nến M15 trong zone
5. Nhận diện pattern nến M15
6. Kiểm tra sweep
7. Kiểm tra Fibo confluence
8. Kiểm tra volume
9. Tính score tổng hợp
10. Quyết định phát tín hiệu

Return:
{
  "signal"          : bool,
  "direction"       : "buy"/"sell"/None,
  "entry_price"     : float,
  "score_data"      : dict,
  "active_zone"     : dict/None,
  "candle_pattern"  : dict,
  "sweep_data"      : dict,
  "fib_check"       : dict,
  "volume_check"    : dict,
  "has_choch_warning": bool,
  "reasons"         : list[str],   (lý do vào lệnh)
  "reject_reasons"  : list[str]    (lý do từ chối nếu không signal)
}

LƯU Ý QUAN TRỌNG:
- Không phát tín hiệu nếu can_trade = False
- CHoCH H1 → has_choch_warning = True
  → Vẫn phát nếu score đủ nhưng cảnh báo thêm
- Pattern phải đúng hướng với trade_direction
- Nến phải xuất hiện trong/chạm vùng OB/FVG
  → Đây là điều kiện bắt buộc cho pattern
```

---

# MODULE 6 — risk_manager.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 6: risk_manager.py

CONTEXT:
- Tính SL/TP dựa trên vùng OB/FVG và cấu trúc H1/H4
- Gold quote 3 chữ số thập phân
- SL lý tưởng: 10-20 USD giá, tối đa 25 USD giá
- TP1: RR 1:1.8, TP2: RR 1:3.0
- Sau TP1: SL mới = Entry + (TP1 distance × 80%)
- Tất cả tham số import từ config.py

NHIỆM VỤ:
Viết module risk_manager.py tính TP/SL
và validate tín hiệu trước khi gửi.

CÁC HÀM CẦN VIẾT:

1. calculate_sl(
     direction    : str,
     active_zone  : dict,
     current_price: float,
     smc_data     : dict
   ) -> dict
Tính Stop Loss.

Logic:
BUY:
- SL = active_zone["bottom"] - buffer
- buffer = tự tính để SL hợp lý

SELL:
- SL = active_zone["top"] + buffer

Kiểm tra sau khi tính:
- sl_distance = abs(entry - sl) tính bằng USD giá
- sl_distance < SL_MIN_PRICE=10  → mở rộng đến 10
- sl_distance > SL_MAX_PRICE=25  → invalid

Return:
{
  "sl_price"    : float,
  "sl_distance" : float,  (USD giá)
  "sl_pips"     : float,  (pips)
  "valid"       : bool,
  "reason"      : str
}

2. calculate_tp(
     direction    : str,
     entry        : float,
     sl_distance  : float,
     smc_data     : dict,
     market_data  : dict
   ) -> dict
Tính Take Profit TP1 và TP2.

TP1 Logic (RR 1:1.8):
- Tính tp1_rr = entry ± (sl_distance × TP1_RR=1.8)
- Tìm SR kỹ thuật H1 gần nhất (swing point, OB đối diện)
- Nếu SR gần tp1_rr (trong 10 pips) → dùng SR đó
- Nếu SR xa hơn tp1_rr → dùng SR (RR tốt hơn)
- Nếu SR gần hơn nhưng RR < 1.5 → tìm SR tiếp theo
- Fallback: dùng tp1_rr thuần túy

TP2 Logic (RR 1:3.0):
- Tính tp2_rr = entry ± (sl_distance × TP2_RR=3.0)
- Tìm SR kỹ thuật H4 (swing point, OB đối diện H4)
- Hoặc Fibo extension 1.272/1.618
- Fallback: dùng tp2_rr thuần túy

Return:
{
  "tp1_price"    : float,
  "tp2_price"    : float,
  "tp1_distance" : float,  (USD giá)
  "tp2_distance" : float,
  "rr1"          : float,
  "rr2"          : float,
  "tp1_source"   : str,    ("sr_level"/"fib"/"rr_pure")
  "tp2_source"   : str
}

3. calculate_trailing_sl(
     entry     : float,
     tp1_price : float,
     direction : str
   ) -> float
Tính SL mới sau khi TP1 chạm.
- SL mới = Entry + (TP1 distance × TP1_SL_TRAIL=0.8)
- BUY : sl_new = entry + (tp1_price - entry) × 0.8
- SELL: sl_new = entry - (entry - tp1_price) × 0.8
- Return sl_new price

4. convert_to_usd(
     price_distance : float,
     lot_size       : float = 0.02
   ) -> float
Quy đổi khoảng cách giá sang USD.
- Tính dựa trên contract size thực tế của broker
- Lấy contract size từ mt5.symbol_info()
- Return USD value

5. validate_signal(
     direction    : str,
     entry        : float,
     sl_data      : dict,
     tp_data      : dict,
     spread       : float,
     active_signals: list
   ) -> dict
Validate toàn bộ tín hiệu trước khi gửi.

Kiểm tra:
1. SL valid (trong range 10-25 USD giá)
2. RR TP1 ≥ 1.5 (tối thiểu chấp nhận)
3. Spread hợp lý (không quá cao)
4. Tổng lệnh active < MAX_ACTIVE_SIGNALS = 3
5. Entry cách lệnh cũ ≥ MIN_ENTRY_DISTANCE = 15 USD giá

Return:
{
  "valid"           : bool,
  "reject_reasons"  : list[str],
  "sl_valid"        : bool,
  "rr_valid"        : bool,
  "spread_valid"    : bool,
  "signals_valid"   : bool,
  "distance_valid"  : bool
}

6. build_signal_package(
     direction    : str,
     entry        : float,
     sl_data      : dict,
     tp_data      : dict,
     score_data   : dict,
     entry_data   : dict,
     market_data  : dict,
     smc_data     : dict
   ) -> dict
Tổng hợp toàn bộ thông tin tín hiệu.

Return signal package đầy đủ:
{
  "id"              : str,     (timestamp + random)
  "symbol"          : "XAUUSD",
  "direction"       : str,
  "status"          : "active",
  "entry_price"     : float,
  "sl_price"        : float,
  "tp1_price"       : float,
  "tp2_price"       : float,
  "sl_distance"     : float,
  "tp1_distance"    : float,
  "tp2_distance"    : float,
  "sl_usd"          : float,
  "tp1_usd"         : float,
  "tp2_usd"         : float,
  "rr1"             : float,
  "rr2"             : float,
  "trailing_sl"     : None,    (sẽ cập nhật khi TP1 chạm)
  "score_total"     : int,
  "score_group_a"   : int,
  "score_group_b"   : int,
  "bias"            : str,
  "bias_confidence" : str,
  "price_zone"      : str,
  "active_zone"     : dict,
  "candle_pattern"  : dict,
  "sweep_data"      : dict,
  "fib_check"       : dict,
  "reasons"         : list[str],
  "has_choch_warning": bool,
  "time_created"    : datetime,
  "time_tp1_hit"    : None,
  "time_tp2_hit"    : None,
  "time_sl_hit"     : None,
  "time_expired"    : None,
  "lot_ref"         : 0.02
}

LƯU Ý QUAN TRỌNG:
- Gold 3 chữ số thập phân
- Lấy contract size thực từ mt5.symbol_info()
  để tính USD chính xác
- SL phải dưới đáy OB (BUY) hoặc trên đỉnh OB (SELL)
- Không được đặt SL trong vùng OB
- TP không được đặt vào vùng OB đối diện
  mà phải đặt ngay trước vùng đó
```

---

# MODULE 7 — telegram_notifier.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 7: telegram_notifier.py

CONTEXT:
- Gửi 6 loại thông báo qua Telegram Bot API
- Parse mode: HTML
- Ngôn ngữ: Tiếng Việt
- Timezone hiển thị: Asia/Ho_Chi_Minh (ICT)
- Tất cả tham số import từ config.py

NHIỆM VỤ:
Viết module telegram_notifier.py xử lý
toàn bộ việc format và gửi thông báo Telegram.

CÁC HÀM CẦN VIẾT:

1. send_message(text: str) -> bool
- POST tới https://api.telegram.org/bot{TOKEN}/sendMessage
- parse_mode: HTML
- Retry 3 lần nếu thất bại, mỗi lần chờ 2 giây
- Return True nếu thành công
- Log kết quả

2. format_daily_briefing(
     market_data : dict,
     smc_data    : dict,
     news_today  : list
   ) -> str
Format tin nhắn tóm tắt đầu ngày (7:00 sáng ICT).

Template:
🌅 <b>GOLD DAILY BRIEFING</b>
📅 {ngày tháng năm}
━━━━━━━━━━━━━━━━━━━━━

📊 <b>XU HƯỚNG:</b>
• D1 Bias : {bias} {emoji}
• H4 Bias : {bias} {emoji}
• Trạng thái: {Trending/Ranging}

📍 <b>VÙNG QUAN TRỌNG:</b>
• Kháng cự: {giá 1} / {giá 2}
• Hỗ trợ  : {giá 1} / {giá 2}
• OB active: {top}–{bottom}

📈 <b>FIBONACCI:</b>
• Premium zone : trên {giá}
• Discount zone: dưới {giá}
• Confluence   : {giá top}–{giá bottom}

⚠️ <b>NEWS HÔM NAY:</b>
• {tên news} lúc {giờ} [{impact}]

🎯 <b>KỲ VỌNG:</b>
• {nhận định ngắn gọn}
━━━━━━━━━━━━━━━━━━━━━
🤖 Gold Signal Bot

3. format_signal_message(signal: dict) -> str
Format tin nhắn tín hiệu entry đầy đủ.

Template:
🥇 <b>GOLD SIGNAL — XAU/USD</b>
⏰ {datetime ICT}
━━━━━━━━━━━━━━━━━━━━━

{🟢 BUY / 🔴 SELL}

<code>Entry : {giá}</code>
<code>TP1   : {giá} (+{distance} | ~${usd} USD)</code>
<code>TP2   : {giá} (+{distance} | ~${usd} USD)</code>
<code>SL    : {giá} (-{distance} | ~${usd} USD)</code>
<code>RR    : 1:{rr1} / 1:{rr2}</code>
<code>Lot   : 0.02</code>

━━━━━━━━━━━━━━━━━━━━━
📊 <b>LÝ DO VÀO LỆNH:</b>

🔵 <b>Xu hướng:</b>
• D1 Bias: {bias} ✅
• H4 Bias: {bias} ✅
• Vùng giá: {Premium/Discount} zone ✅

🔵 <b>Vùng SMC (H1):</b>
• {OB/FVG type}: {top}–{bottom} ✅
• {confluence info} ✅

🔵 <b>Fibonacci:</b>
• {confluence zone} ✅
• Mức {level}: {giá} ✅

🔵 <b>Price Action (M15):</b>
• Mô hình: {pattern} ✅
• {sweep info nếu có} ✅
• Volume: {ratio}x MA(10) ✅

━━━━━━━━━━━━━━━━━━━━━
📈 Score: {total}/14 điểm
⚡ Chất lượng: {CAO/TRUNG BÌNH}
{⚠️ CHoCH cảnh báo nếu có}

4. format_tp1_message(signal: dict) -> str
Format thông báo TP1 chạm.

Template:
✅ <b>GOLD — TP1 ĐÃ CHẠM!</b>
⏰ {datetime ICT}
━━━━━━━━━━━━━━━━━━━━━

🎯 TP1 đạt : <code>{giá}</code>
💰 Lợi nhuận: +{distance} | ~${usd} USD

━━━━━━━━━━━━━━━━━━━━━
🔄 <b>CẬP NHẬT LỆNH:</b>

• SL mới : <code>{sl_new}</code> (+{distance} | ~${usd} USD)
  → Dời SL về mức này bảo vệ lợi nhuận

• Tiếp tục chờ TP2: <code>{tp2}</code>
  (+{distance} | ~${usd} USD | RR 1:{rr2})

⚠️ Lệnh không còn rủi ro thua lỗ

5. format_tp2_message(signal: dict) -> str
Format thông báo TP2 chạm.

Template:
🏆 <b>GOLD — TP2 ĐẠT! FULL WIN!</b>
⏰ {datetime ICT}
━━━━━━━━━━━━━━━━━━━━━

🎯 TP2 đạt : <code>{giá}</code>
💰 Lợi nhuận: +{distance} | ~${usd} USD

━━━━━━━━━━━━━━━━━━━━━
📊 <b>TỔNG KẾT LỆNH:</b>

• Entry : <code>{giá}</code>
• TP1   : <code>{giá}</code> ✅ (+${usd} USD)
• TP2   : <code>{giá}</code> ✅ (+${usd} USD)
• Tổng  : ~${total_usd} USD
• Thời gian giữ: {duration}

🎯 RR thực tế: 1:{rr}
🤖 Bot sẽ tìm tín hiệu mới

6. format_sl_message(signal: dict) -> str
Format thông báo SL chạm.

Template:
❌ <b>GOLD — SL BỊ CHẠM</b>
⏰ {datetime ICT}
━━━━━━━━━━━━━━━━━━━━━

🛑 SL chạm : <code>{giá}</code>
📉 Thua lỗ : -{distance} | ~${usd} USD

━━━━━━━━━━━━━━━━━━━━━
🔍 <b>PHÂN TÍCH:</b>
• Vùng OB/FVG đã bị phá vỡ
• Cấu trúc H1 thay đổi
• Cần xem xét lại bias H4

━━━━━━━━━━━━━━━━━━━━━
💡 <b>KHUYẾN NGHỊ:</b>
• Không vào lệnh ngay
• Chờ thị trường xác nhận lại cấu trúc
• Bot sẽ cập nhật tín hiệu tiếp theo

7. format_sl_trailing_message(signal: dict) -> str
Format thông báo đóng lệnh bằng trailing SL.

Template:
🔒 <b>GOLD — ĐÓNG LỆNH (Trailing SL)</b>
⏰ {datetime ICT}
━━━━━━━━━━━━━━━━━━━━━

🛑 Trailing SL chạm: <code>{giá}</code>
💰 Lợi nhuận : +{distance} | ~${usd} USD ✅

━━━━━━━━━━━━━━━━━━━━━
📊 <b>TỔNG KẾT:</b>
• Entry  : <code>{entry}</code>
• TP1    : <code>{tp1}</code> ✅
• Đóng   : <code>{sl_trail}</code>
• Kết quả: +${usd} USD
• Thời gian giữ: {duration}

💡 Lệnh kết thúc có lời
🤖 Bot sẽ tìm tín hiệu mới

8. format_daily_summary(
     signals_today : list,
     market_data   : dict,
     tomorrow_data : dict
   ) -> str
Format tổng kết cuối ngày (22:00 ICT).

Template:
🌙 <b>GOLD DAILY SUMMARY</b>
📅 {ngày tháng năm}
━━━━━━━━━━━━━━━━━━━━━

📊 <b>THỊ TRƯỜNG HÔM NAY:</b>
• Bias D1   : {bias}
• Bias H4   : {bias} {thay đổi nếu có}
• Biên độ   : {low}–{high} ({range} USD giá)
• Đóng cửa  : {price}

━━━━━━━━━━━━━━━━━━━━━
📋 <b>TÍN HIỆU HÔM NAY:</b>
{với mỗi tín hiệu:}
• {giờ} {BUY/SELL} @ {entry}
  {TP1 ✅ / TP2 ✅ / SL ❌ / Trailing 🔒 / Active ⏳}
  Kết quả: {+/- $usd USD}

━━━━━━━━━━━━━━━━━━━━━
📈 <b>THỐNG KÊ NGÀY:</b>
• Tổng tín hiệu : {n}
• Thắng (TP1+)  : {n} ({%})
• Thua (SL)     : {n} ({%})
• Đang mở       : {n}
• Lợi nhuận     : +${usd} USD
• Thua lỗ       : -${usd} USD
• <b>Tổng: {+/-}${usd} USD</b>

━━━━━━━━━━━━━━━━━━━━━
🔍 <b>VÙNG QUAN TRỌNG NGÀY MAI:</b>
• Kháng cự : {giá 1} / {giá 2}
• Hỗ trợ   : {giá 1} / {giá 2}
• OB active: {top}–{bottom}

💡 <b>NHẬN ĐỊNH NGÀY MAI:</b>
• {nhận định bias}
• {kịch bản giá kỳ vọng}
• {news quan trọng ngày mai}
━━━━━━━━━━━━━━━━━━━━━
🤖 Gold Signal Bot

9. format_warning_message(
     warning_type : str,
     data         : dict
   ) -> str
Format các cảnh báo đặc biệt.

warning_type và template tương ứng:

"ranging":
⚠️ <b>GOLD — THỊ TRƯỜNG RANGING</b>
Phát hiện sideway tại {giá}
ATR hiện tại: {atr} (< 0.8× MA)
→ Tạm dừng tìm entry
→ Theo dõi chờ breakout

"choch":
⚠️ <b>GOLD — CHoCH H1 PHÁT HIỆN</b>
{direction} CHoCH tại {giá}
H4 Bias vẫn: {bias}
→ Tạm dừng entry mới
→ Chờ xác nhận thêm từ H4

"liquidity_grab":
⚠️ <b>GOLD — LIQUIDITY GRAB</b>
Sweep {direction} tại {giá}
Chưa đủ điều kiện xác nhận
Thiếu: {missing_conditions}
→ Cẩn thận bẫy {direction}!

"news_filter":
⚠️ <b>GOLD — TẠM DỪNG (NEWS)</b>
{tên news} lúc {giờ} [{impact}]
→ Không vào lệnh mới đến {giờ kết thúc}
→ Lệnh active vẫn được theo dõi

"opposite_signal":
⚠️ <b>GOLD — TÍN HIỆU NGƯỢC CHIỀU</b>
Có tín hiệu {direction} mới
Đang có lệnh {old_direction} active
Entry cách nhau: {distance} USD giá
→ Thị trường đang phân kỳ, cẩn thận!

"signal_expired":
⏰ <b>GOLD — TÍN HIỆU HẾT HIỆU LỰC</b>
Lệnh {direction} @ {entry} đã 24h
→ Tự động đóng theo dõi
→ Bot tìm tín hiệu mới

"bot_start":
🤖 <b>GOLD SIGNAL BOT — KHỞI ĐỘNG</b>
⏰ {datetime ICT}
Phiên bản: 1.0
Cặp tiền: XAU/USD
Timeframe: D1/H4/H1/M15
→ Bắt đầu phân tích thị trường

"bot_stop":
🛑 <b>GOLD SIGNAL BOT — TẮT</b>
⏰ {datetime ICT}
→ Bot đã dừng hoạt động

LƯU Ý QUAN TRỌNG:
- Tất cả datetime hiển thị theo ICT (UTC+7)
- Giá Gold hiển thị 3 chữ số thập phân
- USD hiển thị 2 chữ số thập phân
- RR hiển thị 2 chữ số thập phân
- Emoji bullish: 🐂, bearish: 🐻
- Score cao (≥12): "CAO", trung bình (10-11): "TRUNG BÌNH"
```

---

# MODULE 8 — news_filter.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 8: news_filter.py

CONTEXT:
- Lọc tin tức kinh tế ảnh hưởng Gold
- Nguồn: FCS Forex API
- High impact: tránh 30 phút trước/sau
- Medium impact: tránh 15 phút trước/sau
- Tất cả tham số import từ config.py

NHIỆM VỤ:
Viết module news_filter.py lấy và
xử lý lịch tin tức kinh tế.

CÁC HÀM CẦN VIẾT:

1. fetch_news_calendar(date: str = None) -> list[dict]
Lấy lịch tin tức từ FCS API.
- URL: https://fcsapi.com/api-v3/forex/economy_cal
- Params: access_key=NEWS_API_KEY, country=us
- Nếu date=None → lấy ngày hôm nay
- Cache kết quả 1 giờ (không gọi API liên tục)
- Return list tin tức

2. filter_gold_relevant_news(news_list: list) -> list[dict]
Lọc tin tức ảnh hưởng Gold.

High impact (bắt buộc lọc):
- CPI, Core CPI
- NFP (Non-Farm Payrolls)
- FOMC Statement, Fed Rate Decision
- GDP
- PPI
- Fed Chair Speech
- Unemployment Rate

Medium impact (lọc):
- ADP Employment
- Retail Sales
- ISM Manufacturing/Services
- Jobless Claims
- Consumer Confidence
- Core PCE

Return list tin tức đã lọc với impact level.

3. is_news_window(
     current_time : datetime,
     news_list    : list
   ) -> dict
Kiểm tra có đang trong cửa sổ news không.

Logic:
- Với mỗi tin High: window = [time-30min, time+30min]
- Với mỗi tin Medium: window = [time-15min, time+15min]
- Kiểm tra current_time có trong window không

Return:
{
  "in_window"    : bool,
  "news_item"    : dict/None,  (tin gần nhất)
  "impact"       : "High"/"Medium"/None,
  "minutes_to"   : float/None, (phút đến tin tiếp theo)
  "minutes_after": float/None  (phút sau tin gần nhất)
}

4. get_upcoming_news(
     hours_ahead : int = 8
   ) -> list[dict]
Lấy danh sách tin sắp tới trong X giờ.
- Dùng cho daily briefing
- Return list tin sắp tới kèm thời gian

5. get_today_news_summary() -> list[dict]
Lấy tóm tắt tin tức hôm nay.
- Dùng cho daily summary
- Return all relevant news hôm nay

LƯU Ý QUAN TRỌNG:
- Cache tin tức để tránh gọi API quá nhiều
- Xử lý timezone: API trả về UTC → convert sang ICT
- Nếu API lỗi → log cảnh báo, không chặn bot
- Fallback: nếu không lấy được news → cho phép trade
  nhưng log cảnh báo "Không thể lấy lịch news"
```

---

# MODULE 9 — signal_manager.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module 9: signal_manager.py

CONTEXT:
- Quản lý tất cả tín hiệu active
- Lưu trữ vào state/active_signals.json
- Theo dõi TP/SL mỗi 5 phút
- Tối đa 3 tín hiệu active cùng lúc
- Tất cả tham số import từ config.py

NHIỆM VỤ:
Viết module signal_manager.py quản lý
vòng đời toàn bộ tín hiệu.

CÁC HÀM CẦN VIẾT:

1. load_signals(state_file: str) -> list[dict]
Đọc danh sách tín hiệu từ JSON.
- Return [] nếu file không tồn tại
- Xử lý JSON decode error

2. save_signals(
     signals   : list[dict],
     state_file: str
   ) -> None
Ghi danh sách tín hiệu vào JSON.
- Tạo thư mục nếu chưa có
- Ghi atomic (write temp file rồi rename)

3. add_signal(signal: dict) -> bool
Thêm tín hiệu mới.
- Kiểm tra tổng active < MAX_ACTIVE_SIGNALS=3
- Kiểm tra entry cách lệnh cũ ≥ MIN_ENTRY_DISTANCE=15
- Return True nếu thêm thành công

4. get_active_signals() -> list[dict]
Lấy danh sách tín hiệu đang active.
- Chỉ lấy status = "active"

5. check_tp_sl_hit(
     signal        : dict,
     current_price : float
   ) -> dict
Kiểm tra tín hiệu có chạm TP/SL không.

Logic BUY:
- TP1 chạm: current_price >= tp1_price
- TP2 chạm: current_price >= tp2_price
- SL chạm : current_price <= sl_price

Logic SELL:
- TP1 chạm: current_price <= tp1_price
- TP2 chạm: current_price <= tp2_price
- SL chạm : current_price >= sl_price

Sau TP1 chạm (trailing active):
- SL mới = trailing_sl (đã tính từ risk_manager)
- Kiểm tra theo trailing_sl thay vì sl gốc

Return:
{
  "hit"      : bool,
  "hit_type" : "TP1"/"TP2"/"SL"/"TRAILING_SL"/None,
  "hit_price": float/None
}

6. update_signal_status(
     signal_id  : str,
     new_status : str,
     hit_price  : float = None,
     hit_time   : datetime = None
   ) -> None
Cập nhật trạng thái tín hiệu.

Các status:
- "active"      : đang theo dõi
- "tp1_hit"     : TP1 đã chạm, đang chờ TP2
- "tp2_hit"     : hoàn thành full win
- "sl_hit"      : thua lỗ
- "trailing_sl" : đóng bằng trailing SL (có lời)
- "expired"     : hết 24h

7. activate_trailing_sl(
     signal_id    : str,
     trailing_sl  : float
   ) -> None
Kích hoạt trailing SL sau TP1.
- Cập nhật trailing_sl vào signal
- Cập nhật status = "tp1_hit"
- Lưu time_tp1_hit

8. check_expired_signals() -> list[dict]
Kiểm tra tín hiệu hết hạn 24h.
- Return list tín hiệu đã hết hạn

9. monitor_all_signals(
     current_price : float,
     notifier      : object
   ) -> None
Hàm chính theo dõi tất cả tín hiệu active.
Gọi mỗi 5 phút.

Logic:
1. Load active signals
2. Check expired → update + notify
3. Với mỗi signal active:
   a. check_tp_sl_hit()
   b. Nếu hit:
      - "TP1": activate_trailing_sl() + notify tp1
      - "TP2": update status + notify tp2
      - "SL" : update status + notify sl
      - "TRAILING_SL": update status + notify trailing

10. can_add_signal(
      new_signal     : dict,
      active_signals : list
    ) -> dict
Kiểm tra có thể thêm tín hiệu mới không.

Return:
{
  "can_add"         : bool,
  "reject_reason"   : str/None,
  "active_count"    : int,
  "nearest_distance": float/None
}

11. get_today_signals() -> list[dict]
Lấy tất cả tín hiệu trong ngày hôm nay.
- Dùng cho daily summary

12. get_daily_stats(signals: list) -> dict
Tính thống kê ngày.
Return:
{
  "total"      : int,
  "wins"       : int,
  "losses"     : int,
  "active"     : int,
  "win_rate"   : float,
  "total_profit_usd": float,
  "total_loss_usd"  : float,
  "net_usd"         : float
}

LƯU Ý QUAN TRỌNG:
- Sau TP1: chuyển sang theo dõi trailing_sl
  không còn theo dõi sl gốc nữa
- Một tín hiệu chỉ có thể hit 1 lần
  (tránh notify trùng)
- Lock file khi đọc/ghi để tránh race condition
- Log mọi thay đổi trạng thái
```

---

# MODULE 10 — main.py

```
Tôi đang xây dựng Gold Signal Bot với Python + MetaTrader 5.
Đây là module cuối: main.py

CONTEXT:
- Điều phối toàn bộ các module
- Chạy 24/5 liên tục trên Windows
- 2 vòng lặp: signal scan (15 phút) và TP/SL monitor (5 phút)
- Tất cả module đã được viết:
  config, data_feed, market_structure,
  smc_analyzer, entry_trigger, risk_manager,
  telegram_notifier, news_filter, signal_manager

NHIỆM VỤ:
Viết main.py điều phối toàn bộ bot.

CÁC HÀM CẦN VIẾT:

1. setup_logging() -> None
Cấu hình logging ghi ra cả file và console.
- File: logs/bot.log
- Format: [datetime] [LEVEL] message
- Rotation: 10MB, giữ 5 file cũ

2. run_signal_scan(
     notifier       : object,
     signal_manager : object
   ) -> None
Vòng quét tín hiệu mỗi 15 phút.

Luồng:
1. Kiểm tra is_market_open()
   → Nếu đóng cửa: log + return
2. Kiểm tra news window
   → Nếu trong window: gửi cảnh báo + return
3. Lấy get_all_timeframes()
4. Kiểm tra spread hợp lý
5. analyze_market_structure()
   → Nếu ranging: gửi cảnh báo ranging + return
   → Nếu can_trade=False: log + return
6. analyze_h1_smc()
   → Nếu has_choch: gửi cảnh báo CHoCH
7. check_entry_signal()
   → Nếu không có signal: log + return
   → Nếu có sweep invalid: gửi cảnh báo
8. calculate_sl()
   → Nếu invalid: log + return
9. calculate_tp()
10. validate_signal()
    → Nếu invalid: log lý do + return
11. can_add_signal()
    → Nếu không thể thêm: log + return
12. build_signal_package()
13. send_message(format_signal_message())
14. add_signal()
15. Log thành công

3. run_tpsl_monitor(
     notifier       : object,
     signal_manager : object
   ) -> None
Vòng theo dõi TP/SL mỗi 5 phút.

Luồng:
1. Lấy current_price
2. monitor_all_signals(current_price, notifier)
3. Log kết quả

4. run_daily_briefing(
     notifier    : object,
     news_filter : object
   ) -> None
Gửi tóm tắt đầu ngày lúc 7:00 ICT.

Luồng:
1. Lấy market data
2. Lấy news hôm nay
3. format_daily_briefing()
4. send_message()

5. run_daily_summary(
     notifier       : object,
     signal_manager : object
   ) -> None
Gửi tổng kết cuối ngày lúc 22:00 ICT.

Luồng:
1. Lấy tín hiệu hôm nay
2. Tính thống kê
3. Lấy market data cho ngày mai
4. format_daily_summary()
5. send_message()

6. main() -> None
Hàm chính khởi động và chạy bot.

Logic:
1. setup_logging()
2. validate_config()
3. connect_mt5()
4. Khởi tạo các module
5. send_message(format_warning_message("bot_start"))
6. Tính thời điểm scan tiếp theo:
   - next_signal_scan = thời điểm nến M15 tiếp theo đóng
   - next_tpsl_check  = now + 5 phút
   - next_briefing    = 7:00 ICT hôm nay/mai
   - next_summary     = 22:00 ICT hôm nay/mai

7. Vòng lặp chính while True:
   now = datetime.now(ICT)

   Nếu now >= next_briefing:
   → run_daily_briefing()
   → next_briefing += 1 ngày

   Nếu now >= next_summary:
   → run_daily_summary()
   → next_summary += 1 ngày

   Nếu now >= next_signal_scan:
   → check_connection() → reconnect nếu cần
   → run_signal_scan()
   → next_signal_scan = thời điểm nến M15 tiếp theo đóng

   Nếu now >= next_tpsl_check:
   → run_tpsl_monitor()
   → next_tpsl_check = now + 5 phút

   sleep(30)  (kiểm tra mỗi 30 giây)

8. Xử lý KeyboardInterrupt:
   → send_message(format_warning_message("bot_stop"))
   → disconnect_mt5()
   → Log "Bot đã dừng"

9. Xử lý Exception:
   → Log error chi tiết
   → Thử reconnect MT5
   → Chờ 60 giây rồi tiếp tục

YÊU CẦU BỔ SUNG:
- Tính chính xác thời điểm nến M15 đóng:
  next_m15_close = round lên bội số 15 phút tiếp theo
  Ví dụ: 14:32 → next close = 14:45
- Không dùng sleep cố định mà dùng
  thời điểm thực tế để tránh drift
- Thêm if __name__ == "__main__": main()
- Log toàn bộ exception với traceback đầy đủ
- Tạo thư mục logs/ và state/ nếu chưa có
```

---

# REQUIREMENTS.TXT

```
Tạo file requirements.txt cho dự án Gold Signal Bot:

MetaTrader5>=5.0.45
pandas>=2.0.0
numpy>=1.24.0
requests>=2.31.0
python-dotenv>=1.0.0
pytz>=2023.3
```

---

# CẤU TRÚC THƯ MỤC

```
gold_signal_bot/
├── main.py
├── config.py
├── requirements.txt
├── .env                    (không commit lên git)
├── .env.example
├── .gitignore
├── modules/
│   ├── __init__.py
│   ├── data_feed.py
│   ├── market_structure.py
│   ├── smc_analyzer.py
│   ├── entry_trigger.py
│   ├── risk_manager.py
│   ├── telegram_notifier.py
│   ├── news_filter.py
│   └── signal_manager.py
├── state/
│   └── active_signals.json
└── logs/
    └── bot.log
```

---

# LƯU Ý CHUNG KHI CODE

```
1. Gold XAU/USD:
   - Quote 3 chữ số thập phân
   - 1 pip = 0.010 USD giá
   - Lấy contract size thực từ mt5.symbol_info()
   - Spread bình thường: 10-35 pips

2. Thứ tự test từng module:
   - Test data_feed trước (kết nối MT5)
   - Test market_structure với data thật
   - Test smc_analyzer độc lập
   - Test entry_trigger với mock data
   - Test risk_manager với mock signal
   - Test telegram_notifier với test message
   - Test news_filter với FCS API
   - Test signal_manager với mock signals
   - Test main.py toàn bộ flow

3. Khi có vấn đề trong quá trình test:
   - Điều chỉnh tham số trong config.py
   - Không sửa logic trong module
   - Log đầy đủ để debug

4. Phiên bản đầu tiên:
   - Chạy ít nhất 2 tuần với tài khoản demo
   - Ghi lại tất cả tín hiệu để review
   - Điều chỉnh tham số dựa trên kết quả thực tế
```
