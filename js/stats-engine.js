/**
 * StatsEngine - 100% Client-Side Pure JavaScript Statistical Computing Engine
 * Provides comprehensive descriptive, inferential, correlation, regression, and SPC analytics.
 */
(function (global) {
  'use strict';

  const StatsEngine = {};

  // ==========================================
  // 1. Core Mathematical & Statistical Basics
  // ==========================================

  StatsEngine.cleanNumericArray = function (arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(v => (typeof v === 'number' ? v : parseFloat(v)))
      .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  };

  StatsEngine.sum = function (arr) {
    return arr.reduce((acc, v) => acc + v, 0);
  };

  StatsEngine.mean = function (arr) {
    if (arr.length === 0) return 0;
    return StatsEngine.sum(arr) / arr.length;
  };

  StatsEngine.variance = function (arr, isSample = true) {
    if (arr.length < 2) return 0;
    const avg = StatsEngine.mean(arr);
    const ss = arr.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
    return ss / (isSample ? arr.length - 1 : arr.length);
  };

  StatsEngine.stdDev = function (arr, isSample = true) {
    return Math.sqrt(StatsEngine.variance(arr, isSample));
  };

  StatsEngine.median = function (arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  };

  StatsEngine.quantile = function (sortedArr, q) {
    if (sortedArr.length === 0) return 0;
    const pos = (sortedArr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
    }
    return sortedArr[base];
  };

  StatsEngine.mode = function (arr) {
    if (arr.length === 0) return null;
    const freq = new Map();
    let maxFreq = 0;
    let modeVal = arr[0];
    for (const v of arr) {
      const count = (freq.get(v) || 0) + 1;
      freq.set(v, count);
      if (count > maxFreq) {
        maxFreq = count;
        modeVal = v;
      }
    }
    return { value: modeVal, frequency: maxFreq };
  };

  StatsEngine.skewness = function (arr) {
    const n = arr.length;
    if (n < 3) return 0;
    const avg = StatsEngine.mean(arr);
    const s = StatsEngine.stdDev(arr, true);
    if (s === 0) return 0;
    const m3 = arr.reduce((acc, v) => acc + Math.pow((v - avg) / s, 3), 0);
    return (n / ((n - 1) * (n - 2))) * m3;
  };

  StatsEngine.kurtosis = function (arr) {
    // Fisher's excess kurtosis (Normal distribution = 0)
    const n = arr.length;
    if (n < 4) return 0;
    const avg = StatsEngine.mean(arr);
    const s = StatsEngine.stdDev(arr, true);
    if (s === 0) return 0;
    const m4 = arr.reduce((acc, v) => acc + Math.pow((v - avg) / s, 4), 0);
    const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * m4;
    const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    return term1 - term2;
  };

  /**
   * Complete descriptive summary for a numeric array
   */
  StatsEngine.describe = function (rawArr) {
    const arr = StatsEngine.cleanNumericArray(rawArr);
    if (arr.length === 0) return null;
    const n = arr.length;
    const sorted = [...arr].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;
    const sum = StatsEngine.sum(arr);
    const mean = sum / n;
    const variance = StatsEngine.variance(arr, true);
    const std = Math.sqrt(variance);
    const q1 = StatsEngine.quantile(sorted, 0.25);
    const median = StatsEngine.quantile(sorted, 0.5);
    const q3 = StatsEngine.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const skew = StatsEngine.skewness(arr);
    const kurt = StatsEngine.kurtosis(arr);
    const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0; // %

    return {
      count: n,
      sum,
      mean,
      std,
      variance,
      min,
      q1,
      median,
      q3,
      max,
      range,
      iqr,
      skewness: skew,
      kurtosis: kurt,
      cv,
      mode: StatsEngine.mode(arr).value
    };
  };

  // ==========================================
  // 2. Probability & Distribution Functions
  // ==========================================

  // Normal distribution PDF
  StatsEngine.normalPdf = function (x, mean, std) {
    if (std === 0) return 0;
    const exp = Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
    return (1 / (std * Math.sqrt(2 * Math.PI))) * exp;
  };

  // Error Function erf(x) approximation
  StatsEngine.erf = function (x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
  };

  // Standard Normal CDF
  StatsEngine.normalCdf = function (z) {
    return 0.5 * (1 + StatsEngine.erf(z / Math.SQRT2));
  };

  // Inverse Standard Normal CDF (Probit function)
  StatsEngine.probit = function (p) {
    if (p <= 0 || p >= 1) return 0;
    // Beasley-Springer-Moro algorithm
    const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
    const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
    const c = [
      0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
      0.0276438810338635, 0.0038405729373609, 0.0003951804142957,
      0.0000321767881768, 0.0000002888167364, 0.0000003960315187
    ];

    const y = p - 0.5;
    if (Math.abs(y) < 0.42) {
      const r = y * y;
      const num = y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]);
      const den = (((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1.0;
      return num / den;
    }

    let r = p;
    if (y > 0) r = 1 - p;
    r = Math.log(-Math.log(r));
    let x = c[0];
    for (let i = 1; i < c.length; i++) {
      x += c[i] * Math.pow(r, i);
    }
    return y < 0 ? -x : x;
  };

  // Jarque-Bera Normality Test
  StatsEngine.jarqueBeraTest = function (rawArr) {
    const arr = StatsEngine.cleanNumericArray(rawArr);
    const n = arr.length;
    if (n < 6) return { statistic: 0, pValue: 1, isNormal: true };

    const S = StatsEngine.skewness(arr);
    const K = StatsEngine.kurtosis(arr); // excess kurtosis

    const jb = (n / 6) * (Math.pow(S, 2) + Math.pow(K, 2) / 4);
    // Under H0, JB follows Chi-squared with df = 2
    // p-value for chi-squared with df=2 is e^(-jb / 2)
    const pValue = Math.max(0, Math.min(1, Math.exp(-jb / 2)));

    return {
      statistic: jb,
      pValue: pValue,
      skewness: S,
      kurtosis: K,
      isNormal: pValue >= 0.05
    };
  };

  // Q-Q Plot Coordinates
  StatsEngine.qqPlotData = function (rawArr) {
    const arr = StatsEngine.cleanNumericArray(rawArr);
    const n = arr.length;
    if (n === 0) return { theoretical: [], actual: [] };

    const sorted = [...arr].sort((a, b) => a - b);
    const mean = StatsEngine.mean(sorted);
    const std = StatsEngine.stdDev(sorted, true);

    const theoretical = [];
    const actual = [];

    for (let i = 0; i < n; i++) {
      // Blom's plotting position: (i + 1 - 0.375) / (n + 0.25)
      const p = (i + 1 - 0.375) / (n + 0.25);
      const zTheoretical = StatsEngine.probit(p);
      const theoreticalVal = mean + zTheoretical * std;
      theoretical.push(theoreticalVal);
      actual.push(sorted[i]);
    }

    return { theoretical, actual, mean, std };
  };

  // ==========================================
  // 3. Correlation Analysis
  // ==========================================

  // Pearson Correlation Coefficient
  StatsEngine.pearson = function (arrX, arrY) {
    const n = Math.min(arrX.length, arrY.length);
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const x = arrX[i];
      const y = arrY[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    return num / den;
  };

  // Spearman Rank Correlation
  StatsEngine.spearman = function (arrX, arrY) {
    const n = Math.min(arrX.length, arrY.length);
    if (n < 2) return 0;

    const rank = function (arr) {
      const paired = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
      const ranks = new Array(n);
      let i = 0;
      while (i < n) {
        let j = i;
        while (j < n - 1 && paired[j].val === paired[j + 1].val) {
          j++;
        }
        const avgRank = (i + j + 2) / 2;
        for (let k = i; k <= j; k++) {
          ranks[paired[k].idx] = avgRank;
        }
        i = j + 1;
      }
      return ranks;
    };

    const rankX = rank(arrX.slice(0, n));
    const rankY = rank(arrY.slice(0, n));
    return StatsEngine.pearson(rankX, rankY);
  };

  // Correlation Matrix for multiple columns
  StatsEngine.correlationMatrix = function (dataObject, colNames, method = 'pearson') {
    const matrix = [];
    const fn = method === 'spearman' ? StatsEngine.spearman : StatsEngine.pearson;

    for (let i = 0; i < colNames.length; i++) {
      const row = [];
      const colA = colNames[i];
      const arrA = dataObject[colA];

      for (let j = 0; j < colNames.length; j++) {
        const colB = colNames[j];
        const arrB = dataObject[colB];
        if (i === j) {
          row.push(1.0);
        } else {
          row.push(parseFloat(fn(arrA, arrB).toFixed(4)));
        }
      }
      matrix.push(row);
    }

    return {
      labels: colNames,
      z: matrix,
      method: method
    };
  };

  // ==========================================
  // 4. Regression Analysis
  // ==========================================

  // Simple Linear Regression (y = a*x + b)
  StatsEngine.linearRegression = function (arrX, arrY) {
    const n = Math.min(arrX.length, arrY.length);
    if (n < 2) return null;

    const meanX = StatsEngine.mean(arrX);
    const meanY = StatsEngine.mean(arrY);

    let ssXY = 0;
    let ssXX = 0;
    let ssYY = 0;

    for (let i = 0; i < n; i++) {
      const dx = arrX[i] - meanX;
      const dy = arrY[i] - meanY;
      ssXY += dx * dy;
      ssXX += dx * dx;
      ssYY += dy * dy;
    }

    if (ssXX === 0) return null;

    const slope = ssXY / ssXX;
    const intercept = meanY - slope * meanX;

    let ssRes = 0;
    const fitted = [];
    const residuals = [];

    for (let i = 0; i < n; i++) {
      const yHat = slope * arrX[i] + intercept;
      const res = arrY[i] - yHat;
      fitted.push(yHat);
      residuals.push(res);
      ssRes += res * res;
    }

    const r2 = ssYY !== 0 ? Math.max(0, 1 - ssRes / ssYY) : 0;
    const adjR2 = n > 2 ? 1 - ((1 - r2) * (n - 1)) / (n - 2) : r2;
    const mse = ssRes / n;
    const rmse = Math.sqrt(mse);
    const sError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    const seSlope = ssXX !== 0 ? sError / Math.sqrt(ssXX) : 0;
    const tStat = seSlope !== 0 ? slope / seSlope : 0;

    // Approximate p-value for t-statistic with df = n - 2
    const df = n - 2;
    const pValue = StatsEngine.tDistPValue(tStat, df);

    return {
      slope,
      intercept,
      r2,
      adjR2,
      mse,
      rmse,
      tStat,
      pValue,
      equation: `y = ${slope >= 0 ? '' : '-'}${Math.abs(slope).toFixed(4)}x ${intercept >= 0 ? '+ ' : '- '}${Math.abs(intercept).toFixed(4)}`,
      fitted,
      residuals
    };
  };

  // Polynomial Regression (Order 2: y = c2*x^2 + c1*x + c0)
  StatsEngine.polyRegression2 = function (arrX, arrY) {
    const n = Math.min(arrX.length, arrY.length);
    if (n < 3) return null;

    let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0;
    let t0 = 0, t1 = 0, t2 = 0;

    for (let i = 0; i < n; i++) {
      const x = arrX[i];
      const y = arrY[i];
      const x2 = x * x;
      s1 += x;
      s2 += x2;
      s3 += x2 * x;
      s4 += x2 * x2;
      t0 += y;
      t1 += x * y;
      t2 += x2 * y;
    }

    // Solve 3x3 system:
    // [s4 s3 s2] [c2]   [t2]
    // [s3 s2 s1] [c1] = [t1]
    // [s2 s1 s0] [c0]   [t0]
    const A = [
      [s4, s3, s2, t2],
      [s3, s2, s1, t1],
      [s2, s1, s0, t0]
    ];

    // Gaussian elimination
    for (let i = 0; i < 3; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < 3; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }
      for (let k = i; k < 4; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      if (Math.abs(A[i][i]) < 1e-12) return null;

      for (let k = i + 1; k < 3; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < 4; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
      }
    }

    const c = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      c[i] = A[i][3] / A[i][i];
      for (let k = i - 1; k >= 0; k--) {
        A[k][3] -= A[k][i] * c[i];
      }
    }

    const [c2, c1, c0] = c;

    const meanY = t0 / n;
    let ssTot = 0;
    let ssRes = 0;
    const fitted = [];

    for (let i = 0; i < n; i++) {
      const x = arrX[i];
      const y = arrY[i];
      const yHat = c2 * x * x + c1 * x + c0;
      fitted.push(yHat);
      ssTot += Math.pow(y - meanY, 2);
      ssRes += Math.pow(y - yHat, 2);
    }

    const r2 = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    return {
      c2, c1, c0,
      r2,
      equation: `y = ${c2.toFixed(4)}x² ${c1 >= 0 ? '+ ' : '- '}${Math.abs(c1).toFixed(4)}x ${c0 >= 0 ? '+ ' : '- '}${Math.abs(c0).toFixed(4)}`,
      fitted
    };
  };

  // ==========================================
  // 5. Hypothesis Testing (t-test & ANOVA)
  // ==========================================

  // Student's t distribution two-tailed p-value approximation
  StatsEngine.tDistPValue = function (t, df) {
    if (df <= 0) return 1.0;
    const absT = Math.abs(t);
    // Use regularized incomplete beta function approximation or Hill's series
    const x = df / (df + absT * absT);
    // Beta distribution approximation
    const a = df / 2;
    const b = 0.5;
    const pOneTail = 0.5 * StatsEngine.incompleteBeta(x, a, b);
    return Math.max(0, Math.min(1, 2 * pOneTail));
  };

  // Incomplete Beta Function approximation (Continued fraction)
  StatsEngine.incompleteBeta = function (x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Log Gamma function (Lanczos)
    const logGamma = function (z) {
      const c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.138571095831109, 9.9843695780195716e-6, 1.5056327351493116e-7
      ];
      let y = z;
      let x0 = c[0];
      for (let i = 1; i < 9; i++) {
        x0 += c[i] / (y + i);
      }
      const t = y + 7.5;
      return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(x0);
    };

    const factor = Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
    );

    // Lentz's method continued fraction
    const maxIter = 100;
    const eps = 3.0e-7;
    let c = 1.0;
    let d = 1.0 / (1.0 - (a + b) * x / (a + 1.0));
    let h = d;

    for (let m = 1; m <= maxIter; m++) {
      // Even step
      let m2 = 2 * m;
      let num = (m * (b - m) * x) / ((a + m2 - 1.0) * (a + m2));
      d = 1.0 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1.0 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      h *= d * c;

      // Odd step
      num = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1.0));
      d = 1.0 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1.0 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      const delta = d * c;
      h *= delta;

      if (Math.abs(delta - 1.0) < eps) break;
    }

    const result = (factor / a) * h;
    return x < (a + 1.0) / (a + b + 2.0) ? result : 1.0 - result;
  };

  // One-sample t-test
  StatsEngine.oneSampleTTest = function (rawArr, testMean = 0) {
    const arr = StatsEngine.cleanNumericArray(rawArr);
    const n = arr.length;
    if (n < 2) return null;

    const mean = StatsEngine.mean(arr);
    const std = StatsEngine.stdDev(arr, true);
    const se = std / Math.sqrt(n);
    const tStat = se !== 0 ? (mean - testMean) / se : 0;
    const df = n - 1;
    const pValue = StatsEngine.tDistPValue(tStat, df);

    return {
      n,
      mean,
      testMean,
      std,
      se,
      df,
      tStat,
      pValue,
      isSignificant: pValue < 0.05,
      ci95: [mean - 1.96 * se, mean + 1.96 * se]
    };
  };

  // Two-sample t-test (Welch's t-test)
  StatsEngine.twoSampleTTest = function (rawArr1, rawArr2) {
    const arr1 = StatsEngine.cleanNumericArray(rawArr1);
    const arr2 = StatsEngine.cleanNumericArray(rawArr2);
    const n1 = arr1.length;
    const n2 = arr2.length;
    if (n1 < 2 || n2 < 2) return null;

    const m1 = StatsEngine.mean(arr1);
    const m2 = StatsEngine.mean(arr2);
    const v1 = StatsEngine.variance(arr1, true);
    const v2 = StatsEngine.variance(arr2, true);

    const seDiff = Math.sqrt(v1 / n1 + v2 / n2);
    const tStat = seDiff !== 0 ? (m1 - m2) / seDiff : 0;

    // Welch-Satterthwaite df
    const numDf = Math.pow(v1 / n1 + v2 / n2, 2);
    const denDf = Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1);
    const df = denDf !== 0 ? numDf / denDf : 1;

    const pValue = StatsEngine.tDistPValue(tStat, Math.round(df));

    return {
      n1, n2, m1, m2,
      diff: m1 - m2,
      seDiff,
      df: Math.round(df * 10) / 10,
      tStat,
      pValue,
      isSignificant: pValue < 0.05
    };
  };

  // One-way ANOVA (Analysis of Variance)
  StatsEngine.oneWayAnova = function (groupsArray) {
    const validGroups = groupsArray.map(g => StatsEngine.cleanNumericArray(g)).filter(g => g.length > 0);
    const k = validGroups.length;
    if (k < 2) return null;

    let N = 0;
    let grandSum = 0;
    const groupMeans = [];
    const groupSizes = [];

    for (const g of validGroups) {
      const gSum = StatsEngine.sum(g);
      const gN = g.length;
      N += gN;
      grandSum += gSum;
      groupMeans.push(gSum / gN);
      groupSizes.push(gN);
    }

    const grandMean = grandSum / N;

    let ssBetween = 0;
    let ssWithin = 0;

    for (let i = 0; i < k; i++) {
      const g = validGroups[i];
      const gMean = groupMeans[i];
      ssBetween += groupSizes[i] * Math.pow(gMean - grandMean, 2);

      for (const val of g) {
        ssWithin += Math.pow(val - gMean, 2);
      }
    }

    const dfBetween = k - 1;
    const dfWithin = N - k;

    if (dfWithin <= 0) return null;

    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    const fStat = msWithin !== 0 ? msBetween / msWithin : 0;

    // F-distribution p-value: I_x(df1/2, df2/2) where x = df1*F / (df1*F + df2)
    const x = (dfBetween * fStat) / (dfBetween * fStat + dfWithin);
    const pValue = Math.max(0, Math.min(1, 1 - StatsEngine.incompleteBeta(x, dfBetween / 2, dfWithin / 2)));

    return {
      k, N,
      grandMean,
      ssBetween,
      ssWithin,
      dfBetween,
      dfWithin,
      msBetween,
      msWithin,
      fStat,
      pValue,
      isSignificant: pValue < 0.05
    };
  };

  // ==========================================
  // 6. SPC (Statistical Process Control) & Time Series
  // ==========================================

  // Shewhart Control Chart & Moving Averages
  StatsEngine.spcChart = function (rawArr) {
    const arr = StatsEngine.cleanNumericArray(rawArr);
    const n = arr.length;
    if (n < 2) return null;

    const mean = StatsEngine.mean(arr);
    const std = StatsEngine.stdDev(arr, true);

    const ucl = mean + 3 * std;
    const lcl = mean - 3 * std;
    const uwl = mean + 2 * std; // Upper Warning Limit
    const lwl = mean - 2 * std; // Lower Warning Limit

    // Moving Averages (SMA 5, SMA 20)
    const sma5 = [];
    const sma20 = [];

    for (let i = 0; i < n; i++) {
      if (i >= 4) {
        const slice5 = arr.slice(i - 4, i + 1);
        sma5.push(StatsEngine.mean(slice5));
      } else {
        sma5.push(null);
      }

      if (i >= 19) {
        const slice20 = arr.slice(i - 19, i + 1);
        sma20.push(StatsEngine.mean(slice20));
      } else {
        sma20.push(null);
      }
    }

    // Outlier detection: IQR & 3-Sigma rule
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = StatsEngine.quantile(sorted, 0.25);
    const q3 = StatsEngine.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const iqrLower = q1 - 1.5 * iqr;
    const iqrUpper = q3 + 1.5 * iqr;

    const outliers = [];
    for (let i = 0; i < n; i++) {
      const val = arr[i];
      const isSigmaOutlier = val > ucl || val < lcl;
      const isIqrOutlier = val > iqrUpper || val < iqrLower;
      if (isSigmaOutlier || isIqrOutlier) {
        outliers.push({
          index: i,
          value: val,
          type: isSigmaOutlier && isIqrOutlier ? '3σ & IQR' : (isSigmaOutlier ? '3σ' : 'IQR')
        });
      }
    }

    return {
      mean,
      std,
      ucl,
      lcl,
      uwl,
      lwl,
      sma5,
      sma20,
      iqrLower,
      iqrUpper,
      outliers,
      outlierCount: outliers.length,
      data: arr
    };
  };

  global.StatsEngine = StatsEngine;

})(typeof window !== 'undefined' ? window : this);
