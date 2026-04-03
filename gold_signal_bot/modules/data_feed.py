"""
data_feed.py — Xử lý kết nối MT5 và cung cấp dữ liệu nến cho Gold Signal Bot.
"""
import logging
import time
from datetime import datetime, timezone

import MetaTrader5 as mt5
import pandas as pd

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)

MAX_SPREAD_PIPS = 50.0   # cảnh báo nếu spread > 50 pips


def connect_mt5() -> bool:
    """Khởi tạo và đăng nhập MT5. Retry tối đa 3 lần, mỗi lần chờ 5 giây."""
    for attempt in range(1, 4):
        if mt5.initialize():
            if mt5.login(config.MT5_LOGIN, password=config.MT5_PASSWORD, server=config.MT5_SERVER):
                info = mt5.terminal_info()
                logger.info(f"Kết nối MT5 thành công (lần {attempt}): {info.name}")
                return True
            else:
                logger.warning(f"Đăng nhập thất bại lần {attempt}: {mt5.last_error()}")
                mt5.shutdown()
        else:
            logger.warning(f"Khởi tạo MT5 thất bại lần {attempt}: {mt5.last_error()}")
        if attempt < 3:
            time.sleep(5)
    raise ConnectionError(f"Không thể kết nối MT5 sau 3 lần thử: {mt5.last_error()}")


def disconnect_mt5() -> None:
    """Ngắt kết nối MT5."""
    mt5.shutdown()
    logger.info("Đã ngắt kết nối MT5.")


def get_candles(symbol: str, timeframe: int, count: int) -> pd.DataFrame:
    """Lấy dữ liệu nến từ MT5. Retry 3 lần nếu thất bại."""
    for attempt in range(1, 4):
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count + 1)
        if rates is not None and len(rates) > 1:
            df = pd.DataFrame(rates)
            df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
            df = df[["time", "open", "high", "low", "close", "tick_volume"]].copy()
            # Loại bỏ nến cuối chưa đóng
            df = df.iloc[:-1].reset_index(drop=True)
            df = df.sort_values("time").reset_index(drop=True)
            # Tính thêm các cột phân tích
            df["body"] = df["close"] - df["open"]
            hl = (df["high"] - df["low"]).replace(0, 1e-9)
            df["body_ratio"] = df["body"].abs() / hl
            df["is_bullish"] = df["close"] > df["open"]
            return df
        err = mt5.last_error()
        logger.warning(f"get_candles thất bại lần {attempt}: {err}")
        if attempt < 3:
            time.sleep(2)
    raise RuntimeError(f"Không lấy được nến {symbol} tf={timeframe}: {mt5.last_error()}")


def get_current_price(symbol: str) -> float:
    """Trả về giá mid = (bid + ask) / 2."""
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise RuntimeError(f"Không lấy được tick {symbol}: {mt5.last_error()}")
    return (tick.bid + tick.ask) / 2


def get_current_spread(symbol: str) -> float:
    """Tính spread pips cho Gold (1 pip = 0.010)."""
    info = mt5.symbol_info(symbol)
    if info is None:
        raise RuntimeError(f"Không lấy được symbol_info {symbol}: {mt5.last_error()}")
    spread_points = info.spread
    # Gold: point = 0.001, 1 pip = 0.010 → 10 points/pip
    spread_pips = spread_points * info.point / 0.010
    if spread_pips > MAX_SPREAD_PIPS:
        logger.warning(f"Spread cao bất thường: {spread_pips:.1f} pips")
    return spread_pips


def is_market_open() -> bool:
    """Kiểm tra thị trường Forex có đang mở không (theo UTC)."""
    now_utc = datetime.now(timezone.utc)
    weekday = now_utc.weekday()   # 0=Monday … 6=Sunday
    # Đóng: Thứ 7 (5) cả ngày, Chủ nhật (6) trước 22:00 UTC
    if weekday == 5:
        return False
    if weekday == 6 and now_utc.hour < 22:
        return False
    return True


def check_connection() -> bool:
    """Kiểm tra kết nối MT5, tự reconnect nếu mất."""
    info = mt5.terminal_info()
    if info is not None and info.connected:
        return True
    logger.warning("Mất kết nối MT5, đang reconnect...")
    try:
        connect_mt5()
        return True
    except ConnectionError as e:
        logger.error(f"Reconnect thất bại: {e}")
        return False


def get_all_timeframes(symbol: str) -> dict:
    """Lấy dữ liệu tất cả timeframe cùng lúc."""
    return {
        "D1": get_candles(symbol, config.TF_D1, config.CANDLES_D1),
        "H4": get_candles(symbol, config.TF_H4, config.CANDLES_H4),
        "H1": get_candles(symbol, config.TF_H1, config.CANDLES_H1),
        "M15": get_candles(symbol, config.TF_M15, config.CANDLES_M15),
        "M5": get_candles(symbol, config.TF_M5, config.CANDLES_M5),
        "current_price": get_current_price(symbol),
        "spread": get_current_spread(symbol),
        "timestamp": datetime.now(timezone.utc),
    }
