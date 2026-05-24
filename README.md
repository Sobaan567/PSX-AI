# PSX AI - Pakistan Stock Exchange ML Intelligence Platform

PSX AI is a machine learning focused stock analysis project for the Pakistan Stock Exchange. It combines live PSX market-watch data, historical end-of-day prices, technical feature engineering, historical pattern matching, regression forecasting, walk-forward validation, backtesting, and an AI assistant.

The main ML goal is not to promise exact stock prices. The goal is to estimate short-term direction, expected move, confidence, support/resistance, and risk using explainable market features.

## What The ML System Does

The prediction pipeline lives in `backend/main.py`, mainly inside the `/api/predict/{symbol}` endpoint.

```text
PSX live/EOD data
      |
      v
Clean and normalize prices
      |
      v
Build ML/technical features
      |
      v
Run multiple models/signals
      |
      v
Blend results into ensemble forecast
      |
      v
Return trend, confidence, target, risk, scenarios, explanation
```

## Algorithms Used

| Algorithm / Method | Function | What it does | Why it is used |
|---|---|---|---|
| Feature engineering | `feature_snapshot()` | Converts price and volume history into model features such as returns, moving-average gaps, RSI, MACD, Bollinger position, stochastic oscillator, volatility, and volume ratio. | Gives the model numeric inputs that describe momentum, trend, risk, and volume behavior. |
| Historical analog model | `historical_analog_model()` | Compares the current market setup against older setups using feature distance. It finds the most similar past patterns and checks what happened after the selected forecast horizon. | This is the most ML-like part of the system. It works like a nearest-neighbor pattern model for stock behavior. |
| Distance scoring | `feature_distance()` | Measures how close two feature snapshots are using weighted Euclidean distance. More important features get higher weights. | Helps the analog model find historically similar stock conditions. |
| Linear regression forecast | `linear_regression_forecast()` | Fits a simple line over recent closing prices and projects the next price. | Captures short-term price direction and slope in a simple explainable way. |
| Moving averages | `simple_moving_average()` and `exponential_moving_average()` | Calculates MA7, MA14, MA30, EMA12, and EMA26. | Detects trend direction and short-term vs medium-term strength. |
| RSI | `relative_strength_index()` | Measures whether a stock is overbought, oversold, or neutral. | Adds momentum and mean-reversion context. |
| MACD signal | `macd_signal()` | Compares EMA12 and EMA26 as a percent of current price. | Detects trend momentum shifts. |
| Bollinger position | `bollinger_position()` | Checks where the current price sits inside recent volatility bands. | Helps identify stretched prices and possible mean reversion. |
| Stochastic oscillator | `stochastic_oscillator()` | Measures the close relative to the recent high-low range. | Adds short-term momentum/range position. |
| Volatility model | `standard_deviation()` and recent returns | Estimates recent daily volatility. | Controls forecast bands, confidence, and max expected move. |
| Walk-forward validation | `walk_forward_validation()` | Simulates predictions on recent historical windows and compares predicted direction with actual future movement. | Gives a realistic validation metric without using future data for each test case. |
| Hybrid ensemble | `predict()` | Blends technical return, historical analog return, regression return, and mean-reversion return using weights. | Reduces dependence on one signal and gives a more stable forecast. |
| Backtesting | `run_backtest()` | Tests trading strategies such as moving-average cross, RSI, and breakout over historical data. | Evaluates whether a strategy would have worked historically. |

## Prediction Output

For a symbol such as `OGDC`, the prediction endpoint returns:

| Field | Meaning |
|---|---|
| `trend` | `UP`, `DOWN`, or `NEUTRAL` based on expected move. |
| `rating` | Human-readable signal such as `Bullish watch` or `Risk watch`. |
| `confidence` | Confidence score based on signal strength, data history, analog confidence, and validation. |
| `current_price` | Live price when market is open, otherwise latest available close. |
| `target_price` | Ensemble forecast target for the selected horizon. |
| `expected_change_pct` | Expected percent move. |
| `support` and `resistance` | Recent price floor and ceiling. |
| `risk_reward` | Estimated reward compared with risk. |
| `signals` | Raw technical signals used by the model. |
| `score_components` | Explainable breakdown of trend, momentum, RSI, volatility, analogs, and validation. |
| `model.validation` | Walk-forward accuracy and error metrics. |
| `model.analogs` | Similar historical setups found by the analog model. |
| `forecast_path` | Day-by-day bear/base/bull forecast path. |
| `explanation` | Plain-English reasons behind the signal. |

Example:

```text
GET http://127.0.0.1:8000/api/predict/OGDC?days=5
```

## Current ML Approach

The current system is an explainable hybrid model:

```text
Final forecast =
  technical signal
+ historical analog signal
+ regression signal
+ mean-reversion signal
```

The model uses weighted blending:

| Component | Purpose |
|---|---|
| Technical signal | Captures trend, moving averages, momentum, RSI, EMA, and MACD. |
| Historical analog signal | Finds similar past conditions and learns from their future returns. |
| Regression signal | Projects recent price slope forward. |
| Mean reversion signal | Adjusts forecasts when RSI/Bollinger conditions are stretched. |

