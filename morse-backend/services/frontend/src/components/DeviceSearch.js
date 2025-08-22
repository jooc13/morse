import React, { useState } from 'react';
import { 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Alert, 
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  CircularProgress
} from '@mui/material';
import { Search, Devices, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function DeviceSearch({ onProfileUpdate }) {
  const [last4, setLast4] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!last4.trim()) {
      setError('Please enter the last 4 characters of device UUID');
      return;
    }

    if (!/^[0-9a-f]{4}$/i.test(last4.trim())) {
      setError('Please enter exactly 4 hexadecimal characters (0-9, a-f)');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const result = await api.searchDevices(last4.trim().toLowerCase());
      setSearchResults(result.devices);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewWorkouts = (deviceUuid) => {
    navigate(`/claim/${deviceUuid}`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
      
      <Typography variant="h4" component="h1" gutterBottom>
        <Devices sx={{ mr: 1, verticalAlign: 'middle' }} />
        Search Devices
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Enter the last 4 characters of your device's UUID to find available workouts to claim.
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box component="form" onSubmit={handleSearch}>
          <Box display="flex" gap={2} alignItems="flex-start">
            <TextField
              label="Last 4 characters of Device UUID"
              value={last4}
              onChange={(e) => setLast4(e.target.value.slice(0, 4))}
              placeholder="e.g. a1b2"
              required
              autoFocus
              disabled={loading}
              inputProps={{ maxLength: 4, style: { textTransform: 'lowercase' } }}
              helperText="Enter exactly 4 hexadecimal characters (0-9, a-f)"
              sx={{ flexGrow: 1 }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Search />}
              sx={{ mt: 1 }}
            >
              Search
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {searched && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Search Results for "...{last4}"
          </Typography>

          {searchResults.length === 0 ? (
            <Alert severity="info">
              No devices found with UUID ending in "{last4}". 
              Make sure you have the correct UUID and that there are unclaimed workouts available.
            </Alert>
          ) : (
            <List>
              {searchResults.map((device, index) => (
                <ListItem key={index} divider={index < searchResults.length - 1}>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="subtitle1" component="span">
                          Device: ...{device.device_uuid.slice(-8)}
                        </Typography>
                        {device.device_name && (
                          <Typography variant="body2" color="text.secondary">
                            {device.device_name}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          Last seen: {formatDate(device.last_seen)}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                          <Chip 
                            label={`${device.unclaimed_workouts_count} workouts`} 
                            size="small" 
                            color="primary"
                          />
                          <Chip 
                            label={`${device.unclaimed_sessions_count} sessions`} 
                            size="small" 
                            color="secondary"
                          />
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="outlined"
                      onClick={() => handleViewWorkouts(device.device_uuid)}
                      disabled={device.unclaimed_workouts_count === 0}
                    >
                      View Workouts
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default DeviceSearch;