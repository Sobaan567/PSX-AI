from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
import os
import json
import random
import math
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="PSX AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

PSX_MARKET_WATCH = "https://dps.psx.com.pk/market-watch"
PSX_INTRADAY = "https://dps.psx.com.pk/timeseries/int/{}"
PSX_EOD = "https://dps.psx.com.pk/timeseries/eod/{}"
PSX_CORPORATE_ANNOUNCEMENTS = "https://www.psx.com.pk/psx/announcement/corporate-announcements"
PSX_CALENDAR = "https://dps.psx.com.pk/calendar"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://dps.psx.com.pk/",
})

class ChatMessage(BaseModel):
    message: str
    history: list = []

COMMON_SYMBOLS = [
    "OGDC", "ENGRO", "HBL", "PSO", "LUCK", "MARI", "TRG", "UBL", "MCB", "HUBC",
    "MLCF", "SYS", "FFC", "EFERT", "PPL", "POL", "BAFL", "NBP", "DGKC", "CHCC",
]

def parse_float(val):
    try:
        return float(str(val).replace(",", "").strip())
    except:
        return 0.0

def normalize_market_stock(stock):
    current = parse_float(stock.get("current", 0))
    ldcp = parse_float(stock.get("ldcp", 0))
    open_price = parse_float(stock.get("open", 0))
    high = parse_float(stock.get("high", 0))
    low = parse_float(stock.get("low", 0))
    change = parse_float(stock.get("change", 0))
    pchange = parse_float(stock.get("pchange", 0))

    is_live = current > 0
    if not is_live:
        fallback_price = ldcp or open_price or high or low
        current = fallback_price
        if fallback_price:
            change = 0.0
            pchange = 0.0
            stock["price_basis"] = "Previous close"
        else:
            stock["price_basis"] = "Unavailable"
    else:
        stock["price_basis"] = "Live market watch"
        if ldcp:
            change = current - ldcp
            pchange = (change / ldcp) * 100

    stock.update({
        "ldcp": ldcp,
        "open": open_price or current,
        "high": high or max(current, ldcp),
        "low": low or min(value for value in [current, ldcp] if value > 0) if any(value > 0 for value in [current, ldcp]) else 0.0,
        "current": current,
        "change": change,
        "pchange": pchange,
        "volume": parse_float(stock.get("volume", 0)),
        "is_live": is_live,
    })
    return stock

