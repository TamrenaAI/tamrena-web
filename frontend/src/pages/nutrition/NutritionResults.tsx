import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNutritionResult, type NutritionResult, type NutritionMeal } from '../../lib/api';

function MealCard({ meal }: { meal: NutritionMeal }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2DACB', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
      <h3 style={{ fontFamily: 'Newsreader, serif', fontSize: '16px', color: '#211C16', marginBottom: '8px' }}>
        {meal.meal_name}
      </h3>
      {meal.foods.map((food, i) => (
        <p key={i} style={{ fontSize: '13px', color: '#5B5347', margin: '4px 0' }}>
          {food.name} — {food.serving_grams}g ({food.calories} kcal, {food.protein_g}g protein)
        </p>
      ))}
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#211C16', marginTop: '8px' }}>
        Total: {meal.total_calories} kcal · {meal.total_protein_g}g protein · {meal.total_carbs_g}g carbs · {meal.total_fat_g}g fat
      </p>
    </div>
  );
}

function NutritionResults() {
  const { runId } = useParams<{ runId: string }>();
  const [result, setResult] = useState<NutritionResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    getNutritionResult(runId)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load nutrition result'));
  }, [runId]);

  if (error) {
    return <p style={{ color: '#A83A2E', padding: '48px', fontFamily: 'Inter, sans-serif' }}>{error}</p>;
  }

  if (result === undefined) {
    return <p style={{ padding: '48px', fontFamily: 'Inter, sans-serif' }}>Loading…</p>;
  }

  if (result === null) {
    return (
      <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <p style={{ color: '#5B5347' }}>Still generating — check back shortly.</p>
        <Link to="/nutrition/intake" style={{ color: '#B5502E', fontSize: '14px', fontWeight: 600 }}>
          Back to Nutrition Intake →
        </Link>
      </div>
    );
  }

  const { macro_result, meal_plan, explanation } = result;

  return (
    <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '24px', color: '#211C16', marginBottom: '16px' }}>
          Your Nutrition Plan
        </h1>

        {macro_result && (
          <div id="nutrition-macro-summary" style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '14px', color: '#5B5347' }}>
              Target: {macro_result.target_calories} kcal · {macro_result.protein_g}g protein ·{' '}
              {macro_result.carbs_g}g carbs · {macro_result.fat_g}g fat
            </p>
          </div>
        )}

        {meal_plan && (
          <div id="nutrition-meal-plan">
            <MealCard meal={meal_plan.breakfast} />
            <MealCard meal={meal_plan.lunch} />
            <MealCard meal={meal_plan.dinner} />
            {meal_plan.snack && <MealCard meal={meal_plan.snack} />}
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#211C16', marginTop: '12px' }}>
              Daily total: {meal_plan.total_daily_calories} kcal · {meal_plan.total_daily_protein_g}g protein ·{' '}
              {meal_plan.total_daily_carbs_g}g carbs · {meal_plan.total_daily_fat_g}g fat
            </p>
          </div>
        )}

        {explanation && (
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2DACB', borderRadius: '12px', padding: '16px', marginTop: '24px' }}>
            <p style={{ fontSize: '14px', color: '#5B5347', marginBottom: '8px' }}>{explanation.summary}</p>
            <ul style={{ fontSize: '13px', color: '#5B5347' }}>
              {explanation.adherence_tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default NutritionResults;
