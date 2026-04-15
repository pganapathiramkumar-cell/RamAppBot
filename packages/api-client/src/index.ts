/**
 * Rambot API Client — shared by web and any other JS/TS consumers.
 */

import axios, { AxiosInstance } from 'axios';
import type { SteerGoal, Skill, TokenPair } from '../../shared-types/src';

export class RambotApiClient {
  private http: AxiosInstance;

  constructor(baseURL: string, getToken?: () => string | null) {
    this.http = axios.create({ baseURL });
    if (getToken) {
      this.http.interceptors.request.use((config) => {
        const token = getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
      });
    }
  }

  // ── Auth ──────────────────────────────────────────────────
  async login(email: string, password: string): Promise<TokenPair> {
    const { data } = await this.http.post('/auth/login', { email, password });
    return data;
  }

  // ── Steer ─────────────────────────────────────────────────
  async getSteerGoals(organizationId: string): Promise<SteerGoal[]> {
    const { data } = await this.http.get('/steer', { params: { organization_id: organizationId } });
    return data;
  }

  async createSteerGoal(payload: Partial<SteerGoal>): Promise<SteerGoal> {
    const { data } = await this.http.post('/steer', payload);
    return data;
  }

  async activateSteerGoal(goalId: string): Promise<SteerGoal> {
    const { data } = await this.http.post(`/steer/${goalId}/activate`);
    return data;
  }

  async analyzeSteerGoals(organizationId: string, question: string): Promise<string> {
    const { data } = await this.http.post('/steer/ai/analyze', { organization_id: organizationId, question });
    return data.analysis;
  }

  // ── Skill ─────────────────────────────────────────────────
  async getSkills(organizationId: string): Promise<Skill[]> {
    const { data } = await this.http.get('/skill', { params: { organization_id: organizationId } });
    return data;
  }

  async createSkill(payload: Partial<Skill>): Promise<Skill> {
    const { data } = await this.http.post('/skill', payload);
    return data;
  }

  async deploySkill(skillId: string): Promise<Skill> {
    const { data } = await this.http.post(`/skill/${skillId}/deploy`);
    return data;
  }

  async analyzeSkillGaps(organizationId: string, goalIds: string[]): Promise<string> {
    const { data } = await this.http.post('/skill/ai/gap-analysis', { organization_id: organizationId, goal_ids: goalIds });
    return data.gap_analysis;
  }
}
