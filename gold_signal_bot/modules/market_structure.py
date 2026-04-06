"""
market_structure.py — Phân tích cấu trúc thị trường D1 và H4.
Xác định trend, swing points, Fibonacci, Premium/Discount zone.
"""
import logging
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)


def find_swing_points(df: pd.DataFrame, pivot_bars: int) -> dict:
    """Tìm swing high và swing low đã được xác nhận đủ pivot_bars nến."""
    highs, lows = [], []
    n = len(df)
    for i in range(pivot_bars, n - pivot_bars):
        # Swing High
        if all(df["high"].iloc[i] > df["high"].iloc[i - j] for j in range(1, pivot_bars + 1)) and \
           all(df["high"].iloc[i] > df["high"].iloc[i + j] for j in range(1, pivot_bars + 1)):
            highs.append({"index": i, "price": df["high"].iloc[i], "time": df["time"].iloc[i]})
        # Swing Low
        if all(df["low"].iloc[i] < df["low"].iloc[i - j] for j in range(1, pivot_bars + 1)) and \
           all(df["low"].iloc[i] < df["low"].iloc[i + j] for j in range(1, pivot_bars + 1)):
            lows.append({"index": i, "price": df["low"].iloc[i], "time": df["time"].iloc[i]})
    return {"highs": highs, "lows": lows}


def _calc_atr(df: pd.DataFrame, period: int) -> pd.Series:
    """Tính ATR."""
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def _is_ranging(df_h4: pd.DataFrame, swing_highs: list, swing_lows: list) -> bool:
    """Kiểm tra thị trường có đang ranging không."""
    atr = _calc_atr(df_h4, config.RANGING_ATR_PERIOD)
    atr_ma = atr.rolling(config.RANGING_ATR_MA).mean()
    last_atr = atr.iloc[-1]
    last_ma = atr_ma.iloc[-1]
    if pd.isna(last_atr) or pd.isna(last_ma):
        return False
    atr_condition = last_atr < config.RANGING_ATR_MULT * last_ma

    # Kiểm tra BOS trong RANGING_BOS_LOOKBACK nến gần nhất
    lookback = config.RANGING_BOS_LOOKBACK
    recent = df_h4.iloc[-lookback:]
    has_bos = False
    if swing_highs:
        last_sh = swing_highs[-1]["price"]
        if recent["close"].max() > last_sh:
            has_bos = True
    if swing_lows:
        last_sl = swing_lows[-1]["price"]
        if recent["close"].min() < last_sl:
            has_bos = True

    return atr_condition and not has_bos


def _determine_bias(swings: dict, count: int) -> str:
    """Xác định bias từ swing highs/lows."""
    highs = [s["price"] for s in swings["highs"][-count:]]
    lows = [s["price"] for s in swings["lows"][-count:]]
    if len(highs) < count or len(lows) < count:
        return "ranging"
    up_highs = all(highs[i] < highs[i + 1] for i in range(len(highs) - 1))
    up_lows = all(lows[i] < lows[i + 1] for i in range(len(lows) - 1))
    dn_highs = all(highs[i] > highs[i + 1] for i in range(len(highs) - 1))
    dn_lows = all(lows[i] > lows[i + 1] for i in range(len(lows) - 1))
    if up_highs and up_lows:
        return "bullish"
    if dn_highs and dn_lows:
        return "bearish"
    return "ranging"


