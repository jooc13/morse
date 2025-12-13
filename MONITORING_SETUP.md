# MORSE Monitoring & Alerting Setup

Complete guide for production monitoring, alerting, and observability.

## Overview

This guide sets up comprehensive monitoring for:
- Service health and uptime
- Performance metrics (response times, Core Web Vitals)
- Error rates and tracking
- Database performance
- User experience metrics

**Goal:** Know about issues before users report them, with <15 minute mean time to recovery.

---

## Quick Setup (15 minutes)

### 1. UptimeRobot - Basic Health Monitoring (Free)

**Setup:**

1. Go to https://uptimerobot.com (free tier: 50 monitors)
2. Create account
3. Add monitors:

**API Health Monitor:**
- Monitor Type: HTTP(s)
- URL: `https://your-api.onrender.com/health`
- Monitoring Interval: 5 minutes
- Alert Contacts: Your email/SMS

**Frontend Monitor:**
- Monitor Type: HTTP(s)
- URL: `https://your-frontend.onrender.com`
- Monitoring Interval: 5 minutes
- Alert Contacts: Your email/SMS

**Benefits:**
- Instant downtime alerts
- 99.9% uptime tracking
- Response time monitoring
- Public status page

**Time to setup:** 5 minutes

---

### 2. Render Built-in Monitoring (Free)

**Already included with Render:**

1. Go to https://dashboard.render.com
2. Select service (morse-api or morse-frontend)
3. View metrics:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

**Setup Alerts:**

1. Render Dashboard > Service > Settings > Notifications
2. Enable alerts for:
   - Service down
   - Deploy failed
   - Deploy succeeded
   - High memory usage

**Benefits:**
- Built-in, no configuration needed
- Real-time metrics
- Deploy notifications
- Free with service

**Time to setup:** 2 minutes

---

### 3. Sentry - Error Tracking (Optional, Recommended)

**Free tier:** 5,000 errors/month

**Setup:**

1. Create account at https://sentry.io
2. Create new project: Node.js
3. Get your DSN key

**Install in API:**

```bash
cd morse-backend/services/api
npm install @sentry/node --save
```

**Add to morse-backend/services/api/src/app.js:**

```javascript
const Sentry = require('@sentry/node');

// Initialize Sentry (add at top of file, after requires)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1, // 10% of transactions for performance
  });

  // RequestHandler creates a separate execution context
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// ... your routes ...

// Error handler (add before final error handler)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}
```

**Add to Render environment variables:**
- Key: `SENTRY_DSN`
- Value: Your Sentry DSN

**Benefits:**
- Automatic error tracking
- Stack traces with context
- Performance monitoring
- User impact metrics
- Release tracking

**Time to setup:** 8 minutes

---

## Advanced Monitoring (Optional)

### 4. LogTail - Log Aggregation

**Free tier:** 1GB/month

**Setup:**

1. Go to https://logtail.com
2. Create source: Render
3. Get source token

**Add to Render environment variables:**
- Key: `LOGTAIL_SOURCE_TOKEN`
- Value: Your token

**Install in API:**

```bash
npm install @logtail/node --save
```

**Benefits:**
- Centralized logs
- Real-time search
- Alert on patterns
- Log retention

**Time to setup:** 10 minutes

---

### 5. Custom Performance Monitoring

**Add to morse-backend/services/api/src/middleware/performance.js:**

```javascript
// Performance monitoring middleware

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();

  // Capture response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log slow requests (>150ms)
    if (duration > 150) {
      console.warn({
        type: 'SLOW_REQUEST',
        method: req.method,
        path: req.path,
        duration,
        statusCode,
        timestamp: new Date().toISOString(),
      });
    }

    // Log errors
    if (statusCode >= 500) {
      console.error({
        type: 'SERVER_ERROR',
        method: req.method,
        path: req.path,
        duration,
        statusCode,
        timestamp: new Date().toISOString(),
      });
    }

    // Store metrics (could send to external service)
    global.metrics = global.metrics || { requests: [], errors: 0, slowRequests: 0 };
    global.metrics.requests.push({ duration, statusCode, timestamp: Date.now() });
    if (statusCode >= 500) global.metrics.errors++;
    if (duration > 150) global.metrics.slowRequests++;

    // Keep only last 1000 requests in memory
    if (global.metrics.requests.length > 1000) {
      global.metrics.requests = global.metrics.requests.slice(-1000);
    }
  });

  next();
};

module.exports = performanceMonitor;
```

