"""
main.py — Điều phối toàn bộ Gold Signal Bot.
Chạy 24/5 liên tục: signal scan mỗi 15 phút, TP/SL monitor mỗi 5 phút.
"""
import logging
import logging.handlers
import os
import time
import traceback
from datetime import datetime, timezone, timedelta

import pytz

import config
from modules.data_feed import (
    connect_mt5, disconnect_mt5, get_all_timeframes,
    is_market_open, check_connection, get_current_price,
)
from modules.market_structure import analyze_market_structure
from modules.smc_analyzer import analyze_h1_smc
from modules.entry_trigger import check_entry_signal
from modules.risk_manager import (
    calculate_sl, calculate_tp, validate_signal, build_signal_package,
)
from modules.telegram_notifier import (
    send_message, format_signal_message, format_daily_briefing,
    format_daily_summary, format_warning_message,
)
from modules.news_filter import (
    fetch_news_calendar, filter_gold_relevant_news,
    is_news_window, get_upcoming_news, get_today_news_summary,
)
from modules.signal_manager import SignalManager

ICT = pytz.timezone(config.TIMEZONE)
logger = logging.getLogger(__name__)


def setup_logging() -> None:
    """Cấu hình logging ra file (rotating) và console."""
    os.makedirs(os.path.dirname(config.LOG_FILE), exist_ok=True)
    root = logging.getLogger()
    root.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))

    file_handler = logging.handlers.RotatingFileHandler(
        config.LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(levelname)s] %(name)s: %(message)s")
    )
    root.addHandler(file_handler)

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s"))
    root.addHandler(console)


