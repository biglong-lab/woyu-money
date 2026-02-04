import { db } from "./db";
import { dailyPmsRecords } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface ForecastResult {
  predicted: number;
  confidence: number;
  trend: "increasing" | "decreasing" | "stable";
  changeRate: number;
  volatility: number;
}

export interface TrendAnalysis {
  dailyForecast: ForecastResult[];
  monthlyProjection: {
    currentMonth: number;
    nextMonth: number;
    futureMonth: number;
  };
  riskAssessment: "low" | "medium" | "high";
  recommendations: string[];
}

export class PMSForecastingEngine {
  /**
   * 線性趨勢預測 - 基於最近N天數據計算趨勢線
   */
  private linearTrend(values: number[], days: number = 7): ForecastResult {
    if (values.length < 3) {
      return {
        predicted: values[values.length - 1] || 0,
        confidence: 0.1,
        trend: "stable",
        changeRate: 0,
        volatility: 0
      };
    }

    const n = Math.min(values.length, days);
    const recentValues = values.slice(-n);
    
    // 計算線性回歸
    const xSum = recentValues.reduce((sum, _, i) => sum + i, 0);
    const ySum = recentValues.reduce((sum, val) => sum + val, 0);
    const xySum = recentValues.reduce((sum, val, i) => sum + i * val, 0);
    const x2Sum = recentValues.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    // 預測下一個值
    const predicted = slope * n + intercept;
    
    // 計算信心度 (基於R²)
    const yMean = ySum / n;
    const ssRes = recentValues.reduce((sum, val, i) => {
      const pred = slope * i + intercept;
      return sum + Math.pow(val - pred, 2);
    }, 0);
    const ssTot = recentValues.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    const confidence = Math.max(0.1, Math.min(0.95, rSquared));
    
    // 趨勢判斷
    const changeRate = (slope / yMean) * 100;
    let trend: "increasing" | "decreasing" | "stable";
    if (Math.abs(changeRate) < 2) trend = "stable";
    else if (changeRate > 0) trend = "increasing";
    else trend = "decreasing";
    
    // 波動性計算
    const volatility = Math.sqrt(ssRes / n) / yMean;
    
    return {
      predicted: Math.max(0, predicted),
      confidence,
      trend,
      changeRate,
      volatility
    };
  }

  /**
   * 指數平滑法預測 - 給近期數據更高權重
   */
  private exponentialSmoothing(values: number[], alpha: number = 0.3): ForecastResult {
    if (values.length === 0) {
      return {
        predicted: 0,
        confidence: 0.1,
        trend: "stable",
        changeRate: 0,
        volatility: 0
      };
    }

    let smoothed = values[0];
    const smoothedValues = [smoothed];
    
    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
      smoothedValues.push(smoothed);
    }
    
    // 計算趨勢
    const recent = smoothedValues.slice(-5);
    const changeRate = recent.length > 1 ? 
      ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100 : 0;
    
    let trend: "increasing" | "decreasing" | "stable";
    if (Math.abs(changeRate) < 2) trend = "stable";
    else if (changeRate > 0) trend = "increasing";
    else trend = "decreasing";
    
    // 計算波動性
    const variance = values.reduce((sum, val, i) => {
      return sum + Math.pow(val - smoothedValues[i], 2);
    }, 0) / values.length;
    const volatility = Math.sqrt(variance) / (smoothedValues[smoothedValues.length - 1] || 1);
    
