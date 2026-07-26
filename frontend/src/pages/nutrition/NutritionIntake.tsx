import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateNutritionPlan, type NutritionIntakeAnswers } from '../../lib/api';
import { FormStepWizard } from '../../components/ui/FormStepWizard';
import { PillGroup, type Option } from '../../components/ui/PillGroup';

const GENDER_OPTIONS: Option<NutritionIntakeAnswers['gender']>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const GOAL_OPTIONS: Option<NutritionIntakeAnswers['goal']>[] = [
  { value: 'fat_loss', label: 'Fat Loss', sublabel: 'Trim body fat' },
  { value: 'weight_loss', label: 'Weight Loss', sublabel: 'Deficit' },
  { value: 'muscle_gain', label: 'Muscle Gain', sublabel: 'Hypertrophy' },
  { value: 'bulking', label: 'Bulking', sublabel: 'Surplus' },
  { value: 'maintenance', label: 'Maintenance', sublabel: 'Equilibrium' },
  { value: 'recomposition', label: 'Recomposition', sublabel: 'Fat loss + Muscle' },
];

const ACTIVITY_OPTIONS: Option<NutritionIntakeAnswers['activity_level']>[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'very_active', label: 'Very Active' },
  { value: 'extra_active', label: 'Extra Active' },
];

const DIET_OPTIONS: Option<NutritionIntakeAnswers['diet_type']>[] = [
  { value: 'normal', label: 'Standard Balanced' },
  { value: 'high_protein', label: 'High Protein' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'keto', label: 'Keto' },
];

// Preset Dropdown Arrays for Non-Typing Selection
const AGE_DROPDOWN_OPTIONS = Array.from({ length: 70 }, (_, i) => 16 + i); // 16 to 85
const HEIGHT_DROPDOWN_OPTIONS = Array.from({ length: 81 }, (_, i) => 140 + i); // 140cm to 220cm
const WEIGHT_DROPDOWN_OPTIONS = Array.from({ length: 141 }, (_, i) => 40 + i); // 40kg to 180kg

const PREFERRED_FOODS_DROPDOWN_OPTIONS = [
  { value: 'Chicken breast, Jasmine rice, Eggs, Oats', label: 'Classic Bodybuilder (Chicken, Rice, Eggs, Oats)' },
  { value: 'Salmon, Sweet potato, Eggs, Avocado, Spinach', label: 'Healthy Fats & Seafood (Salmon, Sweet Potato, Avocado)' },
  { value: 'Lean beef, White rice, Eggs, Broccoli, Almonds', label: 'Red Meat Power (Beef, Rice, Eggs, Broccoli)' },
  { value: 'Tofu, Quinoa, Lentils, Avocado, Olive oil', label: 'Plant Based (Tofu, Quinoa, Lentils, Avocado)' },
  { value: 'Turkey breast, Rice cakes, Whey protein, Asparagus', label: 'Shredding Prep (Turkey, Rice Cakes, Whey, Asparagus)' },
  { value: 'Eggs, Beef, Avocado, Cheese, Butter', label: 'Keto Clean (Eggs, Beef, Avocado, Cheese)' },
];

const ALLERGIES_DROPDOWN_OPTIONS = [
  { value: '', label: 'None (No Known Allergies)' },
  { value: 'Dairy, Lactose', label: 'Dairy & Lactose Intolerance' },
  { value: 'Peanuts, Tree nuts', label: 'Peanuts & Tree Nuts' },
  { value: 'Gluten, Wheat', label: 'Gluten & Wheat Sensitivity' },
  { value: 'Shellfish, Fish', label: 'Shellfish & Fish' },
  { value: 'Soy', label: 'Soy' },
  { value: 'Eggs', label: 'Eggs' },
];

