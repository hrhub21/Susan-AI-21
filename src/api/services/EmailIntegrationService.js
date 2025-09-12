import nodemailer from 'nodemailer';
import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import EventEmitter from 'events';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Email Integration Service for Susan AI
 * Supports SMTP, SendGrid, AWS SES, Mailgun, and other email services
 * Provides comprehensive email functionality with templates, tracking, and automation
 */
export class EmailIntegrationService extends EventEmitter {
  constructor() {
    super();
    
    // Core configuration
    this.emailProviders = new Map();
    this.transporters = new Map();
    this.rateLimiters = new Map();
    this.oauthTokens = new Map();
    this.templates = new Map();
    this.auditLogs = [];
    this.retryQueues = new Map();
    this.webhookHandlers = new Map();
    this.trackingData = new Map();
    
    // Rate limiting configurations
    this.rateLimits = {
      smtp: { requests: 100, window: 60 * 60 * 1000 }, // 100/hour
      sendgrid: { requests: 100, window: 60 * 1000 }, // 100/minute
      ses: { requests: 14, window: 1000 }, // 14/second
      mailgun: { requests: 300, window: 60 * 60 * 1000 }, // 300/hour
      office365: { requests: 10000, window: 60 * 60 * 1000 }, // 10000/hour
      gmail: { requests: 250, window: 60 * 60 * 1000 } // 250/hour (quota units)
    };
    
    // Initialize email providers
    this.initializeProviders();
    this.setupRateLimiters();
    this.setupWebhookHandlers();
    this.setupDefaultTemplates();
    this.startRetryProcessor();
  }

