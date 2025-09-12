# Susan AI Enterprise Multi-User Dashboard & Role-Based Access Control System

## Overview

This document describes the comprehensive Enterprise Multi-User Dashboard and Role-Based Access Control (RBAC) systems implemented for Susan AI. These systems provide enterprise-grade user management, security, and access control for large organizations deploying Susan AI at scale.

## Architecture

### Core Components

1. **EnterpriseUserManagementService** - Handles organization, team, and user management
2. **RoleBasedAccessControlService** - Manages permissions, policies, and access control
3. **Enhanced Authentication Middleware** - Integrates RBAC with existing auth system
4. **Enterprise API Routes** - RESTful endpoints for enterprise features

### Data Structure

```
data/
├── enterprise/
│   ├── users/           # Enterprise user records
│   ├── teams/           # Team configurations
│   ├── organizations/   # Organization structures
│   ├── activities/      # User activity logs
│   └── analytics/       # Performance analytics
├── rbac/
│   ├── permissions/     # Custom permissions
│   ├── policies/        # Data access policies
│   ├── audit/          # Audit logs
│   └── sessions/       # Secure sessions
└── auth/
    ├── tokens/         # JWT tokens
    ├── sessions/       # User sessions
    └── security/       # Security policies
```

## Features

### Enterprise User Management

#### 1. Organization Management
- **Multi-tenant Architecture**: Support for multiple organizations within a single deployment
- **Organization Types**: Insurance companies, adjusting firms, roofing companies, restoration companies
- **Hierarchical Structure**: Configurable organizational hierarchies
- **Custom Settings**: Per-organization configuration and branding

#### 2. Team Management
- **Dynamic Teams**: Create and manage teams within organizations
- **Team Permissions**: Assign team-specific permissions and access levels
- **Team Analytics**: Track team performance and collaboration metrics
- **Member Management**: Add/remove team members with role-based assignments

#### 3. User Roles & Permissions
- **Six-Tier Role System**:
  - **Client** (Level 1): Basic claim viewing and document upload
  - **Contractor** (Level 2): Estimate creation and assigned work management
  - **Inspector** (Level 3): Damage assessment and compliance checking
  - **Adjuster** (Level 4): Full claim management and team collaboration
  - **Manager** (Level 5): Team management and advanced analytics
  - **Admin** (Level 6): System administration and security management

#### 4. Activity Monitoring
- **Comprehensive Logging**: Track all user activities and system interactions
- **Real-time Monitoring**: Live activity feeds and alerts
- **Performance Metrics**: User productivity and engagement analytics
- **Audit Trails**: Complete audit history for compliance requirements

#### 5. User Analytics
- **Performance Dashboards**: Individual and team performance metrics
- **Productivity Scoring**: Algorithm-based productivity calculations
- **Engagement Tracking**: User engagement and system utilization
- **Trend Analysis**: Historical performance trends and forecasting

### Role-Based Access Control (RBAC)

#### 1. Permission Framework
- **Granular Permissions**: 50+ specific permissions across 10 categories
- **Permission Categories**:
  - Claims Management
  - Document Management
  - Reporting & Analytics
  - User Management
  - Team Management
  - Organization Management
  - Security & Compliance
  - System Integrations
  - AI Features
  - Data Access

#### 2. Feature Access Control
- **Feature Gates**: Control access to specific Susan AI features
- **Dynamic Enablement**: Enable/disable features based on roles and permissions
- **License Compliance**: Ensure users only access licensed features
- **Usage Tracking**: Monitor feature utilization for optimization

#### 3. Data Access Policies
- **Row-Level Security**: Filter data based on user context
- **Policy Types**:
  - Own Data Only
  - Team Data Access
  - Organization Data Access
  - Tenant Data Access
  - Public Data Access
  - Assigned Data Access

#### 4. API Authorization
- **Endpoint Protection**: Secure all API endpoints with permission checks
- **Method-based Authorization**: Different permissions for GET, POST, PUT, DELETE
- **Context-aware Security**: Consider IP, device, and session context
- **Rate Limiting**: Role-based API rate limits

#### 5. Audit Logging
- **Comprehensive Audit Trail**: Log all access attempts and permission checks
- **Security Events**: Track security-related events and anomalies
- **Compliance Reporting**: Generate compliance reports for auditors
- **Real-time Alerts**: Immediate notification of security violations

#### 6. Session Management
- **Secure Sessions**: Enhanced session security with risk scoring
- **Permission Caching**: Cache user permissions for performance
- **Session Monitoring**: Track session activities and anomalies
- **Multi-factor Authentication**: Integrate with MFA systems