def fetch_market_watch():
    try:
        r = session.get(PSX_MARKET_WATCH, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        table = soup.find("table")
        if not table:
            return {"error": "No table found"}

        headers = [th.get("data-name") or th.text.strip().lower() for th in table.find_all("th")]

        stocks = []
        for row in table.find("tbody").find_all("tr"):
            cols = [td.text.strip() for td in row.find_all("td")]
            if len(cols) < 6:
                continue
            try:
                stock = {
                    "symbol": cols[0],
                    "sector": cols[1],
                    "ldcp": parse_float(cols[3]),
                    "open": parse_float(cols[4]),
                    "high": parse_float(cols[5]),
                    "low": parse_float(cols[6]) if len(cols) > 6 else 0,
                    "current": parse_float(cols[7]) if len(cols) > 7 else 0,
                    "change": parse_float(cols[8]) if len(cols) > 8 else 0,
                    "pchange": parse_float(cols[9]) if len(cols) > 9 else 0,
                    "volume": parse_float(cols[10]) if len(cols) > 10 else 0,
                }
                stocks.append(normalize_market_stock(stock))
            except:
                continue
        return stocks
    except Exception as e:
        return {"error": str(e)}

def fetch_eod(symbol: str):
    try:
        r = session.get(PSX_EOD.format(symbol.upper()), timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def fetch_intraday(symbol: str):
    try:
        r = session.get(PSX_INTRADAY.format(symbol.upper()), timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def fetch_market_quote(symbol: str):
    sym = symbol.upper().strip()
    data = fetch_market_watch()
    if isinstance(data, dict) and "error" in data:
        return None

    candidates = [
        sym,
        f"{sym}XD",
        f"{sym}H",
        f"{sym}NC",
    ]

    for candidate in candidates:
        match = next((stock for stock in data if stock.get("symbol", "").upper() == candidate), None)
        if match:
            return match

    return next(
        (
            stock for stock in data
            if stock.get("symbol", "").upper().startswith(sym)
            and parse_float(stock.get("current", 0)) > 0
        ),
        None,
    )

def extract_symbols(text: str):
    cleaned = "".join(ch if ch.isalnum() else " " for ch in text.upper())
    words = set(cleaned.split())
    found = [symbol for symbol in COMMON_SYMBOLS if symbol in words or f"{symbol}XD" in words or f"{symbol}NC" in words]
    return found[:4]

def summarize_stock_for_chat(stock):
    if not stock:
        return None
    return {
        "symbol": stock.get("symbol", ""),
        "sector": stock.get("sector", ""),
        "current": round(parse_float(stock.get("current", 0)), 2),
        "change": round(parse_float(stock.get("change", 0)), 2),
        "pchange": round(parse_float(stock.get("pchange", 0)), 2),
        "volume": parse_float(stock.get("volume", 0)),
    }

def normalize_rows(data):
    rows = []
    if isinstance(data, list):
        if data and isinstance(data[0], list):
            for row in data:
                if len(row) < 2:
                    continue
                # PSX EOD rows are [timestamp, close, volume, open].
                rows.append({
                    "time": row[0],
                    "close": parse_float(row[1]),
                    "volume": parse_float(row[2]) if len(row) > 2 else 0.0,
                    "open": parse_float(row[3]) if len(row) > 3 else 0.0,
                })
            return sorted(rows, key=lambda item: item.get("time", 0))
        return sorted(
            [row for row in data if parse_float(row.get("close", 0)) > 0],
            key=lambda item: item.get("time") or item.get("date") or 0,
        )
    if isinstance(data, dict):
        for key in ["data", "results", "records"]:
            if key in data and isinstance(data[key], list):
                return normalize_rows(data[key])
    return []

def generate_mock_rows(symbol: str):
    seed = sum(ord(c) for c in symbol)
    random.seed(seed)
    base = float(100 + (seed % 400))
    rows = []
    for _ in range(14):
        base = round(base + random.uniform(-3, 4), 2)
        rows.append({"close": base})
    return rows

def simple_moving_average(values, window):
    if len(values) < window:
        return None
    return sum(values[-window:]) / window

def exponential_moving_average(values, window):
    if not values:
        return None
    alpha = 2 / (window + 1)
    ema = values[0]
    for value in values[1:]:
        ema = (value * alpha) + (ema * (1 - alpha))
    return ema

def relative_strength_index(values, period=14):
    if len(values) <= period:
        return 50.0

    gains = []
    losses = []
    for prev, current in zip(values[-period - 1:-1], values[-period:]):
        change = current - prev
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0

    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def percent_returns(values):
    returns = []
    for prev, current in zip(values[:-1], values[1:]):
        if prev:
            returns.append((current - prev) / prev)
    return returns

def standard_deviation(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(variance)

def linear_regression_forecast(values, lookback=30):
    series = values[-lookback:]
    if len(series) < 5:
        return values[-1], 0.0

    n = len(series)
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(series) / n
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:
        return series[-1], 0.0

    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, series)) / denominator
    intercept = mean_y - slope * mean_x
    forecast = intercept + slope * n
    slope_pct = slope / series[-1] if series[-1] else 0.0
    return forecast, slope_pct

def safe_div(numerator, denominator, fallback=0.0):
    return numerator / denominator if denominator else fallback

def bollinger_position(values, window=20):
    if len(values) < window:
        return 0.5, values[-1] if values else 0, values[-1] if values else 0
    series = values[-window:]
    mean = sum(series) / len(series)
    sd = standard_deviation(series)
    upper = mean + (2 * sd)
    lower = mean - (2 * sd)
    position = safe_div(values[-1] - lower, upper - lower, 0.5)
    return clamp(position, 0, 1), lower, upper

def stochastic_oscillator(values, window=14):
    if len(values) < window:
        return 50.0
    series = values[-window:]
    low = min(series)
    high = max(series)
    return clamp(safe_div(values[-1] - low, high - low, 0.5) * 100, 0, 100)

def macd_signal(values):
    if len(values) < 35:
        return 0.0
    ema12 = exponential_moving_average(values[-80:], 12)
    ema26 = exponential_moving_average(values[-80:], 26)
    return safe_div((ema12 or values[-1]) - (ema26 or values[-1]), values[-1])

def feature_snapshot(closes, volumes=None):
    volumes = volumes or []
    if len(closes) < 35:
        return {}

    last = closes[-1]
    returns = percent_returns(closes)
    volatility = standard_deviation(returns[-30:]) if returns else 0.0
    ma7 = simple_moving_average(closes, 7) or last
    ma14 = simple_moving_average(closes, 14) or last
    ma30 = simple_moving_average(closes, 30) or last
    rsi = relative_strength_index(closes, 14)
    boll_pos, _, _ = bollinger_position(closes, 20)
    stoch = stochastic_oscillator(closes, 14)
    recent_volumes = [parse_float(v) for v in volumes[-20:] if parse_float(v) > 0]
    avg_volume = sum(recent_volumes) / len(recent_volumes) if recent_volumes else 0.0
    current_volume = parse_float(volumes[-1]) if volumes else 0.0
    volume_ratio = safe_div(current_volume, avg_volume, 1.0) if current_volume else 1.0

    return {
        "ret_1": returns[-1] if len(returns) >= 1 else 0.0,
        "ret_3": sum(returns[-3:]) if len(returns) >= 3 else 0.0,
        "ret_5": sum(returns[-5:]) if len(returns) >= 5 else 0.0,
        "ret_10": sum(returns[-10:]) if len(returns) >= 10 else 0.0,
        "ret_20": sum(returns[-20:]) if len(returns) >= 20 else 0.0,
        "ma7_gap": safe_div(ma7 - ma14, last),
        "ma30_gap": safe_div(last - ma30, last),
        "macd": macd_signal(closes),
        "rsi": (rsi - 50) / 50,
        "bollinger": (boll_pos - 0.5) * 2,
        "stochastic": (stoch - 50) / 50,
        "volatility": volatility,
        "volume_ratio": clamp(volume_ratio - 1, -2, 2),
    }

def feature_distance(a, b):
    weights = {
        "ret_1": 0.7,
        "ret_3": 0.9,
        "ret_5": 1.1,
        "ret_10": 1.0,
        "ret_20": 0.8,
        "ma7_gap": 1.3,
        "ma30_gap": 1.2,
        "macd": 1.1,
        "rsi": 0.9,
        "bollinger": 0.8,
        "stochastic": 0.7,
        "volatility": 0.8,
        "volume_ratio": 0.25,
    }
    total = 0.0
    for key, weight in weights.items():
        total += weight * ((a.get(key, 0.0) - b.get(key, 0.0)) ** 2)
    return math.sqrt(total)

def historical_analog_model(closes, volumes, days=5, neighbors=24, train_limit=900):
    if len(closes) < max(90, days + 60):
        return {
            "expected_return": 0.0,
            "confidence": 0.0,
            "neighbors": [],
            "hit_rate": 0.0,
            "sample_size": 0,
        }

    latest_features = feature_snapshot(closes, volumes)
    candidates = []
    start = max(35, len(closes) - train_limit - days)
    end = len(closes) - days
    for index in range(start, end):
        window_closes = closes[:index + 1]
        if len(window_closes) < 35 or closes[index] <= 0:
            continue
        features = feature_snapshot(window_closes, volumes[:index + 1])
        distance = feature_distance(latest_features, features)
        future_return = safe_div(closes[index + days] - closes[index], closes[index])
        candidates.append({
            "distance": distance,
            "return": future_return,
            "date_index": index,
            "close": closes[index],
        })

    candidates = sorted(candidates, key=lambda item: item["distance"])[:neighbors]
    if not candidates:
        return {
            "expected_return": 0.0,
            "confidence": 0.0,
            "neighbors": [],
            "hit_rate": 0.0,
            "sample_size": 0,
        }

    weighted = []
    for item in candidates:
        weight = 1 / (item["distance"] + 0.035)
        weighted.append((weight, item["return"], item))

    total_weight = sum(weight for weight, _, _ in weighted)
    expected_return = safe_div(sum(weight * ret for weight, ret, _ in weighted), total_weight)
    direction = 1 if expected_return >= 0 else -1
    matching = [item for _, ret, item in weighted if (1 if ret >= 0 else -1) == direction]
    hit_rate = len(matching) / len(weighted) * 100
    avg_distance = sum(item["distance"] for item in candidates) / len(candidates)
    confidence = clamp((hit_rate - 50) / 50, 0, 1) * 0.55 + clamp(1 - avg_distance, 0, 1) * 0.45

    return {
        "expected_return": expected_return,
        "confidence": confidence,
        "neighbors": [
            {
                "similarity": round(clamp(1 - item["distance"], 0, 1) * 100, 1),
                "future_return_pct": round(item["return"] * 100, 2),
                "close": round(item["close"], 2),
            }
            for item in candidates[:6]
        ],
        "hit_rate": round(hit_rate, 1),
        "sample_size": len(candidates),
    }

def walk_forward_validation(closes, volumes, days=5, cases=70):
    if len(closes) < 160 + days:
        return {
            "cases": 0,
            "directional_accuracy": None,
            "mae_pct": None,
            "avg_abs_move_pct": None,
        }

    predictions = []
    start = max(100, len(closes) - cases - days)
    for index in range(start, len(closes) - days):
        history_closes = closes[:index + 1]
        history_volumes = volumes[:index + 1]
        if len(history_closes) < 120:
            continue
        analog = historical_analog_model(history_closes, history_volumes, days=days, neighbors=18, train_limit=500)
        regression_price, regression_slope = linear_regression_forecast(history_closes, 30)
        regression_return = safe_div(regression_price - history_closes[-1], history_closes[-1])
        predicted = (analog["expected_return"] * 0.65) + (regression_return * 0.35)
        actual = safe_div(closes[index + days] - closes[index], closes[index])
        predictions.append((predicted, actual))

    if not predictions:
        return {
            "cases": 0,
            "directional_accuracy": None,
            "mae_pct": None,
            "avg_abs_move_pct": None,
        }

    correct = len([1 for predicted, actual in predictions if (predicted >= 0) == (actual >= 0)])
    mae = sum(abs(predicted - actual) for predicted, actual in predictions) / len(predictions)
    avg_abs_move = sum(abs(actual) for _, actual in predictions) / len(predictions)
    return {
        "cases": len(predictions),
        "directional_accuracy": round(correct / len(predictions) * 100, 1),
        "mae_pct": round(mae * 100, 2),
        "avg_abs_move_pct": round(avg_abs_move * 100, 2),
    }

def clamp(value, low, high):
    return max(low, min(high, value))

def strip_market_suffix(symbol: str):
    clean = symbol.upper().strip()
    for suffix in ("XD", "NC"):
        if clean.endswith(suffix) and len(clean) > len(suffix):
            return clean[:-len(suffix)]
    return clean

def format_market_date(value):
    try:
        timestamp = int(value)
        if timestamp > 1000000000:
            return datetime.utcfromtimestamp(timestamp).strftime("%b %d")
    except:
        pass
    return str(value or "")

def build_price_history(rows, current_price=None, current_volume=0, limit=90):
    history = []
    for row in rows[-limit:]:
        close = parse_float(row.get("close", 0))
        if close <= 0:
            continue
        history.append({
            "date": format_market_date(row.get("time") or row.get("date")),
            "close": round(close, 2),
            "volume": parse_float(row.get("volume", 0)),
        })

    if current_price and history:
        last_close = history[-1]["close"]
        if last_close and abs(current_price - last_close) / last_close > 0.0005:
            history.append({
                "date": "Live",
                "close": round(current_price, 2),
                "volume": parse_float(current_volume),
                "live": True,
            })
        else:
            history[-1]["close"] = round(current_price, 2)
            history[-1]["live"] = True
    return history[-limit:]

def build_forecast_path(current_price, target_price, volatility, days):
    if not current_price:
        return []

    daily_band = max(0.006, min(0.055, volatility or 0.012))
    path = []
    for day in range(1, days + 1):
        progress = day / days
        smooth_progress = 1 - ((1 - progress) ** 1.35)
        base = current_price + ((target_price - current_price) * smooth_progress)
        band = current_price * daily_band * math.sqrt(day)
        path.append({
            "date": f"Day {day}",
            "base": round(base, 2),
            "bull": round(base + band, 2),
            "bear": round(max(0, base - band), 2),
        })
    return path

def max_drawdown(values):
    peak = values[0] if values else 0
    worst = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            worst = min(worst, (value - peak) / peak)
    return worst * 100

def build_equity_sample(points, limit=80):
    if len(points) <= limit:
        return points
    step = max(1, len(points) // limit)
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled

def fetch_corporate_announcements(limit=24):
    try:
        r = session.get(PSX_CORPORATE_ANNOUNCEMENTS, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        wrapper = soup.select_one("#announcements-content-wrapper") or soup
        date_text = ""
        date_box = wrapper.select_one(".dateBox")
        if date_box:
            date_text = date_box.get_text(" ", strip=True)

        announcements = []
        for link in wrapper.select("a"):
            box = link.select_one(".release-boxes") or link
            text = box.get_text(" ", strip=True)
            if not text:
                continue

            symbol = ""
            company = ""
            title = text
            time_text = ""
            span = box.select_one("span")
            heading = box.select_one("h6")
            para = box.select_one("p")
            if span:
                symbol = span.get_text(" ", strip=True)
            if heading:
                company = heading.get_text(" ", strip=True)
            if para:
                raw = para.get_text(" ", strip=True)
                if "-" in raw:
                    time_text, title = [part.strip() for part in raw.split("-", 1)]
                else:
                    title = raw

            announcements.append({
                "symbol": symbol,
                "company": company,
                "title": title[:260],
                "time": time_text,
                "date": date_text,
                "type": "Company Announcement",
                "url": link.get("href"),
                "source": "PSX Corporate Announcements",
            })
            if len(announcements) >= limit:
                break
        return announcements
    except Exception as e:
        return {"error": str(e)}

def fetch_market_calendar(from_date: str, to_date: str):
    try:
        r = session.post(PSX_CALENDAR, data={"from": from_date, "to": to_date}, timeout=20)
        r.raise_for_status()
        payload = r.json()
        return payload.get("data", []) if isinstance(payload, dict) else []
    except Exception as e:
        return {"error": str(e)}

def run_backtest(symbol: str, strategy="ma_cross", lookback=260, initial_cash=100000.0):
    data = fetch_eod(symbol)
    if isinstance(data, dict) and "error" in data:
        return {"error": data["error"]}

    rows = normalize_rows(data)
    rows = [row for row in rows if parse_float(row.get("close", 0)) > 0][-lookback:]
    if len(rows) < 60:
        return {"error": f"Not enough historical data for {symbol.upper()} backtest. Need at least 60 closes."}

    closes = [parse_float(row["close"]) for row in rows]
    cash = float(initial_cash)
    shares = 0.0
    entry_price = 0.0
    trades = []
    equity = []

    def buy(index, reason):
        nonlocal cash, shares, entry_price
        price = closes[index]
        if cash <= 0 or price <= 0:
            return
        shares = cash / price
        cash = 0.0
        entry_price = price
        trades.append({
            "type": "BUY",
            "date": rows[index].get("time"),
            "price": round(price, 2),
            "reason": reason,
        })

    def sell(index, reason):
        nonlocal cash, shares, entry_price
        price = closes[index]
        if shares <= 0:
            return
        value = shares * price
        pnl_pct = ((price - entry_price) / entry_price * 100) if entry_price else 0
        cash = value
        shares = 0.0
        trades.append({
            "type": "SELL",
            "date": rows[index].get("time"),
            "price": round(price, 2),
            "pnl_pct": round(pnl_pct, 2),
            "reason": reason,
        })

    for i in range(len(closes)):
        if i >= 30:
            if strategy == "rsi":
                rsi = relative_strength_index(closes[:i + 1], 14)
                if shares == 0 and rsi < 32:
                    buy(i, f"RSI oversold at {round(rsi, 1)}")
                elif shares > 0 and rsi > 68:
                    sell(i, f"RSI overheated at {round(rsi, 1)}")
            elif strategy == "breakout":
                high_20 = max(closes[i - 20:i])
                low_10 = min(closes[i - 10:i])
                if shares == 0 and closes[i] > high_20:
                    buy(i, "20-day breakout")
                elif shares > 0 and closes[i] < low_10:
                    sell(i, "10-day breakdown exit")
            else:
                fast = simple_moving_average(closes[:i + 1], 10)
                slow = simple_moving_average(closes[:i + 1], 30)
                prev_fast = simple_moving_average(closes[:i], 10)
                prev_slow = simple_moving_average(closes[:i], 30)
                if shares == 0 and fast and slow and prev_fast and prev_slow and prev_fast <= prev_slow and fast > slow:
                    buy(i, "MA10 crossed above MA30")
                elif shares > 0 and fast and slow and prev_fast and prev_slow and prev_fast >= prev_slow and fast < slow:
                    sell(i, "MA10 crossed below MA30")

        value = cash + shares * closes[i]
        equity.append({
            "date": rows[i].get("time"),
            "close": round(closes[i], 2),
            "value": round(value, 2),
        })

    if shares > 0:
        sell(len(closes) - 1, "Backtest close")
        equity[-1]["value"] = round(cash, 2)

    final_value = cash
    total_return = ((final_value - initial_cash) / initial_cash * 100) if initial_cash else 0
    buy_hold = ((closes[-1] - closes[0]) / closes[0] * 100) if closes[0] else 0
    closed_trades = [trade for trade in trades if trade["type"] == "SELL"]
    wins = len([trade for trade in closed_trades if trade.get("pnl_pct", 0) > 0])
    win_rate = (wins / len(closed_trades) * 100) if closed_trades else 0

    return {
        "symbol": symbol.upper(),
        "strategy": strategy,
        "initial_cash": round(initial_cash, 2),
        "final_value": round(final_value, 2),
        "total_return_pct": round(total_return, 2),
        "buy_hold_return_pct": round(buy_hold, 2),
        "max_drawdown_pct": round(max_drawdown([item["value"] for item in equity]), 2),
        "trade_count": len(closed_trades),
        "win_rate_pct": round(win_rate, 2),
        "trades": trades[-20:],
        "equity": build_equity_sample(equity),
    }

@app.get("/")
def root():
    return {"status": "PSX AI Backend Running", "time": datetime.utcnow().isoformat()}

@app.get("/api/market")
def get_market():
    data = fetch_market_watch()
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return data

@app.get("/api/price/{symbol}")
def get_price(symbol: str):
    data = fetch_intraday(symbol)
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"symbol": symbol.upper(), "data": data}

@app.get("/api/history/{symbol}")
def get_history(symbol: str):
    data = fetch_eod(symbol)
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"symbol": symbol.upper(), "data": data}

@app.get("/api/gainers")
def get_gainers():
    data = fetch_market_watch()
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    try:
        gainers = sorted(
            [s for s in data if s.get("change", 0) > 0],
            key=lambda x: x.get("pchange", 0),
            reverse=True
        )[:10]
        return gainers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/losers")
def get_losers():
    data = fetch_market_watch()
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    try:
        losers = sorted(
            [s for s in data if s.get("change", 0) < 0],
            key=lambda x: x.get("pchange", 0)
        )[:10]
        return losers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/brief")
def get_market_brief():
    data = fetch_market_watch()
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    try:
        active = [s for s in data if s.get("volume", 0) > 0]
        gainers = sorted([s for s in active if s.get("change", 0) > 0], key=lambda x: x.get("pchange", 0), reverse=True)[:5]
        losers = sorted([s for s in active if s.get("change", 0) < 0], key=lambda x: x.get("pchange", 0))[:5]
        volume_leaders = sorted(active, key=lambda x: x.get("volume", 0), reverse=True)[:5]
        advancing = len([s for s in active if s.get("change", 0) > 0])
        declining = len([s for s in active if s.get("change", 0) < 0])
        total_volume = sum(s.get("volume", 0) for s in active)
        breadth = ((advancing - declining) / len(active) * 100) if active else 0

        mood = "bullish" if breadth > 12 else "bearish" if breadth < -12 else "mixed"
        leader = gainers[0]["symbol"] if gainers else "no clear leader"
        pressure = losers[0]["symbol"] if losers else "limited downside pressure"
        volume_name = volume_leaders[0]["symbol"] if volume_leaders else "none"

        summary = (
            f"Market mood is {mood}. {advancing} symbols are advancing against {declining} declining. "
            f"{leader} leads the upside, while {pressure} is the weakest mover. "
            f"{volume_name} is the most active symbol by volume."
        )

        return {
            "summary": summary,
            "mood": mood,
            "breadth": round(breadth, 2),
            "advancing": advancing,
            "declining": declining,
            "total_volume": total_volume,
            "top_gainers": gainers,
            "top_losers": losers,
            "volume_leaders": volume_leaders,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news")
def get_news(limit: int = Query(24, ge=1, le=60)):
    data = fetch_corporate_announcements(limit)
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"source": "PSX Corporate Announcements", "data": data}

@app.get("/api/calendar")
def get_calendar(
    from_date: str = Query(None, alias="from"),
    to_date: str = Query(None, alias="to"),
):
    start = from_date or datetime.utcnow().strftime("%Y-%m-%d")
    end = to_date or (datetime.utcnow() + timedelta(days=45)).strftime("%Y-%m-%d")
    data = fetch_market_calendar(start, end)
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"source": "PSX AGM/EOGM Calendar", "from": start, "to": end, "data": data}

@app.get("/api/backtest/{symbol}")
def get_backtest(
    symbol: str,
    strategy: str = Query("ma_cross", pattern="^(ma_cross|rsi|breakout)$"),
    lookback: int = Query(260, ge=60, le=1200),
    cash: float = Query(100000, gt=0, le=100000000),
):
    result = run_backtest(symbol, strategy=strategy, lookback=lookback, initial_cash=cash)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return result

@app.get("/api/predict/{symbol}")
@app.post("/api/predict/{symbol}")
def predict(symbol: str, days: int = Query(5, ge=1, le=10)):
    requested_sym = symbol.upper().strip()
    data_symbol = strip_market_suffix(requested_sym)

    data = fetch_eod(requested_sym)
    if isinstance(data, dict) and "error" in data and data_symbol != requested_sym:
        data = fetch_eod(data_symbol)
    elif isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])

    rows = normalize_rows(data)
    if len(rows) < 20 and data_symbol != requested_sym:
        fallback = fetch_eod(data_symbol)
        if not (isinstance(fallback, dict) and "error" in fallback):
            rows = normalize_rows(fallback)

    rows = [row for row in rows if parse_float(row.get("close", 0)) > 0]
    closes = [parse_float(r.get("close", 0)) for r in rows]

    if len(closes) < 20:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough historical data for {requested_sym}. Need at least 20 daily closes.",
        )

    try:
        historical_last = closes[-1]
        quote = fetch_market_quote(requested_sym) or fetch_market_quote(data_symbol)
        live_price = parse_float(quote.get("current", 0)) if quote else 0.0
        previous_close = parse_float(quote.get("ldcp", 0)) if quote else 0.0
        current_price = live_price or historical_last
        reference_close = previous_close or (closes[-2] if len(closes) > 1 else historical_last)
        session_change = current_price - reference_close if reference_close else 0.0
        session_change_pct = (session_change / reference_close * 100) if reference_close else 0.0

        analysis_closes = closes[:]
        analysis_volumes = [parse_float(r.get("volume", 0)) for r in rows]
        if live_price and historical_last and abs(live_price - historical_last) / historical_last > 0.0005:
            analysis_closes.append(live_price)
            analysis_volumes.append(parse_float(quote.get("volume", 0)) if quote else 0.0)

        ma7 = simple_moving_average(analysis_closes, 7)
        ma14 = simple_moving_average(analysis_closes, 14)
        ma30 = simple_moving_average(analysis_closes, 30) or ma14
        ema12 = exponential_moving_average(analysis_closes[-60:], 12)
        ema26 = exponential_moving_average(analysis_closes[-60:], 26)
        rsi = relative_strength_index(analysis_closes, 14)

        returns = percent_returns(analysis_closes)
        short_momentum = sum(returns[-5:]) if len(returns) >= 5 else 0.0
        medium_momentum = sum(returns[-20:]) if len(returns) >= 20 else short_momentum
        volatility = standard_deviation(returns[-30:]) if len(returns) >= 10 else 0.0
        regression_price, regression_slope = linear_regression_forecast(analysis_closes, 30)
        current_features = feature_snapshot(analysis_closes, analysis_volumes)
        bollinger_pos, bollinger_lower, bollinger_upper = bollinger_position(analysis_closes, 20)
        stochastic = stochastic_oscillator(analysis_closes, 14)
        macd = macd_signal(analysis_closes)
        analog_model = historical_analog_model(analysis_closes, analysis_volumes, days=days)
        validation = walk_forward_validation(analysis_closes, analysis_volumes, days=days)

        trend_score = 0.0
        if ma7 and ma14:
            trend_score += ((ma7 - ma14) / current_price) * 3.0
        if ema12 and ema26:
            trend_score += ((ema12 - ema26) / current_price) * 2.0
        trend_score += short_momentum * 0.7
        trend_score += medium_momentum * 0.3
        trend_score += regression_slope * 4.0

        if rsi > 72:
            trend_score -= 0.015
        elif rsi < 28:
            trend_score += 0.015

        max_window_move = max(0.012, min(0.12, volatility * math.sqrt(days) * 2.15))
        technical_return = trend_score * math.sqrt(days)
        regression_return = safe_div(regression_price - current_price, current_price)
        analog_return = analog_model["expected_return"]
        mean_reversion_return = 0.0
        if bollinger_pos > 0.82 or rsi > 68:
            mean_reversion_return -= min(0.035, (bollinger_pos - 0.5) * 0.035 + max(0, rsi - 68) / 1000)
        elif bollinger_pos < 0.18 or rsi < 32:
            mean_reversion_return += min(0.035, (0.5 - bollinger_pos) * 0.035 + max(0, 32 - rsi) / 1000)

        analog_weight = 0.18 + (analog_model["confidence"] * 0.22)
        technical_weight = 0.34
        regression_weight = 0.22
        mean_reversion_weight = 0.16
        total_model_weight = analog_weight + technical_weight + regression_weight + mean_reversion_weight
        expected_change_pct = (
            (technical_return * technical_weight)
            + (regression_return * regression_weight)
            + (analog_return * analog_weight)
            + (mean_reversion_return * mean_reversion_weight)
        ) / total_model_weight
        expected_change_pct = clamp(expected_change_pct, -max_window_move, max_window_move)
        blended_target = (
            (current_price * (1 + expected_change_pct) * 0.58)
            + (regression_price * 0.22)
            + ((ema12 or current_price) * 0.20)
        )
        target_price = clamp(
            blended_target,
            current_price * (1 - max_window_move),
            current_price * (1 + max_window_move),
        )
        expected_change_pct = (target_price - current_price) / current_price if current_price else 0.0

        if abs(expected_change_pct) < 0.004:
            trend = "NEUTRAL"
        else:
            trend = "UP" if expected_change_pct > 0 else "DOWN"

        signal_strength = min(abs(expected_change_pct) / max(volatility * math.sqrt(days), 0.006), 1.0)
        history_quality = min(len(analysis_closes) / 120, 1.0)
        validation_score = 0.0
        if validation.get("directional_accuracy") is not None:
            validation_score = clamp((validation["directional_accuracy"] - 50) / 25, 0, 1)
        confidence = 46 + (signal_strength * 25) + (history_quality * 6) + (analog_model["confidence"] * 9) + (validation_score * 8)
        if trend == "NEUTRAL":
            confidence = min(confidence, 63)
        confidence = round(min(confidence, 90.0), 1)

        recent_window = analysis_closes[-min(len(analysis_closes), 45):]
        support = min(recent_window)
        resistance = max(recent_window)
        risk_floor = max(current_price * (1 - max(0.025, volatility * 1.8)), support * 0.995)
        risk_ceiling = min(current_price * (1 + max(0.025, volatility * 1.8)), resistance * 1.005)
        risk_level = risk_floor if trend != "DOWN" else risk_ceiling

        if target_price >= current_price:
            reward = max(target_price - current_price, 0)
            risk = max(current_price - risk_floor, current_price * 0.01)
        else:
            reward = max(current_price - target_price, 0)
            risk = max(risk_ceiling - current_price, current_price * 0.01)
        risk_reward = reward / risk if risk else 0.0

        volume_values = [parse_float(row.get("volume", 0)) for row in rows[-20:] if parse_float(row.get("volume", 0)) > 0]
        avg_volume = sum(volume_values) / len(volume_values) if volume_values else 0.0
        live_volume = parse_float(quote.get("volume", 0)) if quote else 0.0
        volume_ratio = (live_volume / avg_volume) if avg_volume and live_volume else 0.0

        trend_component = clamp((((ma7 or current_price) - (ma30 or current_price)) / current_price) * 900, -100, 100)
        momentum_component = clamp(short_momentum * 500, -100, 100)
        rsi_component = clamp((50 - abs(rsi - 50)) * 2, 0, 100)
        volatility_component = clamp(100 - (volatility * 2500), 0, 100)
        analog_component = clamp(analog_return * 900, -100, 100)
        validation_component = validation.get("directional_accuracy")

        if trend == "UP":
            rating = "Advanced bullish" if confidence >= 72 else "Bullish watch" if confidence >= 64 else "Mild upside"
        elif trend == "DOWN":
            rating = "Advanced risk watch" if confidence >= 72 else "Risk watch" if confidence >= 64 else "Mild downside"
        else:
            rating = "Wait for confirmation"

        signals = {
            "short_momentum_pct": round(short_momentum * 100, 2),
            "medium_momentum_pct": round(medium_momentum * 100, 2),
            "volatility_pct": round(volatility * 100, 2),
            "regression_slope_pct": round(regression_slope * 100, 2),
            "session_change_pct": round(session_change_pct, 2),
            "volume_ratio": round(volume_ratio, 2),
            "macd_pct": round(macd * 100, 2),
            "bollinger_position": round(bollinger_pos, 2),
            "stochastic": round(stochastic, 1),
        }
        score_components = [
            {
                "label": "Trend",
                "score": round(trend_component, 1),
                "summary": "MA7 is above MA30" if ma7 and ma30 and ma7 > ma30 else "MA7 is below MA30",
            },
            {
                "label": "Momentum",
                "score": round(momentum_component, 1),
                "summary": "5-day momentum is positive" if short_momentum > 0 else "5-day momentum is negative",
            },
            {
                "label": "RSI balance",
                "score": round(rsi_component, 1),
                "summary": "RSI is balanced" if 35 <= rsi <= 65 else "RSI is stretched",
            },
            {
                "label": "Volatility",
                "score": round(volatility_component, 1),
                "summary": "Daily volatility is controlled" if volatility < 0.035 else "Daily volatility is elevated",
            },
            {
                "label": "Analogs",
                "score": round(analog_component, 1),
                "summary": f"{analog_model['hit_rate']}% similar-pattern hit rate" if analog_model["sample_size"] else "Not enough analog cases",
            },
            {
                "label": "Validation",
                "score": round((validation_component or 50) - 50, 1),
                "summary": f"{validation_component}% walk-forward directional accuracy" if validation_component is not None else "Validation needs more history",
            },
        ]

        explanation = []
        explanation.append("Live market-watch price is being used" if live_price else "Latest EOD close is being used")
        explanation.append("Price is above the 14-day average" if ma14 and current_price > ma14 else "Price is below the 14-day average")
        if ema12 and ema26:
            explanation.append("Short-term EMA is above long-term EMA" if ema12 > ema26 else "Short-term EMA is below long-term EMA")
        explanation.append("RSI is overbought" if rsi > 70 else "RSI is oversold" if rsi < 30 else "RSI is neutral")
        explanation.append("Recent momentum is positive" if short_momentum > 0 else "Recent momentum is negative")
        explanation.append("Volume is above its 20-day average" if volume_ratio >= 1.2 else "Volume is near or below its 20-day average")
        explanation.append(f"Historical analog model found {analog_model['sample_size']} similar setups with {analog_model['hit_rate']}% directional agreement")
        if validation.get("cases"):
            explanation.append(f"Walk-forward validation: {validation['directional_accuracy']}% direction accuracy over {validation['cases']} recent cases")

        forecast_path = build_forecast_path(current_price, target_price, volatility, days)
        band = current_price * max(0.006, volatility or 0.012) * math.sqrt(days)
        scenarios = {
            "bear": round(max(0, target_price - band), 2),
            "base": round(target_price, 2),
            "bull": round(target_price + band, 2),
        }

        return {
            "symbol": data_symbol,
            "requested_symbol": requested_sym,
            "market_symbol": quote.get("symbol") if quote else data_symbol,
            "trend": trend,
            "rating": rating,
            "confidence": confidence,
            "forecast_days": days,
            "ma7": round(ma7, 2) if ma7 else None,
            "ma14": round(ma14, 2) if ma14 else None,
            "ma30": round(ma30, 2) if ma30 else None,
            "ema12": round(ema12, 2) if ema12 else None,
            "ema26": round(ema26, 2) if ema26 else None,
            "rsi": round(rsi, 1),
            "last_close": round(reference_close, 2) if reference_close else None,
            "latest_eod_close": round(historical_last, 2),
            "current_price": round(current_price, 2),
            "live_price": round(live_price, 2) if live_price else None,
            "previous_close": round(previous_close, 2) if previous_close else None,
            "session_change": round(session_change, 2),
            "session_change_pct": round(session_change_pct, 2),
            "target_price": round(target_price, 2),
            "expected_change_pct": round(expected_change_pct * 100, 2),
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "risk_level": round(risk_level, 2),
            "risk_reward": round(risk_reward, 2),
            "avg_volume_20": round(avg_volume, 2),
            "live_volume": round(live_volume, 2) if live_volume else None,
            "sample_size": len(analysis_closes),
            "historical_sample_size": len(closes),
            "data_source": "PSX market watch + EOD history" if quote else "PSX EOD history",
            "price_basis": "Live market-watch price" if live_price else "Latest EOD close",
            "signals": signals,
            "score_components": score_components,
            "model": {
                "name": "Hybrid technical ensemble",
                "version": "2.0",
                "features": len(current_features),
                "weights": {
                    "technical": round(technical_weight / total_model_weight, 2),
                    "historical_analogs": round(analog_weight / total_model_weight, 2),
                    "regression": round(regression_weight / total_model_weight, 2),
                    "mean_reversion": round(mean_reversion_weight / total_model_weight, 2),
                },
                "outputs": {
                    "technical_return_pct": round(technical_return * 100, 2),
                    "analog_return_pct": round(analog_return * 100, 2),
                    "regression_return_pct": round(regression_return * 100, 2),
                    "mean_reversion_return_pct": round(mean_reversion_return * 100, 2),
                    "ensemble_return_pct": round(expected_change_pct * 100, 2),
                },
                "validation": validation,
                "analogs": analog_model["neighbors"],
                "bands": {
                    "bollinger_lower": round(bollinger_lower, 2),
                    "bollinger_upper": round(bollinger_upper, 2),
                },
            },
            "scenarios": scenarios,
            "forecast_path": forecast_path,
            "history": build_price_history(rows, current_price, live_volume),
            "explanation": explanation,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def build_chat_context(message: str):
    market = fetch_market_watch()
    if isinstance(market, dict) and "error" in market:
        return {
            "time_utc": datetime.utcnow().isoformat(),
            "warning": f"Live PSX context unavailable: {market['error']}",
            "symbols": [],
            "market": {
                "active_symbols": 0,
                "advancing": 0,
                "declining": 0,
                "breadth": 0,
                "top_gainers": [],
                "top_losers": [],
                "volume_leaders": [],
            },
        }

    active = [stock for stock in market if parse_float(stock.get("current", 0)) > 0]
    gainers = sorted([s for s in active if parse_float(s.get("change", 0)) > 0], key=lambda x: parse_float(x.get("pchange", 0)), reverse=True)[:6]
    losers = sorted([s for s in active if parse_float(s.get("change", 0)) < 0], key=lambda x: parse_float(x.get("pchange", 0)))[:6]
    volume_leaders = sorted(active, key=lambda x: parse_float(x.get("volume", 0)), reverse=True)[:6]
    advancing = len([s for s in active if parse_float(s.get("change", 0)) > 0])
    declining = len([s for s in active if parse_float(s.get("change", 0)) < 0])
    breadth = ((advancing - declining) / len(active) * 100) if active else 0

    symbols = []
    for symbol in extract_symbols(message):
        quote = fetch_market_quote(symbol)
        forecast = None
        try:
            forecast = predict(symbol, days=5)
        except:
            forecast = None
        symbols.append({
            "symbol": symbol,
            "quote": summarize_stock_for_chat(quote),
            "forecast": {
                "trend": forecast.get("trend"),
                "rating": forecast.get("rating"),
                "confidence": forecast.get("confidence"),
                "current_price": forecast.get("current_price"),
                "target_price": forecast.get("target_price"),
                "expected_change_pct": forecast.get("expected_change_pct"),
                "support": forecast.get("support"),
                "resistance": forecast.get("resistance"),
                "rsi": forecast.get("rsi"),
            } if isinstance(forecast, dict) else None,
        })

    return {
        "time_utc": datetime.utcnow().isoformat(),
        "market": {
            "active_symbols": len(active),
            "advancing": advancing,
            "declining": declining,
            "breadth": round(breadth, 2),
            "top_gainers": [summarize_stock_for_chat(stock) for stock in gainers],
            "top_losers": [summarize_stock_for_chat(stock) for stock in losers],
            "volume_leaders": [summarize_stock_for_chat(stock) for stock in volume_leaders],
        },
        "symbols": symbols,
    }

def fallback_chat_reply(message: str, context: dict):
    market = context.get("market", {}) if isinstance(context, dict) else {}
    symbols = context.get("symbols", []) if isinstance(context, dict) else []
    msg = message.lower()

    if symbols:
        blocks = []
        for item in symbols:
            quote = item.get("quote") or {}
            forecast = item.get("forecast") or {}
            blocks.append(
                f"**{quote.get('symbol') or item.get('symbol')}** is at PKR {quote.get('current', 0):,.2f}, "
                f"{quote.get('pchange', 0):+.2f}% today. 5D signal: **{forecast.get('rating', 'Watch')}** "
                f"with target PKR {forecast.get('target_price', 0):,.2f}, support PKR {forecast.get('support', 0):,.2f}, "
                f"resistance PKR {forecast.get('resistance', 0):,.2f}."
            )
        return "\n\n".join(blocks) + "\n\nThis is a technical snapshot, not financial advice."

    if "loser" in msg:
        rows = market.get("top_losers", [])[:5]
        return "**Top losers right now:**\n" + "\n".join(
            f"- {row['symbol']}: PKR {row['current']:,.2f} ({row['pchange']:+.2f}%)" for row in rows
        )

    if "gainer" in msg or "top" in msg:
        rows = market.get("top_gainers", [])[:5]
        return "**Top gainers right now:**\n" + "\n".join(
            f"- {row['symbol']}: PKR {row['current']:,.2f} ({row['pchange']:+.2f}%)" for row in rows
        )

    if "volume" in msg or "active" in msg:
        rows = market.get("volume_leaders", [])[:5]
        return "**Most active by volume:**\n" + "\n".join(
            f"- {row['symbol']}: {row['volume']:,.0f} shares, PKR {row['current']:,.2f}" for row in rows
        )

    return (
        f"Market breadth is {market.get('breadth', 0):+.2f}: "
        f"{market.get('advancing', 0)} advancing vs {market.get('declining', 0)} declining. "
        "Ask me for a ticker like OGDC, HBL, LUCK, or for top gainers, losers, and volume leaders."
    )

@app.get("/api/chat/context")
def get_chat_context():
    return build_chat_context("")

@app.post("/api/chat")
async def chat(body: ChatMessage):
    context = build_chat_context(body.message)

    if not GEMINI_API_KEY:
        return {
            "reply": fallback_chat_reply(body.message, context),
            "mode": "local",
            "context": context,
        }

    msg_lower = body.message.lower()

    system_prompt = f"""You are PSX-AI, an expert financial assistant for the Pakistan Stock Exchange.
You help investors analyze stocks, understand market trends, compare symbols, and explain risk.
Use the live PSX context below whenever it is relevant. Prefer exact numbers from context over general comments.
When a symbol forecast is available, mention current price, 5D signal, target, support/resistance, RSI, and confidence.
Keep answers concise and data-driven. Use bullets for lists.
Do not promise returns. Always make clear that this is not financial advice when discussing buy/sell decisions.
Live PSX context JSON:
{json.dumps(context)[:7000]}
Current time (PKT): {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC"""

    history_formatted = []
    for h in body.history[-6:]:
        role = "model" if h.get("role") == "assistant" else "user"
        history_formatted.append({"role": role, "parts": [h.get("content", "")]})

    model = genai.GenerativeModel("gemini-2.5-flash", system_instruction=system_prompt)
    chat_session = model.start_chat(history=history_formatted)
    try:
        response = chat_session.send_message(body.message)
        return {"reply": response.text, "mode": "gemini", "context": context}
    except Exception:
        return {
            "reply": fallback_chat_reply(body.message, context),
            "mode": "local",
            "context": context,
        }
