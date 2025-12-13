-- Database Initialization Script for Bitnami PostgreSQL
-- This script sets up the morse_db database with proper permissions

-- Create database if it doesn't exist (Bitnami handles this via env vars)
-- CREATE DATABASE morse_db;

-- Connect to the morse_db database
\c morse_db;

-- Grant necessary permissions to morse_user
GRANT ALL PRIVILEGES ON DATABASE morse_db TO morse_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO morse_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO morse_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO morse_user;

-- Enable UUID extension for device IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a simple health check function
CREATE OR REPLACE FUNCTION db_health_check()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Database is healthy at ' || NOW();
END;
$$ LANGUAGE plpgsql;