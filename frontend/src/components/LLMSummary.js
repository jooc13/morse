import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
  Chip
} from '@mui/material';
import { Psychology, Insights, TrendingUp } from '@mui/icons-material';
import api from '../services/api';

const LLMSummary = ({ deviceUuid }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(365);

  useEffect(() => {
    loadSummary();
  }, [deviceUuid, days]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getLLMSummary(deviceUuid, { days });
      setSummary(data);
    } catch (err) {
      console.error('Failed to load LLM summary:', err);
      setError('Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatSummaryText = (text) => {
    // Split by sections and format nicely
    return text.split(/(?=\*\*\d+\.)/g).map((section, index) => {
      if (section.trim()) {
        // Check if it's a section header
        const headerMatch = section.match(/\*\*(.+?)\*\*:?\s*(.*)/s);
        if (headerMatch) {
          return (
            <Box key={index} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                {headerMatch[1]}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {headerMatch[2].trim()}
              </Typography>
            </Box>
          );
        }
        return (
          <Typography key={index} variant="body2" sx={{ mb: 2, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {section.trim()}
          </Typography>
        );
      }
      return null;
    });
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology color="primary" />
          AI Workout Insights
        </Typography>
        
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Time Period</InputLabel>
          <Select
            value={days}
            label="Time Period"
            onChange={(e) => setDays(e.target.value)}
          >
            <MenuItem value={30}>30 Days</MenuItem>
            <MenuItem value={90}>90 Days</MenuItem>
            <MenuItem value={180}>6 Months</MenuItem>
            <MenuItem value={365}>1 Year</MenuItem>
            <MenuItem value={1095}>All Time (3 years)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Analyzing your workout patterns...
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {summary && !loading && (
        <Fade in={true} timeout={1000}>
          <Box>
            {/* Data Points Summary */}
            {summary.data_points && (
              <Box sx={{ mb: 3 }}>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  <Chip 
                    icon={<TrendingUp />} 
                    label={`${summary.data_points.total_workouts} Workouts`} 
                    color="primary" 
                    variant="outlined" 
                  />
                  <Chip 
                    icon={<Insights />} 
                    label={`${summary.data_points.unique_exercises} Exercises`} 
                    color="secondary" 
                    variant="outlined" 
                  />
                  <Chip 
                    label={`${summary.data_points.avg_duration} min avg`} 
                    color="success" 
                    variant="outlined" 
                  />
                  <Chip 
                    label={`${summary.data_points.muscle_groups_targeted} muscle groups`} 
                    color="info" 
                    variant="outlined" 
                  />
                </Box>
              </Box>
            )}

            {/* AI Summary */}
            <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                AI Analysis for the last {days} days:
              </Typography>
              
              <Box sx={{ '& > *': { mb: 2 } }}>
                {formatSummaryText(summary.summary)}
              </Box>
            </Paper>

            <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
              🤖 Generated by Claude AI • Refresh the page to get new insights
            </Typography>
          </Box>
        </Fade>
      )}
    </Paper>
  );
};

export default LLMSummary;