# PSX-AI Backend, Algorithms, and Machine Learning Explanation

This file explains how `backend/main.py` works, how data moves through the project, and how the prediction, backtesting, market brief, news, calendar, and AI chat features are calculated.

## Project Overview

PSX-AI is a Pakistan Stock Exchange analysis app. The backend is a FastAPI API that fetches PSX market data, cleans it, calculates technical indicators, builds forecasts, runs backtests, and provides chat-ready market context.

The frontend calls backend endpoints such as:

- `/api/market`
- `/api/gainers`
- `/api/losers`
- `/api/brief`
- `/api/history/{symbol}`
- `/api/predict/{symbol}`
- `/api/backtest/{symbol}`
- `/api/news`
- `/api/calendar`
- `/api/chat`

The backend file is:

```text
backend/main.py
```

## Important Note About Machine Learning

This project does not train and save a deep learning model like TensorFlow, PyTorch, Random Forest, or XGBoost.

Instead, the prediction system uses a hybrid machine-learning-style ensemble:

- Technical indicator scoring
- Linear regression forecast
- Historical analog matching, similar to a weighted k-nearest-neighbors model
- Mean reversion logic
- Walk-forward validation
- Confidence scoring

So the “machine learning” part is mostly algorithmic pattern matching and statistical modeling, not a separately trained `.pkl` or neural network model.

## Imports and Setup

`main.py` starts by importing:

```python
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
```

These are used for:

- `FastAPI`: creating API routes
- `CORSMiddleware`: allowing frontend requests
- `requests`: fetching PSX data
- `BeautifulSoup`: scraping HTML tables and announcements
- `google.generativeai`: optional Gemini-powered chat
- `math`, `random`, `datetime`: calculations and fallback data
- `dotenv`: reading `.env` variables like `GEMINI_API_KEY`

The app is created here:

```python
app = FastAPI(title="PSX AI API")
```

CORS is enabled for all origins:

```python
allow_origins=["*"]
```

This lets the React frontend call the backend without browser CORS errors.

## External Data Sources

The backend fetches live and historical PSX data from:

```python
PSX_MARKET_WATCH = "https://dps.psx.com.pk/market-watch"
PSX_INTRADAY = "https://dps.psx.com.pk/timeseries/int/{}"
PSX_EOD = "https://dps.psx.com.pk/timeseries/eod/{}"
PSX_CORPORATE_ANNOUNCEMENTS = "https://www.psx.com.pk/psx/announcement/corporate-announcements"
PSX_CALENDAR = "https://dps.psx.com.pk/calendar"
```

These provide:

- Current market watch table
- Intraday price series
- End-of-day historical prices
- Corporate announcements
- AGM/EOGM market calendar

## Data Cleaning Helpers

### `parse_float(val)`

Converts text values into numbers.

Example:

```python
"1,234.50" -> 1234.50
```

If conversion fails, it returns `0.0`.

### `normalize_market_stock(stock)`

This standardizes one market-watch stock row.

It calculates:

- `current`
- `ldcp`
- `open`
- `high`
- `low`
- `change`
- `pchange`
- `volume`
- `is_live`
- `price_basis`

If live price is missing, the code falls back to LDCP, open, high, or low and marks the row as:

```text
Previous close
```

If live price exists, it recalculates:

```python
change = current - ldcp
pchange = (change / ldcp) * 100
```

## Fetching Market Data

### `fetch_market_watch()`

This function:

1. Downloads the PSX market-watch page.
2. Parses the first HTML table.
3. Extracts table rows.
4. Converts every row into a stock dictionary.
5. Normalizes each stock with `normalize_market_stock`.

Each stock contains fields like:

```json
{
  "symbol": "OGDC",
  "sector": "Oil & Gas",
  "ldcp": 316.7,
  "open": 317.7,
  "high": 319.9,
  "low": 315.5,
  "current": 318.53,
  "change": 1.83,
  "pchange": 0.58,
  "volume": 3194694
}
```

### `fetch_eod(symbol)`

Fetches historical end-of-day data:

```text
https://dps.psx.com.pk/timeseries/eod/{symbol}
```

This is used by:

- Prediction
- Backtesting
- Chart history

### `fetch_intraday(symbol)`

Fetches intraday time-series data:

```text
https://dps.psx.com.pk/timeseries/int/{symbol}
```

### `fetch_market_quote(symbol)`

