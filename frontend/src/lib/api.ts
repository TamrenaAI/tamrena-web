const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010';
const TOKEN_KEY = 'tamreena_access_token';

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface SessionResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    created_at: string;
  };
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail)) {
      const messages = body.detail.map((e: { msg?: string }) => e.msg).filter(Boolean);
      if (messages.length > 0) return messages.join(', ');
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

/**
 * Authenticated fetch: attaches the stored Bearer token, and on a 401
 * clears it and hard-redirects to /signin — covers expired/invalid tokens
 * from any BFF call, proxied or not.
 */
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/signin';
  }
  return res;
}

export async function signUp(username: string, password: string, confirmPassword: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirm_password: confirmPassword }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `Sign up failed (${res.status})`));
  }
  return res.json();
}

export async function logIn(username: string, password: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `Sign in failed (${res.status})`));
  }
  return res.json();
}

export async function getMe(): Promise<SessionResponse['user']> {
  const res = await authFetch('/auth/me');
  if (!res.ok) {
    throw new Error(`Failed to fetch current user (${res.status})`);
  }
  return res.json();
}

// ── Workout (proxied to Tamreena_AI via this BFF) ──────────────────────

export interface IntakeAnswers {
  goal: string;
  days_per_week: number;
  experience: 'beginner' | 'intermediate' | 'advanced';
  session_duration: string;
  injuries?: string;
  priority?: string;
  age?: number;
  sleep_quality?: string;
  job_type?: string;
  current_program?: string;
}

export interface WorkoutSession {
  session_id: string;
  goal: string | null;
  status: 'generating' | 'ready' | 'failed';
  error: string | null;
  created_at: string;
  intake: IntakeAnswers | null;
  previous_session_id: string | null;
  eligible_for_review: boolean;
}

export interface ParsedExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  rest: string | null;
  rpe: string | null;
  muscle_group: string | null;
  replaced_from: string | null;
  adjustment_reason: string | null;
}

export interface ParsedDay {
  day_number: number;
  label: string;
  target_focus: string;
  warmup: string | null;
  exercises: ParsedExercise[];
}

export interface SessionPlanResponse {
  status: 'ready' | 'pending' | 'failed';
  plan: string | null;
  error?: string | null;
  days: ParsedDay[] | null;
}

export interface ValidateImageResponse {
  valid: boolean;
  stage: string | null;
  issue: string | null;
}

export interface GeneratePlanResponse {
  session_id: string;
  inbody: Record<string, unknown>;
}

export interface ExerciseFeedback {
  name: string;
  muscle_group?: string;
  completed?: boolean;
  difficulty: 'too_easy' | 'just_right' | 'too_hard';
  pain?: boolean;
  note?: string;
}

export interface ExerciseAdjustment {
  exercise_name: string;
  new_exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  rpe: number | null;
  reason: string;
}

export interface WorkoutFeedbackResponse {
  feedback_recorded: boolean;
  adjustment_triggered: boolean;
  summary: string | null;
  adjustments: ExerciseAdjustment[];
}

export async function getSessions(): Promise<WorkoutSession[]> {
  const res = await authFetch('/api/workout/sessions');
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load sessions (${res.status})`));
  const body = await res.json();
  return body.sessions;
}

export async function getSessionPlan(sessionId: string): Promise<SessionPlanResponse> {
  const res = await authFetch(`/api/workout/sessions/${sessionId}/plan`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load plan (${res.status})`));
  return res.json();
}

export async function submitFeedback(
  sessionId: string,
  dayLabel: string,
  exercises: ExerciseFeedback[],
): Promise<WorkoutFeedbackResponse> {
  const res = await authFetch(`/api/workout/feedback/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day_label: dayLabel, exercises }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to submit feedback (${res.status})`));
  return res.json();
}

export async function validateImage(file: File): Promise<ValidateImageResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch('/api/workout/validate-image', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to validate image (${res.status})`));
  return res.json();
}

export async function generatePlan(intake: IntakeAnswers, inbodyFile: File): Promise<GeneratePlanResponse> {
  const formData = new FormData();
  formData.append('inbody_file', inbodyFile);
  formData.append('goal', intake.goal);
  formData.append('days_per_week', String(intake.days_per_week));
  formData.append('experience', intake.experience);
  formData.append('session_duration', intake.session_duration);
  if (intake.injuries) formData.append('injuries', intake.injuries);
  if (intake.priority) formData.append('priority', intake.priority);
  if (intake.age !== undefined) formData.append('age', String(intake.age));
  if (intake.sleep_quality) formData.append('sleep_quality', intake.sleep_quality);
  if (intake.job_type) formData.append('job_type', intake.job_type);
  if (intake.current_program) formData.append('current_program', intake.current_program);

  const res = await authFetch('/api/workout/generate-plan', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to generate plan (${res.status})`));
  return res.json();
}

