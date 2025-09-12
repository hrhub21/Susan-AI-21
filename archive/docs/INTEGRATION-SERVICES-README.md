# Susan AI Integration Services

This document provides comprehensive information about the integration services available in Susan AI, including setup, configuration, and usage instructions.

## Overview

Susan AI includes four powerful integration services that allow seamless connectivity with external platforms:

1. **CRM Integration Service** - Connect with Salesforce, HubSpot, and custom CRM systems
2. **Calendar Integration Service** - Auto-scheduling with Google Calendar, Outlook, and other systems
3. **Email Integration Service** - Direct template sending through SMTP and cloud email services
4. **API Integration Framework** - Flexible framework for connecting with any external system

## Installation

### Required Dependencies

Add the following dependencies to your `package.json`:

```bash
npm install nodemailer ws
```

### Optional Dependencies for Enhanced Features

```bash
npm install aws-sdk @azure/storage-blob googleapis @microsoft/microsoft-graph-client
```

## Service Architecture

Each integration service follows a consistent architecture:

- **OAuth 2.0 Authentication Support**
- **Rate Limiting and Quotas**
- **Error Handling and Retry Logic**
- **Data Mapping and Transformation**
- **Webhook Support**
- **Audit Logging**
- **Configuration Management**
- **Circuit Breaker Pattern**
- **Caching System**

## 1. CRM Integration Service

### Supported Platforms

- **Salesforce** - Full CRM functionality with OAuth 2.0
- **HubSpot** - Complete contact and company management
- **Custom CRM** - Flexible API integration

### Configuration

Add these environment variables to your `.env` file:

```env
# Salesforce Configuration
SALESFORCE_CLIENT_ID=your_salesforce_client_id
SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
SALESFORCE_REDIRECT_URI=http://localhost:3000/auth/salesforce/callback
SALESFORCE_SANDBOX=false
SALESFORCE_API_VERSION=v58.0

# HubSpot Configuration
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:3000/auth/hubspot/callback
HUBSPOT_PORTAL_ID=your_portal_id
HUBSPOT_API_KEY=your_hubspot_api_key

# Custom CRM Configuration
CUSTOM_CRM_BASE_URL=https://your-crm.com/api
CUSTOM_CRM_API_KEY=your_api_key
CUSTOM_CRM_AUTH_TYPE=api_key
```

### API Endpoints

- `GET /api/integrations/crm/status` - Get CRM integration status
- `POST /api/integrations/crm/{crmId}/auth` - Initiate OAuth flow
- `POST /api/integrations/crm/{crmId}/auth/callback` - Complete OAuth
- `POST /api/integrations/crm/{crmId}/contacts` - Create contact
- `GET /api/integrations/crm/{crmId}/contacts` - Search contacts
- `PUT /api/integrations/crm/{crmId}/contacts/{contactId}` - Update contact
- `POST /api/integrations/crm/{crmId}/companies` - Create company

### Usage Example

```javascript
// Create a contact in Salesforce
const response = await fetch('/api/integrations/crm/salesforce/contacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    company: 'Acme Corp'
  })
});

const result = await response.json();
console.log('Contact created:', result.data);
```

## 2. Calendar Integration Service

### Supported Platforms

- **Google Calendar** - Full calendar management with OAuth 2.0
- **Microsoft Outlook** - Complete event scheduling and management
- **CalDAV** - Support for various calendar servers
- **Exchange Server** - Enterprise calendar integration

### Configuration

```env
# Google Calendar Configuration
GOOGLE_CALENDAR_CLIENT_ID=your_google_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Microsoft Outlook Configuration
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
OUTLOOK_REDIRECT_URI=http://localhost:3000/auth/outlook/callback
OUTLOOK_TENANT_ID=your_tenant_id

# CalDAV Configuration
CALDAV_BASE_URL=https://caldav.example.com
CALDAV_USERNAME=your_username
CALDAV_PASSWORD=your_password

# Exchange Configuration
EXCHANGE_SERVER_URL=https://exchange.example.com
EXCHANGE_USERNAME=your_username
EXCHANGE_PASSWORD=your_password
EXCHANGE_DOMAIN=your_domain
```

### API Endpoints

- `GET /api/integrations/calendar/status` - Get calendar integration status
- `POST /api/integrations/calendar/{calendarId}/auth` - Initiate OAuth flow
- `POST /api/integrations/calendar/{calendarId}/events` - Create event
- `GET /api/integrations/calendar/{calendarId}/events` - List events
- `POST /api/integrations/calendar/{calendarId}/slots` - Find available slots
- `POST /api/integrations/calendar/{calendarId}/schedule` - Auto-schedule event

### Auto-Scheduling Features

The calendar service includes intelligent auto-scheduling:

