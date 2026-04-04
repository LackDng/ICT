"""
signal_manager.py — Quản lý vòng đời tín hiệu, lưu trữ JSON, theo dõi TP/SL.
Tối đa 3 tín hiệu active, theo dõi mỗi 5 phút.
"""
import json
import logging
import os
import tempfile
from datetime import datetime, timezone, timedelta
from typing import Optional

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)


def load_signals(state_file: str) -> list:
    """Đọc danh sách tín hiệu từ JSON."""
    if not os.path.exists(state_file):
        return []
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Lỗi đọc signals: {e}")
        return []


def save_signals(signals: list, state_file: str) -> None:
    """Ghi danh sách tín hiệu vào JSON (atomic write)."""
    os.makedirs(os.path.dirname(state_file) if os.path.dirname(state_file) else ".", exist_ok=True)
    dir_name = os.path.dirname(state_file) or "."
    try:
        with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, suffix=".tmp", encoding="utf-8") as f:
            json.dump(signals, f, ensure_ascii=False, indent=2, default=str)
            tmp_path = f.name
        os.replace(tmp_path, state_file)
    except Exception as e:
        logger.error(f"Lỗi ghi signals: {e}")


def add_signal(signal: dict) -> bool:
    """Thêm tín hiệu mới nếu đủ điều kiện."""
    signals = load_signals(config.STATE_FILE)
    active = [s for s in signals if s.get("status") == "active"]
    check = can_add_signal(signal, active)
    if not check["can_add"]:
        logger.warning(f"Không thể thêm signal: {check['reject_reason']}")
        return False
    signals.append(signal)
    save_signals(signals, config.STATE_FILE)
    logger.info(f"Thêm signal {signal['id']} {signal['direction']} @ {signal['entry_price']}")
    return True


def get_active_signals() -> list:
    """Lấy danh sách tín hiệu đang active."""
    signals = load_signals(config.STATE_FILE)
    return [s for s in signals if s.get("status") == "active"]


def check_tp_sl_hit(signal: dict, current_price: float) -> dict:
    """Kiểm tra tín hiệu có chạm TP/SL không."""
    d = signal["direction"]
    status = signal.get("status", "active")
    trailing = signal.get("trailing_sl")

    if d == "buy":
        if status == "tp1_hit" and trailing is not None:
            if current_price >= signal["tp2_price"]:
                return {"hit": True, "hit_type": "TP2", "hit_price": signal["tp2_price"]}
            if current_price <= trailing:
                return {"hit": True, "hit_type": "TRAILING_SL", "hit_price": trailing}
        else:
            if current_price >= signal["tp2_price"]:
                return {"hit": True, "hit_type": "TP2", "hit_price": signal["tp2_price"]}
            if current_price >= signal["tp1_price"]:
                return {"hit": True, "hit_type": "TP1", "hit_price": signal["tp1_price"]}
            if current_price <= signal["sl_price"]:
                return {"hit": True, "hit_type": "SL", "hit_price": signal["sl_price"]}
    else:  # sell
        if status == "tp1_hit" and trailing is not None:
            if current_price <= signal["tp2_price"]:
                return {"hit": True, "hit_type": "TP2", "hit_price": signal["tp2_price"]}
            if current_price >= trailing:
                return {"hit": True, "hit_type": "TRAILING_SL", "hit_price": trailing}
        else:
            if current_price <= signal["tp2_price"]:
                return {"hit": True, "hit_type": "TP2", "hit_price": signal["tp2_price"]}
            if current_price <= signal["tp1_price"]:
                return {"hit": True, "hit_type": "TP1", "hit_price": signal["tp1_price"]}
            if current_price >= signal["sl_price"]:
                return {"hit": True, "hit_type": "SL", "hit_price": signal["sl_price"]}

    return {"hit": False, "hit_type": None, "hit_price": None}


def update_signal_status(
    signal_id: str,
    new_status: str,
    hit_price: float = None,
    hit_time: datetime = None,
) -> None:
    """Cập nhật trạng thái tín hiệu."""
    signals = load_signals(config.STATE_FILE)
    now_str = (hit_time or datetime.now(timezone.utc)).isoformat()
    for s in signals:
        if s["id"] == signal_id:
            s["status"] = new_status
            if new_status == "tp1_hit":
                s["time_tp1_hit"] = now_str
            elif new_status in ("tp2_hit",):
                s["time_tp2_hit"] = now_str
            elif new_status == "sl_hit":
                s["time_sl_hit"] = now_str
            elif new_status == "trailing_sl":
                s["time_sl_hit"] = now_str
            elif new_status == "expired":
                s["time_expired"] = now_str
            if hit_price is not None:
                s["hit_price"] = hit_price
            break
    save_signals(signals, config.STATE_FILE)
    logger.info(f"Signal {signal_id} → {new_status}")


def activate_trailing_sl(signal_id: str, trailing_sl: float) -> None:
    """Kích hoạt trailing SL sau khi TP1 chạm."""
    signals = load_signals(config.STATE_FILE)
    for s in signals:
        if s["id"] == signal_id:
            s["trailing_sl"] = trailing_sl
            s["status"] = "tp1_hit"
            s["time_tp1_hit"] = datetime.now(timezone.utc).isoformat()
            break
    save_signals(signals, config.STATE_FILE)
    logger.info(f"Signal {signal_id}: trailing SL activated @ {trailing_sl:.3f}")


def check_expired_signals() -> list:
    """Kiểm tra tín hiệu hết hạn 24h."""
    signals = load_signals(config.STATE_FILE)
    now = datetime.now(timezone.utc)
    expired = []
    for s in signals:
        if s.get("status") != "active":
            continue
        created = s.get("time_created", "")
        try:
            t0 = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if (now - t0).total_seconds() > config.SIGNAL_EXPIRE_HOURS * 3600:
                expired.append(s)
        except Exception:
            pass
    return expired


