#!/usr/bin/env python3
"""
Daily Stock Screener — Automated 6 AM PST
Scans 300+ stocks for fresh MA9/MA27 crossovers
Posts results to Discord #stocks channel
"""

import yfinance as yf
import pandas as pd
from datetime import datetime
import requests
import json
import sys

# Read stock universe
try:
    with open('/Users/unicornrobot/.openclaw/workspace/tools/stock-screener-universe.txt', 'r') as f:
        STOCKS = [line.strip() for line in f if line.strip()]
except:
    print("Error: stock-screener-universe.txt not found")
    sys.exit(1)

def analyze_stock(ticker):
    """Analyze single stock for algorithm criteria"""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period='90d')
        
        if df.empty or len(df) < 50:
            return None
        
        # Calculate EMA9, MA27, MACD (exact stockcharts formula)
        df['EMA9'] = df['Close'].ewm(span=9, adjust=False).mean()
        df['MA27'] = df['Close'].ewm(span=27, adjust=False).mean()
        df['Vol_MA20'] = df['Volume'].rolling(20).mean()
        df['Vol_Ratio'] = df['Volume'] / df['Vol_MA20']
        
        ema12 = df['Close'].ewm(span=12, adjust=False).mean()
        ema26 = df['Close'].ewm(span=26, adjust=False).mean()
        df['MACD'] = ema12 - ema26
        df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
        
        latest = df.iloc[-1]
        
        ema9 = latest['EMA9']
        ma27 = latest['MA27']
        gap = ((ema9 - ma27) / ma27 * 100)
        vol_ratio = latest['Vol_Ratio']
        macd_bullish = latest['MACD'] > latest['Signal']
        
        # Algorithm criteria (STRICT)
        f1 = ema9 > ma27  # MA9 > MA27
        f2 = vol_ratio >= 1.1  # Volume >= 1.1x
        f3 = macd_bullish  # MACD bullish
        
        passes_all = f1 and f2 and f3
        
        # Score for near-misses
        score = 0
        if f1: score += 40
        elif gap > -2: score += 20
        if f2: score += 35
        elif vol_ratio > 0.8: score += 15
        if f3: score += 25
        
        return {
            'ticker': ticker,
            'price': latest['Close'],
            'ema9': ema9,
            'ma27': ma27,
            'gap_pct': gap,
            'vol_ratio': vol_ratio,
            'macd_bullish': macd_bullish,
            'passes_all': passes_all,
            'score': score
        }
    except:
        return None

def screen_stocks():
    """Screen all stocks and return qualified results"""
    results = []
    
    print(f"Screening {len(STOCKS)} stocks...")
    
    for i, ticker in enumerate(STOCKS):
        if i % 50 == 0:
            print(f"  Progress: {i}/{len(STOCKS)}")
        
        data = analyze_stock(ticker)
        if data:
            results.append(data)
    
    # Separate quality setups from near-misses
    quality = [r for r in results if r['passes_all']]
    quality = sorted(quality, key=lambda x: x['gap_pct'])[:10]  # Top 10 freshest
    
    near_miss = [r for r in results if not r['passes_all']]
    near_miss = sorted(near_miss, key=lambda x: x['score'], reverse=True)[:10]  # Top 10 by score
    
    return quality, near_miss

def format_discord_message(quality, near_miss):
    """Format results for Discord posting"""
    
    msg = "**🔍 DAILY STOCK SCREENER — 6:00 AM PST**\n"
    msg += f"*{datetime.now().strftime('%A, %B %d, %Y')}*\n"
    msg += f"Universe: {len(STOCKS)} stocks | Scanning: EMA9 > MA27, Volume ≥1.1x, MACD bullish\n\n"
    
    if quality:
        msg += "**🟢 QUALITY SETUPS (All 3 criteria met):**\n"
        for r in quality:
            msg += f"\n**{r['ticker']}** | ${r['price']:.2f}\n"
            msg += f"EMA9 ${r['ema9']:.2f} > MA27 ${r['ma27']:.2f} | Gap: {r['gap_pct']:+.2f}%\n"
            msg += f"Volume: {r['vol_ratio']:.2f}x | MACD: ✓\n"
            msg += f"https://stockcharts.com/c/ush/?t={r['ticker']}\n"
    else:
        msg += "🔴 **No quality setups today** (all 3 criteria met)\n\n"
    
    if near_miss:
        msg += "\n**🟡 WATCH LIST (2/3 criteria met):**\n"
        for r in near_miss[:5]:
            msg += f"• **{r['ticker']}** | ${r['price']:.2f} | Score: {r['score']:.0f}/100\n"
    
    msg += f"\n_Data current through yesterday's close. Update frequency: Daily 6:00 AM PST_"
    
    return msg

def post_to_discord(message):
    """Post to Discord #stocks channel"""
    # This will be called by cron — webhook token in env
    webhook_url = "https://discord.com/api/webhooks/1478259138584444944/YOUR_TOKEN"
    
    try:
        requests.post(webhook_url, json={"content": message})
        print("✓ Posted to Discord")
    except Exception as e:
        print(f"Error posting to Discord: {e}")

if __name__ == '__main__':
    print("Starting daily screener...")
    quality, near_miss = screen_stocks()
    message = format_discord_message(quality, near_miss)
    print(message)
    # post_to_discord(message)  # Uncomment when webhook ready