    return {
      predicted: smoothed,
      confidence: Math.max(0.2, 0.8 - volatility),
      trend,
      changeRate,
      volatility
    };
  }

  /**
   * 季節性調整預測
   */
  private seasonalAdjustment(values: number[], period: number = 7): number {
    if (values.length < period * 2) return 1;
    
    const seasons = [];
    for (let i = 0; i < period; i++) {
      const seasonValues = [];
      for (let j = i; j < values.length; j += period) {
        seasonValues.push(values[j]);
      }
      const avgSeason = seasonValues.reduce((sum, val) => sum + val, 0) / seasonValues.length;
      seasons.push(avgSeason);
    }
    
    const overallAvg = seasons.reduce((sum, val) => sum + val, 0) / seasons.length;
    const currentSeasonIndex = (values.length - 1) % period;
    
    return seasons[currentSeasonIndex] / overallAvg;
  }

  /**
   * 獲取歷史數據並進行預測分析
   */
  async generateForecast(projectId?: number, days: number = 30): Promise<TrendAnalysis> {
    // 獲取歷史數據
    let query = db
      .select({
        date: dailyPmsRecords.date,
        currentMonthRevenue: dailyPmsRecords.currentMonthRevenue,
        nextMonthRevenue: dailyPmsRecords.nextMonthRevenue,
        futureMonthRevenue: dailyPmsRecords.futureMonthRevenue,
      })
      .from(dailyPmsRecords)
      .where(eq(dailyPmsRecords.isDeleted, false));

    if (projectId) {
      query = query.where(and(
        eq(dailyPmsRecords.isDeleted, false),
        eq(dailyPmsRecords.projectId, projectId)
      ));
    }

    const records = await query
      .orderBy(desc(dailyPmsRecords.date))
      .limit(days);

    if (records.length === 0) {
      return {
        dailyForecast: [],
        monthlyProjection: { currentMonth: 0, nextMonth: 0, futureMonth: 0 },
        riskAssessment: "high",
        recommendations: ["尚無足夠歷史數據進行預測，建議持續記錄業績數據"]
      };
    }

    // 轉換數據
    const currentMonthValues = records.map(r => parseFloat(r.currentMonthRevenue.toString())).reverse();
    const nextMonthValues = records.map(r => parseFloat(r.nextMonthRevenue.toString())).reverse();
    const futureMonthValues = records.map(r => parseFloat(r.futureMonthRevenue.toString())).reverse();

    // 生成預測
    const currentForecast = this.linearTrend(currentMonthValues);
    const nextForecast = this.linearTrend(nextMonthValues);
    const futureForecast = this.linearTrend(futureMonthValues);
    
    const currentSmoothed = this.exponentialSmoothing(currentMonthValues);
    const nextSmoothed = this.exponentialSmoothing(nextMonthValues);
    const futureSmoothed = this.exponentialSmoothing(futureMonthValues);

    // 生成未來7天預測
    const dailyForecast: ForecastResult[] = [];
    for (let i = 1; i <= 7; i++) {
      const seasonalFactor = this.seasonalAdjustment(currentMonthValues, 7);
      const linearPred = currentForecast.predicted + (currentForecast.changeRate / 100) * currentForecast.predicted * i;
      const smoothedPred = currentSmoothed.predicted * (1 + currentSmoothed.changeRate / 100 * i);
      
      const predicted = (linearPred * 0.6 + smoothedPred * 0.4) * seasonalFactor;
      const confidence = (currentForecast.confidence + currentSmoothed.confidence) / 2;
      
      dailyForecast.push({
        predicted,
        confidence,
        trend: currentForecast.trend,
        changeRate: currentForecast.changeRate,
        volatility: (currentForecast.volatility + currentSmoothed.volatility) / 2
      });
    }

    // 月度預測
    const monthlyProjection = {
      currentMonth: (currentForecast.predicted + currentSmoothed.predicted) / 2,
      nextMonth: (nextForecast.predicted + nextSmoothed.predicted) / 2,
      futureMonth: (futureForecast.predicted + futureSmoothed.predicted) / 2
    };

    // 風險評估
    const avgVolatility = (currentForecast.volatility + nextForecast.volatility + futureForecast.volatility) / 3;
    const avgConfidence = (currentForecast.confidence + nextForecast.confidence + futureForecast.confidence) / 3;
    
    let riskAssessment: "low" | "medium" | "high";
    if (avgVolatility < 0.1 && avgConfidence > 0.7) riskAssessment = "low";
    else if (avgVolatility < 0.2 && avgConfidence > 0.5) riskAssessment = "medium";
    else riskAssessment = "high";

    // 建議生成
    const recommendations = this.generateRecommendations(
      currentForecast, nextForecast, futureForecast, avgVolatility, avgConfidence
    );

    return {
      dailyForecast,
      monthlyProjection,
      riskAssessment,
      recommendations
    };
  }

  /**
   * 生成業績管理建議
   */
  private generateRecommendations(
    current: ForecastResult,
    next: ForecastResult,
    future: ForecastResult,
    volatility: number,
    confidence: number
  ): string[] {
    const recommendations: string[] = [];

    // 趨勢建議
    if (current.trend === "decreasing" && current.changeRate < -5) {
      recommendations.push("本月業績呈下降趨勢，建議加強行銷推廣和客戶維護");
    } else if (current.trend === "increasing" && current.changeRate > 10) {
      recommendations.push("本月業績表現優異，建議維持當前策略並準備擴大產能");
    }

    if (next.trend === "decreasing") {
      recommendations.push("下月業績預期下滑，建議提前制定應對策略");
    }

    // 波動性建議
    if (volatility > 0.3) {
      recommendations.push("業績波動較大，建議分析波動原因並制定穩定策略");
    } else if (volatility < 0.1) {
      recommendations.push("業績相對穩定，適合進行長期規劃");
    }

    // 信心度建議
    if (confidence < 0.5) {
      recommendations.push("預測信心度較低，建議增加數據記錄頻率以提高預測準確性");
    }

    // 月度比較建議
    const currentToNext = ((next.predicted - current.predicted) / current.predicted) * 100;
    if (currentToNext > 15) {
      recommendations.push("下月業績預期大幅成長，建議準備充足資源以應對需求增加");
    } else if (currentToNext < -15) {
      recommendations.push("下月業績預期大幅下降，建議檢視市場策略並調整營運計畫");
    }

    if (recommendations.length === 0) {
      recommendations.push("業績表現穩定，建議持續監控並維持現有策略");
    }

    return recommendations;
  }

  /**
   * 異常偵測 - 識別業績異常變動
   */
  async detectAnomalies(projectId?: number): Promise<{
    hasAnomalies: boolean;
    anomalies: Array<{
      date: string;
      type: "spike" | "drop" | "volatility";
      severity: "low" | "medium" | "high";
      description: string;
    }>;
  }> {
    let query = db
      .select({
        date: dailyPmsRecords.date,
        currentMonthRevenue: dailyPmsRecords.currentMonthRevenue,
      })
      .from(dailyPmsRecords)
      .where(eq(dailyPmsRecords.isDeleted, false));

    if (projectId) {
      query = query.where(and(
        eq(dailyPmsRecords.isDeleted, false),
        eq(dailyPmsRecords.projectId, projectId)
      ));
    }

    const records = await query
      .orderBy(desc(dailyPmsRecords.date))
      .limit(30);

    if (records.length < 5) {
      return { hasAnomalies: false, anomalies: [] };
    }

    const values = records.map(r => parseFloat(r.currentMonthRevenue.toString())).reverse();
    const dates = records.map(r => r.date).reverse();
    
    // 計算統計指標
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const anomalies = [];
    
    for (let i = 1; i < values.length; i++) {
      const current = values[i];
      const previous = values[i - 1];
      const zScore = Math.abs((current - mean) / stdDev);
      const changeRate = Math.abs((current - previous) / previous) * 100;
      
      // 檢測異常尖峰
      if (zScore > 2.5 && current > mean) {
        anomalies.push({
          date: dates[i],
          type: "spike" as const,
          severity: zScore > 3 ? "high" as const : "medium" as const,
          description: `業績出現異常高峰，比平均值高出 ${((current - mean) / mean * 100).toFixed(1)}%`
        });
      }
      
      // 檢測異常下降
      if (zScore > 2.5 && current < mean) {
        anomalies.push({
          date: dates[i],
          type: "drop" as const,
          severity: zScore > 3 ? "high" as const : "medium" as const,
          description: `業績出現異常下降，比平均值低 ${((mean - current) / mean * 100).toFixed(1)}%`
        });
      }
      
      // 檢測高波動
      if (changeRate > 50) {
        anomalies.push({
          date: dates[i],
          type: "volatility" as const,
          severity: changeRate > 100 ? "high" as const : "medium" as const,
          description: `業績波動劇烈，單日變化 ${changeRate.toFixed(1)}%`
        });
      }
    }
    
    return {
      hasAnomalies: anomalies.length > 0,
      anomalies
    };
  }
}

export const pmsForecasting = new PMSForecastingEngine();