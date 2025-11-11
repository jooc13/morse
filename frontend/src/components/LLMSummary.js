import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
  Chip
} from '@mui/material';
import { Psychology, Insights, TrendingUp, AutoAwesome } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../services/api';

const MotionPaper = motion(Paper);
const MotionChip = motion(Chip);

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
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      sx={{
        p: 3,
        mt: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)'
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              backgroundColor: 'grey.900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AutoAwesome sx={{ fontSize: 20, color: 'white' }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'text.primary'
            }}
          >
            AI Workout Insights
          </Typography>
        </Box>

        <FormControl
          size="small"
          sx={{
            minWidth: 140,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2
            }
          }}
        >
          <InputLabel>Time Period</InputLabel>
          <Select
            value={days}
            label="Time Period"
            onChange={(e) => setDays(e.target.value)}
            sx={{
              fontWeight: 500,
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '1.5px'
              }
            }}
          >
            <MenuItem value={30}>30 Days</MenuItem>
            <MenuItem value={90}>90 Days</MenuItem>
            <MenuItem value={180}>6 Months</MenuItem>
            <MenuItem value={365}>1 Year</MenuItem>
            <MenuItem value={1095}>All Time</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box py={4}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={2}>
            <Psychology sx={{ fontSize: 24, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Analyzing your workout patterns...
            </Typography>
          </Box>
          <LinearProgress
            sx={{
              height: 2,
              backgroundColor: 'grey.100',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'grey.900'
              }
            }}
          />
        </Box>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            border: '1px solid',
            borderColor: 'grey.300',
            backgroundColor: 'grey.50',
            color: 'text.primary',
            borderRadius: 2
          }}
        >
          {error}
        </Alert>
      )}

      {summary && !loading && (
        <Fade in={true} timeout={1000}>
          <Box>
            {/* Data Points Summary */}
            {summary.data_points && (
              <Box sx={{ mb: 3 }}>
                <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
                  <MotionChip
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    icon={<TrendingUp sx={{ fontSize: 16 }} />}
                    label={`${summary.data_points.total_workouts} Workouts`}
                    sx={{
                      backgroundColor: 'grey.900',
                      color: 'white',
                      fontWeight: 600,
                      height: 32,
                      borderRadius: 2,
                      '& .MuiChip-icon': {
                        color: 'white'
                      }
                    }}
                  />
                  <MotionChip
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                    icon={<Insights sx={{ fontSize: 16 }} />}
                    label={`${summary.data_points.unique_exercises} Exercises`}
                    sx={{
                      backgroundColor: 'grey.100',
                      color: 'text.primary',
                      fontWeight: 600,
                      height: 32,
                      borderRadius: 2,
                      border: '1.5px solid',
                      borderColor: 'grey.300'
                    }}
                  />
                  <MotionChip
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.2 }}
                    label={`${summary.data_points.avg_duration} min avg`}
                    sx={{
                      backgroundColor: 'grey.100',
                      color: 'text.primary',
                      fontWeight: 600,
                      height: 32,
                      borderRadius: 2,
                      border: '1.5px solid',
                      borderColor: 'grey.300'
                    }}
                  />
                  <MotionChip
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.25 }}
                    label={`${summary.data_points.muscle_groups_targeted} muscle groups`}
                    sx={{
                      backgroundColor: 'grey.100',
                      color: 'text.primary',
                      fontWeight: 600,
                      height: 32,
                      borderRadius: 2,
                      border: '1.5px solid',
                      borderColor: 'grey.300'
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* AI Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Paper
                sx={{
                  p: 3,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 2
                }}
              >
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    mb: 2,
                    display: 'block'
                  }}
                >
                  AI Analysis • Last {days} Days
                </Typography>

                <Box sx={{ '& > *': { mb: 2 } }}>
                  {formatSummaryText(summary.summary)}
                </Box>
              </Paper>
            </motion.div>

            <Typography
              variant="caption"
              sx={{
                mt: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}
            >
              <AutoAwesome sx={{ fontSize: 14 }} />
              Generated by Claude AI
            </Typography>
          </Box>
        </Fade>
      )}
    </MotionPaper>
  );
};

export default LLMSummary;