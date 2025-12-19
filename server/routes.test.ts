import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, setupApp } from './app';
import { db, dbReady } from './db';
import { sql } from 'drizzle-orm';

describe('Social Account Routes', () => {
  let agent: any;

  beforeAll(async () => {
    console.log("Starting test setup...");
    // Wait for DB to be ready and app to be setup
    console.log("Waiting for dbReady...");
    await dbReady;
    console.log("dbReady done. Setting up app...");
    await setupApp();
    console.log("App setup done. Creating agent...");
    agent = request.agent(app);

    // Ensure we have the dev user (seedDevUser runs on storage init, which happens on app setup)
    // Attempt login
    console.log("Attempting login...");
    const loginRes = await agent
      .post('/api/login')
      .send({ email: 'test@research.edu', password: 'password123' });
    
    console.log("Login Status:", loginRes.status);
    if (loginRes.status !== 200) {
        console.error("Login failed response:", loginRes.body);
    }
    expect(loginRes.status).toBe(200);
  });

  it('should create a new social account', async () => {
    const res = await agent
      .post('/api/accounts')
      .send({
        username: 'unique_user_1',
        displayName: 'Unique User',
        avatarUrl: 'https://example.com/avatar.png'
      });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('unique_user_1');
  });

  it('should fail to create a social account with duplicate username', async () => {
    // Create one first
    await agent.post('/api/accounts').send({
        username: 'duplicate_user',
        displayName: 'First User',
        avatarUrl: 'https://example.com/avatar1.png'
    });

    // Try to create same username
    const res = await agent
      .post('/api/accounts')
      .send({
        username: 'duplicate_user',
        displayName: 'Second User',
        avatarUrl: 'https://example.com/avatar2.png'
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Username already exists');
  });
});
