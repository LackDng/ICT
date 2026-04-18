"""
smc_analyzer.py — Phân tích SMC (Smart Money Concepts) trên H1.
Tìm Order Block, FVG, BOS, CHoCH.
"""
import logging
from typing import Optional

import pandas as pd

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)

PIP = 0.010  # 1 pip = 0.010 cho Gold


def _find_h1_swings(df: pd.DataFrame, pivot: int = 3) -> dict:
    """Tìm swing points nội tại trên H1 (pivot nhỏ hơn H4)."""
    highs, lows = [], []
    n = len(df)
    for i in range(pivot, n - pivot):
        if all(df["high"].iloc[i] >= df["high"].iloc[i - j] for j in range(1, pivot + 1)) and \
           all(df["high"].iloc[i] >= df["high"].iloc[i + j] for j in range(1, pivot + 1)):
            highs.append({"index": i, "price": df["high"].iloc[i], "time": df["time"].iloc[i]})
        if all(df["low"].iloc[i] <= df["low"].iloc[i - j] for j in range(1, pivot + 1)) and \
           all(df["low"].iloc[i] <= df["low"].iloc[i + j] for j in range(1, pivot + 1)):
            lows.append({"index": i, "price": df["low"].iloc[i], "time": df["time"].iloc[i]})
    return {"highs": highs, "lows": lows}


def detect_bos_choch(
    df: pd.DataFrame,
    swing_highs: list,
    swing_lows: list,
    bias: str,
) -> list:
    """Phát hiện BOS và CHoCH trong 50 nến gần nhất của H1.
    Dùng kết hợp H4 swing points và H1 swing points nội tại.
    """
    # Gộp H4 swings với H1 swings nội tại (chỉ lấy H1 swing trong 100 nến gần nhất)
    h1_swings = _find_h1_swings(df.iloc[-100:] if len(df) > 100 else df)
    combined_highs = swing_highs + h1_swings["highs"]
    combined_lows = swing_lows + h1_swings["lows"]

    result = []
    lookback = min(50, len(df))
    recent_df = df.iloc[-lookback:].reset_index(drop=True)
    n = len(recent_df)

    for i in range(1, n):
        close = recent_df["close"].iloc[i]
        time = recent_df["time"].iloc[i]
        is_recent = i >= n - 10

        # BOS Bullish: close vượt swing high
        for sh in combined_highs:
            if close > sh["price"]:
                result.append({
                    "type": "BOS",
                    "direction": "bullish",
                    "broken_level": sh["price"],
                    "candle_index": i,
                    "time": time,
                    "is_recent": is_recent,
                })
                break

        # BOS Bearish: close phá swing low
        for sl in combined_lows:
            if close < sl["price"]:
                result.append({
                    "type": "BOS",
                    "direction": "bearish",
                    "broken_level": sl["price"],
                    "candle_index": i,
                    "time": time,
                    "is_recent": is_recent,
                })
                break

        # CHoCH
        if bias == "bullish":
            for sl in combined_lows:
                if close < sl["price"]:
                    result.append({
                        "type": "CHoCH",
                        "direction": "bearish",
                        "broken_level": sl["price"],
                        "candle_index": i,
                        "time": time,
                        "is_recent": is_recent,
                    })
                    break
        elif bias == "bearish":
            for sh in combined_highs:
                if close > sh["price"]:
                    result.append({
                        "type": "CHoCH",
                        "direction": "bullish",
                        "broken_level": sh["price"],
                        "candle_index": i,
                        "time": time,
                        "is_recent": is_recent,
                    })
                    break

    # Loại bỏ trùng lặp cùng type/level
    seen: set = set()
    unique = []
    for r in result:
        key = (r["type"], r["direction"], round(r["broken_level"], 2))
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def _calc_fill_ratio(top: float, bottom: float, current_high: float, current_low: float) -> float:
    """Tính phần trăm FVG/OB đã bị fill."""
    zone_size = top - bottom
    if zone_size <= 0:
        return 1.0
    filled = max(0.0, min(current_high, top) - max(current_low, bottom))
    return filled / zone_size


