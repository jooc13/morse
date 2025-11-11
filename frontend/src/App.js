import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, AppBar, Toolbar, Typography, Container } from '@mui/material';
import Dashboard from './components/Dashboard';
import WorkoutList from './components/WorkoutList';
import ProgressChart from './components/ProgressChart';
import api from './services/api';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
});

function App() {
  const [deviceUuid, setDeviceUuid] = useState('');
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For demo purposes, generate a test device UUID
    const testUuid = localStorage.getItem('morse_device_uuid') || 'test-device-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('morse_device_uuid', testUuid);
    setDeviceUuid(testUuid);
    
    // Load user stats
    loadUserStats(testUuid);
  }, []);

  const loadUserStats = async (uuid) => {
    try {
      setLoading(true);
      const stats = await api.getUserStats(uuid);
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <Typography variant="h6">Loading Morse Dashboard...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Morse Workout Tracker
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Device: {deviceUuid.slice(0, 8)}...
              </Typography>
            </Toolbar>
          </AppBar>

          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Routes>
              <Route 
                path="/" 
                element={
                  <Dashboard 
                    deviceUuid={deviceUuid} 
                    userStats={userStats}
                    onStatsUpdate={() => loadUserStats(deviceUuid)}
                  />
                } 
              />
              <Route 
                path="/workouts" 
                element={<WorkoutList deviceUuid={deviceUuid} />} 
              />
              <Route 
                path="/progress" 
                element={<ProgressChart deviceUuid={deviceUuid} />} 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;