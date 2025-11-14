import React, { useState } from 'react';
import { 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Alert, 
  Link,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

function Register({ onRegister }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passphrase.trim()) {
      setError('Please enter a passphrase');
      return;
    }

    if (passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters long');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await onRegister(passphrase);
      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 6, 
        maxWidth: 440, 
        mx: 'auto',
        backgroundColor: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 3,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              color: '#1976d2',
              fontWeight: 800,
              mb: 1
            }}
          >
            Join Morse
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ opacity: 0.8 }}>
            Create a secure passphrase to start claiming your workouts
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Passphrase"
          type={showPassphrase ? 'text' : 'password'}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          margin="normal"
          required
          autoFocus
          disabled={loading}
          helperText="Must be at least 6 characters long"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  edge="end"
                >
                  {showPassphrase ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Confirm Passphrase"
          type={showConfirmPassphrase ? 'text' : 'password'}
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
          margin="normal"
          required
          disabled={loading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                  edge="end"
                >
                  {showConfirmPassphrase ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          sx={{ 
            mt: 4, 
            mb: 3,
            py: 1.5,
            backgroundColor: '#1976d2',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#1565c0',
            },
            fontWeight: 600,
            fontSize: '1.1rem',
          }}
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>

        <Box textAlign="center">
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
            Already have an account?{' '}
            <Link 
              component={RouterLink} 
              to="/login" 
              sx={{ 
                color: '#1976d2',
                textDecoration: 'none',
                fontWeight: 600,
                '&:hover': {
                  textDecoration: 'underline',
                  color: '#1565c0',
                }
              }}
            >
              Sign in here
            </Link>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default Register;