- **Working Hours Configuration**
- **Buffer Time Management**
- **Conflict Detection**
- **Multi-Attendee Scheduling**
- **Timezone Handling**

### Usage Example

```javascript
// Auto-schedule a meeting
const response = await fetch('/api/integrations/calendar/google/schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventData: {
      title: 'Team Meeting',
      duration: 60, // minutes
      attendees: [
        { email: 'john@example.com', name: 'John Doe' },
        { email: 'jane@example.com', name: 'Jane Smith' }
      ],
      description: 'Weekly team sync'
    },
    options: {
      autoFind: true,
      rulesId: 'default'
    }
  })
});

const result = await response.json();
console.log('Meeting scheduled:', result.data);
```

## 3. Email Integration Service

### Supported Providers

- **SMTP** - Direct SMTP server integration
- **SendGrid** - Cloud email service with templates
- **Amazon SES** - AWS email service
- **Mailgun** - Email API service
- **Office 365** - Microsoft email with OAuth 2.0
- **Gmail API** - Google email with OAuth 2.0

### Configuration

```env
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key

# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SES_REGION=us-east-1

# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_domain.com

# Office 365 Configuration
OFFICE365_CLIENT_ID=your_office365_client_id
OFFICE365_CLIENT_SECRET=your_office365_client_secret
OFFICE365_TENANT_ID=your_tenant_id

# Gmail Configuration
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret

# Default Settings
DEFAULT_FROM_EMAIL=noreply@yourcompany.com
```

### API Endpoints

- `GET /api/integrations/email/status` - Get email provider status
- `POST /api/integrations/email/{providerId}/send` - Send email
- `POST /api/integrations/email/{providerId}/send-template` - Send template email
- `GET /api/integrations/email/templates` - List email templates
- `POST /api/integrations/email/templates` - Create template
- `GET /api/integrations/email/tracking/{trackingId}` - Get email tracking

### Built-in Templates

The service includes pre-built templates:

1. **Meeting Invitation** - Professional meeting invites with accept/decline links
2. **Follow-up Email** - Automated follow-up with action items
3. **System Notification** - Branded system notifications

### Usage Example

```javascript
// Send a meeting invitation using template
const response = await fetch('/api/integrations/email/sendgrid/send-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 'meeting_invitation',
    variables: {
      meeting: {
        title: 'Project Review',
        date: '2025-01-15',
        time: '2:00 PM EST',
        duration: '1 hour',
        location: 'Conference Room A',
        meetingLink: 'https://zoom.us/j/123456789'
      },
      organizer: {
        name: 'Susan AI',
        email: 'susan@yourcompany.com'
      }
    },
    recipients: {
      to: ['john@example.com', 'jane@example.com']
    }
  })
});

const result = await response.json();
console.log('Invitation sent:', result.trackingId);
```

## 4. API Integration Framework

### Supported Protocols

- **REST API** - Full REST API support with all HTTP methods
- **GraphQL** - Query and mutation support
- **SOAP** - SOAP web service integration (planned)
- **WebSocket** - Real-time communication
- **gRPC** - High-performance RPC (planned)

### Authentication Types

- **None** - No authentication required
- **API Key** - Header or query parameter API keys
- **Bearer Token** - JWT or other bearer tokens
- **Basic Auth** - Username/password authentication
- **OAuth 2.0** - Full OAuth 2.0 flow with token refresh
- **Custom** - Custom authentication handlers

### Configuration

```javascript
// Register a new integration
const integrationConfig = {
  name: 'My Custom API',
  baseUrl: 'https://api.example.com',
  protocol: 'rest',
  auth: {
    type: 'bearer_token',
    token: 'your_api_token'
  },
  rateLimit: {
    requests: 100,
    window: 60000 // 1 minute
  },
  timeout: 30000,
  retries: 3,
  circuitBreakerThreshold: 5
};

const response = await fetch('/api/integrations/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    integrationId: 'my-custom-api',
    config: integrationConfig
  })
});
```

### API Endpoints

- `GET /api/integrations/api` - List all integrations
- `POST /api/integrations/api` - Register new integration
- `PUT /api/integrations/api/{integrationId}` - Update integration
- `DELETE /api/integrations/api/{integrationId}` - Remove integration
- `POST /api/integrations/api/{integrationId}/request` - Make API request
- `POST /api/integrations/api/{integrationId}/graphql` - GraphQL request
- `GET /api/integrations/api/metrics` - Get integration metrics

### Advanced Features

- **Circuit Breaker Pattern** - Prevents cascade failures
- **Intelligent Caching** - Response caching with TTL
- **Middleware System** - Request/response transformation
- **Data Transformation** - Automatic data mapping
- **Webhook Support** - Incoming webhook handling
- **Retry Logic** - Exponential backoff retry strategy

