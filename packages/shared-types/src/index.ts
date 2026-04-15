// ── Steer Types ──────────────────────────────────────────────
export type SteerGoalType = 'strategic' | 'operational' | 'compliance' | 'innovation';
export type SteerGoalPriority = 'critical' | 'high' | 'medium' | 'low';
export type SteerGoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface SteerGoal {
  id: string;
  title: string;
  description: string;
  goal_type: SteerGoalType;
  priority: SteerGoalPriority;
  status: SteerGoalStatus;
  owner_id: string;
  organization_id: string;
  ai_alignment_score: number;
  success_criteria: string[];
  target_date?: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

// ── Skill Types ──────────────────────────────────────────────
export type SkillCategory = 'nlp' | 'computer_vision' | 'data_analysis' | 'reasoning' | 'code_generation' | 'multimodal' | 'agent' | 'custom';
export type SkillStatus = 'draft' | 'under_review' | 'approved' | 'deployed' | 'deprecated';
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  status: SkillStatus;
  proficiency_level: ProficiencyLevel;
  organization_id: string;
  created_by: string;
  tags: string[];
  accuracy_score: number;
  latency_ms: number;
  usage_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Auth Types ───────────────────────────────────────────────
export type UserRole = 'super_admin' | 'org_admin' | 'ai_architect' | 'analyst' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// ── API Types ────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  detail: string;
  status_code: number;
}
