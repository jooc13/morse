-- Teams feature migration
-- Creates tables for teams, team memberships, and team-specific user display names

-- Teams table
CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(255) NOT NULL,
    team_description TEXT,
    creator_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invite_code VARCHAR(32) UNIQUE NOT NULL, -- Unique code for joining via link
    allow_public_view BOOLEAN DEFAULT FALSE, -- Admin control: allow all members to see everyone
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team memberships table
CREATE TABLE team_memberships (
    membership_id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    display_name VARCHAR(255), -- Optional display name for this team only
    role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_teams_invite_code ON teams(invite_code);
CREATE INDEX idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_user_id ON team_memberships(user_id);

-- Function to generate random invite codes
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS VARCHAR(32) AS $$
DECLARE
    code VARCHAR(32);
    exists_check INTEGER;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code (easier for sharing)
        code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        
        -- Check if code already exists
        SELECT COUNT(*) INTO exists_check FROM teams WHERE invite_code = code;
        
        -- If unique, return the code
        IF exists_check = 0 THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invite codes
CREATE OR REPLACE FUNCTION set_invite_code() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
        NEW.invite_code := generate_invite_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_invite_code_trigger 
    BEFORE INSERT ON teams 
    FOR EACH ROW EXECUTE FUNCTION set_invite_code();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at_trigger 
    BEFORE UPDATE ON teams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();