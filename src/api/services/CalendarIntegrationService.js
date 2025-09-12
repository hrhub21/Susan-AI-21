import axios from 'axios';
import crypto from 'crypto';
import EventEmitter from 'events';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Calendar Integration Service for Susan AI
 * Supports Google Calendar, Outlook, and other calendar systems
 * Provides comprehensive calendar functionality with OAuth, auto-scheduling, and event management
 */
export class CalendarIntegrationService extends EventEmitter {
  constructor() {
    super();
    
    // Core configuration
    this.calendars = new Map();
    this.clients = new Map();
    this.rateLimiters = new Map();
    this.oauthTokens = new Map();
    this.webhookHandlers = new Map();
    this.eventMappings = new Map();
    this.auditLogs = [];
    this.retryQueues = new Map();
    this.schedulingRules = new Map();
    
    // Rate limiting configurations
    this.rateLimits = {
      google: { requests: 1000, window: 60 * 1000 }, // 1000/minute
      outlook: { requests: 10000, window: 60 * 60 * 1000 }, // 10000/hour
      caldav: { requests: 500, window: 60 * 60 * 1000 }, // 500/hour
      exchange: { requests: 2000, window: 60 * 60 * 1000 } // 2000/hour
    };
    
    // Initialize calendar integrations
    this.initializeCalendars();
    this.setupRateLimiters();
    this.setupWebhookHandlers();
    this.setupEventMappings();
    this.setupSchedulingRules();
    this.startRetryProcessor();
  }

