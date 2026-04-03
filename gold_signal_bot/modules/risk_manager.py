"""
risk_manager.py — Tính TP/SL và validate tín hiệu trước khi gửi.
Gold: quote 3 chữ số thập phân, lấy contract size thực từ MT5.
"""
import logging
import random
import string
from datetime import datetime, timezone
from typing import Optional

import MetaTrader5 as mt5

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)

PIP = 0.010
BUFFER_PIPS = 5  # buffer SL ngoài OB


def _pips_to_price(pips: float) -> float:
    return pips * PIP


def calculate_sl(
    direction: str,
    active_zone: dict,
    current_price: float,
    smc_data: dict,
) -> dict:
    """Tính Stop Loss dựa trên vùng OB/FVG."""
    buffer = _pips_to_price(BUFFER_PIPS)
    if "zone_bottom" in active_zone:
        zone_bot = active_zone["zone_bottom"]
        zone_top = active_zone["zone_top"]
    else:
        zone_bot = active_zone.get("bottom", current_price - _pips_to_price(config.SL_MIN_PRICE))
        zone_top = active_zone.get("top", current_price + _pips_to_price(config.SL_MIN_PRICE))

    if direction == "buy":
        sl_price = round(zone_bot - buffer, 3)
        sl_distance = current_price - sl_price
    else:
        sl_price = round(zone_top + buffer, 3)
        sl_distance = sl_price - current_price

    sl_pips = sl_distance / PIP

    # Điều chỉnh nếu quá nhỏ
    if sl_distance < config.SL_MIN_PRICE:
        sl_distance = config.SL_MIN_PRICE
        sl_price = round(current_price - sl_distance if direction == "buy" else current_price + sl_distance, 3)
        sl_pips = sl_distance / PIP

    valid = sl_distance <= config.SL_MAX_PRICE
    reason = "OK" if valid else f"SL {sl_distance:.1f} USD > max {config.SL_MAX_PRICE} USD"

    return {
        "sl_price": sl_price,
        "sl_distance": sl_distance,
        "sl_pips": sl_pips,
        "valid": valid,
        "reason": reason,
    }


def _find_sr_level(
    direction: str,
    entry: float,
    tp_rr: float,
    sl_distance: float,
    smc_data: dict,
    market_data: dict,
    timeframe: str = "h1",
) -> tuple:
    """Tìm SR kỹ thuật gần TP RR nhất."""
    tp_rr_price = entry + sl_distance * tp_rr if direction == "buy" else entry - sl_distance * tp_rr
    tolerance = _pips_to_price(10)

    candidates: list = []
    # Swing points từ market_data
    bias_data = market_data.get("bias_data", {})
    if timeframe == "h1":
        bos_list = smc_data.get("bos_choch_list", [])
        for b in bos_list:
            candidates.append(b["broken_level"])
        for ob in smc_data.get("ob_list", []):
            if direction == "buy":
                candidates.append(ob["top"])
            else:
                candidates.append(ob["bottom"])
    else:
        sh = bias_data.get("last_sh_h4")
        sl = bias_data.get("last_sl_h4")
        if sh:
            candidates.append(sh)
        if sl:
            candidates.append(sl)
        fib_sets = market_data.get("fib_sets_h4", [])
        for fib in fib_sets:
            for ext_price in fib.get("extensions", {}).values():
                candidates.append(ext_price)

    best_sr = None
    best_rr = tp_rr
    for sr in candidates:
        if direction == "buy" and sr <= entry:
            continue
        if direction == "sell" and sr >= entry:
            continue
        dist = abs(sr - tp_rr_price)
        if dist <= tolerance:
            sr_distance = abs(sr - entry)
            rr = sr_distance / sl_distance
            if rr >= 1.5 and rr > best_rr:
                best_sr = sr
                best_rr = rr

    if best_sr:
        return round(best_sr, 3), "sr_level"
    return round(tp_rr_price, 3), "rr_pure"


def calculate_tp(
    direction: str,
    entry: float,
    sl_distance: float,
    smc_data: dict,
    market_data: dict,
) -> dict:
    """Tính Take Profit TP1 (RR 1.8) và TP2 (RR 3.0)."""
    tp1_price, tp1_source = _find_sr_level(direction, entry, config.TP1_RR, sl_distance, smc_data, market_data, "h1")
    tp2_price, tp2_source = _find_sr_level(direction, entry, config.TP2_RR, sl_distance, smc_data, market_data, "h4")

    tp1_dist = abs(tp1_price - entry)
    tp2_dist = abs(tp2_price - entry)
    rr1 = round(tp1_dist / sl_distance, 2)
    rr2 = round(tp2_dist / sl_distance, 2)

    return {
        "tp1_price": tp1_price,
        "tp2_price": tp2_price,
        "tp1_distance": tp1_dist,
        "tp2_distance": tp2_dist,
        "rr1": rr1,
        "rr2": rr2,
        "tp1_source": tp1_source,
        "tp2_source": tp2_source,
    }


