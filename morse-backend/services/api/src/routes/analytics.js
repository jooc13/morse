const express = require('express');
const axios = require('axios');
const router = express.Router();

// A/B test configuration
const AB_TEST_CONFIG = {
  variants: ['kudos', 'thanks'],
  weights: [50, 50], // 50/50 split
  cuicuiHook: 'https://cuicui.day/hooks',
  teamMembers: [
    {
      nickname: 'jooc13',
      role: 'Repository Owner & Lead Developer',
      avatar: 'J',
      status: 'Active'
    },
    {
      nickname: 'C13',
      role: 'Core Contributor',
      avatar: 'C',
      status: 'Active'
    },
    {
      nickname: 'Morse Dev',
      role: 'Frontend Specialist',
      avatar: 'M',
      status: 'Active'
    }
  ]
};

// Analytics storage (in production, use a database)
let analyticsData = {
  pageViews: 0,
  buttonClicks: {
    kudos: 0,
    thanks: 0
  },
  sessions: new Map(),
  events: []
};

// Function to send data to cuicui.day
async function sendToCuicui(eventType, data) {
  try {
    const payload = {
      eventType,
      timestamp: new Date().toISOString(),
      endpoint: '/f513a0a',
      team: 'jooc13',
      ...data
    };

    const response = await axios.post(AB_TEST_CONFIG.cuicuiHook, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`✅ Analytics sent to cuicui.day:`, response.data);
    return response.data;
  } catch (error) {
    console.warn(`⚠️ Failed to send to cuicui.day:`, error.message);
    // Continue execution even if cuicui fails
  }
}

// Determine A/B test variant based on user ID or session
function getVariant(sessionId) {
  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const percentile = hash % 100;

  if (percentile < AB_TEST_CONFIG.weights[0]) {
    return 'kudos';
  } else {
    return 'thanks';
  }
}