### Usage Example

```javascript
// Make a REST API call through the framework
const response = await fetch('/api/integrations/api/my-custom-api/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'GET',
    url: '/users',
    data: { page: 1, limit: 10 }
  })
});

const result = await response.json();
console.log('API Response:', result.data);
```

## Webhook Support

All integration services support incoming webhooks for real-time updates:

### CRM Webhooks
- Contact created/updated/deleted
- Company created/updated/deleted
- Deal stage changes
- Custom object updates

### Calendar Webhooks
- Event created/updated/deleted
- Calendar permissions changed
- Attendee responses
- Meeting room bookings

### Email Webhooks
- Email delivered/bounced/clicked
- Unsubscribe events
- Spam complaints
- Template usage analytics

### API Framework Webhooks
- Custom webhook handlers
- Signature verification
- Data transformation
- Event routing

## Monitoring and Analytics

### Audit Logging

All services maintain comprehensive audit logs:

```javascript
// Get consolidated audit logs
const response = await fetch('/api/integrations/audit?limit=100&service=email');
const logs = await response.json();

logs.data.forEach(log => {
  console.log(`${log.service}: ${log.action} at ${log.timestamp}`);
});
```

### Metrics and Status

```javascript
// Get overall integration status
const response = await fetch('/api/integrations/status');
const status = await response.json();

console.log('CRM Status:', status.data.crm);
console.log('Calendar Status:', status.data.calendar);
console.log('Email Status:', status.data.email);
console.log('API Framework Status:', status.data.api);
```

### Rate Limiting Status

```javascript
// Check rate limiting status
const response = await fetch('/api/integrations/crm/status');
const status = await response.json();

Object.entries(status.data).forEach(([crmId, info]) => {
  console.log(`${crmId}: ${info.rateLimitStatus.requests}/${info.rateLimitStatus.limit} requests`);
});
```

## Error Handling

All services implement comprehensive error handling:

- **Automatic Retry** - Configurable retry logic with exponential backoff
- **Circuit Breaker** - Prevents cascade failures when external services are down
- **Rate Limit Handling** - Automatic retry when rate limits are hit
- **Token Refresh** - Automatic OAuth token refresh when expired
- **Fallback Strategies** - Graceful degradation when services are unavailable

## Security Best Practices

### Environment Variables
- Store all sensitive credentials in environment variables
- Use different credentials for development/staging/production
- Rotate API keys and secrets regularly

### OAuth 2.0 Security
- Use HTTPS for all OAuth redirects
- Validate state parameters to prevent CSRF attacks
- Store refresh tokens securely
- Implement proper token expiration handling

### Webhook Security
- Verify webhook signatures when available
- Use HTTPS endpoints for webhook URLs
- Implement proper request validation
- Rate limit webhook endpoints

### API Security
- Use least-privilege access for API keys
- Implement proper authentication for all endpoints
- Validate all input data
- Log security events for monitoring

## Troubleshooting

### Common Issues

1. **OAuth Authentication Failures**
   - Check client ID and secret
   - Verify redirect URI configuration
   - Ensure proper scopes are requested

2. **Rate Limiting Issues**
   - Check rate limit status endpoints
   - Implement proper backoff strategies
   - Consider upgrading API plans

3. **Webhook Delivery Failures**
   - Verify webhook URL accessibility
   - Check signature verification
   - Monitor webhook endpoint logs

4. **Email Delivery Issues**
   - Check SMTP server settings
   - Verify DNS configuration
   - Monitor bounce and complaint rates

### Debug Mode

Enable debug logging by setting:

```env
LOG_LEVEL=debug
```

This will provide detailed information about:
- API requests and responses
- Authentication flows
- Rate limiting events
- Error details and stack traces

## Support and Documentation

For additional support:

1. Check the audit logs for detailed error information
2. Use the test endpoints to verify connectivity
3. Monitor the health check endpoints
4. Review the comprehensive error messages in API responses

## Future Enhancements

Planned features for upcoming versions:

- **SOAP Protocol Support** in API Integration Framework
- **gRPC Protocol Support** for high-performance APIs
- **Advanced Analytics Dashboard** with visual metrics
- **Custom Workflow Engine** for complex integrations
- **Multi-tenant Support** for SaaS deployments
- **Advanced Caching Strategies** with Redis support
- **Enhanced Security Features** with encryption at rest

## Contributing

When extending the integration services:

1. Follow the established architecture patterns
2. Implement comprehensive error handling
3. Add appropriate audit logging
4. Include rate limiting and circuit breaker support
5. Write comprehensive tests
6. Update documentation

## License

These integration services are part of the Susan AI system and are licensed under the MIT License.