export function getGeneratePlanStreamUrl(sessionId: string): string {
  const token = getToken();
  return `${API_BASE_URL}/api/workout/generate-plan/stream/${sessionId}?token=${encodeURIComponent(token ?? '')}`;
}

// ── Progress (proxied to Tamreena_AI via this BFF) ──────────────────────

export interface ScanRecord {
  id: string;
  user_id: string;
  session_id: string | null;
  skeletal_muscle_mass_kg: number;
  body_fat_percent: number;
  bmr_kcal: number | null;
  arm_asymmetry: boolean;
  arm_diff_grams: number;
  leg_asymmetry: boolean;
  leg_diff_grams: number;
  elevated_bf: boolean;
  trunk_underdeveloped: boolean;
  created_at: string;
}

export interface ScanComparison {
  latest: ScanRecord;
  previous: ScanRecord;
  delta: {
    skeletal_muscle_mass_kg: number;
    body_fat_percent: number;
    arm_asymmetry_resolved: boolean;
    leg_asymmetry_resolved: boolean;
    trunk_underdeveloped_resolved: boolean;
  };
}

export interface ProgressReport {
  old_session_id: string;
  new_session_id: string;
  summary: Record<string, unknown>;
  narrative: string;
  created_at: string;
}

export interface MonthlyReviewResponse {
  session_id: string;
  inbody: Record<string, unknown>;
  progress_report: string;
}

export async function getScans(): Promise<ScanRecord[]> {
  const res = await authFetch('/api/progress/scans');
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load scan history (${res.status})`));
  const body = await res.json();
  return body.scans;
}

export async function getComparison(): Promise<ScanComparison | null> {
  const res = await authFetch('/api/progress/comparison');
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load comparison (${res.status})`));
  const body = await res.json();
  return body.comparison;
}

export async function getProgressReport(sessionId: string): Promise<ProgressReport | null> {
  const res = await authFetch(`/api/progress/${sessionId}/report`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load progress report (${res.status})`));
  return res.json();
}

export async function startMonthlyReview(sessionId: string, inbodyFile: File): Promise<MonthlyReviewResponse> {
  const formData = new FormData();
  formData.append('inbody_file', inbodyFile);
  const res = await authFetch(`/api/progress/${sessionId}/monthly-review`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to start monthly review (${res.status})`));
  return res.json();
}

// ── Exercises (proxied to Tamreena_AI and Computer-Vision via this BFF) ─

export interface TamreenaExerciseListItem {
  name: string;
  target_muscle: string | null;
  equipment: string | null;
  image_url: string | null;
  gif_url: string | null;
}

export interface TamreenaExerciseListResponse {
  exercises: TamreenaExerciseListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface TamreenaExerciseDetail {
  name: string;
  target_muscle: string | null;
  equipment: string | null;
  instructions: string | null;
  image_url: string | null;
  gif_url: string | null;
  attribution: string | null;
}

export interface CvExercise {
  id: string;
  name: string;
  description: string;
  muscle_groups: string[];
  camera: string;
  counters: string[];
  rules: number;
  image: string | null;
}

export async function getTamreenaExercises(): Promise<TamreenaExerciseListResponse> {
  const res = await authFetch('/api/exercises');
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load exercises (${res.status})`));
  return res.json();
}

export async function getTamreenaExerciseDetail(name: string): Promise<TamreenaExerciseDetail> {
  const res = await authFetch(`/api/exercises/lookup?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load exercise detail (${res.status})`));
  return res.json();
}

export async function getCvExercises(): Promise<CvExercise[]> {
  const res = await authFetch('/api/exercises/cv');
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load CV exercises (${res.status})`));
  return res.json();
}

/**
 * Tamreena_AI's exercise list/lookup responses return image_url/gif_url as
 * paths relative to Tamreena_AI's own origin (e.g. "/media/exercises/gifs/x.gif").
 * The BFF proxies that same path shape at its own origin (see Task 4's
 * media_router), so resolving it just means prefixing with this service's
 * own base URL instead of leaving it browser-relative (which would resolve
 * against the frontend's own origin and 404).
 */
