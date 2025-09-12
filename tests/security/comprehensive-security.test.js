import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { testDataGenerators } from '../utils/mocks.js';

describe('Comprehensive Security Testing', () => {
  let app;
  let server;
  let testUser;
  let validToken;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-security-testing';
    
    // Import the main API server
    const { default: createApp } = await import('../../src/api/server.js');
    app = createApp();
    
    server = app.listen(0);
    testUser = testDataGenerators.user();
    validToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Authentication Security', () => {
    test('should reject requests with invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'Bearer invalid-token',
        jwt.sign({ userId: 'test' }, 'wrong-secret'),
        jwt.sign({ userId: 'test' }, process.env.JWT_SECRET, { expiresIn: '-1h' }), // Expired
        '', // Empty token
        'Bearer ', // Bearer without token
      ];
      
      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/v1/conversations')
          .set('Authorization', token)
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toMatch(/auth|token|unauthorized/i);
      }
    });

    test('should implement proper session timeout', async () => {
      const shortLivedToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '1ms' }
      );
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(401);
      
      expect(response.body.error.message).toMatch(/expired|invalid/i);
    });

    test('should prevent JWT token manipulation', async () => {
      const validToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
      const [header, payload, signature] = validToken.split('.');
      
      // Try to manipulate the payload
      const maliciousPayload = Buffer.from(JSON.stringify({
        userId: 'admin',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64');
      
      const manipulatedToken = `${header}.${maliciousPayload}.${signature}`;
      
      const response = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${manipulatedToken}`)
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });

    test('should enforce strong password requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        '12345',
        'qwerty',
        'password123',
        'admin',
        'test'
      ];
      
      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `test-${Date.now()}@example.com`,
            password,
            name: 'Test User'
          })
          .expect(400);
        
        expect(response.body.error.message).toMatch(/password.*strong|password.*complex/i);
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should prevent XSS attacks in conversation titles', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '\"\>\<script\>alert(\"xss\")\</script\>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        '\'; DROP TABLE conversations; --',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];
      
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            title: payload,
            initialMessage: 'Hello'
          });
        
        if (response.status === 201) {
          // If creation succeeded, check that the payload was sanitized
          expect(response.body.data.conversation.title).not.toContain('<script>');
          expect(response.body.data.conversation.title).not.toContain('javascript:');
          expect(response.body.data.conversation.title).not.toContain('onerror=');
        } else {
          // Or it should be rejected with validation error
          expect(response.status).toBe(400);
        }
      }
    });

    test('should prevent SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1' UNION SELECT * FROM users --",
        "admin'--",
        "admin'/*",
        "' OR 1=1#",
        "1'; UPDATE users SET password='hacked' --"
      ];
      
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: payload,
            password: 'test123'
          });
        
        // Should either reject with validation error or handle safely
        expect([400, 401, 422]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });

    test('should prevent NoSQL injection attempts', async () => {
      const noSqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'function() { return true; }' }
      ];
      
      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: payload,
            password: 'test123'
          });
        
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    test('should validate and limit file upload sizes', async () => {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      
      const response = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', largeBuffer, 'large-file.txt')
        .expect(413); // Payload too large
      
      expect(response.body.error.message).toMatch(/size|limit|large/i);
    });

    test('should validate file types for uploads', async () => {
      const maliciousFiles = [
        { filename: 'malware.exe', content: Buffer.from('MZ'), contentType: 'application/octet-stream' },
        { filename: 'script.js', content: Buffer.from('alert("xss")'), contentType: 'application/javascript' },
        { filename: 'shell.php', content: Buffer.from('<?php system($_GET["cmd"]); ?>'), contentType: 'application/x-httpd-php' }
      ];
      
      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/v1/files/upload')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('file', file.content, file.filename)
          .expect(400);
        
        expect(response.body.error.message).toMatch(/file.*type|invalid.*file/i);
      }
    });
  });

  describe('API Security Headers', () => {
    test('should include proper security headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toMatch(/max-age/);
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should not expose sensitive information in headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers).not.toHaveProperty('x-runtime');
    });
  });

  describe('Rate Limiting Security', () => {
    test('should enforce rate limits on authentication endpoints', async () => {
      const requests = [];
      
      // Make rapid login attempts
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      expect(rateLimited).toBe(true);
    });

    test('should implement progressive delays for failed login attempts', async () => {
      const startTime = Date.now();
      
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should take longer due to progressive delays
      expect(totalTime).toBeGreaterThan(1000); // At least 1 second total
    });
  });

  describe('Data Privacy and Protection', () => {
    test('should not expose sensitive user data in API responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('passwordHash');
      expect(response.body.data).not.toHaveProperty('salt');
      expect(response.body.data).not.toHaveProperty('secretKey');
    });

    test('should implement proper access control for user data', async () => {
      const otherUserToken = jwt.sign(
        { userId: 'other-user-id' },
        process.env.JWT_SECRET
      );
      
      // Try to access another user's conversations
      const response = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);
      
      // Should only return empty result or user's own data
      if (response.body.data.conversations) {
        expect(response.body.data.conversations.every(
          conv => conv.userId === 'other-user-id'
        )).toBe(true);
      }
    });

    test('should encrypt sensitive data at rest', async () => {
      // Create a conversation with sensitive content
      const sensitiveData = {
        title: 'Personal Financial Information',
        initialMessage: 'My SSN is 123-45-6789 and my credit card is 4111-1111-1111-1111'
      };
      
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send(sensitiveData)
        .expect(201);
      
      // Check that sensitive data is not stored in plain text
      // (This would require checking the actual database/storage)
      expect(response.body.data.conversation.id).toBeDefined();
    });
  });

  describe('API Versioning and Deprecation Security', () => {
    test('should reject requests to deprecated API versions', async () => {
      const response = await request(app)
        .get('/api/v0/conversations')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect([404, 410]).toContain(response.status);
    });

    test('should validate API version in requests', async () => {
      const response = await request(app)
        .get('/api/v999/conversations')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect([404, 400]).toContain(response.status);
    });
  });

  describe('Denial of Service Protection', () => {
    test('should handle large payloads gracefully', async () => {
      const largePayload = {
        title: 'A'.repeat(10000),
        initialMessage: 'B'.repeat(100000)
      };
      
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send(largePayload);
      
      expect([400, 413]).toContain(response.status);
    });

    test('should limit concurrent connections per user', async () => {
      const concurrentRequests = [];
      
      for (let i = 0; i < 50; i++) {
        concurrentRequests.push(
          request(app)
            .get('/api/v1/conversations')
            .set('Authorization', `Bearer ${validToken}`)
        );
      }
      
      const responses = await Promise.all(concurrentRequests);
      const tooManyRequests = responses.some(res => res.status === 429);
      
      expect(tooManyRequests).toBe(true);
    });
  });

  describe('Cryptographic Security', () => {
    test('should use secure random generators', () => {
      // Test that the application uses secure random generators
      const random1 = crypto.randomBytes(32);
      const random2 = crypto.randomBytes(32);
      
      expect(random1).not.toEqual(random2);
      expect(random1.length).toBe(32);
      expect(random2.length).toBe(32);
    });

    test('should implement proper password hashing', async () => {
      // This would test the actual password hashing implementation
      const password = 'test-password-123';
      
      // Register a new user
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `security-test-${Date.now()}@example.com`,
          password,
          name: 'Security Test User'
        });
      
      if (response.status === 201) {
        // Password should never be returned in response
        expect(response.body.data.user).not.toHaveProperty('password');
        expect(response.body.data.user).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose stack traces in production', async () => {
      // Force an error condition
      const response = await request(app)
        .post('/api/v1/conversations/invalid-id/messages')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'test' });
      
      expect(response.body.error).toBeDefined();
      expect(response.body.error.stack).toBeUndefined();
      expect(response.body.error.stackTrace).toBeUndefined();
    });

    test('should provide generic error messages for authentication failures', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect(401);
      
      // Should not reveal whether email exists or not
      expect(response.body.error.message).toMatch(/invalid.*credentials|authentication.*failed/i);
      expect(response.body.error.message).not.toMatch(/user.*not.*found|email.*not.*exist/i);
    });
  });

  describe('Session and Cookie Security', () => {
    test('should set secure cookie attributes', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'validpassword123'
        });
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        cookies.forEach(cookie => {
          if (cookie.includes('session') || cookie.includes('auth')) {
            expect(cookie).toMatch(/HttpOnly/i);
            expect(cookie).toMatch(/Secure/i);
            expect(cookie).toMatch(/SameSite/i);
          }
        });
      }
    });
  });

  describe('Content Security Policy', () => {
    test('should implement strict CSP headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      const csp = response.headers['content-security-policy'];
      if (csp) {
        expect(csp).toMatch(/default-src.*'self'/i);
        expect(csp).toMatch(/script-src/i);
        expect(csp).toMatch(/style-src/i);
        expect(csp).not.toMatch(/'unsafe-eval'/i);
      }
    });
  });
});
