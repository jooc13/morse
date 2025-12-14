import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import * as api from '../../services/api';

// Mock the API module
jest.mock('../../services/api');

// Mock Material-UI components
jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' }
    }
  })
}));

// Mock recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }) => <div>{children}</div>
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'test-device-123'),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Test data
const mockDashboardData = {
  stats: {
    totalWorkouts: 10,
    totalExercises: 50,
    totalDuration: 15000,
    avgWorkoutDuration: 1500,
    weeklyWorkouts: 3,
    monthlyWorkouts: 12,
    favoriteDay: 'Monday',
    favoriteExercise: 'Bench Press'
  },
  recentWorkouts: [
    {
      id: 'workout-1',
      title: 'Morning Workout',
      date_completed: '2025-01-10T10:00:00Z',
      duration_seconds: 1800,
      exercise_count: 5,
      exercises: [
        { name: 'Bench Press', category: 'strength' },
        { name: 'Squats', category: 'strength' }
      ]
    },
    {
      id: 'workout-2',
      title: 'Evening Cardio',
      date_completed: '2025-01-09T18:00:00Z',
      duration_seconds: 2400,
      exercise_count: 2,
      exercises: [
        { name: 'Running', category: 'cardio' }
      ]
    }
  ],
  progress: {
    workoutTrends: [
      { date: '2025-01-01', workouts: 2, duration: 3600 },
      { date: '2025-01-02', workouts: 1, duration: 1800 },
      { date: '2025-01-03', workouts: 3, duration: 5400 }
    ],
    muscleGroups: [
      { name: 'chest', count: 20 },
      { name: 'legs', count: 15 },
      { name: 'back', count: 10 },
      { name: 'arms', count: 8 }
    ]
  }
};

// Helper function to render component
const renderComponent = () => {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        if (url.includes('/progress')) {
          return Promise.resolve({ data: mockDashboardData.progress });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockDashboardData.stats });
        }
        return Promise.resolve({ data: { workouts: mockDashboardData.recentWorkouts } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('renders the dashboard', async () => {
    renderComponent();

    // Check for main heading
    expect(screen.getByText(/Fitness Dashboard/i)).toBeInTheDocument();
  });

  it('displays workout statistics', async () => {
    renderComponent();

    await waitFor(() => {
      // Check stat cards
      expect(screen.getByText('10')).toBeInTheDocument(); // totalWorkouts
      expect(screen.getByText('50')).toBeInTheDocument(); // totalExercises
      expect(screen.getByText('4.2h')).toBeInTheDocument(); // totalDuration
      expect(screen.getByText('25m')).toBeInTheDocument(); // avgWorkoutDuration
    });
  });

  it('displays recent workouts', async () => {
    renderComponent();

    await waitFor(() => {
      // Check for recent workouts
      expect(screen.getByText('Morning Workout')).toBeInTheDocument();
      expect(screen.getByText('Evening Cardio')).toBeInTheDocument();
      expect(screen.getByText('5 exercises')).toBeInTheDocument();
      expect(screen.getByText('2 exercises')).toBeInTheDocument();
    });
  });

  it('shows workout duration in readable format', async () => {
    renderComponent();

    await waitFor(() => {
      // Check formatted durations
      expect(screen.getByText('30m')).toBeInTheDocument(); // 1800 seconds
      expect(screen.getByText('40m')).toBeInTheDocument(); // 2400 seconds
    });
  });

  it('renders workout trends chart', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByText('Workout Trends')).toBeInTheDocument();
    });
  });

  it('renders muscle groups chart', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('Muscle Groups')).toBeInTheDocument();
    });
  });

  it('navigates to exercise library when button clicked', async () => {
    renderComponent();

    await waitFor(() => {
      const viewAllButton = screen.getByText(/View All Exercises/i);
      expect(viewAllButton).toBeInTheDocument();

      fireEvent.click(viewAllButton);

      // Check if navigation occurred
      expect(window.location.pathname).toBe('/exercises');
    });
  });

  it('navigates to upload page when upload button clicked', async () => {
    renderComponent();

    await waitFor(() => {
      const uploadButton = screen.getByText(/Upload Workout/i);
      expect(uploadButton).toBeInTheDocument();

      fireEvent.click(uploadButton);

      // Check if navigation occurred
      expect(window.location.pathname).toBe('/upload');
    });
  });

  it('shows loading state initially', () => {
    // Mock delayed response
    api.get.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderComponent();

    // Should show loading indicators
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('handles API errors gracefully', async () => {
    api.get.mockRejectedValue(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      // Should show error message
      expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no workouts', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        return Promise.resolve({ data: { workouts: [] } });
      }
      return Promise.resolve({ data: { stats: { totalWorkouts: 0 } } });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/No workouts yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Upload your first workout to get started/i)).toBeInTheDocument();
    });
  });

  it('displays workout categories with icons', async () => {
    renderComponent();

    await waitFor(() => {
      // Check for category indicators
      mockDashboardData.recentWorkouts.forEach(workout => {
        workout.exercises.forEach(exercise => {
          if (exercise.category === 'strength') {
            // Should show strength indicator
            expect(screen.getByText('strength')).toBeInTheDocument();
          }
          if (exercise.category === 'cardio') {
            // Should show cardio indicator
            expect(screen.getByText('cardio')).toBeInTheDocument();
          }
        });
      });
    });
  });

  it('shows weekly and monthly workout stats', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/3 this week/i)).toBeInTheDocument();
      expect(screen.getByText(/12 this month/i)).toBeInTheDocument();
    });
  });

  it('displays favorite workout day and exercise', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Monday/i)).toBeInTheDocument();
      expect(screen.getByText(/Bench Press/i)).toBeInTheDocument();
    });
  });

  it('updates dashboard data when refresh button clicked', async () => {
    renderComponent();

    await waitFor(() => {
      const refreshButton = screen.getByLabelText(/refresh/i);
      expect(refreshButton).toBeInTheDocument();

      // Clear previous calls
      api.get.mockClear();

      fireEvent.click(refreshButton);

      // Should fetch data again
      expect(api.get).toHaveBeenCalledTimes(3); // workouts, stats, progress
    });
  });

  it('formats dates correctly', async () => {
    renderComponent();

    await waitFor(() => {
      // Check formatted dates
      expect(screen.getByText(/Jan 10, 2025/i)).toBeInTheDocument();
      expect(screen.getByText(/Jan 9, 2025/i)).toBeInTheDocument();
    });
  });

  it('shows workout summary cards', async () => {
    renderComponent();

    await waitFor(() => {
      // Check summary cards exist
      expect(screen.getByText(/Total Workouts/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Exercises/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Duration/i)).toBeInTheDocument();
      expect(screen.getByText(/Average Duration/i)).toBeInTheDocument();
    });
  });

  it('uses device UUID from localStorage', async () => {
    renderComponent();

    // Verify localStorage was accessed
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deviceUuid');

    await waitFor(() => {
      // Verify API was called with device UUID
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/workouts/device/test-device-123')
      );
    });
  });
});