def find_fvg(df: pd.DataFrame, bias: str) -> list:
    """Phát hiện Fair Value Gap trên H1."""
    result = []
    n = len(df)
    current_price = df["close"].iloc[-1]

    for i in range(n - 2):
        c0 = df.iloc[i]
        c2 = df.iloc[i + 2]

        # Bullish FVG: low[i+2] > high[i]
        if c2["low"] > c0["high"] and bias == "bullish":
            top = c2["low"]
            bottom = c0["high"]
            size_pips = (top - bottom) / PIP
            if size_pips < config.FVG_MIN_PIPS:
                continue
            age = n - 1 - (i + 2)
            if age > config.FVG_MAX_AGE_CANDLES:
                continue
            fill_ratio = _calc_fill_ratio(top, bottom, df["high"].iloc[i + 2:].max(), df["low"].iloc[i + 2:].min())
            if fill_ratio > config.FVG_FILL_WEAK:
                continue
            status = "active" if fill_ratio <= config.FVG_FILL_PARTIAL else "weakened"
            result.append({
                "type": "bullish",
                "top": top,
                "bottom": bottom,
                "mid": (top + bottom) / 2,
                "size_pips": size_pips,
                "time": df["time"].iloc[i],
                "age_candles": age,
                "fill_ratio": fill_ratio,
                "status": status,
                "score_adj": -1 if status == "weakened" else 0,
            })

        # Bearish FVG: high[i+2] < low[i]
        elif c2["high"] < c0["low"] and bias == "bearish":
            top = c0["low"]
            bottom = c2["high"]
            size_pips = (top - bottom) / PIP
            if size_pips < config.FVG_MIN_PIPS:
                continue
            age = n - 1 - (i + 2)
            if age > config.FVG_MAX_AGE_CANDLES:
                continue
            fill_ratio = _calc_fill_ratio(top, bottom, df["high"].iloc[i + 2:].max(), df["low"].iloc[i + 2:].min())
            if fill_ratio > config.FVG_FILL_WEAK:
                continue
            status = "active" if fill_ratio <= config.FVG_FILL_PARTIAL else "weakened"
            result.append({
                "type": "bearish",
                "top": top,
                "bottom": bottom,
                "mid": (top + bottom) / 2,
                "size_pips": size_pips,
                "time": df["time"].iloc[i],
                "age_candles": age,
                "fill_ratio": fill_ratio,
                "status": status,
                "score_adj": -1 if status == "weakened" else 0,
            })

    return result


def _find_ob_candidates(df: pd.DataFrame, bias: str) -> list:
    """Fallback: tìm OB trực tiếp từ H1 swing points khi không có BOS.
    Tìm nến mạnh ngược chiều trước một move lớn cùng chiều bias.
    """
    candidates = []
    n = len(df)
    lookback = min(config.OB_MAX_AGE_CANDLES, n - 3)
    for i in range(n - lookback, n - 2):
        candle = df.iloc[i]
        next1 = df.iloc[i + 1]
        next2 = df.iloc[i + 2] if i + 2 < n else None

        if bias == "bullish":
            # Nến bearish mạnh, tiếp theo là 2 nến bullish mạnh
            if (not candle["is_bullish"] and candle["body_ratio"] >= config.OB_MIN_BODY_RATIO
                    and next1["is_bullish"] and next1["body_ratio"] >= 0.5):
                age = n - 1 - i
                candidates.append({"index": i, "age": age, "candle": candle})
        else:
            # Nến bullish mạnh, tiếp theo là 2 nến bearish mạnh
            if (candle["is_bullish"] and candle["body_ratio"] >= config.OB_MIN_BODY_RATIO
                    and not next1["is_bullish"] and next1["body_ratio"] >= 0.5):
                age = n - 1 - i
                candidates.append({"index": i, "age": age, "candle": candle})
    return candidates