def monitor_all_signals(current_price: float, notifier: object) -> None:
    """Theo dõi tất cả tín hiệu active, gọi mỗi 5 phút."""
    from modules.telegram_notifier import (
        format_tp1_message, format_tp2_message,
        format_sl_message, format_sl_trailing_message, format_warning_message, send_message
    )
    from modules.risk_manager import calculate_trailing_sl

    # Kiểm tra expired
    for s in check_expired_signals():
        update_signal_status(s["id"], "expired")
        send_message(format_warning_message("signal_expired", {
            "direction": s["direction"], "entry": s["entry_price"]
        }))
        logger.info(f"Signal {s['id']} expired")

    active = get_active_signals()
    # Thêm tp1_hit signals vào danh sách theo dõi
    all_signals = load_signals(config.STATE_FILE)
    tracking = [s for s in all_signals if s.get("status") in ("active", "tp1_hit")]

    for s in tracking:
        result = check_tp_sl_hit(s, current_price)
        if not result["hit"]:
            continue

        hit_type = result["hit_type"]
        hit_price = result["hit_price"]

        if hit_type == "TP1":
            trailing = calculate_trailing_sl(s["entry_price"], s["tp1_price"], s["direction"])
            activate_trailing_sl(s["id"], trailing)
            # Reload signal sau khi update
            all_sigs = load_signals(config.STATE_FILE)
            updated = next((x for x in all_sigs if x["id"] == s["id"]), s)
            send_message(format_tp1_message(updated))
            logger.info(f"Signal {s['id']} TP1 hit @ {hit_price}")

        elif hit_type == "TP2":
            update_signal_status(s["id"], "tp2_hit", hit_price)
            send_message(format_tp2_message(s))
            logger.info(f"Signal {s['id']} TP2 hit @ {hit_price}")

        elif hit_type == "SL":
            update_signal_status(s["id"], "sl_hit", hit_price)
            send_message(format_sl_message(s))
            logger.info(f"Signal {s['id']} SL hit @ {hit_price}")

        elif hit_type == "TRAILING_SL":
            update_signal_status(s["id"], "trailing_sl", hit_price)
            send_message(format_sl_trailing_message(s))
            logger.info(f"Signal {s['id']} trailing SL hit @ {hit_price}")


def can_add_signal(new_signal: dict, active_signals: list) -> dict:
    """Kiểm tra có thể thêm tín hiệu mới không."""
    if len(active_signals) >= config.MAX_ACTIVE_SIGNALS:
        return {
            "can_add": False,
            "reject_reason": f"Đã có {len(active_signals)}/{config.MAX_ACTIVE_SIGNALS} lệnh active",
            "active_count": len(active_signals),
            "nearest_distance": None,
        }
    new_entry = new_signal.get("entry_price", 0)
    nearest = None
    for s in active_signals:
        dist = abs(s.get("entry_price", 0) - new_entry)
        if nearest is None or dist < nearest:
            nearest = dist
    if nearest is not None and nearest < config.MIN_ENTRY_DISTANCE:
        return {
            "can_add": False,
            "reject_reason": f"Entry quá gần lệnh cũ: {nearest:.1f} USD giá",
            "active_count": len(active_signals),
            "nearest_distance": nearest,
        }
    return {
        "can_add": True,
        "reject_reason": None,
        "active_count": len(active_signals),
        "nearest_distance": nearest,
    }


def get_today_signals() -> list:
    """Lấy tất cả tín hiệu trong ngày hôm nay (ICT)."""
    import pytz
    ICT = pytz.timezone(config.TIMEZONE)
    now_ict = datetime.now(timezone.utc).astimezone(ICT)
    today_date = now_ict.date()
    signals = load_signals(config.STATE_FILE)
    result = []
    for s in signals:
        created = s.get("time_created", "")
        try:
            t0 = datetime.fromisoformat(created.replace("Z", "+00:00")).astimezone(ICT)
            if t0.date() == today_date:
                result.append(s)
        except Exception:
            pass
    return result


def get_daily_stats(signals: list) -> dict:
    """Tính thống kê ngày."""
    wins = [s for s in signals if s.get("status") in ("tp1_hit", "tp2_hit", "trailing_sl")]
    losses = [s for s in signals if s.get("status") == "sl_hit"]
    active = [s for s in signals if s.get("status") == "active"]
    total = len(signals)
    win_rate = round(len(wins) / total * 100, 1) if total else 0.0
    total_profit = sum(
        s.get("tp1_usd", 0) + (s.get("tp2_usd", 0) if s.get("status") == "tp2_hit" else 0)
        for s in wins
    )
    total_loss = sum(s.get("sl_usd", 0) for s in losses)
    return {
        "total": total,
        "wins": len(wins),
        "losses": len(losses),
        "active": len(active),
        "win_rate": win_rate,
        "total_profit_usd": round(total_profit, 2),
        "total_loss_usd": round(total_loss, 2),
        "net_usd": round(total_profit - total_loss, 2),
    }


class SignalManager:
    """Wrapper class thuận tiện cho main.py."""

    def add(self, signal: dict) -> bool:
        return add_signal(signal)

    def get_active(self) -> list:
        return get_active_signals()

    def monitor(self, price: float, notifier=None) -> None:
        monitor_all_signals(price, notifier)

    def today(self) -> list:
        return get_today_signals()

    def stats(self, signals: list) -> dict:
        return get_daily_stats(signals)

    def can_add(self, signal: dict) -> dict:
        return can_add_signal(signal, self.get_active())
