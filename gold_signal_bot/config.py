"""
config.py — Tập trung toàn bộ tham số cấu hình Gold Signal Bot.
Không hardcode bất kỳ giá trị nào trong các module khác.
"""
import os
from dotenv import load_dotenv
import MetaTrader5 as mt5

load_dotenv()

# ─── MT5 Connection ────────────────────────────────────────────────────────────
MT5_LOGIN: int = int(os.getenv("MT5_LOGIN", "0"))
MT5_PASSWORD: str = os.getenv("MT5_PASSWORD", "")
MT5_SERVER: str = os.getenv("MT5_SERVER", "")
SYMBOL: str = "XAUUSD"

# ─── Telegram ──────────────────────────────────────────────────────────────────
TELEGRAM_TOKEN: str = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

# ─── Timeframes ────────────────────────────────────────────────────────────────
TF_D1: int = mt5.TIMEFRAME_D1
TF_H4: int = mt5.TIMEFRAME_H4
TF_H1: int = mt5.TIMEFRAME_H1
TF_M15: int = mt5.TIMEFRAME_M15
TF_M5: int = mt5.TIMEFRAME_M5

# ─── Số nến lấy ────────────────────────────────────────────────────────────────
CANDLES_D1: int = 100
CANDLES_H4: int = 200
CANDLES_H1: int = 300
CANDLES_M15: int = 500
CANDLES_M5: int = 100

# ─── Swing Point ───────────────────────────────────────────────────────────────
SWING_PIVOT_D1: int = 5   # số nến mỗi bên để xác định swing D1
SWING_PIVOT_H4: int = 3   # số nến mỗi bên để xác định swing H4
SWING_COUNT: int = 3       # số swing tối thiểu để xác nhận trend

# ─── Ranging Detection ─────────────────────────────────────────────────────────
RANGING_ATR_PERIOD: int = 14
RANGING_ATR_MULT: float = 0.8
RANGING_ATR_MA: int = 20
RANGING_BOS_LOOKBACK: int = 15

# ─── Fibonacci ─────────────────────────────────────────────────────────────────
FIB_LEVELS: list = [0.236, 0.382, 0.5, 0.618, 0.786, 0.886]
FIB_EXTENSIONS: list = [1.272, 1.618]
FIB_CONFLUENCE_PIPS: float = 15.0   # pips
FIB_MAX_SETS_H4: int = 3

# ─── Order Block ───────────────────────────────────────────────────────────────
OB_MIN_BODY_RATIO: float = 0.6
OB_MAX_AGE_CANDLES: int = 40        # nến H1
OB_FVG_MAX_GAP: float = 10.0        # pips

# ─── Fair Value Gap ────────────────────────────────────────────────────────────
FVG_MIN_PIPS: float = 15.0          # pips
FVG_MAX_AGE_CANDLES: int = 40       # nến H1
FVG_FILL_PARTIAL: float = 0.5
FVG_FILL_WEAK: float = 0.8

# ─── Liquidity Sweep ───────────────────────────────────────────────────────────
SWEEP_MIN_PIPS: float = 10.0        # pips
SWEEP_BODY_MIN: float = 0.6
SWEEP_VOLUME_MULT: float = 1.5
SWEEP_VALID_CANDLES: int = 5

# ─── Nến xác nhận M15 ──────────────────────────────────────────────────────────
CONFIRM_BODY_MIN: float = 0.6
CONFIRM_STRONG_CLOSE: float = 0.8
CONFIRM_PINBAR_SHADOW: float = 2.0

# ─── Confluence Score ──────────────────────────────────────────────────────────
SCORE_BIAS: int = 3
SCORE_OB_FVG: int = 3
SCORE_CANDLE: int = 2
SCORE_SWEEP: int = 2
SCORE_FIB: int = 2
SCORE_CHOCH: int = 1
SCORE_VOLUME: int = 1
SCORE_MIN_GROUP_A: int = 7
SCORE_MIN_GROUP_B: int = 3
SCORE_MIN_TOTAL: int = 10

# ─── TP/SL ─────────────────────────────────────────────────────────────────────
SL_MIN_PRICE: float = 10.0          # USD giá
SL_MAX_PRICE: float = 25.0          # USD giá
TP1_RR: float = 1.8
TP2_RR: float = 3.0
TP1_SL_TRAIL: float = 0.8

# ─── Quản lý lệnh ──────────────────────────────────────────────────────────────
MAX_ACTIVE_SIGNALS: int = 3
MIN_ENTRY_DISTANCE: float = 15.0    # USD giá
SIGNAL_EXPIRE_HOURS: int = 24

# ─── News Filter ───────────────────────────────────────────────────────────────
NEWS_HIGH_BEFORE: int = 30          # phút trước tin High impact
NEWS_HIGH_AFTER: int = 30           # phút sau tin High impact
NEWS_MED_BEFORE: int = 15           # phút trước tin Medium impact
NEWS_MED_AFTER: int = 15            # phút sau tin Medium impact
NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")

# ─── Chu kỳ quét ───────────────────────────────────────────────────────────────
SCAN_INTERVAL_SIGNAL: int = 900     # giây (15 phút)
SCAN_INTERVAL_TPSL: int = 300       # giây (5 phút)

# ─── Thông báo định kỳ ─────────────────────────────────────────────────────────
DAILY_BRIEFING_HOUR: int = 7
DAILY_SUMMARY_HOUR: int = 22
TIMEZONE: str = "Asia/Ho_Chi_Minh"

# ─── Logging & State ───────────────────────────────────────────────────────────
LOG_FILE: str = "logs/bot.log"
LOG_LEVEL: str = "INFO"
STATE_FILE: str = "state/active_signals.json"


def validate_config() -> None:
    """Kiểm tra các giá trị cấu hình bắt buộc khi bot khởi động."""
    required = {
        "MT5_LOGIN": MT5_LOGIN,
        "MT5_PASSWORD": MT5_PASSWORD,
        "MT5_SERVER": MT5_SERVER,
        "TELEGRAM_TOKEN": TELEGRAM_TOKEN,
        "TELEGRAM_CHAT_ID": TELEGRAM_CHAT_ID,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise ValueError(f"Thiếu cấu hình bắt buộc: {', '.join(missing)}")