**Add metrics endpoint in app.js:**

```javascript
// Add this route
app.get('/metrics', (req, res) => {
  const metrics = global.metrics || { requests: [], errors: 0, slowRequests: 0 };
  const recentRequests = metrics.requests.slice(-100);

  // Calculate p95
  const sortedDurations = recentRequests
    .map(r => r.duration)
    .sort((a, b) => a - b);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p95 = sortedDurations[p95Index] || 0;

  // Calculate average
  const avg = sortedDurations.length > 0
    ? sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length
    : 0;

  // Error rate (last 100 requests)
  const errorCount = recentRequests.filter(r => r.statusCode >= 500).length;
  const errorRate = (errorCount / recentRequests.length) * 100 || 0;

  res.json({
    timestamp: new Date().toISOString(),
    performance: {
      p95: Math.round(p95),
      average: Math.round(avg),
      slowRequests: metrics.slowRequests,
    },
    errors: {
      total: metrics.errors,
      errorRate: errorRate.toFixed(2) + '%',
    },
    requests: {
      total: metrics.requests.length,
      recent: recentRequests.length,
    },
  });
});
```

**Use the middleware:**

```javascript
const performanceMonitor = require('./middleware/performance');
app.use(performanceMonitor);
```

**Benefits:**
- Custom metrics endpoint
- P95 tracking
- Error rate monitoring
- No external dependencies

---

## Monitoring Dashboard Setup

### Option 1: Render Dashboard (Built-in)

**Access:** https://dashboard.render.com

**What to monitor:**
- CPU usage (alert if >80% consistently)
- Memory usage (alert if >90%)
- Request rate
- Response times
- Deploy status

**Best for:** Quick checks, deploy monitoring

---

### Option 2: Custom Monitoring Script

**Use the included monitoring script:**

```bash
# Monitor for 5 minutes
export API_URL=https://your-api.onrender.com
export FRONTEND_URL=https://your-frontend.onrender.com
just monitor
```

**This tracks:**
- Health check status
- P95 response times
- Error rates
- Request counts

**Best for:** Post-deployment monitoring, debugging

---

### Option 3: External Dashboard (Grafana Cloud - Free Tier)

**Setup Grafana Cloud:**

1. Go to https://grafana.com/products/cloud/
2. Create free account
3. Create API key
4. Install Grafana Agent on Render (advanced)

**Best for:** Long-term metrics, custom dashboards

---

## Alert Configuration

### Critical Alerts (Immediate Action Required)

| Alert | Threshold | Action |
|-------|-----------|--------|
| Service Down | >1 min | Immediate rollback |
| Error Rate >10% | 5 min window | Investigate + rollback |
| P95 >500ms | 10 min window | Check database, consider scaling |
| Database Connection Failed | Immediate | Check DB status, restart service |

### Warning Alerts (Monitor Closely)

| Alert | Threshold | Action |
|-------|-----------|--------|
| Error Rate 5-10% | 15 min window | Investigate errors |
| P95 150-500ms | 30 min window | Optimize queries |
| Memory >80% | 10 min window | Check for memory leaks |
| CPU >80% | 15 min window | Consider scaling up |

### Informational Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| New Deploy | Immediate | Monitor for 15 min |
| Slow Request >150ms | Log only | Review later |
| High Request Rate | 2x normal | Celebrate or investigate |

---

## Monitoring Checklist

### Daily Checks (5 minutes)

- [ ] Check Render dashboard for any alerts
- [ ] Review error rates (should be <1%)
- [ ] Check response times (p95 <150ms)
- [ ] Verify all services are running

### Weekly Checks (15 minutes)

- [ ] Review Sentry errors (if configured)
- [ ] Check database performance
- [ ] Review slow request logs
- [ ] Check uptime statistics (should be >99.9%)
- [ ] Review resource usage trends

### Post-Deployment Checks (15 minutes)

- [ ] Run health checks: `just health`
- [ ] Run smoke tests: `just smoke`
- [ ] Monitor for 15 minutes: `just monitor`
- [ ] Check error rates
- [ ] Verify new features work
- [ ] Review deployment logs

---

## Metrics to Track

