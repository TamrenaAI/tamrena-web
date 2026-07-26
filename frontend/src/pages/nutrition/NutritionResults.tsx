import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNutritionResult, type NutritionResult, type NutritionMeal } from '../../lib/api';

function MealCard({ meal, index }: { meal: NutritionMeal; index: number }) {
  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
      {/* Meal Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: '1px solid rgba(6, 182, 212, 0.3)', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
            {index}
          </span>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {meal.meal_name}
          </h3>
        </div>
        <span className="badge badge-cyan">
          BALANCED MACROS
        </span>
      </div>

      {/* Foods List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
        {meal.foods.map((food, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(7, 10, 17, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div>
              <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#f8fafc' }}>{food.name}</span>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>({food.serving_grams}g serving)</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              <span>{food.calories} <small style={{ color: '#64748b' }}>kcal</small></span>
              <span style={{ fontWeight: 700, color: '#34d399' }}>{food.protein_g}g <small style={{ color: '#64748b', fontWeight: 400 }}>P</small></span>
            </div>
          </div>
        ))}
      </div>

      {/* Meal Macro Summary Footer */}
      <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>
        <span>Total Meal Nutrition</span>
        <div style={{ display: 'flex', gap: '12px', color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#fbbf24' }}>{meal.total_calories} kcal</span>
          <span>·</span>
          <span style={{ color: '#34d399' }}>{meal.total_protein_g}g Protein</span>
          <span>·</span>
          <span style={{ color: '#38bdf8' }}>{meal.total_carbs_g}g Carbs</span>
          <span>·</span>
          <span style={{ color: '#c084fc' }}>{meal.total_fat_g}g Fat</span>
        </div>
      </div>
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
    return <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af' }}>⚠️ {error}</div>;
  }

  if (result === undefined) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading your dataset nutrition protocol...</p>
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Plan is still generating — check back shortly.</p>
        <Link to="/nutrition/intake" className="btn btn-primary">
          Back to Nutrition Intake →
        </Link>
      </div>
    );
  }

  const { macro_result, meal_plan, explanation } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge badge-cyan">DATASET NUTRITION MODE</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Generated Today</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            Personalized Macro & Meal Protocol
          </h1>
        </div>

        <button onClick={() => window.print()} className="btn btn-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg>
          Export Meal Plan (PDF)
        </button>
      </div>

      {/* Macro Summary Card */}
      {macro_result && (
        <div id="nutrition-macro-summary" className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ color: '#06b6d4' }}>⚡</span>
            <h2 style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>
              DAILY MACRONUTRIENT TARGETS SUMMARY
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span className="metric-val" style={{ fontSize: '28px', color: '#fbbf24', display: 'block' }}>
                {macro_result.target_calories}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>TARGET (KCAL)</span>
            </div>
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span className="metric-val" style={{ fontSize: '28px', color: '#34d399', display: 'block' }}>
                {macro_result.protein_g}g
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>PROTEIN</span>
            </div>
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span className="metric-val" style={{ fontSize: '28px', color: '#38bdf8', display: 'block' }}>
                {macro_result.carbs_g}g
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>CARBS</span>
            </div>
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span className="metric-val" style={{ fontSize: '28px', color: '#c084fc', display: 'block' }}>
                {macro_result.fat_g}g
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>FAT</span>
            </div>
          </div>
        </div>
      )}

      {/* Meal Plan Schedule */}
      {meal_plan && (
        <div id="nutrition-meal-plan">
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '16px' }}>
            Curated Meal Schedule
          </h2>

          <MealCard meal={meal_plan.breakfast} index={1} />
          <MealCard meal={meal_plan.lunch} index={2} />
          <MealCard meal={meal_plan.dinner} index={3} />
          {meal_plan.snack && <MealCard meal={meal_plan.snack} index={4} />}
        </div>
      )}

      {/* AI Explanation Accordion Box */}
      {explanation && (
        <div
          style={{
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: '#38bdf8', fontSize: '18px' }}>💡</span>
            <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase', margin: 0 }}>
              AI NUTRITIONAL RATIONALE & GUIDELINES
            </h3>
          </div>
          <p style={{ fontSize: '14.5px', color: '#e2e8f0', lineHeight: 1.6, marginBottom: '16px' }}>
            {explanation.summary}
          </p>
          {explanation.adherence_tips.length > 0 && (
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Key Adherence Tips:
              </span>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '13.5px', lineHeight: 1.6 }}>
                {explanation.adherence_tips.map((tip, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NutritionResults;
