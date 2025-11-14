import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, AppBar, Toolbar, Typography, Container, Button } from '@mui/material';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import HistoryPage from './components/HistoryPage';
import ExercisesPage from './components/ExercisesPage';
import UploadTest from './components/UploadTest';
import DeviceSearch from './components/DeviceSearch';
import WorkoutClaiming from './components/WorkoutClaiming';
import ClaimedWorkouts from './components/ClaimedWorkouts';
import Teams from './components/Teams';
import TeamView from './components/TeamView';
import TeamJoin from './components/TeamJoin';
import DeviceLinking from './components/DeviceLinking';
import WorkoutCalendar from './components/WorkoutCalendar';
import api from './services/api';

// TEMPORARY: Set to true to bypass authentication for UI development
const BYPASS_AUTH = true;

// Navigation Buttons Component
const NavigationTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path) => {
    const currentPath = location.pathname;
    if (path === '/history' || path === '/') {
      return currentPath === '/history' || currentPath === '/';
    }
    return currentPath === path || currentPath.startsWith(path);
  };
  
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      gap: 2,
      py: 2,
      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
      backgroundColor: '#ffffff'
    }}>
      <Button
        variant={isActive('/history') ? 'contained' : 'outlined'}
        onClick={() => navigate('/history')}
        sx={{
          minWidth: 200,
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 500,
          backgroundColor: isActive('/history') ? '#1976d2' : 'transparent',
          color: isActive('/history') ? '#ffffff' : '#1976d2',
          borderColor: '#1976d2',
          '&:hover': {
            backgroundColor: isActive('/history') ? '#1565c0' : 'rgba(25, 118, 210, 0.04)',
            borderColor: '#1565c0',
          }
        }}
      >
        History
      </Button>
      <Button
        variant={isActive('/exercises') ? 'contained' : 'outlined'}
        onClick={() => navigate('/exercises')}
        sx={{
          minWidth: 200,
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 500,
          backgroundColor: isActive('/exercises') ? '#1976d2' : 'transparent',
          color: isActive('/exercises') ? '#ffffff' : '#1976d2',
          borderColor: '#1976d2',
          '&:hover': {
            backgroundColor: isActive('/exercises') ? '#1565c0' : 'rgba(25, 118, 210, 0.04)',
            borderColor: '#1565c0',
          }
        }}
      >
        Exercises
      </Button>
      <Button
        variant={isActive('/log-workout') ? 'contained' : 'outlined'}
        onClick={() => navigate('/log-workout')}
        sx={{
          minWidth: 200,
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 500,
          backgroundColor: isActive('/log-workout') ? '#1976d2' : 'transparent',
          color: isActive('/log-workout') ? '#ffffff' : '#1976d2',
          borderColor: '#1976d2',
          '&:hover': {
            backgroundColor: isActive('/log-workout') ? '#1565c0' : 'rgba(25, 118, 210, 0.04)',
            borderColor: '#1565c0',
          }
        }}
      >
        Log New Workout
      </Button>
    </Box>
  );
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2', // Nice blue
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#1976d2', // Use blue for secondary too
    },
    background: {
      default: '#ffffff', // White
      paper: '#ffffff', // White
    },
    text: {
      primary: '#000000', // Black
      secondary: 'rgba(0, 0, 0, 0.6)', // Dark gray
    },
    divider: 'rgba(0, 0, 0, 0.12)',
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
          backgroundColor: '#ffffff',
          color: '#000000',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.12)',
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
          backgroundColor: '#1976d2',
          color: '#ffffff',
          boxShadow: '0 2px 4px rgba(25, 118, 210, 0.2)',
          '&:hover': {
            backgroundColor: '#1565c0',
            boxShadow: '0 4px 8px rgba(25, 118, 210, 0.3)',
          },
        },
        outlined: {
          borderColor: '#1976d2',
          color: '#1976d2',
          '&:hover': {
            borderColor: '#1565c0',
            backgroundColor: 'rgba(25, 118, 210, 0.04)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#ffffff',
            '& fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.23)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1976d2',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
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
      // TEMPORARY: Bypass auth for UI development
      if (BYPASS_AUTH) {
        const mockUser = {
          id: 'dev-user-123',
          device_uuid: 'dev-uuid-123',
          created_at: new Date().toISOString(),
        };
        setUser(mockUser);
        setUserProfile({
          user: mockUser
        });
        // Set a mock token for API calls
        api.setAuthToken('dev-bypass-token');
      }
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
                    color: '#1976d2',
                  }}
                >
                  morse
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
                  color: '#1976d2',
                }}
              >
                morse
              </Typography>
              <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
                User ID: {user.id.slice(0, 8)}...
              </Typography>
              <Button 
                variant="outlined" 
                onClick={handleLogout}
                sx={{ 
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  '&:hover': {
                    borderColor: '#1565c0',
                    backgroundColor: 'rgba(25, 118, 210, 0.04)',
                  },
                }}
              >
                Logout
              </Button>
            </Toolbar>
          </AppBar>

          <NavigationTabs />

          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Routes>
              <Route 
                path="/" 
                element={
                  <HistoryPage user={user} />
                } 
              />
              <Route 
                path="/history" 
                element={
                  <HistoryPage user={user} />
                } 
              />
              <Route 
                path="/log-workout" 
                element={<UploadTest />} 
              />
              <Route 
                path="/exercises" 
                element={<ExercisesPage />} 
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;