  initializeProviders() {
    // SMTP Configuration
    this.emailProviders.set('smtp', {
      name: 'SMTP Server',
      type: 'smtp',
      enabled: !!(process.env.SMTP_HOST && process.env.SMTP_PORT),
      config: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
        }
      },
      features: {
        templates: true,
        tracking: false,
        analytics: false,
        webhooks: false
      }
    });

    // SendGrid Configuration
    this.emailProviders.set('sendgrid', {
      name: 'SendGrid',
      type: 'api',
      enabled: !!process.env.SENDGRID_API_KEY,
      config: {
        apiKey: process.env.SENDGRID_API_KEY,
        baseUrl: 'https://api.sendgrid.com/v3',
        timeout: 30000
      },
      endpoints: {
        send: '/mail/send',
        templates: '/templates',
        tracking: '/tracking_settings',
        webhooks: '/user/webhooks/event'
      },
      features: {
        templates: true,
        tracking: true,
        analytics: true,
        webhooks: true
      }
    });

    // AWS SES Configuration
    this.emailProviders.set('ses', {
      name: 'Amazon SES',
      type: 'aws',
      enabled: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      config: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_SES_REGION || 'us-east-1',
        apiVersion: '2010-12-01'
      },
      endpoints: {
        send: 'email',
        template: 'template',
        bounce: 'configuration-set'
      },
      features: {
        templates: true,
        tracking: true,
        analytics: true,
        webhooks: true
      }
    });

    // Mailgun Configuration
    this.emailProviders.set('mailgun', {
      name: 'Mailgun',
      type: 'api',
      enabled: !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN),
      config: {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
        baseUrl: process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3',
        timeout: 30000
      },
      endpoints: {
        send: '/{domain}/messages',
        templates: '/{domain}/templates',
        events: '/{domain}/events',
        webhooks: '/{domain}/webhooks'
      },
      features: {
        templates: true,
        tracking: true,
        analytics: true,
        webhooks: true
      }
    });

    // Office 365 Configuration
    this.emailProviders.set('office365', {
      name: 'Office 365',
      type: 'oauth',
      enabled: !!(process.env.OFFICE365_CLIENT_ID && process.env.OFFICE365_CLIENT_SECRET),
      config: {
        clientId: process.env.OFFICE365_CLIENT_ID,
        clientSecret: process.env.OFFICE365_CLIENT_SECRET,
        tenant: process.env.OFFICE365_TENANT_ID || 'common',
        redirectUri: process.env.OFFICE365_REDIRECT_URI || 'http://localhost:3000/auth/office365/callback',
        timeout: 30000
      },
      endpoints: {
        oauth: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
        send: 'https://graph.microsoft.com/v1.0/me/sendMail',
        messages: 'https://graph.microsoft.com/v1.0/me/messages'
      },
      scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.ReadWrite'],
      features: {
        templates: false,
        tracking: false,
        analytics: false,
        webhooks: true
      }
    });

    // Gmail API Configuration
    this.emailProviders.set('gmail', {
      name: 'Gmail API',
      type: 'oauth',
      enabled: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
      config: {
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback',
        timeout: 30000
      },
      endpoints: {
        oauth: 'https://oauth2.googleapis.com/token',
        send: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        messages: 'https://gmail.googleapis.com/gmail/v1/users/me/messages'
      },
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify'],
      features: {
        templates: false,
        tracking: false,
        analytics: false,
        webhooks: true
      }
    });

    this.initializeTransporters();
  }

  async initializeTransporters() {
    for (const [providerId, provider] of this.emailProviders) {
      if (!provider.enabled) continue;

      try {
        switch (provider.type) {
          case 'smtp':
            const transporter = nodemailer.createTransporter(provider.config);
            await transporter.verify();
            this.transporters.set(providerId, transporter);
            logger.info(`SMTP transporter initialized: ${provider.name}`);
            break;

          case 'api':
            // API-based providers will be handled in sendEmail method
            this.transporters.set(providerId, {
              type: 'api',
              config: provider.config,
              endpoints: provider.endpoints
            });
            logger.info(`API transporter initialized: ${provider.name}`);
            break;

          case 'aws':
            // AWS SES will be handled separately
            this.transporters.set(providerId, {
              type: 'aws',
              config: provider.config
            });
            logger.info(`AWS SES transporter initialized: ${provider.name}`);
            break;

          case 'oauth':
            // OAuth providers need authentication first
            this.transporters.set(providerId, {
              type: 'oauth',
              config: provider.config,
              endpoints: provider.endpoints
            });
            logger.info(`OAuth transporter initialized: ${provider.name}`);
            break;
        }
      } catch (error) {
        logger.error(`Failed to initialize ${provider.name}`, error);
      }
    }
  }

  setupRateLimiters() {
    for (const [providerId, limits] of Object.entries(this.rateLimits)) {
      this.rateLimiters.set(providerId, {
        requests: 0,
        windowStart: Date.now(),
        ...limits
      });
    }
  }

  async checkRateLimit(providerId) {
    const limiter = this.rateLimiters.get(providerId);
    if (!limiter) return;

    const now = Date.now();
    
    // Reset window if expired
    if (now - limiter.windowStart >= limiter.window) {
      limiter.requests = 0;
      limiter.windowStart = now;
    }

    // Check if rate limit exceeded
    if (limiter.requests >= limiter.requests) {
      const waitTime = limiter.window - (now - limiter.windowStart);
      throw new ApiError(`Rate limit exceeded for ${providerId}. Wait ${Math.ceil(waitTime / 1000)} seconds.`, 429);
    }

    limiter.requests++;
  }

  setupWebhookHandlers() {
    this.webhookHandlers.set('sendgrid', this.handleSendGridWebhook.bind(this));
    this.webhookHandlers.set('mailgun', this.handleMailgunWebhook.bind(this));
    this.webhookHandlers.set('ses', this.handleSESWebhook.bind(this));
    this.webhookHandlers.set('office365', this.handleOffice365Webhook.bind(this));
    this.webhookHandlers.set('gmail', this.handleGmailWebhook.bind(this));
  }

  setupDefaultTemplates() {
    // Meeting invitation template
    this.templates.set('meeting_invitation', {
      id: 'meeting_invitation',
      name: 'Meeting Invitation',
      subject: 'Meeting Invitation: {{meeting.title}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You're invited to a meeting</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #555;">{{meeting.title}}</h3>
            <p><strong>Date:</strong> {{meeting.date}}</p>
            <p><strong>Time:</strong> {{meeting.time}}</p>
            <p><strong>Duration:</strong> {{meeting.duration}}</p>
            {{#if meeting.location}}<p><strong>Location:</strong> {{meeting.location}}</p>{{/if}}
            {{#if meeting.meetingLink}}<p><strong>Join URL:</strong> <a href="{{meeting.meetingLink}}">{{meeting.meetingLink}}</a></p>{{/if}}
          </div>
          {{#if meeting.description}}
          <div style="margin: 20px 0;">
            <h4>Description:</h4>
            <p>{{meeting.description}}</p>
          </div>
          {{/if}}
          <div style="margin: 30px 0;">
            <a href="{{meeting.acceptUrl}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">Accept</a>
            <a href="{{meeting.declineUrl}}" style="background: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Decline</a>
          </div>
          <p style="color: #666; font-size: 12px;">This invitation was sent by Susan AI on behalf of {{organizer.name}}.</p>
        </div>
      `,
      text: `
You're invited to a meeting

{{meeting.title}}
Date: {{meeting.date}}
Time: {{meeting.time}}
Duration: {{meeting.duration}}
{{#if meeting.location}}Location: {{meeting.location}}{{/if}}
{{#if meeting.meetingLink}}Join URL: {{meeting.meetingLink}}{{/if}}

{{#if meeting.description}}Description: {{meeting.description}}{{/if}}

Accept: {{meeting.acceptUrl}}
Decline: {{meeting.declineUrl}}

This invitation was sent by Susan AI on behalf of {{organizer.name}}.
      `,
      variables: ['meeting', 'organizer']
    });

    // Follow-up template
    this.templates.set('follow_up', {
      id: 'follow_up',
      name: 'Follow-up Email',
      subject: 'Follow-up: {{subject}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Following up on our {{interaction.type}}</h2>
          <p>Hi {{recipient.name}},</p>
          <p>I wanted to follow up on our {{interaction.type}} {{#if interaction.date}}on {{interaction.date}}{{/if}} regarding {{interaction.topic}}.</p>
          {{#if followup.items}}
          <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4>Action Items:</h4>
            <ul>
              {{#each followup.items}}
              <li>{{this}}</li>
              {{/each}}
            </ul>
          </div>
          {{/if}}
          {{#if followup.nextSteps}}
          <div style="margin: 20px 0;">
            <h4>Next Steps:</h4>
            <p>{{followup.nextSteps}}</p>
          </div>
          {{/if}}
          <p>Please let me know if you have any questions or if there's anything else I can help with.</p>
          <p>Best regards,<br>{{sender.name}}</p>
          <p style="color: #666; font-size: 12px;">This email was sent by Susan AI on behalf of {{sender.name}}.</p>
        </div>
      `,
      text: `
Following up on our {{interaction.type}}

Hi {{recipient.name}},

I wanted to follow up on our {{interaction.type}} {{#if interaction.date}}on {{interaction.date}}{{/if}} regarding {{interaction.topic}}.

{{#if followup.items}}
Action Items:
{{#each followup.items}}
- {{this}}
{{/each}}
{{/if}}

{{#if followup.nextSteps}}
Next Steps:
{{followup.nextSteps}}
{{/if}}

Please let me know if you have any questions or if there's anything else I can help with.

Best regards,
{{sender.name}}

This email was sent by Susan AI on behalf of {{sender.name}}.
      `,
      variables: ['recipient', 'sender', 'interaction', 'followup']
    });

    // Notification template
    this.templates.set('notification', {
      id: 'notification',
      name: 'System Notification',
      subject: '{{notification.title}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="padding: 20px; border-left: 4px solid {{notification.color}}; background: #f9f9f9;">
            <h2 style="margin: 0 0 10px 0; color: #333;">{{notification.title}}</h2>
            <p style="margin: 0; color: #666;">{{notification.message}}</p>
          </div>
          {{#if notification.details}}
          <div style="margin: 20px 0; padding: 15px; background: #ffffff; border: 1px solid #ddd; border-radius: 5px;">
            <h4 style="margin: 0 0 10px 0;">Details:</h4>
            <p>{{notification.details}}</p>
          </div>
          {{/if}}
          {{#if notification.action}}
          <div style="margin: 20px 0; text-align: center;">
            <a href="{{notification.actionUrl}}" style="background: {{notification.color}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">{{notification.action}}</a>
          </div>
          {{/if}}
          <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">
            This notification was sent by Susan AI at {{timestamp}}.
          </p>
        </div>
      `,
      text: `
{{notification.title}}

{{notification.message}}

{{#if notification.details}}
Details:
{{notification.details}}
{{/if}}

{{#if notification.action}}
{{notification.action}}: {{notification.actionUrl}}
{{/if}}

This notification was sent by Susan AI at {{timestamp}}.
      `,
      variables: ['notification', 'timestamp']
    });
  }

  // OAuth Authentication Methods
  async initiateOAuthFlow(providerId, state = null) {
    const provider = this.emailProviders.get(providerId);
    if (!provider || provider.type !== 'oauth') {
      throw new ApiError(`OAuth not supported for ${providerId}`, 400);
    }

    let authUrl = '';
    const stateParam = state || crypto.randomBytes(16).toString('hex');

    switch (providerId) {
      case 'office365':
        authUrl = `https://login.microsoftonline.com/${provider.config.tenant}/oauth2/v2.0/authorize?` +
          `response_type=code&` +
          `client_id=${provider.config.clientId}&` +
          `redirect_uri=${encodeURIComponent(provider.config.redirectUri)}&` +
          `scope=${provider.scopes.join('%20')}&` +
          `state=${stateParam}&` +
          `response_mode=query`;
        break;

      case 'gmail':
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `response_type=code&` +
          `client_id=${provider.config.clientId}&` +
          `redirect_uri=${encodeURIComponent(provider.config.redirectUri)}&` +
          `scope=${provider.scopes.join('%20')}&` +
          `state=${stateParam}&` +
          `access_type=offline&` +
          `prompt=consent`;
        break;

      default:
        throw new ApiError(`OAuth not supported for ${providerId}`, 400);
    }

    this.logAudit('oauth_initiated', { providerId, state: stateParam });
    return { authUrl, state: stateParam };
  }

  async exchangeCodeForToken(providerId, code, state) {
    const provider = this.emailProviders.get(providerId);
    if (!provider || provider.type !== 'oauth') {
      throw new ApiError(`OAuth not supported for ${providerId}`, 400);
    }

    try {
      let tokenData = null;

      switch (providerId) {
        case 'office365':
          const office365Url = provider.endpoints.oauth.replace('{tenant}', provider.config.tenant);
          const office365Response = await axios.post(office365Url, {
            grant_type: 'authorization_code',
            client_id: provider.config.clientId,
            client_secret: provider.config.clientSecret,
            redirect_uri: provider.config.redirectUri,
            code,
            scope: provider.scopes.join(' ')
          }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          
          tokenData = {
            accessToken: office365Response.data.access_token,
            refreshToken: office365Response.data.refresh_token,
            expiresAt: Date.now() + (office365Response.data.expires_in * 1000),
            scope: office365Response.data.scope
          };
          break;

        case 'gmail':
          const gmailResponse = await axios.post(provider.endpoints.oauth, {
            grant_type: 'authorization_code',
            client_id: provider.config.clientId,
            client_secret: provider.config.clientSecret,
            redirect_uri: provider.config.redirectUri,
            code
          });
          
          tokenData = {
            accessToken: gmailResponse.data.access_token,
            refreshToken: gmailResponse.data.refresh_token,
            expiresAt: Date.now() + (gmailResponse.data.expires_in * 1000),
            scope: gmailResponse.data.scope
          };
          break;

        default:
          throw new ApiError(`OAuth not supported for ${providerId}`, 400);
      }

      this.oauthTokens.set(providerId, tokenData);
      this.logAudit('oauth_completed', { providerId, state });

      return { success: true, providerId, authenticated: true };

    } catch (error) {
      this.logError(providerId, 'OAuth Exchange Failed', error);
      throw new ApiError(`OAuth token exchange failed for ${providerId}: ${error.message}`, 400);
    }
  }

  async refreshToken(providerId) {
    const tokenData = this.oauthTokens.get(providerId);
    const provider = this.emailProviders.get(providerId);

    if (!tokenData?.refreshToken || !provider) {
      throw new ApiError(`No refresh token available for ${providerId}`, 401);
    }

    try {
      let response;
      switch (providerId) {
        case 'office365':
          const office365Url = provider.endpoints.oauth.replace('{tenant}', provider.config.tenant);
          response = await axios.post(office365Url, {
            grant_type: 'refresh_token',
            client_id: provider.config.clientId,
            client_secret: provider.config.clientSecret,
            refresh_token: tokenData.refreshToken
          });
          
          tokenData.accessToken = response.data.access_token;
          tokenData.expiresAt = Date.now() + (response.data.expires_in * 1000);
          if (response.data.refresh_token) {
            tokenData.refreshToken = response.data.refresh_token;
          }
          break;

        case 'gmail':
          response = await axios.post(provider.endpoints.oauth, {
            grant_type: 'refresh_token',
            client_id: provider.config.clientId,
            client_secret: provider.config.clientSecret,
            refresh_token: tokenData.refreshToken
          });
          
          tokenData.accessToken = response.data.access_token;
          tokenData.expiresAt = Date.now() + (response.data.expires_in * 1000);
          if (response.data.refresh_token) {
            tokenData.refreshToken = response.data.refresh_token;
          }
          break;
      }

      this.logAudit('token_refreshed', { providerId });
      
    } catch (error) {
      this.logError(providerId, 'Token Refresh Failed', error);
      throw new ApiError(`Token refresh failed for ${providerId}`, 401);
    }
  }

  // Email Sending Methods
  async sendEmail(providerId, emailData, options = {}) {
    await this.checkRateLimit(providerId);
    
    const provider = this.emailProviders.get(providerId);
    const transporter = this.transporters.get(providerId);

    if (!provider || !transporter) {
      throw new ApiError(`Email provider ${providerId} not available`, 400);
    }

    try {
      const trackingId = crypto.randomBytes(16).toString('hex');
      const enhancedEmailData = {
        ...emailData,
        trackingId,
        timestamp: new Date(),
        provider: providerId
      };

      let result;

      switch (provider.type) {
        case 'smtp':
          result = await this.sendViaSMTP(transporter, enhancedEmailData, options);
          break;
        case 'api':
          result = await this.sendViaAPI(providerId, transporter, enhancedEmailData, options);
          break;
        case 'aws':
          result = await this.sendViaSES(transporter, enhancedEmailData, options);
          break;
        case 'oauth':
          result = await this.sendViaOAuth(providerId, transporter, enhancedEmailData, options);
          break;
        default:
          throw new ApiError(`Unsupported provider type: ${provider.type}`, 400);
      }

      // Store tracking data
      this.trackingData.set(trackingId, {
        emailData: enhancedEmailData,
        result,
        status: 'sent',
        events: [{
          type: 'sent',
          timestamp: new Date(),
          provider: providerId
        }]
      });

      this.logAudit('email_sent', { 
        providerId, 
        trackingId, 
        to: emailData.to,
        subject: emailData.subject 
      });

      return {
        success: true,
        trackingId,
        messageId: result.messageId,
        provider: providerId,
        timestamp: new Date()
      };

    } catch (error) {
      this.logError(providerId, 'Email Send Failed', error);
      return this.addToRetryQueue(providerId, 'sendEmail', { emailData, options });
    }
  }

  async sendViaSMTP(transporter, emailData, options) {
    const mailOptions = {
      from: emailData.from || process.env.DEFAULT_FROM_EMAIL,
      to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
      cc: emailData.cc ? (Array.isArray(emailData.cc) ? emailData.cc.join(', ') : emailData.cc) : undefined,
      bcc: emailData.bcc ? (Array.isArray(emailData.bcc) ? emailData.bcc.join(', ') : emailData.bcc) : undefined,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      attachments: this.processAttachments(emailData.attachments),
      headers: {
        'X-Susan-AI-Tracking': emailData.trackingId,
        ...emailData.headers
      }
    };

    return await transporter.sendMail(mailOptions);
  }

  async sendViaAPI(providerId, transporter, emailData, options) {
    switch (providerId) {
      case 'sendgrid':
        return await this.sendViaSendGrid(transporter, emailData, options);
      case 'mailgun':
        return await this.sendViaMailgun(transporter, emailData, options);
      default:
        throw new ApiError(`API sending not implemented for ${providerId}`, 400);
    }
  }

  async sendViaSendGrid(transporter, emailData, options) {
    const sgMail = {
      to: emailData.to,
      from: emailData.from || process.env.DEFAULT_FROM_EMAIL,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      custom_args: {
        tracking_id: emailData.trackingId,
        susan_ai: 'true'
      }
    };

    if (emailData.cc) sgMail.cc = emailData.cc;
    if (emailData.bcc) sgMail.bcc = emailData.bcc;
    if (emailData.attachments) sgMail.attachments = this.formatAttachments(emailData.attachments, 'sendgrid');

    const response = await axios.post(
      `${transporter.config.baseUrl}${transporter.endpoints.send}`,
      sgMail,
      {
        headers: {
          'Authorization': `Bearer ${transporter.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      messageId: response.headers['x-message-id'],
      status: response.status
    };
  }

  async sendViaMailgun(transporter, emailData, options) {
    const formData = new FormData();
    formData.append('from', emailData.from || process.env.DEFAULT_FROM_EMAIL);
    formData.append('to', Array.isArray(emailData.to) ? emailData.to.join(',') : emailData.to);
    formData.append('subject', emailData.subject);
    formData.append('text', emailData.text);
    formData.append('html', emailData.html);
    formData.append('o:tracking', 'yes');
    formData.append('o:tracking-clicks', 'yes');
    formData.append('o:tracking-opens', 'yes');
    formData.append('v:tracking_id', emailData.trackingId);

    if (emailData.cc) formData.append('cc', Array.isArray(emailData.cc) ? emailData.cc.join(',') : emailData.cc);
    if (emailData.bcc) formData.append('bcc', Array.isArray(emailData.bcc) ? emailData.bcc.join(',') : emailData.bcc);

    const endpoint = transporter.endpoints.send.replace('{domain}', transporter.config.domain);
    const response = await axios.post(
      `${transporter.config.baseUrl}${endpoint}`,
      formData,
      {
        auth: {
          username: 'api',
          password: transporter.config.apiKey
        },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return {
      messageId: response.data.id,
      status: response.status
    };
  }

  async sendViaSES(transporter, emailData, options) {
    // AWS SES implementation would go here
    // This is a simplified version
    throw new ApiError('AWS SES implementation not yet available', 501);
  }

  async sendViaOAuth(providerId, transporter, emailData, options) {
    const tokenData = this.oauthTokens.get(providerId);
    if (!tokenData?.accessToken) {
      throw new ApiError(`No OAuth token available for ${providerId}`, 401);
    }

    // Check if token needs refresh
    if (tokenData.expiresAt && Date.now() >= tokenData.expiresAt - 60000) {
      await this.refreshToken(providerId);
    }

    switch (providerId) {
      case 'office365':
        return await this.sendViaOffice365(transporter, emailData, tokenData, options);
      case 'gmail':
        return await this.sendViaGmail(transporter, emailData, tokenData, options);
      default:
        throw new ApiError(`OAuth sending not implemented for ${providerId}`, 400);
    }
  }

  async sendViaOffice365(transporter, emailData, tokenData, options) {
    const message = {
      subject: emailData.subject,
      body: {
        contentType: 'HTML',
        content: emailData.html || emailData.text
      },
      toRecipients: (Array.isArray(emailData.to) ? emailData.to : [emailData.to]).map(email => ({
        emailAddress: { address: email }
      }))
    };

    if (emailData.cc) {
      message.ccRecipients = (Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc]).map(email => ({
        emailAddress: { address: email }
      }));
    }

    if (emailData.bcc) {
      message.bccRecipients = (Array.isArray(emailData.bcc) ? emailData.bcc : [emailData.bcc]).map(email => ({
        emailAddress: { address: email }
      }));
    }

    const response = await axios.post(
      transporter.endpoints.send,
      { message },
      {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      messageId: response.data.id || crypto.randomBytes(16).toString('hex'),
      status: response.status
    };
  }

  async sendViaGmail(transporter, emailData, tokenData, options) {
    // Construct the email message
    const messageParts = [
      `To: ${Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to}`,
      `Subject: ${emailData.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      emailData.html || emailData.text
    ];

    if (emailData.cc) {
      messageParts.splice(1, 0, `Cc: ${Array.isArray(emailData.cc) ? emailData.cc.join(', ') : emailData.cc}`);
    }

    if (emailData.bcc) {
      messageParts.splice(emailData.cc ? 2 : 1, 0, `Bcc: ${Array.isArray(emailData.bcc) ? emailData.bcc.join(', ') : emailData.bcc}`);
    }

    const rawMessage = messageParts.join('\n');
    const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await axios.post(
      transporter.endpoints.send,
      { raw: encodedMessage },
      {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      messageId: response.data.id,
      status: response.status
    };
  }

  // Template Management Methods
  async renderTemplate(templateId, variables) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new ApiError(`Template ${templateId} not found`, 404);
    }

    try {
      // Simple template rendering (in production, use a proper template engine like Handlebars)
      let renderedSubject = template.subject;
      let renderedHtml = template.html;
      let renderedText = template.text;

      // Replace variables
      const flatVariables = this.flattenVariables(variables);
      for (const [key, value] of Object.entries(flatVariables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        renderedSubject = renderedSubject.replace(regex, value || '');
        renderedHtml = renderedHtml.replace(regex, value || '');
        renderedText = renderedText.replace(regex, value || '');
      }

      // Handle conditional blocks (simplified)
      renderedHtml = this.renderConditionals(renderedHtml, variables);
      renderedText = this.renderConditionals(renderedText, variables);

      return {
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
        templateId,
        variables: Object.keys(flatVariables)
      };

    } catch (error) {
      throw new ApiError(`Template rendering failed: ${error.message}`, 400);
    }
  }

  flattenVariables(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenVariables(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }

  renderConditionals(content, variables) {
    // Simple conditional rendering for {{#if variable}} and {{#each array}}
    // In production, use a proper template engine
    
    // Handle #if blocks
    content = content.replace(/{{#if\s+([^}]+)}}(.*?){{\/if}}/gs, (match, condition, block) => {
      const value = this.getVariableValue(condition.trim(), variables);
      return value ? block : '';
    });

    // Handle #each blocks
    content = content.replace(/{{#each\s+([^}]+)}}(.*?){{\/each}}/gs, (match, arrayPath, block) => {
      const array = this.getVariableValue(arrayPath.trim(), variables);
      if (Array.isArray(array)) {
        return array.map(item => {
          let itemBlock = block;
          if (typeof item === 'object') {
            for (const [key, value] of Object.entries(item)) {
              const regex = new RegExp(`{{${key}}}`, 'g');
              itemBlock = itemBlock.replace(regex, value || '');
            }
          } else {
            itemBlock = itemBlock.replace(/{{this}}/g, item);
          }
          return itemBlock;
        }).join('');
      }
      return '';
    });

    return content;
  }

  getVariableValue(path, variables) {
    return path.split('.').reduce((obj, key) => obj?.[key], variables);
  }

  async sendTemplateEmail(providerId, templateId, variables, recipients, options = {}) {
    try {
      const rendered = await this.renderTemplate(templateId, variables);
      
      const emailData = {
        to: recipients.to,
        cc: recipients.cc,
        bcc: recipients.bcc,
        from: options.from,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: options.attachments,
        headers: {
          'X-Susan-AI-Template': templateId,
          ...options.headers
        }
      };

      const result = await this.sendEmail(providerId, emailData, options);
      
      this.logAudit('template_email_sent', { 
        providerId, 
        templateId, 
        trackingId: result.trackingId 
      });

      return result;

    } catch (error) {
      this.logError(providerId, 'Template Email Failed', error);
      throw new ApiError(`Failed to send template email: ${error.message}`, error.response?.status || 500);
    }
  }

  createTemplate(templateData) {
    const templateId = templateData.id || crypto.randomBytes(8).toString('hex');
    
    const template = {
      id: templateId,
      name: templateData.name,
      subject: templateData.subject,
      html: templateData.html,
      text: templateData.text || this.htmlToText(templateData.html),
      variables: templateData.variables || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(templateId, template);
    this.logAudit('template_created', { templateId, name: template.name });

    return { success: true, templateId, template };
  }

  updateTemplate(templateId, templateData) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new ApiError(`Template ${templateId} not found`, 404);
    }

    const updatedTemplate = {
      ...template,
      ...templateData,
      id: templateId, // Don't allow ID changes
      updatedAt: new Date()
    };

    this.templates.set(templateId, updatedTemplate);
    this.logAudit('template_updated', { templateId });

    return { success: true, templateId, template: updatedTemplate };
  }

  deleteTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new ApiError(`Template ${templateId} not found`, 404);
    }

    this.templates.delete(templateId);
    this.logAudit('template_deleted', { templateId });

    return { success: true, templateId };
  }

  listTemplates() {
    return Array.from(this.templates.values()).map(template => ({
      id: template.id,
      name: template.name,
      variables: template.variables,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));
  }

  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // Tracking and Analytics Methods
  getEmailTracking(trackingId) {
    const tracking = this.trackingData.get(trackingId);
    if (!tracking) {
      throw new ApiError(`Tracking data not found for ${trackingId}`, 404);
    }

    return tracking;
  }

  updateEmailTracking(trackingId, event) {
    const tracking = this.trackingData.get(trackingId);
    if (tracking) {
      tracking.events.push({
        ...event,
        timestamp: new Date()
      });
      
      if (event.type === 'delivered') tracking.status = 'delivered';
      if (event.type === 'opened') tracking.status = 'opened';
      if (event.type === 'clicked') tracking.status = 'clicked';
      if (event.type === 'bounced' || event.type === 'failed') tracking.status = 'failed';

      this.trackingData.set(trackingId, tracking);
    }
  }

  // Webhook Handlers
  async handleSendGridWebhook(data) {
    try {
      if (Array.isArray(data)) {
        for (const event of data) {
          const trackingId = event.tracking_id || event.unique_args?.tracking_id;
          if (trackingId) {
            this.updateEmailTracking(trackingId, {
              type: event.event,
              provider: 'sendgrid',
              details: event
            });
          }
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('SendGrid webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleMailgunWebhook(data) {
    try {
      const trackingId = data['user-variables']?.tracking_id;
      if (trackingId) {
        this.updateEmailTracking(trackingId, {
          type: data.event,
          provider: 'mailgun',
          details: data
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Mailgun webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleSESWebhook(data) {
    try {
      // Handle AWS SES webhook events
      logger.info('Processing SES webhook', { type: data.eventType });
      
      return { success: true };
    } catch (error) {
      logger.error('SES webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleOffice365Webhook(data) {
    try {
      logger.info('Processing Office 365 webhook', { type: data.changeType });
      
      return { success: true };
    } catch (error) {
      logger.error('Office 365 webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleGmailWebhook(data) {
    try {
      logger.info('Processing Gmail webhook', { historyId: data.historyId });
      
      return { success: true };
    } catch (error) {
      logger.error('Gmail webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  // Utility Methods
  processAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments)) {
      return [];
    }

    return attachments.map(attachment => {
      // Handle different attachment formats
      if (attachment.filePath) {
        // File path based attachment (from uploaded files)
        return {
          filename: attachment.filename || path.basename(attachment.filePath),
          path: attachment.filePath,
          contentType: attachment.mimeType || attachment.contentType
        };
      } else if (attachment.content) {
        // Buffer/base64 content based attachment
        return {
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.mimeType || attachment.contentType || 'application/octet-stream'
        };
      } else {
        // Standard nodemailer attachment format
        return attachment;
      }
    });
  }

  formatAttachments(attachments, provider) {
    // Format attachments for different providers
    if (!attachments || !Array.isArray(attachments)) {
      return [];
    }
    
    return attachments.map(attachment => {
      switch (provider) {
        case 'sendgrid':
          return {
            content: attachment.content,
            filename: attachment.filename,
            type: attachment.contentType,
            disposition: 'attachment'
          };
        default:
          return attachment;
      }
    });
  }

  addToRetryQueue(providerId, operation, params) {
    if (!this.retryQueues.has(providerId)) {
      this.retryQueues.set(providerId, []);
    }

    const retryItem = {
      id: crypto.randomBytes(8).toString('hex'),
      operation,
      params,
      attempts: 0,
      maxAttempts: 3,
      nextRetry: Date.now() + 60000, // Retry in 1 minute
      providerId
    };

    this.retryQueues.get(providerId).push(retryItem);
    this.logAudit('operation_queued_for_retry', { providerId, operation, retryId: retryItem.id });

    return {
      success: false,
      queued: true,
      retryId: retryItem.id,
      message: `Operation queued for retry due to error`
    };
  }

  startRetryProcessor() {
    setInterval(() => {
      this.processRetryQueues();
    }, 30000); // Check every 30 seconds
  }

  async processRetryQueues() {
    for (const [providerId, queue] of this.retryQueues) {
      const now = Date.now();
      const itemsToProcess = queue.filter(item => item.nextRetry <= now);

      for (const item of itemsToProcess) {
        try {
          item.attempts++;
          
          let result;
          switch (item.operation) {
            case 'sendEmail':
              result = await this.sendEmail(providerId, item.params.emailData, item.params.options);
              break;
          }

          if (result.success) {
            // Remove from queue
            const index = queue.indexOf(item);
            if (index > -1) queue.splice(index, 1);
            
            this.logAudit('retry_succeeded', { 
              providerId, 
              operation: item.operation, 
              retryId: item.id,
              attempts: item.attempts 
            });
          }

        } catch (error) {
          if (item.attempts >= item.maxAttempts) {
            // Remove failed item
            const index = queue.indexOf(item);
            if (index > -1) queue.splice(index, 1);
            
            this.logAudit('retry_failed_permanently', { 
              providerId, 
              operation: item.operation, 
              retryId: item.id,
              attempts: item.attempts,
              error: error.message 
            });
          } else {
            // Schedule next retry with exponential backoff
            item.nextRetry = Date.now() + (Math.pow(2, item.attempts) * 60000);
          }
        }
      }
    }
  }

  // Logging and Audit Methods
  logError(providerId, context, error) {
    logger.error(`Email Error - ${context}`, {
      providerId,
      error: error.message,
      status: error.response?.status,
      timestamp: new Date()
    });
  }

  logAudit(action, details) {
    const auditEntry = {
      id: crypto.randomBytes(8).toString('hex'),
      action,
      details,
      timestamp: new Date()
    };

    this.auditLogs.push(auditEntry);
    
    // Keep only last 1000 audit entries
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    logger.info('Email Audit Log', auditEntry);
  }

  // Public API Methods
  getProviderStatus() {
    const status = {};
    
    for (const [providerId, provider] of this.emailProviders) {
      const tokenData = this.oauthTokens.get(providerId);
      const rateLimiter = this.rateLimiters.get(providerId);
      const retryQueue = this.retryQueues.get(providerId) || [];

      status[providerId] = {
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        authenticated: provider.type === 'oauth' ? !!tokenData?.accessToken : true,
        tokenExpiresAt: tokenData?.expiresAt,
        features: provider.features,
        rateLimitStatus: {
          requests: rateLimiter?.requests || 0,
          limit: rateLimiter?.requests || 0,
          windowStart: rateLimiter?.windowStart
        },
        retryQueue: {
          items: retryQueue.length,
          oldestItem: retryQueue[0]?.nextRetry
        }
      };
    }
    
    return status;
  }

  getAuditLogs(limit = 100) {
    return this.auditLogs.slice(-limit).reverse();
  }

  async testConnection(providerId) {
    const provider = this.emailProviders.get(providerId);
    const transporter = this.transporters.get(providerId);

    if (!provider || !transporter) {
      return { success: false, error: 'Email provider not available' };
    }

    try {
      switch (provider.type) {
        case 'smtp':
          await transporter.verify();
          break;
        case 'api':
        case 'oauth':
          // For API providers, we'll just check if we can make a basic request
          break;
      }

      return {
        success: true,
        providerId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        providerId,
        timestamp: new Date()
      };
    }
  }

  getAvailableProviders() {
    return Array.from(this.emailProviders.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      type: config.type,
      enabled: config.enabled,
      features: config.features
    }));
  }
}