function NutritionIntake() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form State
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState<NutritionIntakeAnswers['gender']>('male');
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(78);
  const [goal, setGoal] = useState<NutritionIntakeAnswers['goal']>('muscle_gain');
  const [activityLevel, setActivityLevel] = useState<NutritionIntakeAnswers['activity_level']>('moderate');
  const [dietType, setDietType] = useState<NutritionIntakeAnswers['diet_type']>('high_protein');
  const [preferences, setPreferences] = useState('Chicken breast, Jasmine rice, Eggs, Oats');
  const [allergies, setAllergies] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseList = (value: string): string[] =>
    value.split(',').map((item) => item.trim()).filter(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await generateNutritionPlan({
        age,
        gender,
        height_cm: heightCm,
        weight_kg: weightKg,
        goal,
        activity_level: activityLevel,
        diet_type: dietType,
        preferences: parseList(preferences),
        allergies: parseList(allergies),
        additional_notes: additionalNotes || undefined,
      });
      navigate('/nutrition/generating', { state: { run_id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start nutrition plan generation');
      setSubmitting(false);
    }
  };

  const steps = [
    { title: 'Biometrics' },
    { title: 'Goals & Activity' },
    { title: 'Preferences & Notes' },
  ];

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <span className="badge badge-cyan" style={{ marginBottom: '10px' }}>Dataset Nutrition Engine</span>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          Precision Macro Protocol Setup
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
          Select your biometrics, target macros, and dataset meal preferences from dropdown menus.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '36px', background: 'rgba(15, 23, 42, 0.85)' }}>
        <FormStepWizard steps={steps} currentStep={step} onStepClick={(s) => setStep(s)} />

        <form onSubmit={handleSubmit}>
          {/* STEP 1: BIOMETRICS */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '24px' }}>
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Personal Biometrics
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Age (Years)</label>
                  <select
                    id="nutrition-age"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="form-select"
                    required
                  >
                    {AGE_DROPDOWN_OPTIONS.map((a) => (
                      <option key={a} value={a} style={{ background: '#0f172a' }}>
                        {a} Years Old
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ marginBottom: '10px' }}>Biological Gender</label>
                  <PillGroup options={GENDER_OPTIONS} value={gender} onChange={setGender} idPrefix="nutrition-gender" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Height (cm)</label>
                  <select
                    id="nutrition-height"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="form-select"
                    required
                  >
                    {HEIGHT_DROPDOWN_OPTIONS.map((h) => (
                      <option key={h} value={h} style={{ background: '#0f172a' }}>
                        {h} cm
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Weight (kg)</label>
                  <select
                    id="nutrition-weight"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="form-select"
                    required
                  >
                    {WEIGHT_DROPDOWN_OPTIONS.map((w) => (
                      <option key={w} value={w} style={{ background: '#0f172a' }}>
                        {w} kg
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-cyan"
                  style={{ padding: '12px 28px', fontSize: '15px' }}
                >
                  <span>Next: Goals & Activity</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: GOALS & ACTIVITY */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '24px' }}>
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Primary Target & Activity Profile
                </h3>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ marginBottom: '10px' }}>Primary Caloric Target Goal</label>
                <PillGroup options={GOAL_OPTIONS} value={goal} onChange={setGoal} idPrefix="nutrition-goal" />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ marginBottom: '10px' }}>Daily Occupation Activity</label>
                <PillGroup options={ACTIVITY_OPTIONS} value={activityLevel} onChange={setActivityLevel} idPrefix="nutrition-activity" />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ marginBottom: '10px' }}>Dietary Preference Split</label>
                <PillGroup options={DIET_OPTIONS} value={dietType} onChange={setDietType} idPrefix="nutrition-diet" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn btn-cyan"
                  style={{ padding: '12px 28px', fontSize: '15px' }}
                >
                  <span>Next: Preferences & Allergies</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREFERENCES & NOTES */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '24px' }}>
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Custom Preferences & Restrictions
                </h3>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preferred Food Dataset Profile</label>
                <select
                  id="nutrition-preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="form-select"
                >
                  {PREFERRED_FOODS_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: '#0f172a' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Allergies & Restrictions Profile</label>
                <select
                  id="nutrition-allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="form-select"
                >
                  {ALLERGIES_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: '#0f172a' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Additional Guidelines & Notes</label>
                <textarea
                  id="nutrition-additional-notes"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any specific meal timing, macro splits, or personal guidelines..."
                  maxLength={500}
                  rows={3}
                  className="form-textarea"
                />
              </div>

              {error && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af', fontSize: '13px' }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-secondary"
                >
                  ← Back
                </button>
                <button
                  id="nutrition-intake-submit"
                  type="submit"
                  disabled={submitting}
                  className="btn btn-cyan"
                  style={{ padding: '12px 28px', fontSize: '15px' }}
                >
                  <span>{submitting ? 'Generating Plan...' : 'Generate AI Nutrition Plan'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default NutritionIntake;