def _next_m15_close(now: datetime) -> datetime:
    """Tính thời điểm nến M15 tiếp theo đóng (bội số 15 phút)."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    minute = now.minute
    next_quarter = ((minute // 15) + 1) * 15
    delta = timedelta(minutes=next_quarter - minute, seconds=-now.second, microseconds=-now.microsecond)
    return now + delta


def run_signal_scan(signal_mgr: SignalManager) -> None:
    """Vòng quét tín hiệu — chạy mỗi lần nến M15 đóng."""
    # 1. Kiểm tra thị trường mở
    if not is_market_open():
        logger.info("Thị trường đóng cửa, bỏ qua scan.")
        return

    # 2. Kiểm tra news window
    news_list = fetch_news_calendar()
    news_check = is_news_window(datetime.now(timezone.utc), news_list)
    if news_check["in_window"]:
        item = news_check["news_item"] or {}
        logger.info(f"Trong cửa sổ news: {item.get('title','')} [{news_check['impact']}]")
        send_message(format_warning_message("news_filter", {
            "title": item.get("title", ""),
            "time": item.get("time", ""),
            "impact": news_check["impact"],
            "end_time": f"+{config.NEWS_HIGH_AFTER if news_check['impact']=='High' else config.NEWS_MED_AFTER} phút",
        }))
        return

    # 3. Lấy dữ liệu tất cả timeframe
    try:
        tf_data = get_all_timeframes(config.SYMBOL)
    except Exception as e:
        logger.error(f"Lấy dữ liệu thất bại: {e}")
        return

    current_price = tf_data["current_price"]
    spread = tf_data["spread"]

    # 4. Kiểm tra spread
    if spread > 50:
        logger.warning(f"Spread quá cao ({spread:.1f} pips), bỏ qua scan.")
        return

    # 5. Phân tích Market Structure
    try:
        market_data = analyze_market_structure(tf_data["D1"], tf_data["H4"], current_price)
    except Exception as e:
        logger.error(f"analyze_market_structure lỗi: {e}")
        return

    if market_data["bias_data"].get("is_ranging"):
        logger.info("Thị trường ranging, bỏ qua.")
        send_message(format_warning_message("ranging", {"price": current_price, "atr": 0}))
        return

    if not market_data["can_trade"]:
        logger.info(f"can_trade=False, direction={market_data['trade_direction']}")
        return

    # 6. Phân tích H1 SMC
    try:
        bias_data = market_data["bias_data"]
        smc_data = analyze_h1_smc(
            tf_data["H1"],
            bias_data["bias"],
            bias_data["swing_highs_h4"],
            bias_data["swing_lows_h4"],
        )
    except Exception as e:
        logger.error(f"analyze_h1_smc lỗi: {e}")
        return

    if smc_data.get("has_choch"):
        send_message(format_warning_message("choch", {
            "direction": smc_data.get("choch_direction", ""),
            "price": current_price,
            "bias": bias_data["bias"],
        }))

    # 7. Kiểm tra entry M15
    try:
        entry_data = check_entry_signal(tf_data["M15"], market_data, smc_data, current_price)
    except Exception as e:
        logger.error(f"check_entry_signal lỗi: {e}")
        return

    if not entry_data["signal"]:
        logger.info(f"Không có signal: {entry_data['reject_reasons']}")
        sweep = entry_data.get("sweep_data", {})
        if sweep.get("detected") and not sweep.get("valid"):
            send_message(format_warning_message("liquidity_grab", {
                "direction": sweep.get("direction", ""),
                "price": sweep.get("swept_level", 0),
                "missing_conditions": sweep.get("missing_conditions", []),
            }))
        return

    direction = entry_data["direction"]
    active_zone = entry_data.get("active_zone")
    if not active_zone:
        logger.info("Không có active zone, bỏ qua.")
        return

    # 8. Tính SL
    sl_data = calculate_sl(direction, active_zone, current_price, smc_data)
    if not sl_data["valid"]:
        logger.info(f"SL không hợp lệ: {sl_data['reason']}")
        return

    # 9. Tính TP
    tp_data = calculate_tp(direction, current_price, sl_data["sl_distance"], smc_data, market_data)

    # 10. Validate signal
    active_signals = signal_mgr.get_active()
    validation = validate_signal(direction, current_price, sl_data, tp_data, spread, active_signals)
    if not validation["valid"]:
        logger.info(f"Validation thất bại: {validation['reject_reasons']}")
        return

    # 11. Kiểm tra có thể thêm không
    can_check = signal_mgr.can_add({"entry_price": current_price, "direction": direction})
    if not can_check["can_add"]:
        logger.info(f"Không thể thêm signal: {can_check['reject_reason']}")
        return

    # 12. Build signal package
    signal = build_signal_package(
        direction, current_price, sl_data, tp_data,
        entry_data["score_data"], entry_data, market_data, smc_data,
    )

    # 13. Gửi Telegram
    send_message(format_signal_message(signal))

    # 14. Lưu signal
    signal_mgr.add(signal)
    logger.info(f"Signal phát: {signal['id']} {direction} @ {current_price:.3f} score={signal['score_total']}")


def run_tpsl_monitor(signal_mgr: SignalManager) -> None:
    """Theo dõi TP/SL — chạy mỗi 5 phút."""
    try:
        price = get_current_price(config.SYMBOL)
        signal_mgr.monitor(price)
        logger.debug(f"TP/SL monitor: price={price:.3f}")
    except Exception as e:
        logger.error(f"run_tpsl_monitor lỗi: {e}")


def run_daily_briefing(signal_mgr: SignalManager) -> None:
    """Gửi tóm tắt đầu ngày 7:00 ICT."""
    try:
        tf_data = get_all_timeframes(config.SYMBOL)
        market_data = analyze_market_structure(tf_data["D1"], tf_data["H4"], tf_data["current_price"])
        bias_data = market_data["bias_data"]
        smc_data = analyze_h1_smc(
            tf_data["H1"], bias_data["bias"],
            bias_data["swing_highs_h4"], bias_data["swing_lows_h4"],
        )
        news_today = get_today_news_summary()
        msg = format_daily_briefing(market_data, smc_data, news_today)
        send_message(msg)
        logger.info("Daily briefing đã gửi.")
    except Exception as e:
        logger.error(f"run_daily_briefing lỗi: {e}\n{traceback.format_exc()}")


def run_daily_summary(signal_mgr: SignalManager) -> None:
    """Gửi tổng kết cuối ngày 22:00 ICT."""
    try:
        signals_today = signal_mgr.today()
        tf_data = get_all_timeframes(config.SYMBOL)
        market_data = analyze_market_structure(tf_data["D1"], tf_data["H4"], tf_data["current_price"])
        msg = format_daily_summary(signals_today, market_data, market_data)
        send_message(msg)
        logger.info("Daily summary đã gửi.")
    except Exception as e:
        logger.error(f"run_daily_summary lỗi: {e}\n{traceback.format_exc()}")


def _next_daily_event(hour: int) -> datetime:
    """Tính thời điểm tiếp theo của sự kiện hàng ngày theo ICT."""
    now_ict = datetime.now(timezone.utc).astimezone(ICT)
    target = now_ict.replace(hour=hour, minute=0, second=0, microsecond=0)
    if now_ict >= target:
        target += timedelta(days=1)
    return target.astimezone(timezone.utc)


def main() -> None:
    """Hàm chính khởi động và chạy bot."""
    setup_logging()
    os.makedirs("logs", exist_ok=True)
    os.makedirs("state", exist_ok=True)

    logger.info("=== Gold Signal Bot khởi động ===")
    config.validate_config()

    connect_mt5()
    signal_mgr = SignalManager()

    send_message(format_warning_message("bot_start", {}))

    now = datetime.now(timezone.utc)
    next_signal_scan = _next_m15_close(now)
    next_tpsl_check = now + timedelta(seconds=config.SCAN_INTERVAL_TPSL)
    next_briefing = _next_daily_event(config.DAILY_BRIEFING_HOUR)
    next_summary = _next_daily_event(config.DAILY_SUMMARY_HOUR)

    logger.info(f"Scan M15 đầu tiên lúc: {next_signal_scan.astimezone(ICT).strftime('%H:%M ICT')}")

    try:
        while True:
            now = datetime.now(timezone.utc)

            if now >= next_briefing:
                run_daily_briefing(signal_mgr)
                next_briefing += timedelta(days=1)

            if now >= next_summary:
                run_daily_summary(signal_mgr)
                next_summary += timedelta(days=1)

            if now >= next_signal_scan:
                if not check_connection():
                    logger.warning("Mất kết nối MT5, thử lại sau 60s.")
                    time.sleep(60)
                    continue
                try:
                    run_signal_scan(signal_mgr)
                except Exception as e:
                    logger.error(f"run_signal_scan lỗi: {e}\n{traceback.format_exc()}")
                next_signal_scan = _next_m15_close(datetime.now(timezone.utc))

            if now >= next_tpsl_check:
                try:
                    run_tpsl_monitor(signal_mgr)
                except Exception as e:
                    logger.error(f"run_tpsl_monitor lỗi: {e}")
                next_tpsl_check = datetime.now(timezone.utc) + timedelta(seconds=config.SCAN_INTERVAL_TPSL)

            time.sleep(30)

    except KeyboardInterrupt:
        logger.info("Bot dừng bởi người dùng (KeyboardInterrupt).")
        try:
            send_message(format_warning_message("bot_stop", {}))
        except Exception:
            pass
    except Exception as e:
        logger.critical(f"Lỗi nghiêm trọng: {e}\n{traceback.format_exc()}")
        try:
            connect_mt5()
        except Exception:
            pass
        time.sleep(60)
    finally:
        try:
            disconnect_mt5()
        except Exception:
            pass
        logger.info("Bot đã dừng.")


if __name__ == "__main__":
    main()