Searches live market-watch data for a symbol.

It checks:

- `SYMBOL`
- `SYMBOLXD`
- `SYMBOLH`
- `SYMBOLNC`

This matters because PSX symbols may have suffixes.

## Technical Indicator Algorithms

### Simple Moving Average

Function:

```python
simple_moving_average(values, window)
```

It adds the last `window` prices and divides by `window`.

Example:

```python
MA10 = average of last 10 closes
MA30 = average of last 30 closes
```

Used for:

- Trend detection
- MA crossover backtesting
- Prediction score

### Exponential Moving Average

Function:

```python
exponential_moving_average(values, window)
```

EMA gives more weight to recent prices.

Formula:

```python
alpha = 2 / (window + 1)
ema = value * alpha + previous_ema * (1 - alpha)
```

Used for:

- EMA12
- EMA26
- MACD-style trend signal
- Forecast blending

### Relative Strength Index

Function:

```python
relative_strength_index(values, period=14)
```

RSI measures whether a stock is overbought or oversold.

Logic:

- Calculate gains and losses over 14 periods.
- Calculate average gain and average loss.
- Calculate RS.
- Convert into RSI.

Formula:

```python
RSI = 100 - (100 / (1 + RS))
```

Interpretation:

- RSI above 70: overbought
- RSI below 30: oversold
- Around 50: neutral

### Percent Returns

Function:

```python
percent_returns(values)
```

Calculates day-to-day percent return:

```python
(current - previous) / previous
```

Used for:

- Momentum
- Volatility
- Regression inputs
- Analog features

### Standard Deviation

Function:

```python
standard_deviation(values)
```

Measures volatility. Higher standard deviation means more unstable price movement.

Used for:

- Forecast risk bands
- Confidence
- Bull/base/bear scenario width

### Linear Regression Forecast

Function:

```python
linear_regression_forecast(values, lookback=30)
```

This fits a straight line to the last 30 closing prices.

It calculates:

- `slope`
- `intercept`
- next forecast price
- slope percentage

The idea:

- Positive slope means upward trend.
- Negative slope means downward trend.

This is one part of the prediction ensemble.

### Bollinger Position

Function:

```python
bollinger_position(values, window=20)
```

It calculates:

- 20-day average
- upper band = average + 2 standard deviations
- lower band = average - 2 standard deviations
- current position inside the band

Interpretation:

- Near upper band: stock may be stretched upward
- Near lower band: stock may be stretched downward

Used for mean reversion.

### Stochastic Oscillator

Function:

```python
stochastic_oscillator(values, window=14)
```

Compares current close to recent high/low range.

Formula:

```python
(current - low) / (high - low) * 100
```

Interpretation:

- Near 100: price is near recent high
- Near 0: price is near recent low

### MACD Signal

Function:

```python
macd_signal(values)
```

Calculates:

```python
EMA12 - EMA26
```

Then divides by current price to normalize it.

Positive MACD suggests short-term strength.

## Feature Engineering

### `feature_snapshot(closes, volumes=None)`

This function converts price and volume history into a feature vector.

Features include:

- `ret_1`: one-day return
- `ret_3`: three-day return
- `ret_5`: five-day return
- `ret_10`: ten-day return
- `ret_20`: twenty-day return
- `ma7_gap`: gap between MA7 and MA14
- `ma30_gap`: gap between current price and MA30
- `macd`: EMA12 minus EMA26 signal
- `rsi`: normalized RSI
- `bollinger`: normalized Bollinger position
- `stochastic`: normalized stochastic oscillator
- `volatility`: recent volatility
- `volume_ratio`: current volume compared with average volume

This is the main feature engineering step for the ML-style analog model.

## Historical Analog Model

Function:

```python
historical_analog_model(closes, volumes, days=5, neighbors=24, train_limit=900)
```

This is the closest thing to machine learning in the project.

It works like a weighted k-nearest-neighbors model:

1. Build feature vector for the latest market condition.
2. Go through past historical points.
3. Build feature vectors for old market conditions.
4. Compare old feature vectors to the latest one.
5. Pick the most similar historical setups.
6. Look at what happened after those setups.
7. Use those future returns to estimate the expected return.

### Feature Distance

Function:

```python
feature_distance(a, b)
```

It compares two feature snapshots using weighted Euclidean distance.

Some features are given more importance:

