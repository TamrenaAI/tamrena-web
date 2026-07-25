import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateNutritionPlan, type NutritionIntakeAnswers } from '../../lib/api';

function NutritionIntake() {
  const navigate = useNavigate();
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState<NutritionIntakeAnswers['gender']>('male');
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(75);
  const [goal, setGoal] = useState<NutritionIntakeAnswers['goal']>('maintenance');
  const [activityLevel, setActivityLevel] = useState<NutritionIntakeAnswers['activity_level']>('moderate');
  const [dietType, setDietType] = useState<NutritionIntakeAnswers['diet_type']>('normal');
  const [preferences, setPreferences] = useState('');
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

  return (
    <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '24px', color: '#211C16', marginBottom: '16px' }}>
          Nutrition Plan
        </h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label>
            Age
            <input
              id="nutrition-age"
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Gender
            <select
              id="nutrition-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as NutritionIntakeAnswers['gender'])}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label>
            Height (cm)
            <input
              id="nutrition-height"
              type="number"
              min={100}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Weight (kg)
            <input
              id="nutrition-weight"
              type="number"
              min={30}
              max={300}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Goal
            <select
              id="nutrition-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value as NutritionIntakeAnswers['goal'])}
            >
              <option value="fat_loss">Fat loss</option>
              <option value="weight_loss">Weight loss</option>
              <option value="muscle_gain">Muscle gain</option>
              <option value="bulking">Bulking</option>
              <option value="maintenance">Maintenance</option>
              <option value="recomposition">Recomposition</option>
            </select>
          </label>
          <label>
            Activity level
            <select
              id="nutrition-activity-level"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as NutritionIntakeAnswers['activity_level'])}
            >
              <option value="sedentary">Sedentary</option>
              <option value="lightly_active">Lightly active</option>
              <option value="moderate">Moderate</option>
              <option value="very_active">Very active</option>
              <option value="extra_active">Extra active</option>
            </select>
          </label>
          <label>
            Diet type
            <select
              id="nutrition-diet-type"
              value={dietType}
              onChange={(e) => setDietType(e.target.value as NutritionIntakeAnswers['diet_type'])}
            >
              <option value="normal">Normal</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="keto">Keto</option>
              <option value="high_protein">High protein</option>
            </select>
          </label>
          <label>
            Preferences (comma-separated)
            <input
              id="nutrition-preferences"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="chicken, rice, vegetables"
            />
          </label>
          <label>
            Allergies (comma-separated)
            <input
              id="nutrition-allergies"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="peanuts, dairy"
            />
          </label>
          <label>
            Additional notes
            <textarea
              id="nutrition-additional-notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              maxLength={500}
            />
          </label>
          {error && <p style={{ color: '#A83A2E', fontSize: '13px' }}>{error}</p>}
          <button id="nutrition-intake-submit" type="submit" disabled={submitting}>
            {submitting ? 'Starting…' : 'Generate Plan'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default NutritionIntake;