export function mediaUrl(path: string | null): string | null {
  return path ? `${API_BASE_URL}${path}` : null;
}

export interface LiveSessionResult {
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  reps: number;
  good: number;
  bad: number;
  created_at: string;
}

export async function uploadLiveSessionVideo(file: File): Promise<{ id: string; name: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch('/api/live-session/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to upload video (${res.status})`));
  return res.json();
}

export async function saveLiveSessionResult(
  exerciseId: string,
  exerciseName: string,
  reps: number,
  good: number,
  bad: number,
): Promise<LiveSessionResult> {
  const res = await authFetch('/api/live-session/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise_id: exerciseId, exercise_name: exerciseName, reps, good, bad }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to save session result (${res.status})`));
  return res.json();
}

export function getLiveSessionWebSocketUrl(exerciseId: string, videoId: string): string {
  const token = getToken();
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/ws/live-session?exercise=${encodeURIComponent(exerciseId)}&video=${encodeURIComponent(videoId)}&token=${encodeURIComponent(token ?? '')}`;
}

// ── Nutrition (proxied to Nutrition-Plan-Generation via this BFF) ──────

export interface NutritionIntakeAnswers {
  age: number;
  gender: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  goal: 'fat_loss' | 'weight_loss' | 'muscle_gain' | 'bulking' | 'maintenance' | 'recomposition';
  activity_level: 'sedentary' | 'lightly_active' | 'moderate' | 'very_active' | 'extra_active';
  diet_type: 'normal' | 'vegetarian' | 'vegan' | 'keto' | 'high_protein';
  preferences: string[];
  allergies: string[];
  additional_notes?: string;
}

export interface NutritionGenerateResponse {
  run_id: string;
  status: string;
  message: string;
}

export async function generateNutritionPlan(answers: NutritionIntakeAnswers): Promise<NutritionGenerateResponse> {
  const res = await authFetch('/api/nutrition/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...answers, meal_generation_mode: 'dataset' }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to start nutrition plan generation (${res.status})`));
  return res.json();
}

export function getNutritionStreamUrl(runId: string): string {
  const token = getToken();
  return `${API_BASE_URL}/api/nutrition/stream/${encodeURIComponent(runId)}?token=${encodeURIComponent(token ?? '')}`;
}

export interface NutritionFoodItem {
  name: string;
  serving_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionMeal {
  meal_name: string;
  foods: NutritionFoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

export interface NutritionMealPlan {
  breakfast: NutritionMeal;
  lunch: NutritionMeal;
  dinner: NutritionMeal;
  snack: NutritionMeal | null;
  total_daily_calories: number;
  total_daily_protein_g: number;
  total_daily_carbs_g: number;
  total_daily_fat_g: number;
  notes: string | null;
}

export interface NutritionMacroResult {
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionExplanation {
  summary: string;
  calorie_rationale: string;
  macro_rationale: string;
  food_selection_rationale: string;
  adherence_tips: string[];
}

export interface NutritionResult {
  run_id: string;
  success: boolean;
  macro_result: NutritionMacroResult | null;
  meal_plan: NutritionMealPlan | null;
  explanation: NutritionExplanation | null;
  error: string | null;
}

export async function getNutritionResult(runId: string): Promise<NutritionResult | null> {
  const res = await authFetch(`/api/nutrition/result/${encodeURIComponent(runId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load nutrition result (${res.status})`));
  return res.json();
}

// ── Live Session Report (proxied to CV via this BFF) ────────────────────

export interface CvRepetition {
  number: number;
  good: boolean;
  score: number;
}

export interface CvRuleDefinition {
  name: string;
  severity: string;
  message: string;
}

export interface CvSessionSummary {
  total_reps: number;
  good_reps: number;
  bad_reps: number;
  accuracy: number;
  score: number | null;
  common_errors: Record<string, number>;
  most_common_error: string | null;
}

export interface CvSessionReport {
  summary: CvSessionSummary;
  history: CvRepetition[];
  rules: CvRuleDefinition[];
}

export async function getLiveSessionReport(cvSessionId: string): Promise<CvSessionReport> {
  const res = await authFetch(`/api/live-session/report/${cvSessionId}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load report (${res.status})`));
  return res.json();
}