```python
"ma7_gap": 1.3
"ma30_gap": 1.2
"macd": 1.1
"ret_5": 1.1
```

Lower distance means the past setup is more similar to today.

### Weighted Prediction

After finding similar setups, each neighbor gets a weight:

```python
weight = 1 / (distance + 0.035)
```

Closer neighbors get higher weight.

Expected return:

```python
sum(weight * future_return) / sum(weight)
```

The model also calculates:

- `hit_rate`: how often similar setups moved in the same direction
- `confidence`: based on hit rate and average similarity
- `neighbors`: top similar historical cases

## Walk-Forward Validation

Function:

```python
walk_forward_validation(closes, volumes, days=5, cases=70)
```

This checks how the model would have performed on recent historical data.

Process:

1. Pick recent historical points.
2. Pretend each point is “today”.
3. Run the analog model using only data before that point.
4. Blend analog prediction with regression prediction.
5. Compare predicted return to actual future return.

It returns:

- `cases`
- `directional_accuracy`
- `mae_pct`
- `avg_abs_move_pct`

This helps estimate whether the model has been directionally useful.

## Prediction Endpoint

Endpoint:

```text
GET /api/predict/{symbol}
POST /api/predict/{symbol}
```

Main function:

```python
predict(symbol: str, days: int = Query(5, ge=1, le=10))
```

### Prediction Flow

1. Clean symbol name.
2. Fetch EOD historical data.
3. Normalize rows.
4. Fetch live market quote if available.
5. Combine live price with historical closes.
6. Calculate indicators:
   - MA7
   - MA14
   - MA30
   - EMA12
   - EMA26
   - RSI
   - returns
   - momentum
   - volatility
   - regression forecast
   - Bollinger position
   - stochastic oscillator
   - MACD
7. Run historical analog model.
8. Run walk-forward validation.
9. Calculate model ensemble output.
10. Build target price, confidence, scenarios, support, resistance, and explanation.

### Ensemble Model

The prediction is a weighted ensemble of four parts:

```python
technical_weight = 0.34
regression_weight = 0.22
analog_weight = 0.18 + analog_confidence * 0.22
mean_reversion_weight = 0.16
```

The final expected return is:

```python
expected_change_pct =
    technical_return * technical_weight
  + regression_return * regression_weight
  + analog_return * analog_weight
  + mean_reversion_return * mean_reversion_weight
```

Then it divides by total model weight.

### Technical Return

Technical return is built from:

- MA7 vs MA14
- EMA12 vs EMA26
- short momentum
- medium momentum
- regression slope
- RSI penalty or boost

If RSI is too high, the model subtracts from the score.

If RSI is very low, the model adds a possible rebound score.

### Regression Return

Regression return compares regression forecast price with current price:

```python
regression_return = (regression_price - current_price) / current_price
```

### Analog Return

Analog return comes from the historical analog model.

It asks:

```text
When the stock looked similar in the past, what happened after N days?
```

### Mean Reversion Return

Mean reversion checks whether the stock is stretched:

- If Bollinger position is very high or RSI is high, it expects possible pullback.
- If Bollinger position is very low or RSI is low, it expects possible rebound.

### Forecast Limits

The model limits unrealistic moves:

```python
max_window_move = max(0.012, min(0.12, volatility * sqrt(days) * 2.15))
```

This prevents the model from forecasting extreme prices.

### Confidence Score

Confidence is calculated from:

- signal strength
- history quality
- analog confidence
- validation accuracy

Formula style:

```python
confidence = 46
  + signal_strength * 25
  + history_quality * 6
  + analog_confidence * 9
  + validation_score * 8
```

Maximum confidence is capped at `90`.

Neutral forecasts are capped lower.

### Prediction Output

The prediction response includes:

- trend: `UP`, `DOWN`, or `NEUTRAL`
- rating
- confidence
- current price
- target price
- expected change
- support
- resistance
- risk level
- risk/reward
- RSI
- moving averages
- volume ratio
- forecast path
- bull/base/bear scenarios
- model weights
- validation result
- explanation text

## Forecast Path

Function:

```python
build_forecast_path(current_price, target_price, volatility, days)
```

This creates a smooth projected path from current price to target price.

For each day, it creates:

- `base`
- `bull`
- `bear`

The bull and bear paths use volatility bands:

```python
band = current_price * daily_band * sqrt(day)
```

This is what the frontend chart displays.