def get_market_bias(df_d1: pd.DataFrame, df_h4: pd.DataFrame) -> dict:
    """Xác định xu hướng thị trường từ D1 và H4."""
    swings_d1 = find_swing_points(df_d1, config.SWING_PIVOT_D1)
    swings_h4 = find_swing_points(df_h4, config.SWING_PIVOT_H4)

    ranging = _is_ranging(df_h4, swings_h4["highs"], swings_h4["lows"])

    d1_bias = _determine_bias(swings_d1, config.SWING_COUNT)
    h4_bias = "ranging" if ranging else _determine_bias(swings_h4, config.SWING_COUNT)

    if d1_bias == h4_bias and d1_bias != "ranging":
        bias = d1_bias
        confidence = "high"
    elif d1_bias != "ranging" and h4_bias == "ranging":
        bias = d1_bias
        confidence = "medium"
    elif h4_bias != "ranging" and d1_bias == "ranging":
        bias = h4_bias
        confidence = "medium"
    else:
        bias = "ranging"
        confidence = "low"

    last_sh_d1 = swings_d1["highs"][-1]["price"] if swings_d1["highs"] else None
    last_sl_d1 = swings_d1["lows"][-1]["price"] if swings_d1["lows"] else None
    last_sh_h4 = swings_h4["highs"][-1]["price"] if swings_h4["highs"] else None
    last_sl_h4 = swings_h4["lows"][-1]["price"] if swings_h4["lows"] else None

    return {
        "bias": bias,
        "d1_bias": d1_bias,
        "h4_bias": h4_bias,
        "confidence": confidence,
        "is_ranging": ranging,
        "last_sh_d1": last_sh_d1,
        "last_sl_d1": last_sl_d1,
        "last_sh_h4": last_sh_h4,
        "last_sl_h4": last_sl_h4,
        "swing_highs_h4": swings_h4["highs"],
        "swing_lows_h4": swings_h4["lows"],
    }


def calculate_fibonacci(swing_high: float, swing_low: float, direction: str) -> dict:
    """Tính các mức Fibonacci retracement và extension."""
    rng = swing_high - swing_low
    levels: dict = {}
    if direction == "bullish":
        for lvl in [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1.0]:
            levels[str(lvl)] = swing_high - lvl * rng
        extensions = {str(e): swing_low - (e - 1.0) * rng for e in config.FIB_EXTENSIONS}
    else:  # bearish
        for lvl in [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1.0]:
            levels[str(lvl)] = swing_low + lvl * rng
        extensions = {str(e): swing_high + (e - 1.0) * rng for e in config.FIB_EXTENSIONS}

    return {
        "swing_high": swing_high,
        "swing_low": swing_low,
        "direction": direction,
        "levels": levels,
        "extensions": extensions,
        "equilibrium": levels["0.5"],
    }


def get_fib_confluence_zones(
    fib_sets: list, current_price: float, bias: str
) -> list:
    """Tìm vùng confluence từ nhiều bộ Fibo."""
    # Thu thập tất cả mức giá từ các bộ fibo
    all_levels: list = []
    for idx, fib in enumerate(fib_sets):
        for lvl_name, price in fib["levels"].items():
            all_levels.append({"price": price, "level": lvl_name, "fib_idx": idx})

    confluence_zones: list = []
    used: set = set()
    pip = 0.010  # 1 pip = 0.010 cho Gold

    for i, ref in enumerate(all_levels):
        if i in used:
            continue
        cluster = [ref]
        for j, other in enumerate(all_levels):
            if j <= i or j in used:
                continue
            if other["fib_idx"] == ref["fib_idx"]:
                continue
            if abs(ref["price"] - other["price"]) <= config.FIB_CONFLUENCE_PIPS * pip:
                cluster.append(other)
        if len(cluster) >= 2:
            prices = [c["price"] for c in cluster]
            mid = sum(prices) / len(prices)
            # Lọc theo bias
            if bias == "bullish" and mid >= current_price:
                continue
            if bias == "bearish" and mid <= current_price:
                continue
            for c in cluster:
                used.add(all_levels.index(c))
            confluence_zones.append({
                "price_top": max(prices),
                "price_bottom": min(prices),
                "mid": mid,
                "score": len(cluster),
                "levels": [c["level"] for c in cluster],
                "bias": bias,
            })

    return sorted(confluence_zones, key=lambda z: z["score"], reverse=True)


def get_price_zone(current_price: float, swing_high: float, swing_low: float) -> dict:
    """Xác định vùng Premium/Discount/Equilibrium."""
    rng = swing_high - swing_low
    if rng == 0:
        return {"zone": "equilibrium", "retracement": 0.5, "eq_level": (swing_high + swing_low) / 2}
    retracement = (swing_high - current_price) / rng
    eq = swing_low + 0.5 * rng
    if abs(retracement - 0.5) <= 0.05:
        zone = "equilibrium"
    elif retracement > 0.5:
        zone = "discount"
    else:
        zone = "premium"
    return {"zone": zone, "retracement": retracement, "eq_level": eq}