def find_order_blocks(df: pd.DataFrame, bos_list: list, bias: str) -> list:
    """Phát hiện Order Block trên H1.
    Dùng BOS-based OB trước, fallback sang H1 swing-based OB nếu không tìm được.
    """
    result = []
    n = len(df)
    fvg_list = find_fvg(df, bias)

    # Tập hợp ob_idx đã dùng để tránh trùng lặp
    used_indices: set = set()

    for bos in bos_list:
        if bos["direction"] != bias:
            continue
        bos_idx = bos["candle_index"]
        if bos_idx < 1:
            continue

        # Tìm nến OB ngay trước BOS (tìm lùi tối đa 3 nến)
        ob_idx = None
        for back in range(1, 4):
            candidate_idx = bos_idx - back
            if candidate_idx < 0:
                break
            cand = df.iloc[candidate_idx]
            if bias == "bullish" and not cand["is_bullish"] and cand["body_ratio"] >= config.OB_MIN_BODY_RATIO:
                ob_idx = candidate_idx
                break
            if bias == "bearish" and cand["is_bullish"] and cand["body_ratio"] >= config.OB_MIN_BODY_RATIO:
                ob_idx = candidate_idx
                break
        if ob_idx is None:
            ob_idx = bos_idx - 1
        candle = df.iloc[ob_idx]
        used_indices.add(ob_idx)
        age = n - 1 - ob_idx
        candle = df.iloc[ob_idx]
        age = n - 1 - ob_idx
        if age > config.OB_MAX_AGE_CANDLES:
            continue

        if bias == "bullish":
            is_ob = not candle["is_bullish"] and candle["body_ratio"] >= config.OB_MIN_BODY_RATIO
        else:
            is_ob = candle["is_bullish"] and candle["body_ratio"] >= config.OB_MIN_BODY_RATIO

        if not is_ob:
            continue

        top = candle["high"]
        bottom = candle["low"]

        # Kiểm tra mitigation
        subsequent = df.iloc[ob_idx + 1:]
        if len(subsequent) > 0:
            if bias == "bullish":
                deepest_low = subsequent["low"].min()
                fill_ratio = _calc_fill_ratio(top, bottom, subsequent["high"].max(), deepest_low)
            else:
                highest_high = subsequent["high"].max()
                fill_ratio = _calc_fill_ratio(top, bottom, highest_high, subsequent["low"].min())
        else:
            fill_ratio = 0.0

        if fill_ratio > 0.8:
            continue
        status = "active" if fill_ratio <= 0.5 else "weakened"
        score_adj = -1 if status == "weakened" else 0

        # Kiểm tra có FVG gần OB không (Premium OB)
        has_fvg = False
        for fvg in fvg_list:
            fvg_time = fvg["time"]
            ob_time = candle["time"]
            if fvg_time >= ob_time:
                gap_pips = abs(fvg["bottom"] - top) / PIP if bias == "bullish" else abs(fvg["top"] - bottom) / PIP
                if gap_pips <= config.OB_FVG_MAX_GAP:
                    has_fvg = True
                    break

        score = 2 if has_fvg else 1

        result.append({
            "type": bias,
            "top": top,
            "bottom": bottom,
            "mid": (top + bottom) / 2,
            "score": score,
            "has_fvg": has_fvg,
            "status": status,
            "score_adj": score_adj,
            "time": candle["time"],
            "age_candles": age,
            "bos_ref": bos,
        })

    # Fallback: nếu không có BOS-based OB, dùng H1 swing-based OB
    if not result:
        for cand in _find_ob_candidates(df, bias):
            idx = cand["index"]
            if idx in used_indices:
                continue
            candle = cand["candle"]
            age = cand["age"]
            top = candle["high"]
            bottom = candle["low"]
            subsequent = df.iloc[idx + 1:]
            if len(subsequent) > 0:
                if bias == "bullish":
                    fill_ratio = _calc_fill_ratio(top, bottom, subsequent["high"].max(), subsequent["low"].min())
                else:
                    fill_ratio = _calc_fill_ratio(top, bottom, subsequent["high"].max(), subsequent["low"].min())
            else:
                fill_ratio = 0.0
            if fill_ratio > 0.8:
                continue
            status = "active" if fill_ratio <= 0.5 else "weakened"
            score_adj = -1 if status == "weakened" else 0
            has_fvg = any(
                fvg["time"] >= candle["time"] and
                abs(fvg.get("bottom", fvg.get("mid", 0)) - top) / PIP <= config.OB_FVG_MAX_GAP
                for fvg in fvg_list
            )
            score = 2 if has_fvg else 1
            result.append({
                "type": bias,
                "top": top,
                "bottom": bottom,
                "mid": (top + bottom) / 2,
                "score": score,
                "has_fvg": has_fvg,
                "status": status,
                "score_adj": score_adj,
                "time": candle["time"],
                "age_candles": age,
                "bos_ref": None,
            })

    # Sắp xếp theo score giảm dần, lấy tốt nhất 5
    result = sorted(result, key=lambda x: x["score"] + x["score_adj"], reverse=True)[:5]
    return result


