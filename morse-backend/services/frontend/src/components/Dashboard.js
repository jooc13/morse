import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  FitnessCenter,
  Search,
  Assignment,
  AccountCircle,
  Devices,
  CloudUpload,
  Groups,
  Info,
  PlayArrow
} from '@mui/icons-material';
import api from '../services/api';

const Dashboard = ({ user, userProfile, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [queueStats, setQueueStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadQueueStats, 10000); // Update queue stats every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Separate useEffect for welcome dialog - only show once per user
  useEffect(() => {
    if (userProfile?.stats && userProfile.stats.total_claimed_workouts === 0) {
      const hasSeenWelcome = localStorage.getItem(`morse_welcome_seen_${user?.id}`);
      if (!hasSeenWelcome) {
        setShowWelcomeDialog(true);
      }
    }
  }, [userProfile, user?.id]);

  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false);
    if (user?.id) {
      localStorage.setItem(`morse_welcome_seen_${user.id}`, 'true');
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const queueData = await api.getQueueStats();
      setQueueStats(queueData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStats = async () => {
    try {
      const queueData = await api.getQueueStats();
      setQueueStats(queueData);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setUploadSuccess('Please select an audio file');
      return;
    }

    try {
      setUploading(true);
      setUploadSuccess('');
      
      await api.uploadAudio(file);
      setUploadSuccess(`File uploaded successfully! Processing started.`);
      
      // Refresh dashboard data
      await loadDashboardData();
      if (onProfileUpdate) onProfileUpdate();
      
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadSuccess('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const StatCard = ({ title, value, icon, subtitle, color = 'primary', onClick }) => (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: onClick ? 'pointer' : 'default',
        background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.6) 0%, rgba(26, 26, 26, 0.8) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': onClick ? { 
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 32px rgba(0, 229, 255, 0.15)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography 
              color="text.secondary" 
              gutterBottom 
              variant="body2"
              sx={{ 
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: 0.7,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h3" 
              component="div" 
              sx={{ 
                fontWeight: 700,
                fontSize: '2.5rem',
                background: color === 'primary' 
                  ? 'linear-gradient(135deg, #00e5ff 0%, #0288d1 100%)'
                  : color === 'secondary'
                  ? 'linear-gradient(135deg, #ff6b6b 0%, #ff5722 100%)'
                  : color === 'success'
                  ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                  : 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                mb: subtitle ? 0.5 : 0
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ opacity: 0.6, fontSize: '0.8rem' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box 
            sx={{ 
              color: color === 'primary' ? '#00e5ff' 
                : color === 'secondary' ? '#ff6b6b'
                : color === 'success' ? '#4caf50'
                : '#2196f3',
              opacity: 0.8 
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: '3rem' } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Loading Dashboard...</Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h3" 
          sx={{ 
            fontWeight: 800,
            background: 'linear-gradient(135deg, #00e5ff 0%, #ff6b6b 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            mb: 1
          }}
        >
        lift morse
        </Typography>
        
        <Typography variant="h6" color="text.secondary" sx={{ opacity: 0.8, fontWeight: 400 }}>
          tech that just wants to help you get off your phone
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* User Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Claimed Workouts"
            value={userProfile?.stats?.total_claimed_workouts || 0}
            icon={<FitnessCenter fontSize="large" />}
            subtitle={`Member since ${formatDate(user?.created_at)}`}
            onClick={() => navigate('/workouts')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Linked Devices"
            value={userProfile?.stats?.linked_devices || 0}
            icon={<Devices fontSize="large" />}
            color="secondary"
            subtitle="Devices with claimed workouts"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Voice Profiles"
            value={userProfile?.stats?.voice_profiles_count || 0}
            icon={<AccountCircle fontSize="large" />}
            color="success"
            subtitle="For auto-linking workouts"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Last Activity"
            value={formatDate(userProfile?.stats?.last_device_activity)}
            icon={<Assignment fontSize="large" />}
            color="info"
            subtitle="Latest device sync"
          />
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Get started by linking your device and uploading workout audio, or view your existing workouts.
            </Typography>
            {uploadSuccess && (
              <Alert severity={uploadSuccess.includes('failed') ? 'error' : 'success'} sx={{ mb: 2 }}>
                {uploadSuccess}
              </Alert>
            )}
            <Box display="flex" gap={2} flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={() => navigate('/search')}
                size="large"
              >
                Search Devices
              </Button>
              <Button
                variant="outlined"
                startIcon={<FitnessCenter />}
                onClick={() => navigate('/calendar')}
                size="large"
              >
                Workout Calendar
              </Button>
              <Button
                variant="outlined"
                startIcon={<Groups />}
                onClick={() => navigate('/teams')}
                size="large"
                color="info"
              >
                Teams
              </Button>
              <Button
                variant="outlined"
                startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
                component="label"
                size="large"
                color="secondary"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Test Audio'}
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* How It Works */}
        {(!userProfile?.stats?.total_claimed_workouts || userProfile.stats.total_claimed_workouts === 0) && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                How It Works
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <Search sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6">1. Search</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Enter the last 4 characters of your device UUID to find available workouts
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <Assignment sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} />
                    <Typography variant="h6">2. Claim</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Claim workouts to create your voice profile for automatic linking
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <AccountCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="h6">3. Auto-Link</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Future workouts automatically link to your account using voice recognition
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Processing Queue Status */}
        {queueStats && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                System Processing Status
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Real-time status of audio processing and workout extraction.
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip 
                  label={`${queueStats.waiting} Waiting`} 
                  color={queueStats.waiting > 0 ? 'warning' : 'default'} 
                />
                <Chip 
                  label={`${queueStats.active} Processing`} 
                  color={queueStats.active > 0 ? 'info' : 'default'} 
                />
                <Chip 
                  label={`${queueStats.completed} Completed`} 
                  color="success" 
                />
                <Chip 
                  label={`${queueStats.failed} Failed`} 
                  color={queueStats.failed > 0 ? 'error' : 'default'} 
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Recent Activity */}
        {userProfile?.stats?.last_workout_claimed && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Alert severity="info">
                Last workout claimed: {formatDate(userProfile.stats.last_workout_claimed)}
              </Alert>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Welcome Dialog for New Users */}
      <Dialog 
        open={showWelcomeDialog} 
        onClose={handleCloseWelcomeDialog}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Info color="primary" />
            Welcome to Morse!
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            Get started with your workout tracking:
          </Typography>
          
          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="body1" gutterBottom sx={{ fontWeight: 600 }}>
              🏋️ Regular Workflow:
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
              1. Search for your workout by device UUID (last 4 characters)<br/>
              2. Claim your workout to create your voice profile<br/>
              3. Future workouts from that device will auto-link using voice recognition
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body1" gutterBottom sx={{ fontWeight: 600 }}>
              🧪 Testing Workflow:
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
              1. Upload a test audio file using the button below<br/>
              2. Search for device "C4A9" to find your test workout<br/>
              3. Claim it to see the full workflow in action
            </Typography>
          </Box>

          <Box display="flex" gap={2} sx={{ mt: 3 }}>
            <Button
              variant="contained"
              startIcon={<Search />}
              onClick={() => {
                handleCloseWelcomeDialog();
                navigate('/search');
              }}
            >
              Search for Workouts
            </Button>
            {process.env.REACT_APP_SHOW_UPLOAD_TEST === 'true' && (
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                color="secondary"
                onClick={handleCloseWelcomeDialog}
              >
                I'll Upload a Test File
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWelcomeDialog}>
            Got it!
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;