## Support, Resistance, Risk, and Reward

Inside `predict()`:

- Support is the minimum close in the recent 45-day window.
- Resistance is the maximum close in the recent 45-day window.
- Risk floor and ceiling are based on volatility and recent price range.
- Risk/reward compares expected reward against estimated downside or upside risk.

If forecast is bullish:

```python
reward = target_price - current_price
risk = current_price - risk_floor
```

If forecast is bearish:

```python
reward = current_price - target_price
risk = risk_ceiling - current_price
```

## Backtesting

Endpoint:

```text
GET /api/backtest/{symbol}
```

Function:

```python
run_backtest(symbol, strategy="ma_cross", lookback=260, initial_cash=100000.0)
```

The backtest simulates buying and selling with historical EOD close prices.

It supports three strategies.

### Strategy 1: Moving Average Cross

ID:

```text
ma_cross
```

Buy condition:

```text
MA10 crosses above MA30
```

Sell condition:

```text
MA10 crosses below MA30
```

This is a trend-following strategy.

### Strategy 2: RSI

ID:

```text
rsi
```

Buy condition:

```text
RSI < 32
```

Sell condition:

```text
RSI > 68
```

This is a mean-reversion strategy.

It tries to buy oversold stocks and sell when they become overheated.

### Strategy 3: Breakout

ID:

```text
breakout
```

Buy condition:

```text
current close > previous 20-day high
```

Sell condition:

```text
current close < previous 10-day low
```

This tries to catch momentum breakouts and exit on breakdowns.

### Backtest Accounting

The backtest starts with cash:

```python
initial_cash = 100000
```

When buying:

```python
shares = cash / price
cash = 0
```

When selling:

```python
cash = shares * price
shares = 0
```

It tracks:

- trades
- equity curve
- final value
- total return
- buy-and-hold return
- max drawdown
- trade count
- win rate

### Max Drawdown

Function:

```python
max_drawdown(values)
```

It tracks the highest portfolio value seen so far, then measures the worst fall from that peak.

## Research Page Algorithms

The Research page is algorithm-based. It is connected mainly to the backend endpoint:

```text
GET /api/backtest/{symbol}
```

The frontend file is:

```text
frontend/src/components/ResearchPage.jsx
```

The backend logic is:

```python
run_backtest(symbol, strategy, lookback, initial_cash)
```

The Research page lets the user test trading strategies on historical PSX end-of-day data. It is not machine learning training. It is historical simulation.

### How Research Works

1. User enters a symbol such as `OGDC`.
2. User selects a strategy:
   - MA Cross
   - RSI Bounce
   - 20-Day Breakout
3. User selects lookback days.
4. User enters starting cash.
5. Frontend calls `/api/backtest/{symbol}`.
6. Backend fetches historical EOD data.
7. Backend runs the selected algorithm day by day.
8. Backend returns trades, equity curve, return, win rate, and drawdown.
9. Frontend displays charts and metrics.

### Research Algorithm 1: Moving Average Crossover

Strategy ID:

```text
ma_cross
```

This is a trend-following algorithm.

It calculates:

```text
MA10 = average of last 10 closing prices
MA30 = average of last 30 closing prices
```

Buy condition:

```text
Previous MA10 <= Previous MA30
Current MA10 > Current MA30
```

This means the short-term trend has crossed above the long-term trend.

Sell condition:

```text
Previous MA10 >= Previous MA30
Current MA10 < Current MA30
```

This means short-term trend has weakened below the long-term trend.

Viva explanation:

```text
The MA crossover strategy tries to enter when short-term momentum becomes stronger than long-term momentum and exits when short-term momentum becomes weaker.
```

### Research Algorithm 2: RSI Bounce

Strategy ID:

```text
rsi
```

This is a mean-reversion algorithm.

It calculates 14-period RSI.

Buy condition:

```text
RSI < 32
```

This means the stock may be oversold.

Sell condition:

```text
RSI > 68
```

This means the stock may be overheated.

Viva explanation:

```text
The RSI strategy assumes that very weak short-term selling can create a rebound opportunity, and very strong buying can create a profit-taking zone.
```

### Research Algorithm 3: 20-Day Breakout

Strategy ID:

```text
breakout
```

This is a momentum breakout algorithm.

It checks:

```text
high_20 = highest close of previous 20 days
low_10 = lowest close of previous 10 days
```

Buy condition:

