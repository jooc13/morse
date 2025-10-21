import React from 'react';
import SimpleWorkoutDashboard from './SimpleWorkoutDashboard';

const Dashboard = ({ user, userProfile, onProfileUpdate }) => {
  return <SimpleWorkoutDashboard user={user} />;
};

export default Dashboard;