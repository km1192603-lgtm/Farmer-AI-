import { FormEvent, useState } from "react";
import "./app.css";
import { ResultCard, isAdvisoryShape, type AdvisoryResult } from "./ResultCard";

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

const API_BASE = "http://localhost:4000";

async function callApi(path: string, payload: Record<string, unknown>): Promise<JsonValue> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as JsonValue;
}

async function uploadImage(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${API_BASE}/api/media/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Image upload failed: ${res.status}`);
  }
  return (await res.json()) as { imageUrl: string };
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function optionalNum(v: FormDataEntryValue | null): number | undefined {
  const s = str(v);
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function App() {
  const [loading, setLoading] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<JsonValue | null>(null);
  const [language, setLanguage] = useState("en");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fresher stepper state
  const [fresherStep, setFresherStep] = useState<number>(1);
  const [farmingPractice, setFarmingPractice] = useState<string>("integrated");
  const [cropSystem, setCropSystem] = useState<string>("mixed");
  const [farmingScale, setFarmingScale] = useState<string>("small");
  const [fresherSoilType, setFresherSoilType] = useState<string>("loam");
  const [fresherCropType, setFresherCropType] = useState<string>("paddy");
  const [seedType, setSeedType] = useState<string>("certified");
  const [fresherLandSize, setFresherLandSize] = useState<number>(1);
  const [waterAvailabilityFresher, setWaterAvailabilityFresher] = useState<string>("medium");
  const [seedCostPerAcre, setSeedCostPerAcre] = useState<number>(3000);
  const [fertilizerCostPerAcre, setFertilizerCostPerAcre] = useState<number>(4500);
  const [fresherLaborDays, setFresherLaborDays] = useState<number>(12);

  async function runRequest(key: string, fn: () => Promise<JsonValue>, validate?: () => boolean) {
    if (validate && !validate()) return;
    try {
      setLoading(key);
      setError("");
      setFieldErrors({});
      const data = await fn();
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setResult(null);
    } finally {
      setLoading("");
    }
  }

  function setErr(key: string, msg: string, acc: Record<string, string>) {
    acc[key] = msg;
  }

  function onPestSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    const crop = str(form.get("cropType"));
    const sym = str(form.get("symptomText"));
    const pct = optionalNum(form.get("affectedAreaPercent"));

    if (crop.length < 2) setErr("pest-crop", "Enter crop name (at least 2 characters).", errs);
    if (sym.length < 8) setErr("pest-symptom", "Describe symptoms in at least 8 characters.", errs);
    if (pct != null && (pct < 0 || pct > 100)) setErr("pest-pct", "Affected area must be between 0 and 100%.", errs);

    const selectedFile = form.get("imageFile");
    const fileOk = selectedFile instanceof File && selectedFile.size > 0;
    if (!fileOk && sym.length < 20) {
      setErr(
        "pest-image",
        "Add a photo or write a longer symptom description (20+ characters) for safer advice.",
        errs,
      );
    }

    runRequest(
      "pest",
      async () => {
        let imageUrl: string | undefined;
        if (fileOk && selectedFile instanceof File) {
          const upload = await uploadImage(selectedFile);
          imageUrl = upload.imageUrl;
        }

        return callApi("/api/pest-diagnosis", {
          cropType: crop,
          symptomText: sym,
          imageUrl,
          growthStage: str(form.get("growthStage")) || undefined,
          severity: str(form.get("severity")) || undefined,
          affectedAreaPercent: pct ?? undefined,
          recentRain: str(form.get("recentRain")) || undefined,
          irrigationType: str(form.get("irrigationType")) || undefined,
          lastSprayWeeks: optionalNum(form.get("lastSprayWeeks")),
        });
      },
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  function onRoadmapSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    const acres = optionalNum(form.get("landSize"));
    const seed = optionalNum(form.get("seedCost"));
    const fert = optionalNum(form.get("fertilizerCost"));

    if (acres == null || acres <= 0) setErr("road-acres", "Land size must be a positive number.", errs);
    if (seed == null || seed < 0) setErr("road-seed", "Seed cost must be zero or more.", errs);
    if (fert == null || fert < 0) setErr("road-fert", "Fertilizer cost must be zero or more.", errs);

    runRequest(
      "roadmap",
      () =>
        callApi("/api/fresher-roadmap", {
          landSize: acres,
          waterAvailability: str(form.get("waterAvailability")),
          cropType: str(form.get("cropType")),
          seedCost: seed,
          fertilizerCost: fert,
          laborDays: optionalNum(form.get("laborDays")),
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        if (str(form.get("cropType")).length < 2) {
          setFieldErrors({ "road-crop": "Enter crop name (at least 2 characters)." });
          return false;
        }
        return true;
      },
    );
  }

  function onFresherNext1() {
    setFieldErrors({});
    setFresherStep(2);
  }

  function onFresherNext2() {
    const errs: Record<string, string> = {};
    if (!fresherSoilType) errs["fresher-soil"] = "Select soil type.";
    if (!cropSystem) errs["fresher-cropsystem"] = "Select crop system (mono/mixed).";
    if (!farmingScale) errs["fresher-scale"] = "Select farming scale.";

    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setFresherStep(3);
  }

  function onFresherSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!fresherCropType || fresherCropType.length < 2) errs["fresher-crop"] = "Select crop type.";
    if (fresherLandSize == null || fresherLandSize <= 0) errs["fresher-land"] = "Enter land size in acres.";
    if (seedCostPerAcre == null || seedCostPerAcre < 0) errs["fresher-seedcost"] = "Seed cost must be 0 or more.";
    if (fertilizerCostPerAcre == null || fertilizerCostPerAcre < 0)
      errs["fresher-fertcost"] = "Fertilizer cost must be 0 or more.";
    if (!waterAvailabilityFresher) errs["fresher-water"] = "Select water availability (low/medium/high).";

    runRequest(
      "fresher",
      () =>
        callApi("/api/fresher-roadmap", {
          farmingPractice,
          cropSystem,
          farmingScale,
          soilType: fresherSoilType,
          cropType: fresherCropType,
          seedType,
          landSize: fresherLandSize,
          waterAvailability: waterAvailabilityFresher,
          seedCost: seedCostPerAcre,
          fertilizerCost: fertilizerCostPerAcre,
          laborDays: fresherLaborDays,
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  function onVoiceAssistant() {
    runRequest("assistant", () =>
      callApi("/api/assistant/query", {
        language,
        message: "My crop has yellow leaves. What should I do?",
        voice: true,
      }),
    );
  }

  function onWeatherSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (str(form.get("district")).length < 2) setErr("wx-dist", "Enter a valid district name.", errs);
    if (str(form.get("cropType")).length < 2) setErr("wx-crop", "Enter crop type.", errs);

    runRequest(
      "weather",
      () =>
        callApi("/api/weather-risk", {
          district: str(form.get("district")),
          cropType: str(form.get("cropType")),
          cropStage: str(form.get("cropStage")) || undefined,
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  function onCultivationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (str(form.get("cropType")).length < 2) setErr("cul-crop", "Enter crop type.", errs);
    if (str(form.get("stage")).length < 2) setErr("cul-stage", "Enter growth stage.", errs);

    runRequest(
      "cultivation",
      () =>
        callApi("/api/cultivation-advice", {
          cropType: str(form.get("cropType")),
          stage: str(form.get("stage")),
          soilMoisture: str(form.get("soilMoisture")) || undefined,
          lastFertilizerWeeks: optionalNum(form.get("lastFertilizerWeeks")),
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  function onMarketSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (str(form.get("cropType")).length < 2) setErr("mkt-crop", "Enter crop type.", errs);
    const q = optionalNum(form.get("quantityQuintals"));
    if (q != null && q <= 0) setErr("mkt-qty", "Quantity must be positive.", errs);

    runRequest(
      "market",
      () =>
        callApi("/api/market-insights", {
          cropType: str(form.get("cropType")),
          mandiName: str(form.get("mandiName")) || undefined,
          quantityQuintals: q,
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  function onFertilizerSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (str(form.get("cropType")).length < 2) setErr("fer-crop", "Enter crop type.", errs);
    const acres = optionalNum(form.get("landSize"));
    const cost = optionalNum(form.get("fertilizerCost"));
    if (acres == null || acres <= 0) setErr("fer-acres", "Land size must be positive.", errs);
    if (cost == null || cost < 0) setErr("fer-cost", "Fertilizer cost per acre must be zero or more.", errs);

    runRequest(
      "fertilizer",
      () =>
        callApi("/api/fertilizer-plan", {
          cropType: str(form.get("cropType")),
          landSize: acres,
          fertilizerCost: cost,
          soilTestDone: str(form.get("soilTestDone")) || undefined,
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  function onSchemesSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (str(form.get("state")).length < 2) setErr("sch-state", "Enter state name.", errs);

    runRequest(
      "schemes",
      () =>
        callApi("/api/schemes-finder", {
          state: str(form.get("state")),
          landholdingCategory: str(form.get("landholdingCategory")) || undefined,
        }),
      () => {
        if (Object.keys(errs).length) {
          setFieldErrors(errs);
          return false;
        }
        return true;
      },
    );
  }

  const showCard = result && isAdvisoryShape(result);

  return (
    <main className="container">
      <header className="header">
        <h1>Farmer Assistant Platform</h1>
        <p>Problem to solution platform with pest detection, planning and multilingual AI support.</p>
      </header>

      <section className="card">
        <h2>Language and Voice Assistant</h2>
        <div className="row">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ta">Tamil</option>
            <option value="te">Telugu</option>
            <option value="ml">Malayalam</option>
            <option value="kn">Kannada</option>
          </select>
          <button type="button" onClick={onVoiceAssistant} disabled={loading === "assistant"}>
            {loading === "assistant" ? "Checking..." : "Run Voice Assistant"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Pest and Disease Solution (Image-assisted)</h2>
        <form onSubmit={onPestSubmit} className="form" noValidate>
          <input
            name="cropType"
            placeholder="Crop type (ex: paddy)"
            className={fieldErrors["pest-crop"] ? "input-invalid" : ""}
          />
          {fieldErrors["pest-crop"] ? <span className="field-error">{fieldErrors["pest-crop"]}</span> : null}

          <textarea
            name="symptomText"
            placeholder="Symptoms (ex: brown spots on older leaves, spreading from tip)"
            rows={3}
            className={fieldErrors["pest-symptom"] ? "input-invalid" : ""}
          />
          {fieldErrors["pest-symptom"] ? <span className="field-error">{fieldErrors["pest-symptom"]}</span> : null}

          <label className="file-label">
            <span>Photo of affected plant (recommended)</span>
            <input name="imageFile" type="file" accept="image/*" className={fieldErrors["pest-image"] ? "input-invalid" : ""} />
          </label>
          {fieldErrors["pest-image"] ? <span className="field-error">{fieldErrors["pest-image"]}</span> : null}

          <fieldset className="followup-fields">
            <legend>Optional details (improves confidence)</legend>
            <select name="growthStage" defaultValue="">
              <option value="">Growth stage (select)</option>
              <option value="nursery">Nursery</option>
              <option value="vegetative">Vegetative</option>
              <option value="flowering">Flowering</option>
              <option value="grain-fill">Grain-fill / fruit development</option>
              <option value="maturity">Near harvest</option>
            </select>
            <select name="severity" defaultValue="">
              <option value="">Severity (select)</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
            <input
              name="affectedAreaPercent"
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder="Approx. % of field/plants affected (0–100)"
              className={fieldErrors["pest-pct"] ? "input-invalid" : ""}
            />
            {fieldErrors["pest-pct"] ? <span className="field-error">{fieldErrors["pest-pct"]}</span> : null}
            <select name="recentRain" defaultValue="">
              <option value="">Rain or heavy dew last 48h?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unsure">Unsure</option>
            </select>
            <select name="irrigationType" defaultValue="">
              <option value="">Irrigation type</option>
              <option value="flood">Flood / canal</option>
              <option value="drip">Drip</option>
              <option value="sprinkler">Sprinkler</option>
              <option value="rainfed">Rainfed</option>
            </select>
            <input name="lastSprayWeeks" type="number" min={0} placeholder="Weeks since last spray (optional)" />
          </fieldset>

          <button type="submit" disabled={loading === "pest"}>
            {loading === "pest" ? "Diagnosing..." : "Find Pest Solution"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Fresher Farmer Roadmap + Budget Planning</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setFresherStep(1)}
            disabled={fresherStep === 1}
            style={{ opacity: fresherStep === 1 ? 0.7 : 1 }}
          >
            1) Type of farming
          </button>
          <button
            type="button"
            onClick={() => setFresherStep(2)}
            disabled={fresherStep === 2}
            style={{ opacity: fresherStep === 2 ? 0.7 : 1 }}
          >
            2) Farming type
          </button>
          <button
            type="button"
            onClick={() => setFresherStep(3)}
            disabled={fresherStep === 3}
            style={{ opacity: fresherStep === 3 ? 0.7 : 1 }}
          >
            3) Roadmap + Budget
          </button>
        </div>

        {fresherStep === 1 ? (
          <div className="followup-fields">
            <legend>Choose type of farming</legend>
            <select value={farmingPractice} onChange={(e) => setFarmingPractice(e.target.value)}>
              <option value="integrated">Integrated (scouting + safer inputs)</option>
              <option value="organic">Organic</option>
              <option value="conventional">Conventional</option>
            </select>
            <button type="button" onClick={onFresherNext1} style={{ marginTop: 12 }}>
              Next
            </button>
          </div>
        ) : null}

        {fresherStep === 2 ? (
          <div className="followup-fields">
            <legend>Decide farming type + soil</legend>
            <select value={cropSystem} onChange={(e) => setCropSystem(e.target.value)}>
              <option value="mixed">Crop-system: Mixed cropping</option>
              <option value="mono">Crop-system: Mono-crop</option>
            </select>
            {fieldErrors["fresher-cropsystem"] ? <span className="field-error">{fieldErrors["fresher-cropsystem"]}</span> : null}

            <select value={farmingScale} onChange={(e) => setFarmingScale(e.target.value)}>
              <option value="small">Farming scale: Small</option>
              <option value="medium">Farming scale: Medium</option>
              <option value="large">Farming scale: Large</option>
            </select>
            {fieldErrors["fresher-scale"] ? <span className="field-error">{fieldErrors["fresher-scale"]}</span> : null}

            <select value={fresherSoilType} onChange={(e) => setFresherSoilType(e.target.value)}>
              <option value="clay">Soil type: Clay</option>
              <option value="loam">Soil type: Loam</option>
              <option value="sandy">Soil type: Sandy</option>
            </select>
            {fieldErrors["fresher-soil"] ? <span className="field-error">{fieldErrors["fresher-soil"]}</span> : null}

            <button type="button" onClick={onFresherNext2} style={{ marginTop: 12 }}>
              Next
            </button>
          </div>
        ) : null}

        {fresherStep === 3 ? (
          <form onSubmit={onFresherSubmit} className="form" noValidate>
            <input
              type="number"
              min={0}
              step={0.1}
              value={fresherLandSize}
              onChange={(e) => setFresherLandSize(Number(e.target.value))}
              placeholder="Land size (acres)"
              className={fieldErrors["fresher-land"] ? "input-invalid" : ""}
            />
            {fieldErrors["fresher-land"] ? <span className="field-error">{fieldErrors["fresher-land"]}</span> : null}

            <select value={waterAvailabilityFresher} onChange={(e) => setWaterAvailabilityFresher(e.target.value)} className={fieldErrors["fresher-water"] ? "input-invalid" : ""}>
              <option value="low">Water: Low</option>
              <option value="medium">Water: Medium</option>
              <option value="high">Water: High</option>
            </select>
            {fieldErrors["fresher-water"] ? <span className="field-error">{fieldErrors["fresher-water"]}</span> : null}

            <select value={fresherCropType} onChange={(e) => setFresherCropType(e.target.value)} className={fieldErrors["fresher-crop"] ? "input-invalid" : ""}>
              <option value="paddy">Select crop: Paddy</option>
              <option value="tomato">Select crop: Tomato</option>
              <option value="cotton">Select crop: Cotton</option>
            </select>
            {fieldErrors["fresher-crop"] ? <span className="field-error">{fieldErrors["fresher-crop"]}</span> : null}

            <select value={seedType} onChange={(e) => setSeedType(e.target.value)}>
              <option value="local">Seed: Local</option>
              <option value="certified">Seed: Certified</option>
              <option value="hybrid">Seed: Hybrid</option>
            </select>

            <input
              type="number"
              min={0}
              step={50}
              value={seedCostPerAcre}
              onChange={(e) => setSeedCostPerAcre(Number(e.target.value))}
              placeholder="Seed cost per acre (INR)"
              className={fieldErrors["fresher-seedcost"] ? "input-invalid" : ""}
            />
            {fieldErrors["fresher-seedcost"] ? <span className="field-error">{fieldErrors["fresher-seedcost"]}</span> : null}

            <input
              type="number"
              min={0}
              step={50}
              value={fertilizerCostPerAcre}
              onChange={(e) => setFertilizerCostPerAcre(Number(e.target.value))}
              placeholder="Fertilizer cost per acre (INR)"
              className={fieldErrors["fresher-fertcost"] ? "input-invalid" : ""}
            />
            {fieldErrors["fresher-fertcost"] ? <span className="field-error">{fieldErrors["fresher-fertcost"]}</span> : null}

            <input
              type="number"
              min={0}
              step={1}
              value={fresherLaborDays}
              onChange={(e) => setFresherLaborDays(Number(e.target.value))}
              placeholder="Expected labor days this season (optional)"
            />

            <button type="submit" disabled={loading === "fresher"}>
              {loading === "fresher" ? "Generating..." : "Generate Roadmap + Budget"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="card">
        <h2>Weather Updates and Risk Alert</h2>
        <form onSubmit={onWeatherSubmit} className="form" noValidate>
          <input
            name="district"
            placeholder="District (ex: Coimbatore)"
            className={fieldErrors["wx-dist"] ? "input-invalid" : ""}
          />
          {fieldErrors["wx-dist"] ? <span className="field-error">{fieldErrors["wx-dist"]}</span> : null}
          <input
            name="cropType"
            placeholder="Crop type"
            className={fieldErrors["wx-crop"] ? "input-invalid" : ""}
          />
          {fieldErrors["wx-crop"] ? <span className="field-error">{fieldErrors["wx-crop"]}</span> : null}
          <select name="cropStage" defaultValue="">
            <option value="">Crop stage (optional, improves advice)</option>
            <option value="sowing">Sowing</option>
            <option value="vegetative">Vegetative</option>
            <option value="flowering">Flowering</option>
            <option value="harvest">Harvest prep</option>
          </select>
          <button type="submit" disabled={loading === "weather"}>
            {loading === "weather" ? "Checking..." : "Get Weather Risk"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Crop Cultivation Advice Assistant</h2>
        <form onSubmit={onCultivationSubmit} className="form" noValidate>
          <input
            name="cropType"
            placeholder="Crop type"
            className={fieldErrors["cul-crop"] ? "input-invalid" : ""}
          />
          {fieldErrors["cul-crop"] ? <span className="field-error">{fieldErrors["cul-crop"]}</span> : null}
          <input
            name="stage"
            placeholder="Crop stage (ex: sowing / flowering)"
            className={fieldErrors["cul-stage"] ? "input-invalid" : ""}
          />
          {fieldErrors["cul-stage"] ? <span className="field-error">{fieldErrors["cul-stage"]}</span> : null}
          <select name="soilMoisture" defaultValue="">
            <option value="">Topsoil moisture (optional)</option>
            <option value="dry">Dry</option>
            <option value="moist">Moist</option>
            <option value="waterlogged">Waterlogged</option>
          </select>
          <input name="lastFertilizerWeeks" type="number" min={0} placeholder="Weeks since last fertilizer (optional)" />
          <button type="submit" disabled={loading === "cultivation"}>
            {loading === "cultivation" ? "Checking..." : "Get Cultivation Advice"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Market Price Information and Prediction</h2>
        <form onSubmit={onMarketSubmit} className="form" noValidate>
          <input
            name="cropType"
            placeholder="Crop type"
            className={fieldErrors["mkt-crop"] ? "input-invalid" : ""}
          />
          {fieldErrors["mkt-crop"] ? <span className="field-error">{fieldErrors["mkt-crop"]}</span> : null}
          <input name="mandiName" placeholder="Preferred mandi / market name (optional)" />
          <input
            name="quantityQuintals"
            type="number"
            min={0}
            step={0.1}
            placeholder="Quantity to sell (quintals, optional)"
            className={fieldErrors["mkt-qty"] ? "input-invalid" : ""}
          />
          {fieldErrors["mkt-qty"] ? <span className="field-error">{fieldErrors["mkt-qty"]}</span> : null}
          <button type="submit" disabled={loading === "market"}>
            {loading === "market" ? "Checking..." : "Get Market Insights"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Fertilizer Recommendation and Calculation</h2>
        <form onSubmit={onFertilizerSubmit} className="form" noValidate>
          <input
            name="cropType"
            placeholder="Crop type"
            className={fieldErrors["fer-crop"] ? "input-invalid" : ""}
          />
          {fieldErrors["fer-crop"] ? <span className="field-error">{fieldErrors["fer-crop"]}</span> : null}
          <input
            name="landSize"
            type="number"
            min={0}
            step={0.1}
            placeholder="Land size (acres)"
            className={fieldErrors["fer-acres"] ? "input-invalid" : ""}
          />
          {fieldErrors["fer-acres"] ? <span className="field-error">{fieldErrors["fer-acres"]}</span> : null}
          <input
            name="fertilizerCost"
            type="number"
            min={0}
            placeholder="Estimated fertilizer cost per acre (INR)"
            className={fieldErrors["fer-cost"] ? "input-invalid" : ""}
          />
          {fieldErrors["fer-cost"] ? <span className="field-error">{fieldErrors["fer-cost"]}</span> : null}
          <select name="soilTestDone" defaultValue="">
            <option value="">Soil test in last 12 months?</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <button type="submit" disabled={loading === "fertilizer"}>
            {loading === "fertilizer" ? "Calculating..." : "Get Fertilizer Plan"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Government Schemes Information Finder</h2>
        <form onSubmit={onSchemesSubmit} className="form" noValidate>
          <input
            name="state"
            placeholder="State (ex: Tamil Nadu)"
            className={fieldErrors["sch-state"] ? "input-invalid" : ""}
          />
          {fieldErrors["sch-state"] ? <span className="field-error">{fieldErrors["sch-state"]}</span> : null}
          <select name="landholdingCategory" defaultValue="">
            <option value="">Landholding category (optional)</option>
            <option value="marginal">Marginal</option>
            <option value="small">Small</option>
            <option value="other">Other</option>
          </select>
          <button type="submit" disabled={loading === "schemes"}>
            {loading === "schemes" ? "Checking..." : "Find Schemes"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Response</h2>
        {error ? <p className="error">{error}</p> : null}
        {showCard ? (
          <ResultCard data={result as AdvisoryResult} rawJson={JSON.stringify(result, null, 2)} />
        ) : (
          <pre>{result ? JSON.stringify(result, null, 2) : "Run any module above to see live response."}</pre>
        )}
      </section>
    </main>
  );
}