```text
current close > previous 20-day high
```

Sell condition:

```text
current close < previous 10-day low
```

Viva explanation:

```text
The breakout strategy tries to enter when price breaks above its recent 20-day range, showing strength. It exits if price breaks below the recent 10-day support area.
```

### Research Metrics

The backend calculates these metrics after the backtest:

#### Final Value

Final portfolio value after all simulated trades.

```python
final_value = cash
```

If the strategy still holds shares at the end, it sells at the final close.

#### Total Return

```python
total_return = ((final_value - initial_cash) / initial_cash) * 100
```

This tells how much the strategy gained or lost.

#### Buy-and-Hold Return

```python
buy_hold = ((last_close - first_close) / first_close) * 100
```

This compares the strategy against simply buying at the start and holding until the end.

#### Win Rate

```python
win_rate = winning_sells / total_sells * 100
```

This shows the percentage of closed trades that made profit.

#### Max Drawdown

Drawdown measures the biggest fall from a previous portfolio peak.

Viva explanation:

```text
Max drawdown is important because a strategy can have profit but still be risky if it suffers a large temporary loss.
```

#### Equity Curve

The equity curve stores portfolio value after each historical day.

It is shown as a chart in the Research page.

### Why Research Is Algorithm-Based

Research is algorithm-based because it uses fixed mathematical trading rules to simulate decisions:

- If MA crossover happens, buy or sell.
- If RSI crosses thresholds, buy or sell.
- If breakout/breakdown happens, buy or sell.

It does not guess manually. It follows rules over historical data.

## Screener Page Algorithms

The Screener page is also algorithm-based. It is connected to live market data from:

```text
GET /api/market
```

The frontend file is:

```text
frontend/src/components/ScreenerPage.jsx
```

The Screener does not train a machine learning model. It uses live market calculations, filters, sorting, and scoring rules to find useful stock setups.

### How Screener Works

1. Frontend fetches live market data from `/api/market`.
2. Each stock is normalized.
3. Screener calculates extra values such as range position and breakout score.
4. User filters by:
   - symbol
   - sector
   - price
   - volume
   - percent change
   - preset setup
5. Screener sorts stocks by selected metric.
6. Results are displayed in a table.

### Screener Data Normalization

The Screener converts each stock into a clean object:

```js
current
ldcp
open
high
low
change
pchange
volume
sector
rangePosition
breakoutScore
```

### Screener Algorithm 1: Range Position

Range position shows where the current price is inside the day's high-low range.

Formula:

```js
dayRange = high - low
rangePosition = ((current - low) / dayRange) * 100
```

Interpretation:

- `0%`: price is near day low
- `50%`: price is around middle of day range
- `100%`: price is near day high

Viva explanation:

```text
Range position tells whether a stock is trading near its daily high or daily low. A high range position with positive change can indicate breakout strength.
```

### Screener Algorithm 2: Breakout Score

The Screener calculates a breakout-style score:

```js
breakoutScore =
  (rangePosition * 0.45)
  + (positivePercentChange * 8)
  + volumeInMillions
```

In code:

```js
breakoutScore: (rangePosition * 0.45) + (Math.max(pchange, 0) * 8) + (volume / 1_000_000)
```

This score combines:

- where price is inside day range
- positive percentage movement
- trading volume

High breakout score means:

- price is near day high
- stock is moving upward
- volume is active

Viva explanation:

```text
Breakout score is a custom ranking formula. It gives higher rank to stocks near the day high, with positive percentage change and strong volume.
```

### Screener Algorithm 3: Preset Filters

The Screener has preset algorithms.

#### All Stocks

No special setup filter. It shows all stocks after user filters.

#### Breakouts

Condition:

```js
rangePosition >= 80 && pchange > 0
```

Meaning:

```text
The stock is in the top 20% of its daily range and is positive.
```

#### Volume Spikes

Condition:

```js
volume >= 1_000_000
```

Meaning:

```text
The stock has traded at least one million shares.
```

#### Momentum

Condition:

```js
pchange >= 2
```

Meaning:

```text
The stock is up at least 2%.
```

#### Pullbacks

Condition:

```js
pchange <= -2
```

Meaning:

```text
The stock is down at least 2%.
```

### Screener Algorithm 4: Sorting

The Screener can sort results by:

- breakout score
- percent change
- volume
- range position
- current price
- symbol

For numeric fields, it sorts descending:

```js
Number(b[sortBy]) - Number(a[sortBy])
```

For symbol, it sorts alphabetically:

```js
a.symbol.localeCompare(b.symbol)
```

### Screener Algorithm 5: User Filters

The Screener applies multiple filters:

```js
symbol or sector search
sector filter
minimum price
maximum price
minimum volume
minimum percent change
maximum percent change
preset filter
```

All filters are combined. A stock must pass every active condition to appear.

Viva explanation:

```text
The Screener is a multi-condition rule engine. It filters live PSX stocks using price, sector, volume, percent change, range position, and setup presets.
```

### Why Screener Is Algorithm-Based

The Screener is algorithm-based because it uses mathematical formulas and logical conditions:

- range position formula
- breakout score formula
- volume threshold
- momentum threshold
- pullback threshold
- sorting algorithm
- multi-filter pipeline

It does not use AI to choose stocks. It uses deterministic rules.

## Difference Between Screener, Research, and Predict

| Module | Type | Data Used | Main Purpose |
|---|---|---|---|
| Screener | Rule-based algorithm | Live market data | Find live setups |
| Research | Backtesting algorithm | Historical EOD data | Test strategies |
| Predict | Hybrid ML-style ensemble | Historical + live data | Forecast price direction |
| Chat | AI/context assistant | Live market + forecast context | Explain data in natural language |

For viva:

```text
Screener finds current opportunities using rule-based filters.
Research tests whether trading rules worked historically.
Predict estimates future direction using a hybrid ensemble of indicators, regression, analog matching, and validation.
Chat explains the same data using Gemini or local fallback logic.
```

## Market Brief

Endpoint:

```text
GET /api/brief
```

It creates a plain-English summary of the market.

It calculates:

- active stocks
- top gainers
- top losers
- volume leaders
- advancing count
- declining count
- breadth
- mood

Breadth formula:

```python
breadth = (advancing - declining) / active_count * 100
```

Mood:

- breadth > 12: bullish
- breadth < -12: bearish
- otherwise: mixed

## Gainers and Losers

### `/api/gainers`

Fetches market watch, filters stocks with positive change, sorts by percent change descending, and returns top 10.

### `/api/losers`

Fetches market watch, filters stocks with negative change, sorts by percent change ascending, and returns top 10.

## News and Calendar

### `/api/news`

Uses:

```python
fetch_corporate_announcements(limit)
```

It scrapes PSX corporate announcements and returns:

- symbol
- company
- title
- time
- date
- URL
- source

### `/api/calendar`

Uses:

```python
fetch_market_calendar(from_date, to_date)
```

It posts date filters to PSX calendar and returns AGM/EOGM events.

## Chat System

Endpoint:

```text
POST /api/chat
```

The chat system has two modes:

1. Gemini mode, if `GEMINI_API_KEY` exists.
2. Local fallback mode, if Gemini is unavailable.

### Chat Context

Function:

```python
build_chat_context(message)
```

This creates live context for the chat assistant.

It fetches:

- active symbols
- market breadth
- top gainers
- top losers
- volume leaders
- forecasts for detected symbols in the message

Symbol detection uses:

```python
extract_symbols(text)
```

It checks the message against common symbols like:

```text
OGDC, ENGRO, HBL, PSO, LUCK, MARI, TRG, UBL, MCB
```

If a symbol is found, the backend calls:

```python
predict(symbol, days=5)
```

So the chat can answer with:

- current price
- target
- support
- resistance
- RSI
- confidence
- trend rating

### Gemini Mode

If `GEMINI_API_KEY` is set, the backend creates a Gemini model:

```python
genai.GenerativeModel("gemini-2.5-flash", system_instruction=system_prompt)
```

The system prompt includes live PSX context as JSON.

Gemini then answers using the latest data.

### Local Fallback Mode

Function:

```python
fallback_chat_reply(message, context)
```

If Gemini is missing or fails, the backend still gives useful answers.

It can answer:

- top gainers
- top losers
- volume leaders
- symbol forecast summaries
- market breadth summaries

## Endpoint Summary