The model is intentionally explainable. Every forecast includes the factors that pushed the prediction up, down, or neutral.

## How To Improve The Machine Learning

These are the best next steps to make the project more focused as a machine learning project:

1. **Create a real dataset builder**
   Save historical OHLCV rows into CSV/Parquet files so the model can train and test on a fixed dataset instead of only calling live APIs.

2. **Add supervised ML models**
   Train models such as Random Forest, XGBoost/LightGBM, Logistic Regression, or Gradient Boosting to predict:
   - next-day direction
   - 5-day direction
   - expected return bucket
   - volatility/risk bucket

3. **Separate training and inference**
   Add a `train_model.py` script for training and save the trained model as a `.pkl` or `.joblib` file. The FastAPI app should load the saved model for predictions.

4. **Use proper labels**
   Example labels:
   - `target_1d_up`: whether close after 1 day is higher
   - `target_5d_up`: whether close after 5 days is higher
   - `target_5d_return`: percent return after 5 days
   - `target_risk`: whether drawdown crossed a risk threshold

5. **Add train/test splits by time**
   Do not randomly shuffle stock time series. Train on older data and test on newer data to avoid leakage.

6. **Track model metrics**
   Add accuracy, precision, recall, F1-score, ROC-AUC, MAE, RMSE, hit rate, and confusion matrix.

7. **Compare models**
   Keep the current hybrid model as a baseline, then compare it against trained ML models.

8. **Add feature importance**
   Show which features influenced the prediction most. This makes the project easier to explain in a viva, demo, or report.

9. **Add model versioning**
   Store model name, version, training date, symbols used, features used, and validation score.

10. **Add a notebook/report**
   Create a Jupyter notebook that explains dataset creation, feature engineering, model training, evaluation, and final results.

## Recommended ML Roadmap

| Phase | Goal | Output |
|---|---|---|
| Phase 1 | Explain current hybrid model clearly | README and UI explanation |
| Phase 2 | Build historical dataset | `data/psx_ohlcv.csv` |
| Phase 3 | Train baseline supervised model | Logistic Regression / Random Forest |
| Phase 4 | Add model evaluation | Accuracy, F1, confusion matrix, MAE |
| Phase 5 | Serve trained model in FastAPI | `/api/ml/predict/{symbol}` |
| Phase 6 | Compare baseline vs ML model | Model comparison page |
| Phase 7 | Add feature importance | Explainable ML output |

## Project Structure

```text
psx-ai-clean/
|-- backend/
|   |-- main.py              # FastAPI server, ML features, prediction, backtesting
|   |-- requirements.txt     # Python packages
|   |-- .env.example         # Example environment file
|   `-- .env                 # Local secrets, not committed
`-- frontend/
    |-- index.html
    |-- package.json
    |-- vite.config.js
    |-- .env                 # Frontend environment settings
    `-- src/
        |-- main.jsx
        |-- App.jsx
        |-- index.css
        `-- components/
            |-- Navbar.jsx
            |-- Dashboard.jsx
            |-- ScreenerPage.jsx
            |-- ResearchPage.jsx
            |-- ChatPage.jsx
            |-- PredictPage.jsx
            `-- Footer.jsx
```

## Requirements

Install these first:

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |

Check your versions:

```bash
python --version
node --version
npm --version
```

## Run The Backend

Open a terminal in the project root, then run:

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file if it does not already exist:

```bash
copy .env.example .env
```

Open `backend/.env` and add your Gemini API key:

```text
GEMINI_API_KEY=paste_your_key_here
```

Start the FastAPI backend:

```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend should be available at:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Run The Frontend

Open a second terminal in the project root, then run:

```bash
cd frontend
npm install
npm run dev
```

The frontend should be available at:

```text
http://127.0.0.1:5173/
```

## Running Both Apps

You need two terminals:

| Terminal | Folder | Command |
|----------|--------|---------|
| Backend | `backend` | `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000` |
| Frontend | `frontend` | `npm run dev` |

The frontend expects the backend to be running on port `8000`.

## Pages

| Page | What it does |
|------|--------------|
| Market | Live PSX dashboard with movers, breadth, volume, comparison, portfolio, and alerts. |
| Screener | Filters stocks by price, volume, sector, momentum, breakout score, and change. |
| Research | Runs backtests and shows corporate announcements/calendar. |
| AI Chat | Gemini/local chatbot that uses live PSX context. |
| Predict | ML trend prediction, forecast path, confidence, signals, scenarios, and explanation. |

## Common Errors

| Error | Fix |
|-------|-----|
| `pip not found` | Try `python -m pip install -r requirements.txt` from the `backend` folder. |
| `npm not found` | Install Node.js from https://nodejs.org. |
| `GEMINI_API_KEY not configured` | Check `backend/.env` and make sure the key is set. |
| Chat is not working | Make sure the backend is running at `http://127.0.0.1:8000`. |
| Blank frontend page | Run `npm install` inside the `frontend` folder, then restart `npm run dev`. |
| Prices show previous close | This is expected after PSX market close when live market-watch prices are unavailable. |
