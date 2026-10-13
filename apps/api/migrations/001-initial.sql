CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(300) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS workspaces (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS memberships (
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner','admin','member','viewer') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (workspace_id,user_id),
  UNIQUE KEY membership_assignee (user_id,workspace_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS clients (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  contact_email VARCHAR(254) NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY client_workspace (id,workspace_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  client_id CHAR(36) NULL,
  owner_id CHAR(36) NOT NULL,
  status ENUM('planned','active','at_risk','completed') NOT NULL,
  due_date DATE NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY project_workspace (id,workspace_id),
  KEY project_status (workspace_id,archived,status),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id,workspace_id) REFERENCES clients(id,workspace_id),
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  assignee_id CHAR(36) NULL,
  status ENUM('todo','in_progress','in_review','done') NOT NULL,
  priority ENUM('low','medium','high','urgent') NOT NULL,
  due_date DATE NULL,
  completed_at DATETIME(3) NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY task_board (workspace_id,project_id,archived,status),
  FOREIGN KEY (project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id,workspace_id) REFERENCES memberships(user_id,workspace_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  csrf_token CHAR(64) NOT NULL,
  user_id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  KEY session_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS invitations (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  role ENUM('admin','member','viewer') NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS activity (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  actor_name VARCHAR(80) NOT NULL,
  message VARCHAR(250) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY workspace_activity (workspace_id,created_at),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;