| Endpoint | Purpose |
|---|---|
| `/` | Health check |
| `/api/market` | Full PSX market-watch list |
| `/api/price/{symbol}` | Intraday data |
| `/api/history/{symbol}` | EOD historical data |
| `/api/gainers` | Top positive movers |
| `/api/losers` | Top negative movers |
| `/api/brief` | Market summary and mood |
| `/api/news` | Corporate announcements |
| `/api/calendar` | AGM/EOGM calendar |
| `/api/backtest/{symbol}` | Strategy backtest |
| `/api/predict/{symbol}` | Hybrid forecast |
| `/api/chat/context` | Live chat context |
| `/api/chat` | AI/local market assistant |

## How `main.py` Works End to End

For a prediction request:

```text
Frontend -> /api/predict/OGDC -> FastAPI -> fetch EOD -> fetch live quote -> indicators -> analog model -> ensemble -> response -> frontend chart/cards
```

For dashboard data:

```text
Frontend -> /api/market -> scrape PSX market-watch -> normalize stocks -> return JSON
```

For chat:

```text
Frontend -> /api/chat -> build market context -> detect symbols -> run forecasts -> Gemini or local fallback -> response
```

For research:

```text
Frontend -> /api/backtest/OGDC -> fetch EOD -> simulate strategy -> return trades and equity curve
```

## Limitations

- The model is not guaranteed to predict the future.
- It depends on PSX endpoints being reachable.
- It uses technical and statistical signals, not company fundamentals.
- The analog model is not a trained neural network.
- Corporate announcements are scraped from HTML, so layout changes on PSX can break parsing.
- Forecasts are educational signals, not financial advice.

## In Simple Words

The project works like this:

1. Get live and historical PSX data.
2. Clean the data.
3. Calculate indicators like MA, EMA, RSI, MACD, Bollinger, volatility, and momentum.
4. Compare today with similar past patterns.
5. Blend technical score, regression, analog history, and mean reversion.
6. Produce target price, confidence, support, resistance, and scenarios.
7. Show everything in the frontend dashboard, prediction page, research page, and AI chat.

Yes. Here is the clean viva-style mapping.

| Project Part | Algorithm / Logic Used | Purpose |
|---|---|---|
| **Dashboard Market Watch** | Sorting, filtering, gainers/losers detection | Shows live PSX stocks, top movers, volume leaders |
| **Market Mood / Brief** | Market breadth formula | Decides bullish, bearish, or mixed mood |
| **Top Gainers** | Sort by highest positive `% change` | Finds strongest upward movers |
| **Top Losers** | Sort by lowest negative `% change` | Finds weakest movers |
| **Volume Leaders** | Sort by highest volume | Finds most actively traded stocks |
| **Screener** | Rule-based filtering algorithm | Filters stocks by price, volume, sector, change |
| **Screener Breakout** | Range position + positive change | Finds stocks near daily high |
| **Screener Breakout Score** | Custom weighted score | Ranks breakout-style setups |
| **Research MA Cross** | Moving Average Crossover | Tests trend-following strategy |
| **Research RSI** | RSI mean-reversion algorithm | Tests oversold/overbought strategy |
| **Research Breakout** | 20-day high / 10-day low breakout | Tests momentum breakout strategy |
| **Predict Page** | Hybrid ensemble model | Forecasts stock direction and target |
| **Predict Technical Model** | SMA, EMA, RSI, MACD, momentum, volatility | Measures trend and strength |
| **Predict Regression** | Linear regression | Estimates next price from trend line |
| **Predict Analog Model** | Historical analog / weighted KNN-style matching | Finds similar past patterns |
| **Predict Mean Reversion** | Bollinger + RSI logic | Detects stretched price conditions |
| **Predict Validation** | Walk-forward validation | Checks past prediction accuracy |
| **Support / Resistance** | Recent min/max price window | Finds likely price floor and ceiling |
| **Risk / Reward** | Reward divided by estimated risk | Shows trade quality |
| **Backtest Equity Curve** | Portfolio simulation | Tracks value over time |
| **Max Drawdown** | Peak-to-trough loss calculation | Measures risk |
| **Chat Assistant** | Gemini AI + local fallback rules | Explains market data in natural language |
| **News Page** | Web scraping / parsing | Gets PSX announcements |
| **Calendar Page** | Date-filtered API fetch | Gets AGM/EOGM events |

Short version:

- **Screener** uses **rule-based algorithms**
- **Research** uses **backtesting algorithms**
- **Predict** uses **hybrid ML-style forecasting**
- **Chat** uses **AI + live market context**
- **Dashboard** uses **sorting, filtering, breadth, and ranking algorithms**