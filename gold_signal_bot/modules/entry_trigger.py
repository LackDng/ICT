"""
entry_trigger.py — Xác nhận điểm entry trên M15 và tính confluence score.
"""
import logging
from typing import Optional

import pandas as pd

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)

PIP = 0.010


def detect_candle_pattern(df: pd.DataFrame, index: int = -1) -> dict:
    """Nhận diện mô hình nến tại vị trí index."""
    if abs(index) > len(df):
        return {"pattern": "none", "direction": "none", "strength": 0.0, "score_add": 0}

    c = df.iloc[index]
    prev = df.iloc[index - 1] if len(df) > 1 else None

    rng = c["high"] - c["low"]
    if rng == 0:
        return {"pattern": "none", "direction": "none", "strength": 0.0, "score_add": 0}

    body = abs(c["body"])
    body_ratio = c["body_ratio"]
    upper_shadow = c["high"] - max(c["open"], c["close"])
    lower_shadow = min(c["open"], c["close"]) - c["low"]

    # Pinbar Bullish
    if (lower_shadow >= config.CONFIRM_PINBAR_SHADOW * body and
            upper_shadow < 0.3 * rng and
            body_ratio >= config.CONFIRM_BODY_MIN):
        strength = min(lower_shadow / (body + 1e-9) / config.CONFIRM_PINBAR_SHADOW, 1.0)
        return {"pattern": "pinbar", "direction": "bullish", "strength": strength, "score_add": 2}

    # Pinbar Bearish
    if (upper_shadow >= config.CONFIRM_PINBAR_SHADOW * body and
            lower_shadow < 0.3 * rng and
            body_ratio >= config.CONFIRM_BODY_MIN):
        strength = min(upper_shadow / (body + 1e-9) / config.CONFIRM_PINBAR_SHADOW, 1.0)
        return {"pattern": "pinbar", "direction": "bearish", "strength": strength, "score_add": 2}

    # Engulfing
    if prev is not None:
        prev_body_top = max(prev["open"], prev["close"])
        prev_body_bot = min(prev["open"], prev["close"])
        cur_body_top = max(c["open"], c["close"])
        cur_body_bot = min(c["open"], c["close"])
        if (c["is_bullish"] and cur_body_top > prev_body_top and cur_body_bot < prev_body_bot
                and body_ratio >= config.CONFIRM_BODY_MIN):
            return {"pattern": "engulfing", "direction": "bullish", "strength": body_ratio, "score_add": 2}
        if (not c["is_bullish"] and cur_body_top > prev_body_top and cur_body_bot < prev_body_bot
                and body_ratio >= config.CONFIRM_BODY_MIN):
            return {"pattern": "engulfing", "direction": "bearish", "strength": body_ratio, "score_add": 2}

    # Strong Close
    if body_ratio >= config.CONFIRM_BODY_MIN:
        close_pos = (c["close"] - c["low"]) / rng
        if c["is_bullish"] and close_pos >= config.CONFIRM_STRONG_CLOSE:
            return {"pattern": "strong_close", "direction": "bullish", "strength": close_pos, "score_add": 1}
        if not c["is_bullish"] and close_pos <= (1 - config.CONFIRM_STRONG_CLOSE):
            return {"pattern": "strong_close", "direction": "bearish", "strength": 1 - close_pos, "score_add": 1}

    return {"pattern": "none", "direction": "none", "strength": 0.0, "score_add": 0}