def calculate_trailing_sl(entry: float, tp1_price: float, direction: str) -> float:
    """Tính SL mới sau khi TP1 chạm (trailing 80% khoảng TP1)."""
    if direction == "buy":
        return round(entry + (tp1_price - entry) * config.TP1_SL_TRAIL, 3)
    return round(entry - (entry - tp1_price) * config.TP1_SL_TRAIL, 3)


def convert_to_usd(price_distance: float, lot_size: float = 0.02) -> float:
    """Quy đổi khoảng cách giá sang USD dựa trên contract size MT5."""
    try:
        info = mt5.symbol_info(config.SYMBOL)
        if info:
            contract_size = info.trade_contract_size
        else:
            contract_size = 100.0  # fallback Gold standard
    except Exception:
        contract_size = 100.0
    return round(price_distance * contract_size * lot_size, 2)


def validate_signal(
    direction: str,
    entry: float,
    sl_data: dict,
    tp_data: dict,
    spread: float,
    active_signals: list,
) -> dict:
    """Validate toàn bộ tín hiệu trước khi gửi."""
    reject_reasons: list = []

    sl_valid = sl_data.get("valid", False)
    if not sl_valid:
        reject_reasons.append(sl_data.get("reason", "SL không hợp lệ"))

    rr_valid = tp_data.get("rr1", 0) >= 1.5
    if not rr_valid:
        reject_reasons.append(f"RR TP1 = {tp_data.get('rr1', 0):.2f} < 1.5")

    spread_valid = spread <= 50.0
    if not spread_valid:
        reject_reasons.append(f"Spread quá cao: {spread:.1f} pips")

    signals_valid = len(active_signals) < config.MAX_ACTIVE_SIGNALS
    if not signals_valid:
        reject_reasons.append(f"Đã có {len(active_signals)}/{config.MAX_ACTIVE_SIGNALS} lệnh active")

    distance_valid = True
    nearest = None
    for sig in active_signals:
        dist = abs(sig.get("entry_price", 0) - entry)
        if nearest is None or dist < nearest:
            nearest = dist
    if nearest is not None and nearest < config.MIN_ENTRY_DISTANCE:
        distance_valid = False
        reject_reasons.append(f"Entry quá gần lệnh cũ: {nearest:.1f} USD giá")

    return {
        "valid": len(reject_reasons) == 0,
        "reject_reasons": reject_reasons,
        "sl_valid": sl_valid,
        "rr_valid": rr_valid,
        "spread_valid": spread_valid,
        "signals_valid": signals_valid,
        "distance_valid": distance_valid,
    }


def _gen_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{ts}_{suffix}"


def build_signal_package(
    direction: str,
    entry: float,
    sl_data: dict,
    tp_data: dict,
    score_data: dict,
    entry_data: dict,
    market_data: dict,
    smc_data: dict,
) -> dict:
    """Tổng hợp toàn bộ thông tin tín hiệu thành package đầy đủ."""
    sl_usd = convert_to_usd(sl_data["sl_distance"])
    tp1_usd = convert_to_usd(tp_data["tp1_distance"])
    tp2_usd = convert_to_usd(tp_data["tp2_distance"])
    bias_data = market_data.get("bias_data", {})

    return {
        "id": _gen_id(),
        "symbol": config.SYMBOL,
        "direction": direction,
        "status": "active",
        "entry_price": entry,
        "sl_price": sl_data["sl_price"],
        "tp1_price": tp_data["tp1_price"],
        "tp2_price": tp_data["tp2_price"],
        "sl_distance": sl_data["sl_distance"],
        "tp1_distance": tp_data["tp1_distance"],
        "tp2_distance": tp_data["tp2_distance"],
        "sl_usd": sl_usd,
        "tp1_usd": tp1_usd,
        "tp2_usd": tp2_usd,
        "rr1": tp_data["rr1"],
        "rr2": tp_data["rr2"],
        "trailing_sl": None,
        "score_total": score_data.get("total", 0),
        "score_group_a": score_data.get("group_a", 0),
        "score_group_b": score_data.get("group_b", 0),
        "bias": bias_data.get("bias", ""),
        "bias_confidence": bias_data.get("confidence", ""),
        "price_zone": market_data.get("price_zone", {}).get("zone", ""),
        "active_zone": entry_data.get("active_zone"),
        "candle_pattern": entry_data.get("candle_pattern", {}),
        "sweep_data": entry_data.get("sweep_data", {}),
        "fib_check": entry_data.get("fib_check", {}),
        "reasons": entry_data.get("reasons", []),
        "has_choch_warning": entry_data.get("has_choch_warning", False),
        "time_created": datetime.now(timezone.utc).isoformat(),
        "time_tp1_hit": None,
        "time_tp2_hit": None,
        "time_sl_hit": None,
        "time_expired": None,
        "lot_ref": 0.02,
    }
