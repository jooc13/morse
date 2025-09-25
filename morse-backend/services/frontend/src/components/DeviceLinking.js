import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Devices,
  Add,
  Search,
  Link as LinkIcon,
  LinkOff,
  PhoneAndroid,
  Computer,
  Watch,
  Headset,
  ArrowBack
} from '@mui/icons-material';
import api from '../services/api';

const DeviceLinking = ({ onProfileUpdate, requiredFlow = false }) => {
  const navigate = useNavigate();
  const [linkedDevices, setLinkedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkingDevice, setLinkingDevice] = useState(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadLinkedDevices();
  }, []);

  const loadLinkedDevices = async () => {
    try {
      setLoading(true);
      const result = await api.getLinkedDevices();
      setLinkedDevices(result.linked_devices || []);
    } catch (error) {
      console.error('Failed to load linked devices:', error);
      setError('Failed to load linked devices');
    } finally {
      setLoading(false);
    }
  };

  const searchDevices = async () => {
    if (!searchTerm || searchTerm.length !== 4) {
      setError('Please enter exactly 4 characters');
      return;
    }

    try {
      setSearchLoading(true);
      setError('');
      const result = await api.searchAvailableDevices(searchTerm);
      setAvailableDevices(result.available_devices || []);
    } catch (error) {
      console.error('Failed to search devices:', error);
      setError('Failed to search devices');
      setAvailableDevices([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLinkDevice = (device) => {
    setSelectedDevice(device);
    setDeviceName(`Device ${device.device_uuid.slice(-4).toUpperCase()}`);
    setShowLinkDialog(true);
  };

  const confirmLinkDevice = async () => {
    if (!selectedDevice) return;

    try {
      setLinkingDevice(selectedDevice.device_uuid);
      await api.linkDevice(selectedDevice.device_uuid, deviceName);
      
      setShowLinkDialog(false);
      setSelectedDevice(null);
      setDeviceName('');
      
      // Refresh linked devices
      await loadLinkedDevices();
      
      // Refresh available devices (remove the linked one)
      if (searchTerm) {
        await searchDevices();
      }
      
      if (onProfileUpdate) {
        onProfileUpdate();
      }
    } catch (error) {
      console.error('Failed to link device:', error);
      setError(error.response?.data?.error || 'Failed to link device');
    } finally {
      setLinkingDevice(null);
    }
  };

  const handleUnlinkDevice = async (deviceUuid) => {
    try {
      await api.unlinkDevice(deviceUuid);
      await loadLinkedDevices();
      if (onProfileUpdate) {
        onProfileUpdate();
      }
    } catch (error) {
      console.error('Failed to unlink device:', error);
      setError('Failed to unlink device');
    }
  };

  const getDeviceIcon = (deviceUuid) => {
    const last4 = deviceUuid?.slice(-4).toLowerCase() || '';
    // Simple heuristic based on UUID patterns (you could make this smarter)
    if (last4.includes('a') || last4.includes('1')) return <PhoneAndroid />;
    if (last4.includes('b') || last4.includes('2')) return <Computer />;
    if (last4.includes('c') || last4.includes('3')) return <Watch />;
    return <Headset />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading your devices...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {!requiredFlow && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            Back to Dashboard
          </Button>
        </Box>
      )}

      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Devices color="primary" />
        Device Management
      </Typography>

      {requiredFlow && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Welcome to Morse!</Typography>
          <Typography>
            To get started, you need to link at least one device. Once linked, any workouts uploaded from that device will automatically be assigned to your account using voice recognition.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Linked Devices */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon color="primary" />
          Your Linked Devices ({linkedDevices.length})
        </Typography>

        {linkedDevices.length === 0 ? (
          <Box textAlign="center" sx={{ py: 4 }}>
            <Devices sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No devices linked yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Link a device below to start automatic workout syncing
            </Typography>
          </Box>
        ) : (
          <List>
            {linkedDevices.map((device) => (
              <ListItem key={device.device_uuid} sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  {getDeviceIcon(device.device_uuid)}
                </Box>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {device.device_name}
                      </Typography>
                      <Chip 
                        label={device.device_uuid.slice(-8)} 
                        size="small" 
                        variant="outlined" 
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Linked: {formatDate(device.linked_at)} • Last activity: {formatDate(device.last_activity)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip 
                          label={`${device.recent_workouts_count} recent workouts`} 
                          size="small" 
                          color="success"
                        />
                        {device.pending_workouts_count > 0 && (
                          <Chip 
                            label={`${device.pending_workouts_count} pending`} 
                            size="small" 
                            color="warning"
                          />
                        )}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    onClick={() => handleUnlinkDevice(device.device_uuid)}
                    color="error"
                    size="small"
                  >
                    <LinkOff />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Device Search */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add color="primary" />
          Link New Device
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the last 4 characters of your device UUID to find available devices to link.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
          <TextField
            label="Last 4 UUID Characters"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
            placeholder="e.g., a1b2"
            inputProps={{ maxLength: 4 }}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={searchDevices}
            disabled={searchLoading || searchTerm.length !== 4}
          >
            {searchLoading ? <CircularProgress size={20} /> : 'Search'}
          </Button>
        </Box>

        {availableDevices.length > 0 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Available Devices ({availableDevices.length})
            </Typography>
            <Grid container spacing={2}>
              {availableDevices.map((device) => (
                <Grid item xs={12} md={6} key={device.device_uuid}>
                  <Card sx={{ 
                    cursor: 'pointer', 
                    '&:hover': { boxShadow: 4 },
                    opacity: linkingDevice === device.device_uuid ? 0.7 : 1
                  }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getDeviceIcon(device.device_uuid)}
                          <Typography variant="h6">
                            Device {device.device_uuid.slice(-4).toUpperCase()}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={linkingDevice === device.device_uuid ? <CircularProgress size={16} /> : <LinkIcon />}
                          onClick={() => handleLinkDevice(device)}
                          disabled={linkingDevice === device.device_uuid}
                        >
                          Link
                        </Button>
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {device.device_uuid}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={`${device.total_workouts} workouts`} 
                          size="small" 
                          color="primary" 
                        />
                        <Chip 
                          label={`${device.unclaimed_workouts} unclaimed`} 
                          size="small" 
                          color="warning" 
                        />
                        <Chip 
                          label={`Active ${formatDate(device.last_activity)}`} 
                          size="small" 
                          variant="outlined" 
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {searchTerm && availableDevices.length === 0 && !searchLoading && (
          <Alert severity="info">
            No available devices found with UUID ending in "{searchTerm}". 
            Make sure the device has uploaded audio files recently.
          </Alert>
        )}
      </Paper>

      {/* Link Device Dialog */}
      <Dialog open={showLinkDialog} onClose={() => setShowLinkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Device</DialogTitle>
        <DialogContent>
          {selectedDevice && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                Link device <strong>{selectedDevice.device_uuid}</strong> to your account?
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Once linked, workouts from this device will automatically be assigned to you based on voice recognition.
              </Typography>
              <TextField
                fullWidth
                label="Device Name (optional)"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="My iPhone, Home Computer, etc."
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLinkDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirmLinkDevice}>
            Link Device
          </Button>
        </DialogActions>
      </Dialog>

      {/* Continue Button for Required Flow */}
      {requiredFlow && linkedDevices.length > 0 && (
        <Box textAlign="center" sx={{ mt: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/dashboard')}
          >
            Continue to Dashboard
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default DeviceLinking;