def detect_liquidity_sweep(df: pd.DataFrame, lookback: int = 10) -> dict:
    """Phát hiện Liquidity Sweep hợp lệ — yêu cầu đủ 5 điều kiện."""
    missing: list = []
    if len(df) < lookback + 3:
        return {
            "detected": False,
            "valid": False,
            "direction": None,
            "swept_level": None,
            "spike_pips": 0.0,
            "candle_index": None,
            "missing_conditions": ["Không đủ dữ liệu"],
        }

    recent = df.iloc[-lookback:]
    local_high = recent["high"].max()
    local_low = recent["low"].min()

    # Lấy nến trong SWEEP_VALID_CANDLES
    sweep_window = df.iloc[-config.SWEEP_VALID_CANDLES:]
    vol_ma = df["tick_volume"].iloc[-10:].mean()

    result_base = {
        "detected": False,
        "valid": False,
        "direction": None,
        "swept_level": None,
        "spike_pips": 0.0,
        "candle_index": None,
        "missing_conditions": [],
    }

    for i in range(len(sweep_window)):
        c = sweep_window.iloc[i]
        abs_idx = len(df) - config.SWEEP_VALID_CANDLES + i

        # Bullish sweep: spike xuống rồi close lên
        if c["low"] < local_low:
            spike_pips = (local_low - c["low"]) / PIP
            conds_missing = []
            if spike_pips < config.SWEEP_MIN_PIPS:
                conds_missing.append("Spike < 10 pips")
            if c["body_ratio"] < config.SWEEP_BODY_MIN:
                conds_missing.append("Body ratio < 60%")
            # Nến xác nhận
            if abs_idx + 1 < len(df):
                conf_candle = df.iloc[abs_idx + 1]
                if not conf_candle["is_bullish"] or conf_candle["body_ratio"] < 0.4:
                    conds_missing.append("Nến xác nhận yếu")
            else:
                conds_missing.append("Thiếu nến xác nhận")
            if c["tick_volume"] < config.SWEEP_VOLUME_MULT * vol_ma:
                conds_missing.append("Volume không đủ")
            if not c["is_bullish"]:
                conds_missing.append("Nến không đóng ngược chiều")

            result_base.update({
                "detected": True,
                "direction": "bullish",
                "swept_level": local_low,
                "spike_pips": spike_pips,
                "candle_index": abs_idx,
                "missing_conditions": conds_missing,
                "valid": len(conds_missing) == 0,
            })
            return result_base

        # Bearish sweep: spike lên rồi close xuống
        if c["high"] > local_high:
            spike_pips = (c["high"] - local_high) / PIP
            conds_missing = []
            if spike_pips < config.SWEEP_MIN_PIPS:
                conds_missing.append("Spike < 10 pips")
            if c["body_ratio"] < config.SWEEP_BODY_MIN:
                conds_missing.append("Body ratio < 60%")
            if abs_idx + 1 < len(df):
                conf_candle = df.iloc[abs_idx + 1]
                if conf_candle["is_bullish"] or conf_candle["body_ratio"] < 0.4:
                    conds_missing.append("Nến xác nhận yếu")
            else:
                conds_missing.append("Thiếu nến xác nhận")
            if c["tick_volume"] < config.SWEEP_VOLUME_MULT * vol_ma:
                conds_missing.append("Volume không đủ")
            if c["is_bullish"]:
                conds_missing.append("Nến không đóng ngược chiều")

            result_base.update({
                "detected": True,
                "direction": "bearish",
                "swept_level": local_high,
                "spike_pips": spike_pips,
                "candle_index": abs_idx,
                "missing_conditions": conds_missing,
                "valid": len(conds_missing) == 0,
            })
            return result_base

    return result_base


def check_fib_confluence(
    current_price: float,
    confluence_zones: list,
    tolerance_pips: float = 15.0,
) -> dict:
    """Kiểm tra giá có trong confluence Fibo zone không."""
    tolerance = tolerance_pips * PIP
    for zone in confluence_zones:
        if (zone["price_bottom"] - tolerance) <= current_price <= (zone["price_top"] + tolerance):
            dist = abs(current_price - zone["mid"])
            nearest = min(zone["levels"], key=lambda l: abs(float(l) - 0.5))
            return {
                "in_zone": True,
                "zone": zone,
                "distance_pips": dist / PIP,
                "nearest_level": nearest,
            }
    return {"in_zone": False, "zone": None, "distance_pips": 999.0, "nearest_level": ""}


def check_candle_in_zone(current_price: float, active_zones: list) -> dict:
    """Kiểm tra nến M15 có trong vùng OB/FVG không."""
    for zone in active_zones:
        if "zone_top" in zone:
            top, bot = zone["zone_top"], zone["zone_bottom"]
            zone_type = "confluence"
        elif "top" in zone and "bottom" in zone:
            top, bot = zone["top"], zone["bottom"]
            zone_type = "ob" if "score" in zone else "fvg"
        else:
            continue
        if bot <= current_price <= top:
            return {"in_zone": True, "zone": zone, "zone_type": zone_type}
    return {"in_zone": False, "zone": None, "zone_type": None}


def check_volume_confirmation(df: pd.DataFrame, index: int = -1, ma_period: int = 10) -> dict:
    """Kiểm tra volume xác nhận."""
    vol = df["tick_volume"].iloc[index]
    avg_vol = df["tick_volume"].iloc[-ma_period - 1:-1].mean()
    ratio = vol / avg_vol if avg_vol > 0 else 0.0
    return {
        "confirmed": ratio >= config.SWEEP_VOLUME_MULT,
        "current_vol": float(vol),
        "avg_vol": float(avg_vol),
        "ratio": round(ratio, 2),
    }