  initializeCalendars() {
    // Google Calendar Configuration
    this.calendars.set('google', {
      name: 'Google Calendar',
      type: 'google',
      enabled: !!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      config: {
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
        apiVersion: 'v3',
        timeout: 30000
      },
      endpoints: {
        oauth: 'https://oauth2.googleapis.com/token',
        calendars: 'https://www.googleapis.com/calendar/v3/calendars',
        events: 'https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events',
        freebusy: 'https://www.googleapis.com/calendar/v3/freeBusy',
        settings: 'https://www.googleapis.com/calendar/v3/users/me/settings'
      },
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
    });

    // Microsoft Outlook Configuration
    this.calendars.set('outlook', {
      name: 'Microsoft Outlook',
      type: 'outlook',
      enabled: !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET),
      config: {
        clientId: process.env.OUTLOOK_CLIENT_ID,
        clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
        redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/auth/outlook/callback',
        tenant: process.env.OUTLOOK_TENANT_ID || 'common',
        apiVersion: 'v1.0',
        timeout: 30000
      },
      endpoints: {
        oauth: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
        calendars: 'https://graph.microsoft.com/v1.0/me/calendars',
        events: 'https://graph.microsoft.com/v1.0/me/calendars/{calendarId}/events',
        freebusy: 'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
        settings: 'https://graph.microsoft.com/v1.0/me/mailboxSettings'
      },
      scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'https://graph.microsoft.com/Calendars.ReadWrite.Shared']
    });

    // CalDAV Configuration (for various calendar servers)
    this.calendars.set('caldav', {
      name: 'CalDAV Calendar',
      type: 'caldav',
      enabled: !!(process.env.CALDAV_BASE_URL && process.env.CALDAV_USERNAME),
      config: {
        baseUrl: process.env.CALDAV_BASE_URL,
        username: process.env.CALDAV_USERNAME,
        password: process.env.CALDAV_PASSWORD,
        timeout: 30000
      },
      endpoints: {
        calendars: '/.well-known/caldav',
        events: '/calendars/{username}/{calendarId}/',
        principal: '/principals/{username}/'
      }
    });

    // Exchange Server Configuration
    this.calendars.set('exchange', {
      name: 'Exchange Server',
      type: 'exchange',
      enabled: !!(process.env.EXCHANGE_SERVER_URL && process.env.EXCHANGE_USERNAME),
      config: {
        serverUrl: process.env.EXCHANGE_SERVER_URL,
        username: process.env.EXCHANGE_USERNAME,
        password: process.env.EXCHANGE_PASSWORD,
        domain: process.env.EXCHANGE_DOMAIN,
        timeout: 30000
      },
      endpoints: {
        ews: '/EWS/Exchange.asmx',
        autodiscover: '/autodiscover/autodiscover.xml'
      }
    });

    this.initializeClients();
  }

  initializeClients() {
    for (const [calendarId, calendar] of this.calendars) {
      if (calendar.enabled) {
        let baseURL = '';
        let headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'Susan-AI-Calendar-Integration/1.0'
        };

        switch (calendarId) {
          case 'google':
            baseURL = 'https://www.googleapis.com';
            break;
          case 'outlook':
            baseURL = 'https://graph.microsoft.com';
            break;
          case 'caldav':
            baseURL = calendar.config.baseUrl;
            headers['Authorization'] = `Basic ${Buffer.from(`${calendar.config.username}:${calendar.config.password}`).toString('base64')}`;
            headers['Content-Type'] = 'application/xml';
            break;
          case 'exchange':
            baseURL = calendar.config.serverUrl;
            headers['Authorization'] = `Basic ${Buffer.from(`${calendar.config.domain}\\${calendar.config.username}:${calendar.config.password}`).toString('base64')}`;
            headers['Content-Type'] = 'text/xml';
            break;
        }

        const client = axios.create({
          baseURL,
          timeout: calendar.config.timeout || 30000,
          headers
        });

        // Add request interceptor for rate limiting and logging
        client.interceptors.request.use(
          async (config) => {
            await this.checkRateLimit(calendarId);
            this.logRequest(calendarId, config);
            return config;
          },
          (error) => {
            this.logError(calendarId, 'Request Error', error);
            return Promise.reject(error);
          }
        );

        // Add response interceptor for error handling and retry logic
        client.interceptors.response.use(
          (response) => {
            this.logResponse(calendarId, response);
            return response;
          },
          async (error) => {
            this.logError(calendarId, 'Response Error', error);
            
            // Handle rate limiting
            if (error.response?.status === 429) {
              return this.handleRateLimit(calendarId, error.config);
            }
            
            // Handle OAuth token expiration
            if (error.response?.status === 401) {
              return this.handleAuthError(calendarId, error.config);
            }
            
            return Promise.reject(error);
          }
        );

        this.clients.set(calendarId, client);
        logger.info(`Calendar client initialized: ${calendar.name}`);
      }
    }
  }

  setupRateLimiters() {
    for (const [calendarId, limits] of Object.entries(this.rateLimits)) {
      this.rateLimiters.set(calendarId, {
        requests: 0,
        windowStart: Date.now(),
        ...limits
      });
    }
  }

  async checkRateLimit(calendarId) {
    const limiter = this.rateLimiters.get(calendarId);
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
      throw new ApiError(`Rate limit exceeded for ${calendarId}. Wait ${Math.ceil(waitTime / 1000)} seconds.`, 429);
    }

    limiter.requests++;
  }

  async handleRateLimit(calendarId, originalConfig) {
    const retryAfter = parseInt(originalConfig.response?.headers['retry-after']) || 60;
    logger.warn(`Rate limited by ${calendarId}. Retrying after ${retryAfter} seconds.`);
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const client = this.clients.get(calendarId);
          const response = await client.request(originalConfig);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, retryAfter * 1000);
    });
  }

  async handleAuthError(calendarId, originalConfig) {
    try {
      await this.refreshToken(calendarId);
      const client = this.clients.get(calendarId);
      return client.request(originalConfig);
    } catch (error) {
      logger.error(`Failed to refresh token for ${calendarId}`, error);
      throw new ApiError(`Authentication failed for ${calendarId}. Please re-authenticate.`, 401);
    }
  }

  setupWebhookHandlers() {
    this.webhookHandlers.set('google', this.handleGoogleWebhook.bind(this));
    this.webhookHandlers.set('outlook', this.handleOutlookWebhook.bind(this));
    this.webhookHandlers.set('caldav', this.handleCalDAVWebhook.bind(this));
    this.webhookHandlers.set('exchange', this.handleExchangeWebhook.bind(this));
  }

  setupEventMappings() {
    // Google Calendar event mapper
    this.eventMappings.set('google', {
      toSusan: (googleEvent) => ({
        id: googleEvent.id,
        title: googleEvent.summary,
        description: googleEvent.description,
        startTime: googleEvent.start?.dateTime || googleEvent.start?.date,
        endTime: googleEvent.end?.dateTime || googleEvent.end?.date,
        location: googleEvent.location,
        attendees: googleEvent.attendees?.map(att => ({
          email: att.email,
          name: att.displayName,
          status: att.responseStatus
        })) || [],
        recurrence: googleEvent.recurrence,
        reminders: googleEvent.reminders,
        createdAt: googleEvent.created,
        updatedAt: googleEvent.updated,
        calendarId: googleEvent.organizer?.email
      }),
      fromSusan: (susanEvent) => ({
        summary: susanEvent.title,
        description: susanEvent.description,
        start: susanEvent.startTime ? {
          dateTime: susanEvent.startTime,
          timeZone: susanEvent.timeZone || 'UTC'
        } : undefined,
        end: susanEvent.endTime ? {
          dateTime: susanEvent.endTime,
          timeZone: susanEvent.timeZone || 'UTC'
        } : undefined,
        location: susanEvent.location,
        attendees: susanEvent.attendees?.map(att => ({
          email: att.email,
          displayName: att.name
        })),
        recurrence: susanEvent.recurrence,
        reminders: susanEvent.reminders
      })
    });

    // Outlook event mapper
    this.eventMappings.set('outlook', {
      toSusan: (outlookEvent) => ({
        id: outlookEvent.id,
        title: outlookEvent.subject,
        description: outlookEvent.body?.content,
        startTime: outlookEvent.start?.dateTime,
        endTime: outlookEvent.end?.dateTime,
        location: outlookEvent.location?.displayName,
        attendees: outlookEvent.attendees?.map(att => ({
          email: att.emailAddress?.address,
          name: att.emailAddress?.name,
          status: att.status?.response
        })) || [],
        recurrence: outlookEvent.recurrence,
        reminders: outlookEvent.reminderMinutesBeforeStart,
        createdAt: outlookEvent.createdDateTime,
        updatedAt: outlookEvent.lastModifiedDateTime,
        calendarId: outlookEvent.organizer?.emailAddress?.address
      }),
      fromSusan: (susanEvent) => ({
        subject: susanEvent.title,
        body: {
          contentType: 'HTML',
          content: susanEvent.description
        },
        start: susanEvent.startTime ? {
          dateTime: susanEvent.startTime,
          timeZone: susanEvent.timeZone || 'UTC'
        } : undefined,
        end: susanEvent.endTime ? {
          dateTime: susanEvent.endTime,
          timeZone: susanEvent.timeZone || 'UTC'
        } : undefined,
        location: {
          displayName: susanEvent.location
        },
        attendees: susanEvent.attendees?.map(att => ({
          emailAddress: {
            address: att.email,
            name: att.name
          }
        })),
        recurrence: susanEvent.recurrence,
        reminderMinutesBeforeStart: susanEvent.reminders?.overrides?.[0]?.minutes
      })
    });
  }

  setupSchedulingRules() {
    // Default scheduling rules
    this.schedulingRules.set('default', {
      workingHours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
        saturday: null,
        sunday: null
      },
      timeZone: 'UTC',
      bufferTime: 15, // minutes
      maxMeetingDuration: 480, // 8 hours
      allowWeekends: false,
      allowEvenings: false
    });

    // Load custom scheduling rules from environment
    if (process.env.SCHEDULING_RULES) {
      try {
        const customRules = JSON.parse(process.env.SCHEDULING_RULES);
        this.schedulingRules.set('custom', customRules);
      } catch (error) {
        logger.warn('Failed to parse custom scheduling rules', error);
      }
    }
  }

  // OAuth Authentication Methods
  async initiateOAuthFlow(calendarId, state = null) {
    const calendar = this.calendars.get(calendarId);
    if (!calendar) {
      throw new ApiError(`Calendar integration ${calendarId} not found`, 404);
    }

    let authUrl = '';
    const stateParam = state || crypto.randomBytes(16).toString('hex');

    switch (calendarId) {
      case 'google':
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `response_type=code&` +
          `client_id=${calendar.config.clientId}&` +
          `redirect_uri=${encodeURIComponent(calendar.config.redirectUri)}&` +
          `scope=${calendar.scopes.join('%20')}&` +
          `state=${stateParam}&` +
          `access_type=offline&` +
          `prompt=consent`;
        break;

      case 'outlook':
        const tenantUrl = calendar.endpoints.oauth.replace('{tenant}', calendar.config.tenant);
        authUrl = `https://login.microsoftonline.com/${calendar.config.tenant}/oauth2/v2.0/authorize?` +
          `response_type=code&` +
          `client_id=${calendar.config.clientId}&` +
          `redirect_uri=${encodeURIComponent(calendar.config.redirectUri)}&` +
          `scope=${calendar.scopes.join('%20')}&` +
          `state=${stateParam}&` +
          `response_mode=query`;
        break;

      default:
        throw new ApiError(`OAuth not supported for ${calendarId}`, 400);
    }

    this.logAudit('oauth_initiated', { calendarId, state: stateParam });
    return { authUrl, state: stateParam };
  }

  async exchangeCodeForToken(calendarId, code, state) {
    const calendar = this.calendars.get(calendarId);
    if (!calendar) {
      throw new ApiError(`Calendar integration ${calendarId} not found`, 404);
    }

    const client = this.clients.get(calendarId);
    let tokenData = null;

    try {
      switch (calendarId) {
        case 'google':
          const googleResponse = await axios.post(calendar.endpoints.oauth, {
            grant_type: 'authorization_code',
            client_id: calendar.config.clientId,
            client_secret: calendar.config.clientSecret,
            redirect_uri: calendar.config.redirectUri,
            code
          });
          
          tokenData = {
            accessToken: googleResponse.data.access_token,
            refreshToken: googleResponse.data.refresh_token,
            expiresAt: Date.now() + (googleResponse.data.expires_in * 1000),
            scope: googleResponse.data.scope
          };
          break;

        case 'outlook':
          const tenantUrl = calendar.endpoints.oauth.replace('{tenant}', calendar.config.tenant);
          const outlookResponse = await axios.post(tenantUrl, {
            grant_type: 'authorization_code',
            client_id: calendar.config.clientId,
            client_secret: calendar.config.clientSecret,
            redirect_uri: calendar.config.redirectUri,
            code,
            scope: calendar.scopes.join(' ')
          }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          
          tokenData = {
            accessToken: outlookResponse.data.access_token,
            refreshToken: outlookResponse.data.refresh_token,
            expiresAt: Date.now() + (outlookResponse.data.expires_in * 1000),
            scope: outlookResponse.data.scope
          };
          break;

        default:
          throw new ApiError(`OAuth not supported for ${calendarId}`, 400);
      }

      this.oauthTokens.set(calendarId, tokenData);
      this.updateClientAuth(calendarId, tokenData);
      this.logAudit('oauth_completed', { calendarId, state });

      return { success: true, calendarId, authenticated: true };

    } catch (error) {
      this.logError(calendarId, 'OAuth Exchange Failed', error);
      throw new ApiError(`OAuth token exchange failed for ${calendarId}: ${error.message}`, 400);
    }
  }

  async refreshToken(calendarId) {
    const tokenData = this.oauthTokens.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!tokenData?.refreshToken || !calendar) {
      throw new ApiError(`No refresh token available for ${calendarId}`, 401);
    }

    try {
      let response;
      switch (calendarId) {
        case 'google':
          response = await axios.post(calendar.endpoints.oauth, {
            grant_type: 'refresh_token',
            client_id: calendar.config.clientId,
            client_secret: calendar.config.clientSecret,
            refresh_token: tokenData.refreshToken
          });
          
          tokenData.accessToken = response.data.access_token;
          tokenData.expiresAt = Date.now() + (response.data.expires_in * 1000);
          if (response.data.refresh_token) {
            tokenData.refreshToken = response.data.refresh_token;
          }
          break;

        case 'outlook':
          const tenantUrl = calendar.endpoints.oauth.replace('{tenant}', calendar.config.tenant);
          response = await axios.post(tenantUrl, {
            grant_type: 'refresh_token',
            client_id: calendar.config.clientId,
            client_secret: calendar.config.clientSecret,
            refresh_token: tokenData.refreshToken
          });
          
          tokenData.accessToken = response.data.access_token;
          tokenData.expiresAt = Date.now() + (response.data.expires_in * 1000);
          if (response.data.refresh_token) {
            tokenData.refreshToken = response.data.refresh_token;
          }
          break;
      }

      this.updateClientAuth(calendarId, tokenData);
      this.logAudit('token_refreshed', { calendarId });
      
    } catch (error) {
      this.logError(calendarId, 'Token Refresh Failed', error);
      throw new ApiError(`Token refresh failed for ${calendarId}`, 401);
    }
  }

  updateClientAuth(calendarId, tokenData) {
    const client = this.clients.get(calendarId);
    if (client && tokenData) {
      client.defaults.headers.Authorization = `Bearer ${tokenData.accessToken}`;
    }
  }

  // Calendar Management Methods
  async listCalendars(calendarId) {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!client || !calendar) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      let response;

      switch (calendarId) {
        case 'google':
          response = await client.get('/calendar/v3/users/me/calendarList');
          break;
        case 'outlook':
          response = await client.get('/v1.0/me/calendars');
          break;
        default:
          throw new ApiError(`List calendars not supported for ${calendarId}`, 400);
      }

      const calendars = this.transformCalendarList(calendarId, response.data);
      this.logAudit('calendars_listed', { calendarId, count: calendars.length });

      return {
        success: true,
        data: calendars,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'List Calendars Failed', error);
      throw new ApiError(`Failed to list calendars from ${calendarId}: ${error.message}`, error.response?.status || 500);
    }
  }

  // Event Management Methods
  async createEvent(calendarId, eventData, targetCalendarId = 'primary') {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);
    const mapper = this.eventMappings.get(calendarId);

    if (!client || !calendar || !mapper) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      const mappedData = mapper.fromSusan(eventData);
      let response;

      switch (calendarId) {
        case 'google':
          const googleUrl = calendar.endpoints.events.replace('{calendarId}', targetCalendarId);
          response = await client.post(googleUrl, mappedData);
          break;
        case 'outlook':
          const outlookUrl = targetCalendarId === 'primary' 
            ? '/v1.0/me/events' 
            : `/v1.0/me/calendars/${targetCalendarId}/events`;
          response = await client.post(outlookUrl, mappedData);
          break;
        default:
          throw new ApiError(`Create event not supported for ${calendarId}`, 400);
      }

      const createdEvent = this.transformEventData(calendarId, response.data);
      this.logAudit('event_created', { calendarId, eventId: createdEvent.id, targetCalendarId });

      return {
        success: true,
        data: createdEvent,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'Event Creation Failed', error);
      return this.addToRetryQueue(calendarId, 'createEvent', { eventData, targetCalendarId });
    }
  }

  async updateEvent(calendarId, eventId, eventData, targetCalendarId = 'primary') {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);
    const mapper = this.eventMappings.get(calendarId);

    if (!client || !calendar || !mapper) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      const mappedData = mapper.fromSusan(eventData);
      let response;

      switch (calendarId) {
        case 'google':
          const googleUrl = `${calendar.endpoints.events.replace('{calendarId}', targetCalendarId)}/${eventId}`;
          response = await client.put(googleUrl, mappedData);
          break;
        case 'outlook':
          response = await client.patch(`/v1.0/me/events/${eventId}`, mappedData);
          break;
        default:
          throw new ApiError(`Update event not supported for ${calendarId}`, 400);
      }

      const updatedEvent = this.transformEventData(calendarId, response.data);
      this.logAudit('event_updated', { calendarId, eventId, targetCalendarId });

      return {
        success: true,
        data: updatedEvent,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'Event Update Failed', error);
      return this.addToRetryQueue(calendarId, 'updateEvent', { eventId, eventData, targetCalendarId });
    }
  }

  async deleteEvent(calendarId, eventId, targetCalendarId = 'primary') {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!client || !calendar) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      switch (calendarId) {
        case 'google':
          const googleUrl = `${calendar.endpoints.events.replace('{calendarId}', targetCalendarId)}/${eventId}`;
          await client.delete(googleUrl);
          break;
        case 'outlook':
          await client.delete(`/v1.0/me/events/${eventId}`);
          break;
        default:
          throw new ApiError(`Delete event not supported for ${calendarId}`, 400);
      }

      this.logAudit('event_deleted', { calendarId, eventId, targetCalendarId });

      return {
        success: true,
        eventId,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'Event Deletion Failed', error);
      throw new ApiError(`Failed to delete event from ${calendarId}: ${error.message}`, error.response?.status || 500);
    }
  }

  async getEvent(calendarId, eventId, targetCalendarId = 'primary') {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!client || !calendar) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      let response;

      switch (calendarId) {
        case 'google':
          const googleUrl = `${calendar.endpoints.events.replace('{calendarId}', targetCalendarId)}/${eventId}`;
          response = await client.get(googleUrl);
          break;
        case 'outlook':
          response = await client.get(`/v1.0/me/events/${eventId}`);
          break;
        default:
          throw new ApiError(`Get event not supported for ${calendarId}`, 400);
      }

      const event = this.transformEventData(calendarId, response.data);
      this.logAudit('event_retrieved', { calendarId, eventId, targetCalendarId });

      return {
        success: true,
        data: event,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'Event Retrieval Failed', error);
      throw new ApiError(`Failed to retrieve event from ${calendarId}: ${error.message}`, error.response?.status || 500);
    }
  }

  async listEvents(calendarId, options = {}, targetCalendarId = 'primary') {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!client || !calendar) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      let response;
      const { startTime, endTime, maxResults = 50, query } = options;

      switch (calendarId) {
        case 'google':
          const googleUrl = calendar.endpoints.events.replace('{calendarId}', targetCalendarId);
          const googleParams = {
            maxResults,
            singleEvents: true,
            orderBy: 'startTime'
          };
          if (startTime) googleParams.timeMin = startTime;
          if (endTime) googleParams.timeMax = endTime;
          if (query) googleParams.q = query;
          
          response = await client.get(googleUrl, { params: googleParams });
          break;
          
        case 'outlook':
          const outlookUrl = targetCalendarId === 'primary' 
            ? '/v1.0/me/events' 
            : `/v1.0/me/calendars/${targetCalendarId}/events`;
          const outlookParams = {
            $top: maxResults,
            $orderby: 'start/dateTime'
          };
          if (startTime || endTime) {
            const filters = [];
            if (startTime) filters.push(`start/dateTime ge '${startTime}'`);
            if (endTime) filters.push(`end/dateTime le '${endTime}'`);
            outlookParams.$filter = filters.join(' and ');
          }
          if (query) outlookParams.$search = `"${query}"`;
          
          response = await client.get(outlookUrl, { params: outlookParams });
          break;
          
        default:
          throw new ApiError(`List events not supported for ${calendarId}`, 400);
      }

      const events = this.transformEventList(calendarId, response.data);
      this.logAudit('events_listed', { calendarId, count: events.length, targetCalendarId });

      return {
        success: true,
        data: events,
        total: events.length,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'List Events Failed', error);
      throw new ApiError(`Failed to list events from ${calendarId}: ${error.message}`, error.response?.status || 500);
    }
  }

  // Auto-scheduling Methods
  async findAvailableSlots(calendarId, options = {}) {
    const {
      duration = 60, // minutes
      startDate = new Date(),
      endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      attendees = [],
      rulesId = 'default'
    } = options;

    const rules = this.schedulingRules.get(rulesId);
    if (!rules) {
      throw new ApiError(`Scheduling rules ${rulesId} not found`, 400);
    }

    try {
      // Get busy times for the primary calendar and attendees
      const busyTimes = await this.getBusyTimes(calendarId, {
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        attendees
      });

      // Generate available slots based on rules
      const availableSlots = this.generateAvailableSlots(
        startDate,
        endDate,
        duration,
        busyTimes,
        rules
      );

      this.logAudit('slots_found', { 
        calendarId, 
        duration, 
        slotsCount: availableSlots.length,
        attendeesCount: attendees.length 
      });

      return {
        success: true,
        data: availableSlots,
        duration,
        rulesUsed: rulesId,
        calendarId
      };

    } catch (error) {
      this.logError(calendarId, 'Find Available Slots Failed', error);
      throw new ApiError(`Failed to find available slots: ${error.message}`, error.response?.status || 500);
    }
  }

  async getBusyTimes(calendarId, options = {}) {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!client || !calendar) {
      throw new ApiError(`Calendar ${calendarId} not available`, 400);
    }

    try {
      let response;
      const { startTime, endTime, attendees = [] } = options;

      switch (calendarId) {
        case 'google':
          const googlePayload = {
            timeMin: startTime,
            timeMax: endTime,
            items: [
              { id: 'primary' },
              ...attendees.map(email => ({ id: email }))
            ]
          };
          response = await client.post('/calendar/v3/freeBusy', googlePayload);
          break;
          
        case 'outlook':
          const outlookPayload = {
            Schedules: ['primary', ...attendees],
            StartTime: {
              DateTime: startTime,
              TimeZone: 'UTC'
            },
            EndTime: {
              DateTime: endTime,
              TimeZone: 'UTC'
            },
            AvailabilityViewInterval: 60
          };
          response = await client.post('/v1.0/me/calendar/getSchedule', outlookPayload);
          break;
          
        default:
          throw new ApiError(`Get busy times not supported for ${calendarId}`, 400);
      }

      const busyTimes = this.transformBusyTimes(calendarId, response.data);
      return busyTimes;

    } catch (error) {
      this.logError(calendarId, 'Get Busy Times Failed', error);
      throw new ApiError(`Failed to get busy times from ${calendarId}: ${error.message}`, error.response?.status || 500);
    }
  }

  generateAvailableSlots(startDate, endDate, duration, busyTimes, rules) {
    const slots = [];
    const currentDate = new Date(startDate);
    const durationMs = duration * 60 * 1000;
    const bufferMs = rules.bufferTime * 60 * 1000;

    while (currentDate < endDate) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
      const workingDay = rules.workingHours[dayName];

      if (workingDay) {
        const [startHour, startMinute] = workingDay.start.split(':').map(Number);
        const [endHour, endMinute] = workingDay.end.split(':').map(Number);

        const dayStart = new Date(currentDate);
        dayStart.setHours(startHour, startMinute, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(endHour, endMinute, 0, 0);

        let slotStart = new Date(dayStart);

        while (slotStart.getTime() + durationMs <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + durationMs);

          // Check if slot conflicts with busy times
          const hasConflict = busyTimes.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            return (slotStart < busyEnd && slotEnd > busyStart);
          });

          if (!hasConflict) {
            slots.push({
              start: new Date(slotStart).toISOString(),
              end: new Date(slotEnd).toISOString(),
              duration: duration,
              available: true
            });
          }

          // Move to next slot with buffer
          slotStart = new Date(slotStart.getTime() + durationMs + bufferMs);
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return slots.slice(0, 20); // Limit to first 20 slots
  }

  async scheduleEvent(calendarId, eventData, options = {}) {
    const { autoFind = false, rulesId = 'default' } = options;

    try {
      let finalEventData = { ...eventData };

      // Auto-find slot if requested and no time specified
      if (autoFind && (!eventData.startTime || !eventData.endTime)) {
        const duration = eventData.duration || 60;
        const availableSlots = await this.findAvailableSlots(calendarId, {
          duration,
          attendees: eventData.attendees?.map(att => att.email) || [],
          rulesId
        });

        if (availableSlots.data.length === 0) {
          throw new ApiError('No available slots found for the requested meeting', 400);
        }

        const bestSlot = availableSlots.data[0];
        finalEventData.startTime = bestSlot.start;
        finalEventData.endTime = bestSlot.end;
      }

      // Create the event
      const result = await this.createEvent(calendarId, finalEventData, options.targetCalendarId);
      
      if (result.success && eventData.attendees?.length > 0) {
        // Send calendar invitations
        await this.sendInvitations(calendarId, result.data, eventData.attendees);
      }

      this.logAudit('event_scheduled', { 
        calendarId, 
        eventId: result.data?.id,
        autoFind,
        attendeesCount: eventData.attendees?.length || 0
      });

      return result;

    } catch (error) {
      this.logError(calendarId, 'Schedule Event Failed', error);
      throw new ApiError(`Failed to schedule event: ${error.message}`, error.response?.status || 500);
    }
  }

  async sendInvitations(calendarId, event, attendees) {
    // Implementation depends on the calendar system
    // This would typically be handled automatically by the calendar service
    // when attendees are added to the event
    this.logAudit('invitations_sent', { 
      calendarId, 
      eventId: event.id,
      attendeesCount: attendees.length
    });
  }

  // Webhook Handlers
  async handleGoogleWebhook(data) {
    try {
      logger.info('Processing Google Calendar webhook', { 
        resourceId: data.resourceId, 
        resourceState: data.resourceState 
      });
      
      this.emit('calendar_event_updated', {
        calendarId: 'google',
        type: data.resourceState,
        resourceId: data.resourceId,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('Google Calendar webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleOutlookWebhook(data) {
    try {
      logger.info('Processing Outlook webhook', { 
        changeType: data.changeType, 
        resource: data.resource 
      });
      
      this.emit('calendar_event_updated', {
        calendarId: 'outlook',
        type: data.changeType,
        resource: data.resource,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('Outlook webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleCalDAVWebhook(data) {
    try {
      logger.info('Processing CalDAV webhook', { type: data.type, href: data.href });
      
      this.emit('calendar_event_updated', {
        calendarId: 'caldav',
        type: data.type,
        href: data.href,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('CalDAV webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleExchangeWebhook(data) {
    try {
      logger.info('Processing Exchange webhook', { eventType: data.eventType, itemId: data.itemId });
      
      this.emit('calendar_event_updated', {
        calendarId: 'exchange',
        type: data.eventType,
        itemId: data.itemId,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('Exchange webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  // Utility Methods
  transformEventData(calendarId, data) {
    const mapper = this.eventMappings.get(calendarId);
    if (mapper && mapper.toSusan) {
      return mapper.toSusan(data);
    }
    return data;
  }

  transformEventList(calendarId, data) {
    let events = [];
    
    switch (calendarId) {
      case 'google':
        events = data.items || [];
        break;
      case 'outlook':
        events = data.value || [];
        break;
      default:
        events = Array.isArray(data) ? data : data.events || [];
    }

    return events.map(event => this.transformEventData(calendarId, event));
  }

  transformCalendarList(calendarId, data) {
    let calendars = [];
    
    switch (calendarId) {
      case 'google':
        calendars = data.items || [];
        break;
      case 'outlook':
        calendars = data.value || [];
        break;
      default:
        calendars = Array.isArray(data) ? data : data.calendars || [];
    }

    return calendars.map(cal => ({
      id: cal.id,
      name: cal.summary || cal.name,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole || 'reader'
    }));
  }

  transformBusyTimes(calendarId, data) {
    const busyTimes = [];
    
    switch (calendarId) {
      case 'google':
        Object.values(data.calendars || {}).forEach(calendar => {
          if (calendar.busy) {
            calendar.busy.forEach(period => {
              busyTimes.push({
                start: period.start,
                end: period.end
              });
            });
          }
        });
        break;
        
      case 'outlook':
        if (data.value) {
          data.value.forEach(schedule => {
            if (schedule.BusyViewData) {
              // Parse Outlook busy view data
              // This is a simplified implementation
              busyTimes.push({
                start: schedule.StartTime?.DateTime,
                end: schedule.EndTime?.DateTime
              });
            }
          });
        }
        break;
    }

    return busyTimes;
  }

  addToRetryQueue(calendarId, operation, params) {
    if (!this.retryQueues.has(calendarId)) {
      this.retryQueues.set(calendarId, []);
    }

    const retryItem = {
      id: crypto.randomBytes(8).toString('hex'),
      operation,
      params,
      attempts: 0,
      maxAttempts: 3,
      nextRetry: Date.now() + 60000, // Retry in 1 minute
      calendarId
    };

    this.retryQueues.get(calendarId).push(retryItem);
    this.logAudit('operation_queued_for_retry', { calendarId, operation, retryId: retryItem.id });

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
    for (const [calendarId, queue] of this.retryQueues) {
      const now = Date.now();
      const itemsToProcess = queue.filter(item => item.nextRetry <= now);

      for (const item of itemsToProcess) {
        try {
          item.attempts++;
          
          let result;
          switch (item.operation) {
            case 'createEvent':
              result = await this.createEvent(calendarId, item.params.eventData, item.params.targetCalendarId);
              break;
            case 'updateEvent':
              result = await this.updateEvent(calendarId, item.params.eventId, item.params.eventData, item.params.targetCalendarId);
              break;
          }

          if (result.success) {
            // Remove from queue
            const index = queue.indexOf(item);
            if (index > -1) queue.splice(index, 1);
            
            this.logAudit('retry_succeeded', { 
              calendarId, 
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
              calendarId, 
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
  logRequest(calendarId, config) {
    logger.debug('Calendar API Request', {
      calendarId,
      method: config.method?.toUpperCase(),
      url: config.url,
      timestamp: new Date()
    });
  }

  logResponse(calendarId, response) {
    logger.debug('Calendar API Response', {
      calendarId,
      status: response.status,
      timestamp: new Date()
    });
  }

  logError(calendarId, context, error) {
    logger.error(`Calendar Error - ${context}`, {
      calendarId,
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

    logger.info('Calendar Audit Log', auditEntry);
  }

  // Public API Methods
  getCalendarStatus() {
    const status = {};
    
    for (const [calendarId, calendar] of this.calendars) {
      const tokenData = this.oauthTokens.get(calendarId);
      const rateLimiter = this.rateLimiters.get(calendarId);
      const retryQueue = this.retryQueues.get(calendarId) || [];

      status[calendarId] = {
        name: calendar.name,
        type: calendar.type,
        enabled: calendar.enabled,
        authenticated: !!tokenData?.accessToken,
        tokenExpiresAt: tokenData?.expiresAt,
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

  async testConnection(calendarId) {
    const client = this.clients.get(calendarId);
    const calendar = this.calendars.get(calendarId);

    if (!client || !calendar) {
      return { success: false, error: 'Calendar integration not available' };
    }

    try {
      let response;
      
      switch (calendarId) {
        case 'google':
          response = await client.get('/calendar/v3/users/me/settings');
          break;
        case 'outlook':
          response = await client.get('/v1.0/me/mailboxSettings');
          break;
        default:
          throw new Error(`Test connection not implemented for ${calendarId}`);
      }

      return {
        success: true,
        status: response.status,
        calendarId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        calendarId,
        timestamp: new Date()
      };
    }
  }

  getAvailableCalendars() {
    return Array.from(this.calendars.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      type: config.type,
      enabled: config.enabled
    }));
  }

  getSchedulingRules(rulesId = null) {
    if (rulesId) {
      return this.schedulingRules.get(rulesId);
    }
    return Object.fromEntries(this.schedulingRules);
  }

  setSchedulingRules(rulesId, rules) {
    this.schedulingRules.set(rulesId, rules);
    this.logAudit('scheduling_rules_updated', { rulesId });
  }
}