// Analytics endpoint - publicly accessible
router.get('/', async (req, res) => {
  // Get or create session ID
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'] ||
                    Math.random().toString(36).substr(2, 9);

  // Get A/B test variant for this session
  const variant = getVariant(sessionId);

  // Track page view
  analyticsData.pageViews++;
  const pageViewEvent = {
    eventType: 'page_view',
    endpoint: '/f513a0a',
    timestamp: new Date().toISOString(),
    sessionId,
    variant,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    referer: req.headers.referer || 'direct'
  };

  // Store event locally
  analyticsData.events.push(pageViewEvent);

  // Send to cuicui.day
  await sendToCuicui('page_view', pageViewEvent);

  // Send HTML response
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MORSE Analytics - Team jooc13</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            backdrop-filter: blur(10px);
        }

        .header {
            margin-bottom: 30px;
        }

        .title {
            font-size: 2.5rem;
            color: #2d3748;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .subtitle {
            color: #718096;
            font-size: 1.1rem;
            margin-bottom: 20px;
        }

        .team-section {
            margin-bottom: 40px;
        }

        .section-title {
            font-size: 1.3rem;
            color: #4a5568;
            margin-bottom: 20px;
            font-weight: 600;
        }

        .team-member {
            background: #f7fafc;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.3s ease;
        }

        .team-member:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .member-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 1.2rem;
        }

        .member-details {
            text-align: left;
        }

        .member-name {
            font-weight: 600;
            color: #2d3748;
            font-size: 1.1rem;
        }

        .member-role {
            color: #718096;
            font-size: 0.9rem;
        }

        .status-badge {
            background: #48bb78;
            color: white;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .button-container {
            margin-top: 30px;
        }

        .abtest-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 16px 32px;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 200px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .abtest-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .abtest-button:active {
            transform: translateY(0);
        }

        .analytics-info {
            margin-top: 30px;
            padding: 16px;
            background: #edf2f7;
            border-radius: 12px;
            font-size: 0.9rem;
            color: #4a5568;
        }

        .timestamp {
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            color: #718096;
        }

        .emoji {
            font-size: 1.2rem;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">MORSE Analytics</h1>
            <p class="subtitle">Team jooc13 Dashboard</p>
            <p class="timestamp">Page loaded at: ${new Date().toLocaleString()}</p>
        </div>

        <div class="team-section">
            <h2 class="section-title">
                <span class="emoji">👥</span> Team Members
            </h2>
            ${AB_TEST_CONFIG.teamMembers.map(member => `
            <div class="team-member">
                <div class="member-info">
                    <div class="avatar">${member.avatar}</div>
                    <div class="member-details">
                        <div class="member-name">${member.nickname}</div>
                        <div class="member-role">${member.role}</div>
                    </div>
                </div>
                <div class="status-badge">${member.status}</div>
            </div>
            `).join('')}
        </div>

        <div class="button-container">
            <button id="abtest" class="abtest-button">${variant}</button>
            <p style="margin-top: 10px; color: #718096; font-size: 0.9rem;">
                Variant: <strong>${variant}</strong> | Session: <code>${sessionId}</code>
            </p>
        </div>

        <div class="analytics-info">
            <p><strong>Analytics Tracking:</strong> This page is actively monitored. All interactions are logged.</p>
            <p><strong>Endpoint:</strong> /f513a0a | <strong>SHA1:</strong> "jooc13"</p>
        </div>
    </div>

    <script>
        // A/B Test Configuration
        const currentVariant = '${variant}';
        const sessionId = '${sessionId}';
        let clickCount = 0;

        // Track button click with comprehensive analytics
        async function trackButtonClick(buttonText) {
            clickCount++;

            const analyticsData = {
                eventType: 'button_click',
                endpoint: '/f513a0a',
                sessionId: sessionId,
                variant: currentVariant,
                buttonText: buttonText,
                clickCount: clickCount,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                screenResolution: screen.width + 'x' + screen.height,
                viewportSize: window.innerWidth + 'x' + window.innerHeight,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                referrer: document.referrer || 'direct'
            };

            // Log locally
            console.log('🔍 Analytics Event:', JSON.stringify(analyticsData, null, 2));

            // Send to backend
            try {
                const response = await fetch('/f513a0a/analytics/click', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-ID': sessionId
                    },
                    body: JSON.stringify(analyticsData)
                });

                if (response.ok) {
                    console.log('✅ Analytics sent successfully');
                }
            } catch (error) {
                console.warn('⚠️ Failed to send analytics:', error.message);
            }

            // Display feedback to user
            showFeedback(buttonText);
        }

        // Show visual feedback
        function showFeedback(buttonText) {
            const button = document.getElementById('abtest');
            const originalText = button.textContent;

            // Flash effect
            button.style.transform = 'scale(0.95)';
            button.style.opacity = '0.7';

            setTimeout(() => {
                button.style.transform = 'scale(1)';
                button.style.opacity = '1';
            }, 100);

            // Update click counter display
            const counter = document.getElementById('click-counter');
            if (counter) {
                counter.textContent = \`Clicks: \${clickCount}\`;
            }
        }

        // Add event listener to the button
        document.getElementById('abtest').addEventListener('click', function() {
            trackButtonClick(this.textContent);
        });

        // Track user engagement metrics
        let timeOnPage = 0;
        let mouseMovements = 0;
        let scrollDepth = 0;

        // Track time on page
        setInterval(() => {
            timeOnPage++;
        }, 1000);

        // Track mouse movements
        document.addEventListener('mousemove', () => {
            mouseMovements++;
        });

        // Track scroll depth
        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
            );
            scrollDepth = Math.max(scrollDepth, scrollPercent);
        });

        // Send engagement data on page unload
        window.addEventListener('beforeunload', async () => {
            const engagementData = {
                eventType: 'page_unload',
                endpoint: '/f513a0a',
                sessionId: sessionId,
                variant: currentVariant,
                timeOnPage: timeOnPage,
                mouseMovements: mouseMovements,
                scrollDepth: scrollDepth,
                timestamp: new Date().toISOString()
            };

            // Use sendBeacon for unload events
            if (navigator.sendBeacon) {
                navigator.sendBeacon(
                    '/f513a0a/analytics/engagement',
                    JSON.stringify(engagementData)
                );
            }
        });

        // Log page view details
        console.log('📊 Page Analytics Initialized:', {
            endpoint: '/f513a0a',
            sessionId: sessionId,
            variant: currentVariant,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
    </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// POST route for tracking button clicks
router.post('/analytics/click', async (req, res) => {
  try {
    const clickData = req.body;
    const sessionId = req.headers['x-session-id'] || 'unknown';

    // Update local analytics
    analyticsData.buttonClicks[clickData.buttonText]++;
    analyticsData.events.push({
      ...clickData,
      sessionId,
      recordedAt: new Date().toISOString()
    });

    // Send to cuicui.day
    await sendToCuicui('button_click', {
      ...clickData,
      sessionId
    });

    console.log(`📊 Button Click: ${clickData.buttonText} (Session: ${sessionId})`);

    res.json({ success: true, message: 'Analytics recorded' });
  } catch (error) {
    console.error('❌ Error recording click analytics:', error);
    res.status(500).json({ error: 'Failed to record analytics' });
  }
});

// POST route for tracking engagement (using sendBeacon)
router.post('/analytics/engagement', async (req, res) => {
  try {
    const engagementData = req.body;
    const sessionId = req.headers['x-session-id'] || 'unknown';

    // Update local analytics
    analyticsData.events.push({
      ...engagementData,
      sessionId,
      recordedAt: new Date().toISOString()
    });

    // Send to cuicui.day
    await sendToCuicui('page_engagement', {
      ...engagementData,
      sessionId
    });

    console.log(`📈 Engagement: Session ${sessionId} - ${engagementData.timeOnPage}s on page`);

    res.json({ success: true, message: 'Engagement recorded' });
  } catch (error) {
    console.error('❌ Error recording engagement:', error);
    res.status(500).json({ error: 'Failed to record engagement' });
  }
});

// GET route for analytics dashboard (for testing)
router.get('/analytics/stats', (req, res) => {
  res.json({
    summary: {
      totalPageViews: analyticsData.pageViews,
      totalClicks: analyticsData.buttonClicks.kudos + analyticsData.buttonClicks.thanks,
      kudosClicks: analyticsData.buttonClicks.kudos,
      thanksClicks: analyticsData.buttonClicks.thanks,
      conversionRate: ((analyticsData.buttonClicks.kudos + analyticsData.buttonClicks.thanks) / analyticsData.pageViews * 100).toFixed(2) + '%'
    },
    variantPerformance: {
      kudos: {
        clicks: analyticsData.buttonClicks.kudos,
        percentage: ((analyticsData.buttonClicks.kudos / (analyticsData.buttonClicks.kudos + analyticsData.buttonClicks.thanks)) * 100).toFixed(2) + '%'
      },
      thanks: {
        clicks: analyticsData.buttonClicks.thanks,
        percentage: ((analyticsData.buttonClicks.thanks / (analyticsData.buttonClicks.kudos + analyticsData.buttonClicks.thanks)) * 100).toFixed(2) + '%'
      }
    },
    recentEvents: analyticsData.events.slice(-10)
  });
});

module.exports = router;