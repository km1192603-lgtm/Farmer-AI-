import "./result-card.css";

export type CostEstimate = {
  total: number;
  currency: string;
  breakdown?: { label: string; amount: number }[];
  note?: string;
};

export type AdvisoryResult = {
  title?: string;
  summary?: string;
  diagnosis?: string;
  recommendation?: string;
  answer?: string;
  confidence?: number;
  actionSteps?: string[];
  actions?: string[];
  nextActions?: string[];
  costEstimate?: CostEstimate;
  followUpQuestions?: string[];
  alertLevel?: string;
  [key: string]: unknown;
};

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return undefined;
}

function pickSteps(r: AdvisoryResult): string[] {
  if (Array.isArray(r.actionSteps) && r.actionSteps.length) return r.actionSteps;
  if (Array.isArray(r.nextActions) && r.nextActions.length) return r.nextActions;
  if (Array.isArray(r.actions) && r.actions.length) return r.actions;
  return [];
}

export function ResultCard({ data, rawJson }: { data: AdvisoryResult; rawJson?: string }) {
  const confidence = asNumber(data.confidence);
  const steps = pickSteps(data);
  const cost = data.costEstimate as CostEstimate | undefined;
  const followUps = Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [];
  const title =
    (typeof data.title === "string" && data.title) ||
    (typeof data.diagnosis === "string" && data.diagnosis) ||
    "Advisory result";
  const summary =
    (typeof data.summary === "string" && data.summary) ||
    (typeof data.recommendation === "string" && data.recommendation) ||
    (typeof data.answer === "string" && data.answer) ||
    null;

  const pct = confidence != null ? Math.round(Math.min(1, Math.max(0, confidence)) * 100) : null;

  const equipmentSuggestions = Array.isArray(data.equipmentSuggestions) ? (data.equipmentSuggestions as string[]) : [];
  const seedSuggestions = Array.isArray(data.seedSuggestions) ? (data.seedSuggestions as string[]) : [];
  const weatherParameters =
    data.weatherParameters && typeof data.weatherParameters === "object"
      ? (data.weatherParameters as Record<string, unknown>)
      : null;

  return (
    <div className="result-card">
      <div className="result-card__header">
        <h3 className="result-card__title">{title}</h3>
        {data.alertLevel ? <span className={`badge badge--${String(data.alertLevel)}`}>{String(data.alertLevel)}</span> : null}
      </div>

      {pct != null ? (
        <div className="result-card__confidence">
          <span className="result-card__confidence-label">Confidence</span>
          <div className="result-card__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="result-card__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="result-card__confidence-pct">{pct}%</span>
        </div>
      ) : null}

      {summary ? <p className="result-card__summary">{summary}</p> : null}

      {weatherParameters ? (
        <div className="result-card__section">
          <h4>Weather parameters</h4>
          <ul className="result-card__kv">
            {Object.entries(weatherParameters).map(([k, v]) => (
              <li key={k}>
                {k}: {String(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {equipmentSuggestions.length > 0 ? (
        <div className="result-card__section">
          <h4>Suggested equipment</h4>
          <ul className="result-card__bullets">
            {equipmentSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {seedSuggestions.length > 0 ? (
        <div className="result-card__section">
          <h4>Seed suggestions</h4>
          <ul className="result-card__bullets">
            {seedSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div className="result-card__section">
          <h4>Action steps</h4>
          <ol className="result-card__steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {cost && typeof cost.total === "number" ? (
        <div className="result-card__section result-card__cost">
          <h4>Cost estimate</h4>
          <p className="result-card__cost-total">
            {cost.currency ?? "INR"} {cost.total.toLocaleString("en-IN")}
            {cost.note ? <span className="result-card__cost-note"> — {cost.note}</span> : null}
          </p>
          {Array.isArray(cost.breakdown) && cost.breakdown.length > 0 ? (
            <ul className="result-card__breakdown">
              {cost.breakdown.map((b, i) => (
                <li key={i}>
                  {b.label}: {cost.currency ?? "INR"} {b.amount.toLocaleString("en-IN")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {followUps.length > 0 ? (
        <div className="result-card__section result-card__followup">
          <h4>Smart follow-up (answer for better advice)</h4>
          <ul>
            {followUps.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rawJson ? (
        <details className="result-card__raw">
          <summary>Technical details (JSON)</summary>
          <pre>{rawJson}</pre>
        </details>
      ) : null}
    </div>
  );
}

export function isAdvisoryShape(v: unknown): v is AdvisoryResult {
  return v != null && typeof v === "object";
}
