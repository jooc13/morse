import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, AppBar, Toolbar, Typography, Container, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import { FitnessCenter, Dashboard as DashboardIcon, Timeline, List } from '@mui/icons-material';
import Dashboard from './components/Dashboard';
import WorkoutList from './components/WorkoutList';
import MinimalWorkoutDisplay from './components/MinimalWorkoutDisplay';
import ProgressChart from './components/ProgressChart';
import api from './services/api';
import theme from './theme';

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
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          sx={{ backgroundColor: 'background.default' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <FitnessCenter sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          </motion.div>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Loading Morse...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  const navItems = [
    { path: '/', icon: DashboardIcon, label: 'Dashboard' },
    { path: '/workouts', icon: List, label: 'Workouts' },
    { path: '/progress', icon: Timeline, label: 'Progress' },
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <AppBar
            position="static"
            elevation={0}
            sx={{
              backgroundColor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Container maxWidth="lg">
              <Toolbar sx={{ px: { xs: 0 }, py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                  >
                    <FitnessCenter sx={{ fontSize: 28, color: 'text.primary', mr: 1.5 }} />
                  </motion.div>
                  <Typography
                    variant="h6"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      color: 'text.primary'
                    }}
                  >
                    Morse
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      style={({ isActive }) => ({
                        textDecoration: 'none',
                        color: 'inherit',
                      })}
                    >
                      {({ isActive }) => (
                        <motion.div
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              px: 2,
                              py: 1,
                              borderRadius: 2,
                              backgroundColor: isActive ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                              color: isActive ? 'text.primary' : 'text.secondary',
                              fontWeight: isActive ? 600 : 500,
                              fontSize: '0.875rem',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                color: 'text.primary',
                              },
                            }}
                          >
                            <item.icon sx={{ fontSize: 18 }} />
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                              {item.label}
                            </Box>
                          </Box>
                        </motion.div>
                      )}
                    </NavLink>
                  ))}
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    ml: 3,
                    display: { xs: 'none', md: 'block' },
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: 'background.default',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                  }}
                >
                  {deviceUuid.slice(0, 8)}
                </Typography>
              </Toolbar>
            </Container>
          </AppBar>

          <Container
            maxWidth="lg"
            sx={{
              mt: 4,
              mb: 6,
              flex: 1,
              px: { xs: 2, sm: 3 }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Routes>
                <Route
                  path="/"
                  element={
                    <MinimalWorkoutDisplay
                      deviceUuid={deviceUuid}
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
            </motion.div>
          </Container>

          <Box
            component="footer"
            sx={{
              py: 3,
              px: 2,
              mt: 'auto',
              borderTop: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
            }}
          >
            <Container maxWidth="lg">
              <Typography
                variant="body2"
                align="center"
                sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
              >
                Morse Workout Tracker • Voice-powered fitness tracking
              </Typography>
            </Container>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;