def get_h4_fib_sets(
    df_h4: pd.DataFrame, bias: str, swing_highs: list, swing_lows: list
) -> list:
    """Tạo tối đa 3 bộ Fibo từ swing H4."""
    if not swing_highs or not swing_lows:
        return []
    fib_sets = []
    pairs: list = []
    if bias == "bullish":
        # Cặp 1: swing gần nhất
        if len(swing_lows) >= 1 and len(swing_highs) >= 1:
            pairs.append((swing_highs[-1]["price"], swing_lows[-1]["price"]))
        # Cặp 2: swing lớn nhất
        max_h = max(swing_highs, key=lambda s: s["price"])
        min_l = min(swing_lows, key=lambda s: s["price"])
        if (max_h["price"], min_l["price"]) not in pairs:
            pairs.append((max_h["price"], min_l["price"]))
        # Cặp 3: swing gần nhì
        if len(swing_lows) >= 2:
            p3 = (swing_highs[-1]["price"], swing_lows[-2]["price"])
            if p3 not in pairs:
                pairs.append(p3)
    else:  # bearish
        if len(swing_highs) >= 1 and len(swing_lows) >= 1:
            pairs.append((swing_highs[-1]["price"], swing_lows[-1]["price"]))
        max_h = max(swing_highs, key=lambda s: s["price"])
        min_l = min(swing_lows, key=lambda s: s["price"])
        if (max_h["price"], min_l["price"]) not in pairs:
            pairs.append((max_h["price"], min_l["price"]))
        if len(swing_highs) >= 2:
            p3 = (swing_highs[-2]["price"], swing_lows[-1]["price"])
            if p3 not in pairs:
                pairs.append(p3)

    for sh, sl in pairs[:config.FIB_MAX_SETS_H4]:
        if sh > sl:
            fib_sets.append(calculate_fibonacci(sh, sl, bias))
    return fib_sets


def analyze_market_structure(
    df_d1: pd.DataFrame, df_h4: pd.DataFrame, current_price: float
) -> dict:
    """Hàm tổng hợp phân tích cấu trúc thị trường."""
    bias_data = get_market_bias(df_d1, df_h4)

    can_trade = False
    trade_direction: Optional[str] = None

    if bias_data["is_ranging"] or bias_data["bias"] == "ranging":
        return {
            "bias_data": bias_data,
            "fib_d1": {},
            "fib_sets_h4": [],
            "confluence_zones": [],
            "price_zone": {},
            "can_trade": False,
            "trade_direction": None,
        }

    # D1 Fibo
    sh_d1 = bias_data["last_sh_d1"]
    sl_d1 = bias_data["last_sl_d1"]
    fib_d1 = calculate_fibonacci(sh_d1, sl_d1, bias_data["bias"]) if sh_d1 and sl_d1 else {}

    # H4 Fibo sets
    fib_sets_h4 = get_h4_fib_sets(
        df_h4, bias_data["bias"],
        bias_data["swing_highs_h4"],
        bias_data["swing_lows_h4"],
    )

    # Confluence zones
    confluence_zones = get_fib_confluence_zones(fib_sets_h4, current_price, bias_data["bias"]) if fib_sets_h4 else []

    # Price zone
    price_zone = get_price_zone(current_price, sh_d1, sl_d1) if sh_d1 and sl_d1 else {}

    # Quyết định trade
    # Cho phép trade khi giá ở discount/equilibrium (buy) hoặc premium/equilibrium (sell)
    if bias_data["confidence"] in ("high", "medium"):
        zone = price_zone.get("zone", "")
        if bias_data["bias"] == "bullish" and zone in ("discount", "equilibrium"):
            can_trade = True
            trade_direction = "buy"
        elif bias_data["bias"] == "bearish" and zone in ("premium", "equilibrium"):
            can_trade = True
            trade_direction = "sell"

    return {
        "bias_data": bias_data,
        "fib_d1": fib_d1,
        "fib_sets_h4": fib_sets_h4,
        "confluence_zones": confluence_zones,
        "price_zone": price_zone,
        "can_trade": can_trade,
        "trade_direction": trade_direction,
    }