## API Endpoints

### Enterprise User Management

#### Organizations
```
POST   /api/enterprise/organizations              # Create organization
GET    /api/enterprise/organizations/:id          # Get organization
PUT    /api/enterprise/organizations/:id          # Update organization
GET    /api/enterprise/organizations/:id/analytics # Get organization analytics
GET    /api/enterprise/organizations              # List organizations
```

#### Teams
```
POST   /api/enterprise/teams                      # Create team
GET    /api/enterprise/teams/:id                  # Get team
PUT    /api/enterprise/teams/:id                  # Update team
POST   /api/enterprise/teams/:id/members          # Add team member
DELETE /api/enterprise/teams/:id/members/:userId  # Remove team member
GET    /api/enterprise/teams                      # List teams
```

#### Users
```
POST   /api/enterprise/users                      # Create user
GET    /api/enterprise/users/:id                  # Get user
PUT    /api/enterprise/users/:id                  # Update user
GET    /api/enterprise/users/:id/analytics        # Get user analytics
POST   /api/enterprise/users/:id/reports          # Generate user report
GET    /api/enterprise/users                      # List users
```

#### System Information
```
GET    /api/enterprise/roles                      # Get available roles
GET    /api/enterprise/organization-types         # Get organization types
GET    /api/enterprise/stats                      # Get system statistics
```

### Role-Based Access Control

#### Permissions & Roles
```
POST   /api/rbac/permissions                      # Create permission
GET    /api/rbac/permissions                      # List permissions
POST   /api/rbac/roles                           # Create role
GET    /api/rbac/roles                           # List roles
GET    /api/rbac/roles/:id                       # Get role details
```

#### User Permissions
```
POST   /api/rbac/users/:userId/permissions        # Assign permissions
GET    /api/rbac/users/:userId/permissions        # Get user permissions
```

#### Permission Checking
```
POST   /api/rbac/check-permission                 # Check single permission
POST   /api/rbac/check-permissions                # Check multiple permissions
POST   /api/rbac/check-feature                    # Check feature access
```

#### Data Access Policies
```
GET    /api/rbac/data-policies                    # Get data policies
POST   /api/rbac/apply-data-policy                # Apply data policy
```

#### API Authorization
```
POST   /api/rbac/authorize-request                # Authorize API request
```

#### Session Management
```
POST   /api/rbac/sessions                         # Start secure session
```

#### Audit & Compliance
```
GET    /api/rbac/audit                           # Get audit log
POST   /api/rbac/compliance-report               # Generate compliance report
GET    /api/rbac/stats                          # Get RBAC statistics
GET    /api/rbac/health                         # Check service health
```

## Security Features

### Enhanced Authentication
- **Multi-factor Authentication**: TOTP, SMS, and email-based MFA
- **Device Trust Management**: Track and manage trusted devices
- **Session Risk Scoring**: Calculate risk scores for sessions
- **Anomaly Detection**: Detect unusual login patterns and behaviors

### Data Protection
- **Encryption at Rest**: All sensitive data encrypted using AES-256
- **Encryption in Transit**: TLS 1.3 for all communications
- **Data Isolation**: Tenant and organization-level data isolation
- **Backup Encryption**: Encrypted backups with key rotation

### Compliance
- **GDPR Compliance**: Data protection and privacy controls
- **SOC 2 Type II**: Security controls and audit readiness
- **HIPAA Compliance**: Healthcare data protection (where applicable)
- **ISO 27001**: Information security management standards

## Performance Optimizations

### Caching Strategy
- **Permission Caching**: Cache user permissions for fast authorization
- **Session Caching**: In-memory session management
- **Query Optimization**: Optimized database queries for large datasets
- **CDN Integration**: Static asset delivery optimization

### Scalability
- **Horizontal Scaling**: Support for multiple application instances
- **Database Sharding**: Shard data by tenant for better performance
- **Microservices Architecture**: Loosely coupled service design
- **Load Balancing**: Distribute load across multiple servers

## Monitoring & Analytics

### System Monitoring
- **Health Checks**: Continuous system health monitoring
- **Performance Metrics**: Track response times and throughput
- **Error Tracking**: Comprehensive error logging and alerting
- **Resource Utilization**: Monitor CPU, memory, and storage usage

