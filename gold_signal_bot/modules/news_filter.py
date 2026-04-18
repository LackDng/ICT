"""
news_filter.py — Lấy và xử lý lịch tin tức kinh tế ảnh hưởng Gold.
Nguồn: FCS Forex API. Cache kết quả 1 giờ.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import pytz
import requests

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)
ICT = pytz.timezone(config.TIMEZONE)

HIGH_IMPACT_KEYWORDS = [
    "CPI", "Core CPI", "NFP", "Non-Farm", "FOMC", "Fed Rate",
    "GDP", "PPI", "Fed Chair", "Unemployment Rate",
]
MEDIUM_IMPACT_KEYWORDS = [
    "ADP", "Retail Sales", "ISM", "Jobless Claims",
    "Consumer Confidence", "Core PCE",
]

_cache: dict = {"data": None, "timestamp": None, "date": None}


def fetch_news_calendar(date: str = None) -> list:
    """Lấy lịch tin tức từ FCS API, cache 1 giờ."""
    global _cache
    now = datetime.now(timezone.utc)
    if date is None:
        date = now.strftime("%Y-%m-%d")

    # Trả cache nếu còn hợp lệ (< 1 giờ và cùng ngày)
    if (
        _cache["data"] is not None
        and _cache["date"] == date
        and _cache["timestamp"]
        and (now - _cache["timestamp"]).total_seconds() < 3600
    ):
        return _cache["data"]

    if not config.NEWS_API_KEY:
        logger.warning("NEWS_API_KEY chưa cấu hình — bỏ qua news filter")
        return []

    try:
        resp = requests.get(
            "https://fcsapi.com/api-v3/forex/economy_cal",
            params={"access_key": config.NEWS_API_KEY, "country": "us", "date": date},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            news_list = data.get("response", []) if isinstance(data, dict) else []
            _cache["data"] = news_list
            _cache["timestamp"] = now
            _cache["date"] = date
            return news_list
        logger.warning(f"FCS API lỗi: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Không thể lấy lịch news: {e}")
    return []


def filter_gold_relevant_news(news_list: list) -> list:
    """Lọc tin tức High/Medium impact liên quan Gold."""
    result = []
    for item in news_list:
        title = item.get("title", "") or item.get("event", "") or ""
        impact = None
        for kw in HIGH_IMPACT_KEYWORDS:
            if kw.lower() in title.lower():
                impact = "High"
                break
        if impact is None:
            for kw in MEDIUM_IMPACT_KEYWORDS:
                if kw.lower() in title.lower():
                    impact = "Medium"
                    break
        if impact:
            item = dict(item)
            item["impact"] = impact
            result.append(item)
    return result


def _parse_news_time(item: dict) -> Optional[datetime]:
    """Parse thời gian tin tức sang UTC datetime."""
    for key in ("date", "datetime", "time"):
        raw = item.get(key)
        if raw:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
                try:
                    dt = datetime.strptime(raw[:19], fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
    return None


def is_news_window(current_time: datetime, news_list: list) -> dict:
    """Kiểm tra có đang trong cửa sổ news không."""
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    relevant = filter_gold_relevant_news(news_list)
    nearest_future: Optional[dict] = None
    nearest_past: Optional[dict] = None
    min_future_diff = None
    min_past_diff = None

    for item in relevant:
        news_dt = _parse_news_time(item)
        if news_dt is None:
            continue
        impact = item.get("impact", "Medium")
        before = config.NEWS_HIGH_BEFORE if impact == "High" else config.NEWS_MED_BEFORE
        after = config.NEWS_HIGH_AFTER if impact == "High" else config.NEWS_MED_AFTER

        window_start = news_dt - timedelta(minutes=before)
        window_end = news_dt + timedelta(minutes=after)

        if window_start <= current_time <= window_end:
            diff_to = (news_dt - current_time).total_seconds() / 60 if current_time < news_dt else 0
            diff_after = (current_time - news_dt).total_seconds() / 60 if current_time >= news_dt else 0
            return {
                "in_window": True,
                "news_item": item,
                "impact": impact,
                "minutes_to": round(diff_to, 1),
                "minutes_after": round(diff_after, 1),
            }

        if news_dt > current_time:
            diff = (news_dt - current_time).total_seconds() / 60
            if min_future_diff is None or diff < min_future_diff:
                min_future_diff = diff
                nearest_future = item

        if news_dt < current_time:
            diff = (current_time - news_dt).total_seconds() / 60
            if min_past_diff is None or diff < min_past_diff:
                min_past_diff = diff
                nearest_past = item

    return {
        "in_window": False,
        "news_item": nearest_future or nearest_past,
        "impact": None,
        "minutes_to": round(min_future_diff, 1) if min_future_diff is not None else None,
        "minutes_after": round(min_past_diff, 1) if min_past_diff is not None else None,
    }


def get_upcoming_news(hours_ahead: int = 8) -> list:
    """Lấy danh sách tin sắp tới trong X giờ."""
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(hours=hours_ahead)
    news_list = fetch_news_calendar()
    relevant = filter_gold_relevant_news(news_list)
    upcoming = []
    for item in relevant:
        news_dt = _parse_news_time(item)
        if news_dt and now <= news_dt <= deadline:
            item = dict(item)
            item["minutes_until"] = round((news_dt - now).total_seconds() / 60, 1)
            item["time"] = news_dt.astimezone(ICT).strftime("%H:%M ICT")
            upcoming.append(item)
    return sorted(upcoming, key=lambda x: x.get("minutes_until", 999))


def get_today_news_summary() -> list:
    """Lấy tóm tắt tất cả tin tức quan trọng hôm nay."""
    news_list = fetch_news_calendar()
    relevant = filter_gold_relevant_news(news_list)
    for item in relevant:
        news_dt = _parse_news_time(item)
        if news_dt:
            item["time"] = news_dt.astimezone(ICT).strftime("%H:%M ICT")
    return relevant
