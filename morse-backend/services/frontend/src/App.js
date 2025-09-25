import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, AppBar, Toolbar, Typography, Container, Button } from '@mui/material';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import DeviceSearch from './components/DeviceSearch';
import WorkoutClaiming from './components/WorkoutClaiming';
import ClaimedWorkouts from './components/ClaimedWorkouts';
import UploadTest from './components/UploadTest';
import Teams from './components/Teams';
import TeamView from './components/TeamView';
import TeamJoin from './components/TeamJoin';
import DeviceLinking from './components/DeviceLinking';
import WorkoutCalendar from './components/WorkoutCalendar';
import api from './services/api';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00e5ff', // Bright cyan
    },
    secondary: {
      main: '#ff6b6b', // Coral red
    },
    background: {
      default: '#0a0a0a', // Pure black
      paper: '#1a1a1a', // Dark gray
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '2.125rem',
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.005em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 1px 20px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1a1a1a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 24px',
        },
        contained: {
          boxShadow: '0 4px 14px rgba(0, 229, 255, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(0, 229, 255, 0.35)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00e5ff',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1a1a1a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
        },
      },
    },
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('morse_token'));

  useEffect(() => {
    if (token) {
      loadUserProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      api.setAuthToken(token);
      const profile = await api.getUserProfile();
      setUser(profile.user);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // Only logout if it's an auth error and we have a token
      if (error.response?.status === 401 && token) {
        console.log('Auth error - logging out');
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (passphrase) => {
    try {
      const response = await api.login(passphrase);
      const newToken = response.token;
      
      localStorage.setItem('morse_token', newToken);
      setToken(newToken);
      api.setAuthToken(newToken);
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const handleRegister = async (passphrase) => {
    try {
      const response = await api.register(passphrase);
      const newToken = response.token;
      
      localStorage.setItem('morse_token', newToken);
      setToken(newToken);
      api.setAuthToken(newToken);
      
      return { success: true };
    } catch (error) {
      console.error('Registration failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('morse_token');
    setToken(null);
    setUser(null);
    setUserProfile(null);
    api.setAuthToken(null);
  };

  const refreshProfile = () => {
    if (token) {
      loadUserProfile();
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

  // If not logged in, show auth routes
  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
              <Toolbar>
                <Typography 
                  variant="h6" 
                  component="div" 
                  sx={{ 
                    flexGrow: 1,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #00e5ff 0%, #ff6b6b 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  MORSE
                </Typography>
              </Toolbar>
            </AppBar>

            <Container maxWidth="sm" sx={{ mt: 8 }}>
              <Routes>
                <Route 
                  path="/login" 
                  element={<Login onLogin={handleLogin} />} 
                />
                <Route 
                  path="/register" 
                  element={<Register onRegister={handleRegister} />} 
                />
                <Route 
                  path="/teams/join/:inviteCode" 
                  element={<TeamJoin />} 
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Container>
          </Box>
        </Router>
      </ThemeProvider>
    );
  }

  // Logged in user interface
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  flexGrow: 1,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #00e5ff 0%, #ff6b6b 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                MORSE
              </Typography>
              <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
                User ID: {user.id.slice(0, 8)}...
              </Typography>
              <Button color="inherit" onClick={handleLogout}>
                Logout
              </Button>
            </Toolbar>
          </AppBar>

          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Routes>
              <Route 
                path="/" 
                element={
                  <Dashboard 
                    user={user}
                    userProfile={userProfile}
                    onProfileUpdate={refreshProfile}
                  />
                } 
              />
              <Route 
                path="/search" 
                element={<DeviceSearch onProfileUpdate={refreshProfile} />} 
              />
              <Route 
                path="/claim/:deviceUuid" 
                element={<WorkoutClaiming onProfileUpdate={refreshProfile} />} 
              />
              <Route 
                path="/workouts" 
                element={<ClaimedWorkouts />} 
              />
              <Route 
                path="/upload-test" 
                element={<UploadTest />} 
              />
              <Route 
                path="/teams" 
                element={<Teams />} 
              />
              <Route 
                path="/teams/:teamId" 
                element={<TeamView />} 
              />
              <Route 
                path="/devices" 
                element={<DeviceLinking onProfileUpdate={refreshProfile} />} 
              />
              <Route 
                path="/calendar" 
                element={<WorkoutCalendar />} 
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