def check_ob_fvg_confluence(ob_list: list, fvg_list: list) -> list:
    """Tìm vùng OB + FVG confluence."""
    zones = []
    for ob in ob_list:
        for fvg in fvg_list:
            if ob["type"] != fvg["type"]:
                continue
            # Overlap hoặc gần nhau < OB_FVG_MAX_GAP
            ob_top, ob_bot = ob["top"], ob["bottom"]
            fvg_top, fvg_bot = fvg["top"], fvg["bottom"]
            overlap = min(ob_top, fvg_top) - max(ob_bot, fvg_bot)
            if overlap >= 0:
                zone_top = max(ob_top, fvg_top)
                zone_bot = min(ob_bot, fvg_bot)
            else:
                gap_pips = abs(overlap) / PIP
                if gap_pips > config.OB_FVG_MAX_GAP:
                    continue
                zone_top = max(ob_top, fvg_top)
                zone_bot = min(ob_bot, fvg_bot)
            zones.append({
                "ob": ob,
                "fvg": fvg,
                "zone_top": zone_top,
                "zone_bottom": zone_bot,
                "zone_mid": (zone_top + zone_bot) / 2,
                "total_score": ob["score"] + ob["score_adj"] + fvg["score_adj"] + 3,
            })
    return sorted(zones, key=lambda z: z["total_score"], reverse=True)


def analyze_h1_smc(
    df_h1: pd.DataFrame,
    bias: str,
    swing_highs_h4: list,
    swing_lows_h4: list,
) -> dict:
    """Hàm tổng hợp phân tích SMC trên H1."""
    bos_choch = detect_bos_choch(df_h1, swing_highs_h4, swing_lows_h4, bias)
    fvg_list = find_fvg(df_h1, bias)
    ob_list = find_order_blocks(df_h1, bos_choch, bias)
    confluence = check_ob_fvg_confluence(ob_list, fvg_list)

    active_zones: list = []
    active_zones.extend(confluence)
    for ob in ob_list:
        if not any(z["ob"] == ob for z in confluence):
            active_zones.append(ob)
    for fvg in fvg_list:
        if not any(z["fvg"] == fvg for z in confluence):
            active_zones.append(fvg)

    choch_list = [b for b in bos_choch if b["type"] == "CHoCH"]
    has_choch = len(choch_list) > 0
    choch_direction: Optional[str] = choch_list[-1]["direction"] if has_choch else None

    # best_zone: confluence gần giá nhất, nếu không có → OB score cao nhất
    current_price = df_h1["close"].iloc[-1]
    best_zone: Optional[dict] = None
    if confluence:
        best_zone = min(confluence, key=lambda z: abs(z["zone_mid"] - current_price))
    elif ob_list:
        best_zone = ob_list[0]

    return {
        "bos_choch_list": bos_choch,
        "fvg_list": fvg_list,
        "ob_list": ob_list,
        "confluence_zones": confluence,
        "active_zones": active_zones,
        "has_choch": has_choch,
        "choch_direction": choch_direction,
        "best_zone": best_zone,
    }