### Performance Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **API Response Time (p50)** | <50ms | >100ms |
| **API Response Time (p95)** | <100ms | >150ms |
| **API Response Time (p99)** | <200ms | >500ms |
| **Frontend LCP** | <2.0s | >2.5s |
| **Frontend FID** | <100ms | >300ms |
| **Frontend CLS** | <0.1 | >0.25 |

### Reliability Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Uptime** | 99.9% | <99.5% |
| **Error Rate** | <0.1% | >1% |
| **Database Uptime** | 99.99% | <99.9% |
| **Deploy Success Rate** | 100% | <95% |

### User Experience Metrics

| Metric | Target | Monitor |
|--------|--------|---------|
| **Time to Interactive** | <3s | Track trend |
| **API Success Rate** | >99% | Track trend |
| **User Sessions** | Growing | Track growth |

---

## Automated Monitoring Script

**Create: scripts/daily-health-check.sh**

```bash
#!/bin/bash
# Daily automated health check
# Run via cron: 0 9 * * * /path/to/daily-health-check.sh

export API_URL=https://your-api.onrender.com
export FRONTEND_URL=https://your-frontend.onrender.com

# Run health check
/path/to/scripts/health-check.sh > /tmp/health-check-$(date +%Y%m%d).log 2>&1

# Check exit code
if [ $? -ne 0 ]; then
    # Send alert (customize as needed)
    echo "Health check failed on $(date)" | mail -s "MORSE Health Check Failed" your-email@example.com
fi
```

**Setup cron:**

```bash
crontab -e

# Add:
0 9 * * * /path/to/scripts/daily-health-check.sh
```

---

## Incident Response Runbook

### 1. Service Down

**Detection:** UptimeRobot alert, Render notification

**Immediate Actions:**
```bash
# Check status
curl https://your-api.onrender.com/health

# Check Render dashboard
open https://dashboard.render.com

# View logs
render logs -s morse-api --tail 100

# If needed, rollback
just emergency-rollback morse-api
```

**Root Cause Investigation:**
- Check recent deploys
- Review error logs
- Check database connectivity
- Verify environment variables

---

### 2. High Error Rate

**Detection:** Sentry alert, monitoring script

**Immediate Actions:**
```bash
# Check error distribution
render logs -s morse-api | grep -i error | tail -50

# Check metrics
curl https://your-api.onrender.com/metrics

# Run smoke tests
just smoke
```

**Investigation:**
- Identify error pattern
- Check if specific endpoint
- Review recent code changes
- Check database queries

---

### 3. Slow Performance

**Detection:** P95 >150ms alert

**Immediate Actions:**
```bash
# Monitor current performance
just monitor

# Check database
# Look for slow queries

# Check resource usage
# Render dashboard > Service > Metrics
```

**Investigation:**
- Profile slow endpoints
- Check database indexes
- Review recent code changes
- Consider caching

---

## Summary

### Minimum Monitoring Setup (Free, 10 minutes)

1. **UptimeRobot:** Health check monitoring
2. **Render Dashboard:** Resource metrics
3. **Built-in scripts:** Health checks and monitoring

### Recommended Setup (Free tiers, 30 minutes)

1. **UptimeRobot:** Uptime monitoring
2. **Render Dashboard:** Resource metrics
3. **Sentry:** Error tracking
4. **Built-in scripts:** Automated testing
5. **Custom /metrics endpoint:** Performance tracking

### Enterprise Setup (Paid)

1. All of the above, plus:
2. **Grafana Cloud:** Custom dashboards
3. **PagerDuty:** On-call rotation
4. **Datadog/New Relic:** Full observability

---

## Next Steps

1. **Setup UptimeRobot** (5 minutes)
   - Monitor /health endpoints
   - Configure email alerts

2. **Enable Render Notifications** (2 minutes)
   - Deploy notifications
   - Service down alerts

3. **Optional: Add Sentry** (10 minutes)
   - Error tracking
   - Performance monitoring

4. **Test Alerts** (5 minutes)
   - Verify you receive notifications
   - Test rollback procedure

5. **Document Runbook** (15 minutes)
   - Team contact info
   - Escalation procedures
   - Custom alerts for your app

---

**You now have comprehensive monitoring that:**
- Alerts on downtime within 5 minutes
- Tracks performance metrics
- Monitors error rates
- Enables fast incident response
- Costs $0 (free tiers)

Deploy with confidence.