def calculate_confluence_score(
    bias_data: dict,
    zone_check: dict,
    candle_pattern: dict,
    sweep_data: dict,
    fib_check: dict,
    choch_data: dict,
    volume_check: dict,
) -> dict:
    """Tính tổng điểm confluence."""
    breakdown: dict = {}

    # ── Nhóm A ──────────────────────────────────────────────────────────────────
    group_a = 0
    conf = bias_data.get("confidence", "low")
    if conf == "high":
        pts = config.SCORE_BIAS
    elif conf == "medium":
        pts = 2
    else:
        pts = 0
    group_a += pts
    breakdown["bias"] = pts

    zone_type = zone_check.get("zone_type")
    if zone_type == "confluence":
        pts = config.SCORE_OB_FVG
    elif zone_type in ("ob", "fvg"):
        pts = 2
    else:
        pts = 0
    group_a += pts
    breakdown["ob_fvg"] = pts

    pts = candle_pattern.get("score_add", 0)
    group_a += pts
    breakdown["candle"] = pts

    # ── Nhóm B ──────────────────────────────────────────────────────────────────
    group_b = 0

    pts = config.SCORE_SWEEP if sweep_data.get("valid") else 0
    group_b += pts
    breakdown["sweep"] = pts

    pts = config.SCORE_FIB if fib_check.get("in_zone") else 0
    group_b += pts
    breakdown["fib"] = pts

    pts = config.SCORE_CHOCH if choch_data.get("has_choch") else 0
    group_b += pts
    breakdown["choch"] = pts

    pts = config.SCORE_VOLUME if volume_check.get("confirmed") else 0
    group_b += pts
    breakdown["volume"] = pts

    total = group_a + group_b
    signal_valid = (
        group_a >= config.SCORE_MIN_GROUP_A
        and group_b >= config.SCORE_MIN_GROUP_B
        and total >= config.SCORE_MIN_TOTAL
    )

    return {
        "group_a": group_a,
        "group_b": group_b,
        "total": total,
        "max_total": 14,
        "signal_valid": signal_valid,
        "breakdown": breakdown,
    }


def check_entry_signal(
    df_m15: pd.DataFrame,
    market_data: dict,
    smc_data: dict,
    current_price: float,
) -> dict:
    """Hàm tổng hợp kiểm tra điều kiện entry trên M15."""
    reject_reasons: list = []
    reasons: list = []

    if not market_data.get("can_trade"):
        return {
            "signal": False,
            "direction": None,
            "entry_price": current_price,
            "score_data": {},
            "active_zone": None,
            "candle_pattern": {},
            "sweep_data": {},
            "fib_check": {},
            "volume_check": {},
            "has_choch_warning": False,
            "reasons": [],
            "reject_reasons": ["can_trade = False"],
        }

    trade_direction = market_data.get("trade_direction")
    bias_data = market_data.get("bias_data", {})

    # 1. CHoCH warning
    has_choch_warning = smc_data.get("has_choch", False)
    if has_choch_warning:
        logger.warning("CHoCH H1 phát hiện — cẩn thận hơn khi entry")

    # 2. Nến M15 trong zone
    active_zones = smc_data.get("active_zones", [])
    zone_check = check_candle_in_zone(current_price, active_zones)
    if not zone_check["in_zone"]:
        reject_reasons.append("Giá không trong vùng OB/FVG")

    # 3. Pattern nến M15
    candle_pattern = detect_candle_pattern(df_m15)
    if candle_pattern["direction"] != trade_direction and candle_pattern["pattern"] != "none":
        reject_reasons.append(f"Pattern {candle_pattern['pattern']} không đúng hướng")
    elif candle_pattern["pattern"] != "none" and candle_pattern["direction"] == trade_direction:
        reasons.append(f"Mô hình {candle_pattern['pattern']} {trade_direction}")

    # 4. Sweep
    sweep_data = detect_liquidity_sweep(df_m15)

    # 5. Fibo confluence
    fib_check = check_fib_confluence(current_price, market_data.get("confluence_zones", []))
    if fib_check["in_zone"]:
        reasons.append(f"Trong vùng Fibo confluence")

    # 6. Volume
    volume_check = check_volume_confirmation(df_m15)
    if volume_check["confirmed"]:
        reasons.append(f"Volume xác nhận {volume_check['ratio']}x MA")

    # 7. Score
    score_data = calculate_confluence_score(
        bias_data=bias_data,
        zone_check=zone_check,
        candle_pattern=candle_pattern,
        sweep_data=sweep_data,
        fib_check=fib_check,
        choch_data={"has_choch": has_choch_warning},
        volume_check=volume_check,
    )

    signal = score_data["signal_valid"] and zone_check["in_zone"] and candle_pattern["pattern"] != "none"
    if not score_data["signal_valid"]:
        reject_reasons.append(
            f"Score không đủ: A={score_data['group_a']}/{config.SCORE_MIN_GROUP_A} "
            f"B={score_data['group_b']}/{config.SCORE_MIN_GROUP_B} "
            f"Total={score_data['total']}/{config.SCORE_MIN_TOTAL}"
        )

    if signal:
        reasons.insert(0, f"D1+H4 bias: {bias_data.get('bias')} ({bias_data.get('confidence')})")
        reasons.insert(1, f"Score tổng: {score_data['total']}/14")

    return {
        "signal": signal,
        "direction": trade_direction if signal else None,
        "entry_price": current_price,
        "score_data": score_data,
        "active_zone": zone_check.get("zone"),
        "candle_pattern": candle_pattern,
        "sweep_data": sweep_data,
        "fib_check": fib_check,
        "volume_check": volume_check,
        "has_choch_warning": has_choch_warning,
        "reasons": reasons,
        "reject_reasons": reject_reasons,
    }
