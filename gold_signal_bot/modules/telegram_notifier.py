"""
telegram_notifier.py — Format và gửi thông báo Telegram cho Gold Signal Bot.
Parse mode: HTML. Ngôn ngữ: Tiếng Việt. Timezone: Asia/Ho_Chi_Minh (ICT).
"""
import logging
import time
from datetime import datetime, timezone

import pytz
import requests

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)
ICT = pytz.timezone(config.TIMEZONE)
TELEGRAM_API = f"https://api.telegram.org/bot{config.TELEGRAM_TOKEN}/sendMessage"


def send_message(text: str) -> bool:
    """Gửi tin nhắn Telegram HTML, retry 3 lần cách 2 giây."""
    for attempt in range(1, 4):
        try:
            resp = requests.post(
                TELEGRAM_API,
                json={"chat_id": config.TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
                timeout=10,
                verify=False,  # Bỏ qua SSL verify — fix lỗi certificate trên Windows
            )
            if resp.status_code == 200:
                logger.info("Telegram: gửi thành công")
                return True
            logger.warning(f"Telegram lần {attempt}: {resp.status_code} {resp.text[:100]}")
        except Exception as e:
            logger.warning(f"Telegram lần {attempt} exception: {e}")
        if attempt < 3:
            time.sleep(2)
    logger.error("Telegram: gửi thất bại sau 3 lần")
    return False


def _fmt_time(dt=None) -> str:
    """Format datetime sang ICT (UTC+7), mặc định = now."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ICT).strftime("%d/%m/%Y %H:%M ICT")


def _fmt_date(dt=None) -> str:
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ICT).strftime("%d/%m/%Y")


def _bias_emoji(bias: str) -> str:
    return {"bullish": "🐂", "bearish": "🐻"}.get(bias, "⚖️")


def _quality(total: int) -> str:
    return "CAO" if total >= 12 else "TRUNG BÌNH"


def _dir_emoji(direction: str) -> str:
    return "🟢 BUY" if direction == "buy" else "🔴 SELL"


def format_daily_briefing(market_data: dict, smc_data: dict, news_today: list) -> str:
    """Format tin nhắn tóm tắt đầu ngày 7:00 ICT."""
    bias_data = market_data.get("bias_data", {})
    d1_bias = bias_data.get("d1_bias", "N/A")
    h4_bias = bias_data.get("h4_bias", "N/A")
    is_ranging = bias_data.get("is_ranging", False)
    state = "Ranging" if is_ranging else "Trending"

    sh_h4 = bias_data.get("last_sh_h4", 0)
    sl_h4 = bias_data.get("last_sl_h4", 0)
    sh_d1 = bias_data.get("last_sh_d1", 0)
    sl_d1 = bias_data.get("last_sl_d1", 0)

    fib_d1 = market_data.get("fib_d1", {})
    eq = fib_d1.get("equilibrium", 0) if fib_d1 else 0

    conf_zones = market_data.get("confluence_zones", [])
    conf_str = ""
    if conf_zones:
        z = conf_zones[0]
        conf_str = f"• Confluence: {z['price_bottom']:.3f}–{z['price_top']:.3f}"

    news_lines = ""
    for n in news_today:
        t = n.get("time", "")
        news_lines += f"• {n.get('title', n.get('event', ''))} lúc {t} [{n.get('impact', '')}]\n"
    if not news_lines:
        news_lines = "• Không có tin tức quan trọng\n"

    trade_dir = market_data.get("trade_direction") or "ranging"

    return (
        f"🌅 <b>GOLD DAILY BRIEFING</b>\n"
        f"📅 {_fmt_date()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📊 <b>XU HƯỚNG:</b>\n"
        f"• D1 Bias : {d1_bias} {_bias_emoji(d1_bias)}\n"
        f"• H4 Bias : {h4_bias} {_bias_emoji(h4_bias)}\n"
        f"• Trạng thái: {state}\n\n"
        f"📍 <b>VÙNG QUAN TRỌNG:</b>\n"
        f"• Kháng cự D1: {sh_d1:.3f} | H4: {sh_h4:.3f}\n"
        f"• Hỗ trợ   D1: {sl_d1:.3f} | H4: {sl_h4:.3f}\n\n"
        f"📈 <b>FIBONACCI:</b>\n"
        f"• Equilibrium (0.5): {eq:.3f}\n"
        f"{conf_str}\n\n"
        f"⚠️ <b>NEWS HÔM NAY:</b>\n"
        f"{news_lines}\n"
        f"🎯 <b>KỲ VỌNG:</b>\n"
        f"• Trade direction: {trade_dir.upper()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🤖 Gold Signal Bot"
    )


def format_signal_message(signal: dict) -> str:
    """Format tin nhắn tín hiệu entry đầy đủ."""
    d = signal["direction"]
    reasons = "\n".join(f"• {r}" for r in signal.get("reasons", []))
    choch_warn = "\n⚠️ CHoCH H1 phát hiện — thận trọng!" if signal.get("has_choch_warning") else ""
    return (
        f"🥇 <b>GOLD SIGNAL — XAU/USD</b>\n"
        f"⏰ {_fmt_time()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{_dir_emoji(d)}\n\n"
        f"<code>Entry : {signal['entry_price']:.3f}</code>\n"
        f"<code>TP1   : {signal['tp1_price']:.3f} (+{signal['tp1_distance']:.3f} | ~${signal['tp1_usd']:.2f} USD)</code>\n"
        f"<code>TP2   : {signal['tp2_price']:.3f} (+{signal['tp2_distance']:.3f} | ~${signal['tp2_usd']:.2f} USD)</code>\n"
        f"<code>SL    : {signal['sl_price']:.3f} (-{signal['sl_distance']:.3f} | ~${signal['sl_usd']:.2f} USD)</code>\n"
        f"<code>RR    : 1:{signal['rr1']} / 1:{signal['rr2']}</code>\n"
        f"<code>Lot   : 0.02</code>\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 <b>LÝ DO VÀO LỆNH:</b>\n"
        f"{reasons}\n\n"
        f"📈 Score: {signal['score_total']}/14 điểm\n"
        f"⚡ Chất lượng: {_quality(signal['score_total'])}"
        f"{choch_warn}"
    )


def format_tp1_message(signal: dict) -> str:
    """Format thông báo TP1 chạm."""
    from modules.risk_manager import calculate_trailing_sl, convert_to_usd
    sl_new = signal.get("trailing_sl") or calculate_trailing_sl(
        signal["entry_price"], signal["tp1_price"], signal["direction"]
    )
    sl_new_dist = abs(sl_new - signal["entry_price"])
    sl_new_usd = convert_to_usd(sl_new_dist)
    return (
        f"✅ <b>GOLD — TP1 ĐÃ CHẠM!</b>\n"
        f"⏰ {_fmt_time()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🎯 TP1 đạt : <code>{signal['tp1_price']:.3f}</code>\n"
        f"💰 Lợi nhuận: +{signal['tp1_distance']:.3f} | ~${signal['tp1_usd']:.2f} USD\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔄 <b>CẬP NHẬT LỆNH:</b>\n\n"
        f"• SL mới : <code>{sl_new:.3f}</code> (+{sl_new_dist:.3f} | ~${sl_new_usd:.2f} USD)\n"
        f"  → Dời SL về mức này bảo vệ lợi nhuận\n\n"
        f"• Tiếp tục chờ TP2: <code>{signal['tp2_price']:.3f}</code>\n"
        f"  (+{signal['tp2_distance']:.3f} | ~${signal['tp2_usd']:.2f} USD | RR 1:{signal['rr2']})\n\n"
        f"⚠️ Lệnh không còn rủi ro thua lỗ"
    )


def format_tp2_message(signal: dict) -> str:
    """Format thông báo TP2 chạm - full win."""
    total_usd = signal["tp1_usd"] + signal["tp2_usd"]
    created = signal.get("time_created", "")
    try:
        from datetime import datetime as dt
        t0 = dt.fromisoformat(created.replace("Z", "+00:00")) if created else None
        duration = str(datetime.now(timezone.utc) - t0).split(".")[0] if t0 else "N/A"
    except Exception:
        duration = "N/A"
    return (
        f"🏆 <b>GOLD — TP2 ĐẠT! FULL WIN!</b>\n"
        f"⏰ {_fmt_time()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🎯 TP2 đạt : <code>{signal['tp2_price']:.3f}</code>\n"
        f"💰 Lợi nhuận: +{signal['tp2_distance']:.3f} | ~${signal['tp2_usd']:.2f} USD\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 <b>TỔNG KẾT LỆNH:</b>\n\n"
        f"• Entry : <code>{signal['entry_price']:.3f}</code>\n"
        f"• TP1   : <code>{signal['tp1_price']:.3f}</code> ✅ (+${signal['tp1_usd']:.2f} USD)\n"
        f"• TP2   : <code>{signal['tp2_price']:.3f}</code> ✅ (+${signal['tp2_usd']:.2f} USD)\n"
        f"• Tổng  : ~${total_usd:.2f} USD\n"
        f"• Thời gian giữ: {duration}\n\n"
        f"🎯 RR thực tế: 1:{signal['rr2']}\n"
        f"🤖 Bot sẽ tìm tín hiệu mới"
    )


def format_sl_message(signal: dict) -> str:
    """Format thông báo SL chạm."""
    return (
        f"❌ <b>GOLD — SL BỊ CHẠM</b>\n"
        f"⏰ {_fmt_time()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🛑 SL chạm : <code>{signal['sl_price']:.3f}</code>\n"
        f"📉 Thua lỗ : -{signal['sl_distance']:.3f} | ~${signal['sl_usd']:.2f} USD\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔍 <b>PHÂN TÍCH:</b>\n"
        f"• Vùng OB/FVG đã bị phá vỡ\n"
        f"• Cấu trúc H1 thay đổi\n"
        f"• Cần xem xét lại bias H4\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"💡 <b>KHUYẾN NGHỊ:</b>\n"
        f"• Không vào lệnh ngay\n"
        f"• Chờ thị trường xác nhận lại cấu trúc\n"
        f"• Bot sẽ cập nhật tín hiệu tiếp theo"
    )


def format_sl_trailing_message(signal: dict) -> str:
    """Format thông báo đóng lệnh bằng trailing SL (có lời)."""
    sl_trail = signal.get("trailing_sl", signal["sl_price"])
    profit_dist = abs(sl_trail - signal["entry_price"])
    from modules.risk_manager import convert_to_usd
    profit_usd = convert_to_usd(profit_dist)
    created = signal.get("time_created", "")
    try:
        from datetime import datetime as dt
        t0 = dt.fromisoformat(created.replace("Z", "+00:00")) if created else None
        duration = str(datetime.now(timezone.utc) - t0).split(".")[0] if t0 else "N/A"
    except Exception:
        duration = "N/A"
    return (
        f"🔒 <b>GOLD — ĐÓNG LỆNH (Trailing SL)</b>\n"
        f"⏰ {_fmt_time()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🛑 Trailing SL chạm: <code>{sl_trail:.3f}</code>\n"
        f"💰 Lợi nhuận : +{profit_dist:.3f} | ~${profit_usd:.2f} USD ✅\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 <b>TỔNG KẾT:</b>\n"
        f"• Entry  : <code>{signal['entry_price']:.3f}</code>\n"
        f"• TP1    : <code>{signal['tp1_price']:.3f}</code> ✅\n"
        f"• Đóng   : <code>{sl_trail:.3f}</code>\n"
        f"• Kết quả: +${profit_usd:.2f} USD\n"
        f"• Thời gian giữ: {duration}\n\n"
        f"💡 Lệnh kết thúc có lời\n"
        f"🤖 Bot sẽ tìm tín hiệu mới"
    )


def format_daily_summary(signals_today: list, market_data: dict, tomorrow_data: dict) -> str:
    """Format tổng kết cuối ngày 22:00 ICT."""
    bias_data = market_data.get("bias_data", {})
    wins = [s for s in signals_today if s.get("status") in ("tp1_hit", "tp2_hit", "trailing_sl")]
    losses = [s for s in signals_today if s.get("status") == "sl_hit"]
    active = [s for s in signals_today if s.get("status") == "active"]
    total_profit = sum(s.get("tp1_usd", 0) + (s.get("tp2_usd", 0) if s.get("status") == "tp2_hit" else 0) for s in wins)
    total_loss = sum(s.get("sl_usd", 0) for s in losses)
    win_rate = round(len(wins) / len(signals_today) * 100, 1) if signals_today else 0

    sig_lines = ""
    for s in signals_today:
        st = s.get("status", "active")
        icon = {"tp2_hit": "TP2 ✅", "tp1_hit": "TP1 ✅", "trailing_sl": "Trailing 🔒", "sl_hit": "SL ❌", "active": "Active ⏳"}.get(st, st)
        sig_lines += f"• {s['direction'].upper()} @ {s['entry_price']:.3f} → {icon}\n"

    sh_h4 = bias_data.get("last_sh_h4", 0)
    sl_h4 = bias_data.get("last_sl_h4", 0)
    t_dir = tomorrow_data.get("trade_direction") or "N/A"

    return (
        f"🌙 <b>GOLD DAILY SUMMARY</b>\n"
        f"📅 {_fmt_date()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📊 <b>THỊ TRƯỜNG HÔM NAY:</b>\n"
        f"• Bias D1: {bias_data.get('d1_bias','N/A')} {_bias_emoji(bias_data.get('d1_bias',''))}\n"
        f"• Bias H4: {bias_data.get('h4_bias','N/A')} {_bias_emoji(bias_data.get('h4_bias',''))}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 <b>TÍN HIỆU HÔM NAY:</b>\n"
        f"{sig_lines if sig_lines else '• Không có tín hiệu\n'}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📈 <b>THỐNG KÊ NGÀY:</b>\n"
        f"• Tổng tín hiệu : {len(signals_today)}\n"
        f"• Thắng (TP1+)  : {len(wins)} ({win_rate}%)\n"
        f"• Thua (SL)     : {len(losses)}\n"
        f"• Đang mở       : {len(active)}\n"
        f"• Lợi nhuận     : +${total_profit:.2f} USD\n"
        f"• Thua lỗ       : -${total_loss:.2f} USD\n"
        f"• <b>Tổng: ${total_profit - total_loss:+.2f} USD</b>\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔍 <b>VÙNG QUAN TRỌNG NGÀY MAI:</b>\n"
        f"• Kháng cự: {sh_h4:.3f}\n"
        f"• Hỗ trợ  : {sl_h4:.3f}\n\n"
        f"💡 <b>NHẬN ĐỊNH NGÀY MAI:</b>\n"
        f"• Trade direction: {t_dir.upper()}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🤖 Gold Signal Bot"
    )


def format_warning_message(warning_type: str, data: dict) -> str:
    """Format các cảnh báo đặc biệt."""
    t = _fmt_time()
    templates = {
        "ranging": (
            f"⚠️ <b>GOLD — THỊ TRƯỜNG RANGING</b>\n"
            f"Phát hiện sideway tại {data.get('price', 0):.3f}\n"
            f"ATR hiện tại: {data.get('atr', 0):.3f} (< 0.8× MA)\n"
            f"→ Tạm dừng tìm entry\n→ Theo dõi chờ breakout"
        ),
        "choch": (
            f"⚠️ <b>GOLD — CHoCH H1 PHÁT HIỆN</b>\n"
            f"{data.get('direction','').capitalize()} CHoCH tại {data.get('price', 0):.3f}\n"
            f"H4 Bias vẫn: {data.get('bias','N/A')}\n"
            f"→ Tạm dừng entry mới\n→ Chờ xác nhận thêm từ H4"
        ),
        "liquidity_grab": (
            f"⚠️ <b>GOLD — LIQUIDITY GRAB</b>\n"
            f"Sweep {data.get('direction','')} tại {data.get('price',0):.3f}\n"
            f"Chưa đủ điều kiện xác nhận\n"
            f"Thiếu: {', '.join(data.get('missing_conditions', []))}\n"
            f"→ Cẩn thận bẫy {data.get('direction','')}!"
        ),
        "news_filter": (
            f"⚠️ <b>GOLD — TẠM DỪNG (NEWS)</b>\n"
            f"{data.get('title','')} lúc {data.get('time','')} [{data.get('impact','')}]\n"
            f"→ Không vào lệnh mới đến {data.get('end_time','')}\n"
            f"→ Lệnh active vẫn được theo dõi"
        ),
        "opposite_signal": (
            f"⚠️ <b>GOLD — TÍN HIỆU NGƯỢC CHIỀU</b>\n"
            f"Có tín hiệu {data.get('direction','')} mới\n"
            f"Đang có lệnh {data.get('old_direction','')} active\n"
            f"Entry cách nhau: {data.get('distance', 0):.1f} USD giá\n"
            f"→ Thị trường đang phân kỳ, cẩn thận!"
        ),
        "signal_expired": (
            f"⏰ <b>GOLD — TÍN HIỆU HẾT HIỆU LỰC</b>\n"
            f"Lệnh {data.get('direction','')} @ {data.get('entry',0):.3f} đã 24h\n"
            f"→ Tự động đóng theo dõi\n→ Bot tìm tín hiệu mới"
        ),
        "bot_start": (
            f"🤖 <b>GOLD SIGNAL BOT — KHỞI ĐỘNG</b>\n"
            f"⏰ {t}\nPhiên bản: 1.0\n"
            f"Cặp tiền: XAU/USD\nTimeframe: D1/H4/H1/M15\n"
            f"→ Bắt đầu phân tích thị trường"
        ),
        "bot_stop": (
            f"🛑 <b>GOLD SIGNAL BOT — TẮT</b>\n"
            f"⏰ {t}\n→ Bot đã dừng hoạt động"
        ),
    }
    return templates.get(warning_type, f"⚠️ <b>CẢNH BÁO</b>\n{warning_type}: {data}")