### Business Analytics
- **User Engagement**: Track user adoption and feature usage
- **Performance Metrics**: Team and individual performance analytics
- **Cost Analysis**: Track costs and ROI metrics
- **Predictive Analytics**: Forecast usage and capacity needs

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# API Keys
VALID_API_KEYS=key1,key2,key3
ADMIN_API_KEYS=admin-key1,admin-key2

# Database Configuration
DATABASE_URL=your-database-url
REDIS_URL=your-redis-url

# Enterprise Features
ENTERPRISE_MODE=true
RBAC_ENABLED=true
AUDIT_LOGGING=true

# Security Settings
MFA_ENABLED=true
SESSION_TIMEOUT=8h
PASSWORD_POLICY_ENABLED=true
```

### Feature Flags
```json
{
  "enterprise_features": true,
  "advanced_analytics": true,
  "ai_insights": true,
  "compliance_reporting": true,
  "sso_integration": true,
  "audit_logging": true
}
```

## Deployment

### Docker Configuration
```yaml
version: '3.8'
services:
  susan-ai:
    image: susan-ai:enterprise
    environment:
      - ENTERPRISE_MODE=true
      - RBAC_ENABLED=true
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./config:/app/config
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: susan-ai-enterprise
spec:
  replicas: 3
  selector:
    matchLabels:
      app: susan-ai
  template:
    metadata:
      labels:
        app: susan-ai
    spec:
      containers:
      - name: susan-ai
        image: susan-ai:enterprise
        env:
        - name: ENTERPRISE_MODE
          value: "true"
        - name: RBAC_ENABLED
          value: "true"
        ports:
        - containerPort: 3000
```

## Usage Examples

### Creating an Organization
```javascript
const organizationData = {
  name: "Acme Insurance Company",
  type: "insurance_company",
  domain: "acme-insurance.com",
  adminUser: {
    email: "admin@acme-insurance.com",
    firstName: "John",
    lastName: "Admin"
  },
  settings: {
    timezone: "America/New_York",
    theme: "corporate",
    features: ["advanced_claims", "ai_insights", "compliance_reporting"]
  }
};

const response = await fetch('/api/enterprise/organizations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(organizationData)
});
```

### Checking User Permissions
```javascript
const permissionCheck = await fetch('/api/rbac/check-permission', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    permission: 'claims:edit_all',
    context: {
      organizationId: 'org_123',
      teamId: 'team_456'
    }
  })
});

const { hasPermission } = await permissionCheck.json();
```

### Generating Analytics Report
```javascript
const reportData = {
  reportType: 'comprehensive',
  timeframe: 'month',
  format: 'json'
};

const report = await fetch(`/api/enterprise/users/${userId}/reports`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(reportData)
});
```

## Migration Guide

### From Single-User to Enterprise
1. **Backup Existing Data**: Create full backup of current system
2. **Enable Enterprise Mode**: Set `ENTERPRISE_MODE=true` in environment
3. **Create Default Organization**: Set up initial organization structure
4. **Migrate Users**: Import existing users into enterprise system
5. **Configure Permissions**: Set up roles and permissions for existing users
6. **Test Access**: Verify all users can access their expected features

### Database Migration
```sql
-- Add enterprise fields to existing users table
ALTER TABLE users ADD COLUMN organization_id VARCHAR(255);
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'client';
ALTER TABLE users ADD COLUMN teams JSON;

-- Create organization tables
CREATE TABLE organizations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create teams table
CREATE TABLE teams (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),
  members JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

## Troubleshooting

### Common Issues

#### Permission Denied Errors
```bash
# Check user permissions
curl -X POST http://localhost:3000/api/rbac/check-permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"permission": "claims:view_all"}'
```

#### Session Issues
```bash
# Check session health
curl -X GET http://localhost:3000/api/rbac/health \
  -H "Authorization: Bearer $TOKEN"
```

#### Audit Log Analysis
```bash
# Get recent audit events
curl -X GET "http://localhost:3000/api/rbac/audit?limit=100&eventType=access_attempt" \
  -H "Authorization: Bearer $TOKEN"
```

### Performance Issues
1. **Check Permission Cache**: Verify permission caching is enabled
2. **Database Optimization**: Ensure proper indexing on user and permission tables
3. **Memory Usage**: Monitor memory usage for permission caching
4. **Network Latency**: Check network latency between services

## Support

For enterprise support and custom implementations, contact:
- **Email**: enterprise@susan-ai.com
- **Documentation**: https://docs.susan-ai.com/enterprise
- **Support Portal**: https://support.susan-ai.com

## License

Enterprise features require a valid Susan AI Enterprise license. Contact sales for licensing information.