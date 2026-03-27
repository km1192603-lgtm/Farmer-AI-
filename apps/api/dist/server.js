import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
const app = express();
app.use(cors());
app.use(express.json());
const uploadsDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".jpg";
        const safeExt = ext.replace(/[^.\w]/g, "");
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
});
const upload = multer({ storage });
app.use("/uploads", express.static(uploadsDir));
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "farmer-api" });
});
app.post("/api/pest-diagnosis", (req, res) => {
    const { cropType, symptomText, imageUrl, growthStage, severity, affectedAreaPercent, recentRain, irrigationType, lastSprayWeeks, } = req.body;
    const hasImage = Boolean(imageUrl);
    const confBase = hasImage ? 0.76 : 0.62;
    const confBoost = (growthStage ? 0.04 : 0) +
        (severity ? 0.03 : 0) +
        (affectedAreaPercent != null && affectedAreaPercent !== "" ? 0.03 : 0) +
        (recentRain ? 0.02 : 0) +
        (irrigationType ? 0.02 : 0) +
        (lastSprayWeeks != null && lastSprayWeeks !== "" ? 0.02 : 0);
    const confidence = Math.min(0.92, confBase + confBoost);
    const diagnosis = hasImage ? "Possible fungal leaf disease (image-assisted)" : "Possible nutrient or fungal leaf issue (symptom-based)";
    const summary = `For ${cropType ?? "your crop"}: ${symptomText ?? "reported symptoms"}. Start with field scouting, confirm pattern on upper/lower leaf, and avoid spraying until cause is clearer if rain is expected.`;
    const actionSteps = [
        "Scout the field: check random plants and both sides of leaves.",
        "Note if spots are circular, angular, or along veins; check for insects under leaves.",
        "Improve drainage or reduce irrigation frequency if leaves stay wet for long.",
        "If fungal pattern is likely, consult local agri officer before any chemical spray.",
        "Record photos and area affected; re-check after 3–5 days.",
    ];
    const sprayConsultCost = 0;
    const ipmKitEstimate = 450 + (affectedAreaPercent ? Math.min(2000, Number(affectedAreaPercent) * 15) : 800);
    const costEstimate = {
        total: ipmKitEstimate + sprayConsultCost,
        currency: "INR",
        breakdown: [
            { label: "Field scouting + pH strip (optional)", amount: 150 },
            { label: "Bio-pest or safer option (indicative)", amount: Math.max(300, ipmKitEstimate - 150) },
        ],
        note: "Chemical cost varies by product and local rates; confirm with licensed dealer.",
    };
    const followUpQuestions = [];
    if (!hasImage)
        followUpQuestions.push("Upload a clear close-up photo of affected leaves (both sides if possible).");
    if (!growthStage)
        followUpQuestions.push("Which growth stage is the crop in (nursery, vegetative, flowering, grain-fill)?");
    if (!severity)
        followUpQuestions.push("How severe is the problem (light / moderate / severe)?");
    if (affectedAreaPercent == null || affectedAreaPercent === "")
        followUpQuestions.push("Roughly what percent of the field or plants show symptoms?");
    if (!recentRain)
        followUpQuestions.push("Did it rain or was there heavy dew in the last 48 hours?");
    if (!irrigationType)
        followUpQuestions.push("What is your main irrigation type (flood, drip, sprinkler, rainfed)?");
    if (lastSprayWeeks == null || lastSprayWeeks === "")
        followUpQuestions.push("When did you last apply pesticide or foliar spray (weeks ago)?");
    res.json({
        title: diagnosis,
        cropType,
        diagnosis,
        confidence,
        summary,
        recommendation: summary,
        actionSteps,
        costEstimate,
        followUpQuestions,
        imageUrl: imageUrl ?? null,
        inputsEcho: {
            growthStage: growthStage ?? null,
            severity: severity ?? null,
            affectedAreaPercent: affectedAreaPercent ?? null,
            recentRain: recentRain ?? null,
            irrigationType: irrigationType ?? null,
            lastSprayWeeks: lastSprayWeeks ?? null,
        },
    });
});
app.post("/api/media/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "Image file is required. Use field name 'image'." });
        return;
    }
    const imageUrl = `http://localhost:${process.env.PORT ?? 4000}/uploads/${req.file.filename}`;
    res.json({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        imageUrl,
    });
});
app.post("/api/weather-risk", async (req, res) => {
    const { district, cropType, cropStage } = req.body;
    async function fetchOpenWeather() {
        const fetchFn = globalThis.fetch;
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            // Fallback: deterministic mock so UI still works without API key.
            const hash = Array.from(String(district ?? "x")).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 1000;
            const temperatureC = 24 + (hash % 12) - 5;
            const rainfallMm = hash % 2 === 0 ? 12 + (hash % 7) : 2 + (hash % 3);
            const humidityPercent = 55 + (hash % 30);
            const windSpeedKmph = 7 + (hash % 35);
            const temperatureType = temperatureC >= 32 ? "hot" : temperatureC <= 18 ? "cold" : "mild";
            const stormMain = windSpeedKmph > 55;
            const sunlightHours = 10.5 + (hash % 3) * 0.3;
            return {
                source: "mock",
                temperatureC,
                temperatureType,
                rainfallMm,
                humidityPercent,
                windSpeedKmph,
                sunlightHours,
                stormCycloneAlert: stormMain ? "Possible storm/cyclone conditions" : "No cyclone conditions detected",
                mainWeather: stormMain ? "Thunderstorm-like" : "Clear/Moderate",
            };
        }
        const q = String(district ?? "");
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&units=metric&appid=${encodeURIComponent(apiKey)}`;
        const r = await fetchFn(url);
        if (!r.ok) {
            throw new Error(`OpenWeather fetch failed: ${r.status}`);
        }
        const j = await r.json();
        const temperatureC = Number(j?.main?.temp);
        const humidityPercent = Number(j?.main?.humidity);
        const windSpeedKmph = Number(j?.wind?.speed);
        const rainfallMm = Number(j?.rain?.["1h"] ?? j?.rain?.["3h"] ?? 0);
        const temperatureType = temperatureC >= 32 ? "hot" : temperatureC <= 18 ? "cold" : "mild";
        const sunrise = j?.sys?.sunrise;
        const sunset = j?.sys?.sunset;
        const sunlightHours = typeof sunrise === "number" && typeof sunset === "number" && sunset > sunrise ? (sunset - sunrise) / 3600 : null;
        const mainWeather = j?.weather?.[0]?.main ?? "";
        const thunder = String(mainWeather).toLowerCase().includes("thunder");
        const stormLikely = thunder || windSpeedKmph >= 55;
        const stormCycloneAlert = stormLikely ? "Possible storm/cyclone conditions" : "No cyclone conditions detected";
        return {
            source: "openweathermap",
            temperatureC,
            temperatureType,
            rainfallMm,
            humidityPercent,
            windSpeedKmph,
            sunlightHours: typeof sunlightHours === "number" ? Number(sunlightHours.toFixed(1)) : 10.5,
            stormCycloneAlert,
            mainWeather,
        };
    }
    function riskFromWeather(w) {
        const rain = Number(w.rainfallMm ?? 0);
        const hum = Number(w.humidityPercent ?? 0);
        const temp = Number(w.temperatureC ?? 0);
        const wind = Number(w.windSpeedKmph ?? 0);
        const storm = String(w.stormCycloneAlert ?? "").toLowerCase().includes("possible");
        const pestHigh = rain >= 10 && hum >= 70 && temp >= 18 && temp <= 32;
        const pestMed = (rain >= 5 && hum >= 60) || (hum >= 75 && (temp < 18 || temp > 32)) || (rain >= 10 && hum >= 60);
        const pestRisk = pestHigh ? "high" : pestMed ? "medium" : "low";
        const weatherHigh = storm || rain >= 20 || temp <= 16 || temp >= 36 || wind >= 70 || (rain >= 10 && hum >= 80);
        const weatherMed = rain >= 5 || hum >= 65 || temp <= 18 || temp >= 34 || wind >= 45;
        const weatherRisk = weatherHigh ? "high" : weatherMed ? "medium" : "low";
        return { pestRisk, weatherRisk };
    }
    try {
        const w = await fetchOpenWeather();
        const { pestRisk, weatherRisk } = riskFromWeather(w);
        const confidence = w.source === "openweathermap" ? 0.8 : 0.55;
        const summary = `Weather risk for ${district ?? "your location"}: ${weatherRisk.toUpperCase()} risk. Pest risk: ${pestRisk.toUpperCase()}.`;
        const alertLevel = weatherRisk;
        const actionSteps = [];
        if (w.stormCycloneAlert.toLowerCase().includes("possible")) {
            actionSteps.push("Check bunds, drainage channels, and remove blockages before strong winds/rain.");
            actionSteps.push("Secure young plants with staking where possible and avoid field entry during gusts.");
            actionSteps.push("After heavy rain/wind, scout for early pest/disease within 2-3 days.");
        }
        if (pestRisk === "high") {
            actionSteps.push("Increase scouting frequency (morning and evening) for leaf spots/insect damage.");
            actionSteps.push("Avoid unnecessary foliar sprays before rain; schedule spraying when leaves remain dry.");
            actionSteps.push("Remove heavily affected leaves to reduce spread (if feasible).");
        }
        else if (pestRisk === "medium") {
            actionSteps.push("Do one field scouting round and set a spray/management plan only after confirming symptoms.");
            actionSteps.push("Maintain correct irrigation to avoid long leaf-wetness.");
        }
        else {
            actionSteps.push("Maintain regular crop care; keep drainage ready in case rain increases.");
        }
        const costEstimate = {
            total: weatherRisk === "high" ? 1500 : weatherRisk === "medium" ? 800 : 0,
            currency: "INR",
            breakdown: weatherRisk === "high"
                ? [{ label: "Drainage and field readiness labor (indicative)", amount: 1500 }]
                : weatherRisk === "medium"
                    ? [{ label: "Light drainage prep (indicative)", amount: 800 }]
                    : [],
            note: "Indicative cost; actual depends on plot size and local wages.",
        };
        const followUpQuestions = [];
        if (!cropStage)
            followUpQuestions.push("Which crop stage is your crop in right now (sowing/tillering/flowering/harvest prep)?");
        followUpQuestions.push("Is your field prone to standing water after rain (yes/no)?");
        if (pestRisk !== "low")
            followUpQuestions.push("Did you notice symptoms within the last 3 days (yes/no)?");
        res.json({
            title: "Weather Updates and Risk Alert",
            district,
            cropType,
            cropStage: cropStage ?? null,
            confidence,
            alertLevel,
            summary,
            recommendation: summary,
            actionSteps,
            costEstimate,
            followUpQuestions,
            weatherParameters: {
                temperatureType: w.temperatureType, // hot/cold/mild
                temperatureC: w.temperatureC,
                rainfallMm: w.rainfallMm,
                humidityPercent: w.humidityPercent,
                windSpeedKmph: w.windSpeedKmph,
                sunlightHours: w.sunlightHours,
                stormCycloneAlert: w.stormCycloneAlert,
                pestRisk,
                weatherRisk,
                source: w.source,
            },
        });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Weather fetch failed";
        res.status(500).json({
            title: "Weather Updates and Risk Alert",
            district,
            cropType,
            alertLevel: "medium",
            confidence: 0.4,
            summary: "Could not fetch live weather right now. Please retry, or set OPENWEATHER_API_KEY for real weather.",
            recommendation: "Retry later for live weather or use pest scouting based on your field observations.",
            actionSteps: ["Do field scouting and follow safe management practices until live data is available."],
            costEstimate: { total: 0, currency: "INR", note: message },
            followUpQuestions: ["Which crop stage is your crop in right now?", "Send a pest/disease photo if you see leaf symptoms."],
            weatherParameters: null,
        });
    }
});
app.post("/api/cultivation-advice", (req, res) => {
    const { cropType, stage, soilMoisture, lastFertilizerWeeks } = req.body;
    const confidence = soilMoisture && lastFertilizerWeeks != null ? 0.78 : 0.66;
    const summary = `For ${cropType ?? "crop"} at ${stage ?? "this stage"}: focus on moisture balance, weed control, and timely nutrient splits aligned to stage.`;
    const actionSteps = [
        "Check soil moisture at 10–15 cm depth before irrigation.",
        "Complete one round of mechanical or safe chemical weed control if needed.",
        "Apply nutrient split for current stage only after soil moisture is adequate.",
        "Scout pests early morning; treat only after correct identification.",
    ];
    const costEstimate = {
        total: 2200,
        currency: "INR",
        breakdown: [
            { label: "Weed management (labor + input, indicative)", amount: 1200 },
            { label: "Micronutrient or stage spray (optional)", amount: 1000 },
        ],
        note: "Scale by acreage; confirm product rates with extension officer.",
    };
    const followUpQuestions = [];
    if (!soilMoisture)
        followUpQuestions.push("Is topsoil currently dry, moist, or waterlogged?");
    if (lastFertilizerWeeks == null || lastFertilizerWeeks === "")
        followUpQuestions.push("How many weeks since last fertilizer application?");
    res.json({
        title: "Cultivation advice",
        cropType,
        stage,
        confidence,
        summary,
        recommendation: summary,
        actionSteps,
        nextActions: actionSteps,
        costEstimate,
        followUpQuestions,
    });
});
app.post("/api/market-insights", (req, res) => {
    const { cropType, mandiName, quantityQuintals } = req.body;
    const confidence = mandiName ? 0.71 : 0.58;
    const currentPrice = 2350;
    const summary = `Indicative mandi trend for ${cropType ?? "commodity"}: upward bias next 7 days. Use local mandi board rates for final decision.`;
    const actionSteps = [
        "Compare today’s rate with last 7-day average at your nearest mandi.",
        "If storage is costly and price trend is flat, consider staggered sale in 2 lots.",
        "Factor transport and bagging cost before net realization.",
        "Watch weather: harvest rush after rain can temporarily depress price.",
    ];
    const transportPerQtl = 120;
    const q = Math.max(1, Number(quantityQuintals) || 10);
    const costEstimate = {
        total: Math.round(transportPerQtl * q * 0.3),
        currency: "INR",
        breakdown: [
            { label: "Transport + loading (30% of full haul, indicative)", amount: Math.round(transportPerQtl * q * 0.3) },
        ],
        note: "Net price = gross mandi rate minus transport, commission, and moisture deductions.",
    };
    const followUpQuestions = [];
    if (!mandiName)
        followUpQuestions.push("Which mandi or market do you usually sell at?");
    if (!quantityQuintals)
        followUpQuestions.push("How many quintals do you plan to sell this week?");
    res.json({
        title: "Market insight",
        cropType,
        currentPrice,
        trend: "upward",
        prediction: "Likely 4–7% increase in next 7 days (indicative model)",
        confidence,
        summary,
        recommendation: summary,
        actionSteps,
        costEstimate,
        followUpQuestions,
    });
});
app.post("/api/fertilizer-plan", (req, res) => {
    const { cropType, landSize, fertilizerCost, soilTestDone } = req.body;
    const acres = Number(landSize ?? 1);
    const perAcre = Number(fertilizerCost ?? 1000);
    const totalCost = acres * perAcre;
    const confidence = soilTestDone === "yes" || soilTestDone === true ? 0.8 : 0.63;
    const summary = `NPK split plan for ${cropType ?? "crop"} on ${acres} acre(s). Prefer soil-test-based dosing when possible.`;
    const actionSteps = [
        "Apply basal dose before or at sowing as per local recommendation.",
        "Split top-dress to match tillering/flowering windows.",
        "Avoid applying urea on dry soil; irrigate lightly after if recommended.",
        "If soil test is available, adjust NPK to test report targets.",
    ];
    const costEstimate = {
        total: totalCost,
        currency: "INR",
        breakdown: [
            { label: `Fertilizer (${acres} ac × indicative rate)`, amount: totalCost },
            { label: "Soil test (optional, per sample)", amount: 400 },
        ],
        note: "Soil test cost is one-time; reduces risk of over-fertilization.",
    };
    const followUpQuestions = [];
    if (!soilTestDone || soilTestDone === "")
        followUpQuestions.push("Have you done a soil test in the last 12 months (yes/no)?");
    res.json({
        title: "Fertilizer plan",
        cropType,
        npkSplit: ["Basal: 40%", "Active growth: 35%", "Flowering/grain-fill: 25%"],
        confidence,
        summary,
        recommendation: summary,
        actionSteps,
        costEstimate,
        followUpQuestions,
    });
});
app.post("/api/schemes-finder", (req, res) => {
    const { state, landholdingCategory } = req.body;
    const confidence = landholdingCategory ? 0.72 : 0.6;
    const schemes = [
        { name: "PM-KISAN", eligibility: "Small and marginal farmers", actionSteps: ["Link Aadhaar to land records", "Apply via official portal or CSC"] },
        { name: "Crop Insurance", eligibility: "Registered cultivators", actionSteps: ["Enroll before cutoff date", "Keep sowing declaration proof"] },
    ];
    const summary = `Potential schemes for ${state ?? "your state"}. Verify eligibility on official portals before application.`;
    const actionSteps = [
        "Open state agriculture department portal and filter by farmer category.",
        "Prepare land document, bank passbook, and identity proof.",
        "Apply only through official links; avoid middleman fees.",
        "Save acknowledgement number and follow SMS updates.",
    ];
    const costEstimate = {
        total: 0,
        currency: "INR",
        breakdown: [{ label: "Government scheme application (typical)", amount: 0 }],
        note: "CSC or agent may charge a nominal service fee; official application is often free.",
    };
    const followUpQuestions = [];
    if (!landholdingCategory)
        followUpQuestions.push("Are you marginal, small, or other farmer category (as per land records)?");
    res.json({
        title: "Government schemes",
        state,
        confidence,
        summary,
        recommendation: summary,
        actionSteps,
        schemes,
        costEstimate,
        followUpQuestions,
    });
});
app.post("/api/fresher-roadmap", (req, res) => {
    const { 
    // Fresher step inputs
    farmingPractice, cropSystem, farmingScale, soilType, cropType, seedType, 
    // Budget inputs
    landSize, waterAvailability, seedCost, fertilizerCost, laborDays, } = req.body;
    const acres = Number(landSize ?? 0) || 1;
    const seedPerAcre = Number(seedCost ?? 0);
    const fertPerAcre = Number(fertilizerCost ?? 0);
    const labor = Number(laborDays ?? 12) * 450; // 450 INR per labor day (indicative)
    const landPrep = acres * 5000;
    const equipmentMap = {
        paddy: { items: ["Rice nursery trays/bed", "Paddy transplanting tools (if applicable)", "Irrigation pump/pipe", "Weed control kit"], rentalPerAcre: 1400 },
        tomato: { items: ["Drip irrigation kit (recommended)", "Plant support stakes/twine", "Seedling trays + shade net", "Mulching material (straw/film)"], rentalPerAcre: 1800 },
        cotton: { items: ["Seed drill or row planting tools", "Weed control implement", "Sprayer (manual/power as needed)", "Insect monitoring traps (yellow sticky cards)"], rentalPerAcre: 1500 },
    };
    const cropKey = String(cropType ?? "").toLowerCase().includes("tom") ? "tomato" : String(cropType ?? "").toLowerCase().includes("cot") ? "cotton" : "paddy";
    const equip = equipmentMap[cropKey];
    const equipmentRentalTotal = acres * equip.rentalPerAcre;
    const organicAddOn = String(farmingPractice ?? "").toLowerCase().includes("organic") ? acres * 600 : 0;
    const integratedAddOn = String(farmingPractice ?? "").toLowerCase().includes("integrated") ? acres * 350 : 0;
    const seedTotal = acres * seedPerAcre;
    const fertilizerTotal = acres * fertPerAcre;
    const budget = seedTotal + fertilizerTotal + landPrep + labor + equipmentRentalTotal + organicAddOn + integratedAddOn;
    const soilAdvice = soilType === "clay"
        ? "Clay soil holds water; prioritize drainage and avoid prolonged waterlogging."
        : soilType === "sandy"
            ? "Sandy soil drains fast; plan frequent light irrigation and organic matter addition."
            : soilType === "loam"
                ? "Loam soil is balanced; focus on consistent moisture and timely nutrient splits."
                : "Use soil test when possible; adjust nutrients and irrigation accordingly.";
    const cropSystemNote = cropSystem === "mixed"
        ? "Mixed cropping can reduce pest pressure if crop choices are compatible."
        : "Mono-crop management is simpler; keep scouting strict and control weeds early.";
    const practiceNote = farmingPractice === "organic"
        ? "Organic practice: increase compost/organic matter and avoid unnecessary harsh chemicals."
        : farmingPractice === "conventional"
            ? "Conventional practice: follow label dosages and follow safe spray timings."
            : "Integrated practice: combine scouting, cultural methods, and targeted inputs.";
    const confidenceBase = 0.62;
    const confidenceBoost = (soilType ? 0.05 : 0) +
        (farmingPractice ? 0.06 : 0) +
        (cropSystem ? 0.04 : 0) +
        (seedType ? 0.04 : 0) +
        (Number(seedPerAcre) > 0 ? 0.03 : 0) +
        (Number(fertPerAcre) > 0 ? 0.03 : 0);
    const confidence = Math.min(0.9, confidenceBase + confidenceBoost);
    const roadmap = [
        "1) Field preparation: leveling and weed cleaning",
        "2) Soil preparation: compost/organic matter or gypsum as needed (per soil type)",
        "3) Seed/seedling preparation: seed treatment (or seedling nursery management)",
        "4) Sowing/Transplanting: choose window based on local calendar",
        "5) Early crop care: irrigation schedule + gap filling",
        "6) Nutrient management: basal and split doses as per growth stage",
        "7) Pest and disease scouting: weekly checks + early removal of affected parts",
        "8) Weed management: first 30-45 days are critical (keep field clean)",
        "9) Harvest planning: reduce irrigation before harvest (crop dependent)",
        "10) Post-harvest: drying, grading, storage to avoid price loss",
    ];
    const actionSteps = [
        `Start with your plan: ${practiceNote}`,
        `Soil guidance: ${soilAdvice}`,
        cropSystemNote,
        "Book seed and fertilizers early to reduce price shocks.",
        "Maintain a simple season diary: dates of sowing, irrigation, fertilizer, and any pest events.",
        "Set a weekly scouting reminder (mobile alarm) to keep confidence high.",
    ];
    const seedSuggestions = [
        seedType ? `Selected seed type: ${seedType}` : "Choose certified seeds for better germination",
        "Prefer regionally proven varieties (ask local agri officer if unsure).",
    ];
    const equipmentSuggestions = [
        ...equip.items,
        soilType === "clay" ? "Drainage channels tools (small shovels/weed removal) - needed" : "Mulching helps maintain soil moisture",
    ];
    const costEstimate = {
        total: Math.round(budget),
        currency: "INR",
        breakdown: [
            { label: "Seed (acres * seed cost per acre)", amount: Math.round(seedTotal) },
            { label: "Fertilizer (acres * fertilizer cost per acre)", amount: Math.round(fertilizerTotal) },
            { label: "Land preparation (indicative)", amount: Math.round(landPrep) },
            { label: "Equipment rental (indicative)", amount: Math.round(equipmentRentalTotal) },
            { label: "Labor (indicative)", amount: Math.round(labor) },
        ],
        note: "Add 10-15% buffer for price shocks and weather delays.",
    };
    const followUpQuestions = [];
    if (!waterAvailability)
        followUpQuestions.push("What is your water situation (low/medium/high)?");
    if (!soilType)
        followUpQuestions.push("Select your soil type (clay/loam/sandy) or do a quick soil test.");
    if (!seedType)
        followUpQuestions.push("Which seed type do you prefer (local/certified/hybrid)?");
    if (!cropType)
        followUpQuestions.push("Select crop type for a more accurate equipment + seed suggestion.");
    res.json({
        title: "Fresher Farmer Roadmap + Budget Planning",
        confidence,
        summary: `Budget friendly plan for ${cropType ?? "your crop"} on ${acres} acre(s}. Water: ${waterAvailability ?? "given"}.`,
        recommendation: "Follow roadmap week-by-week and update decisions based on field scouting.",
        inputs: {
            landSizeAcres: acres,
            waterAvailability,
            farmingPractice,
            cropSystem,
            farmingScale,
            soilType,
            cropType,
            seedType,
        },
        roadmap,
        actionSteps,
        seedSuggestions,
        equipmentSuggestions,
        costEstimate,
        estimatedBudget: Math.round(budget),
        followUpQuestions,
    });
});
app.post("/api/assistant/query", (req, res) => {
    const { language, message, imageUrl, voice } = req.body;
    const confidence = imageUrl ? 0.78 : 0.7;
    const summary = `Assistant response (${language ?? "en"}) for your question. Cross-check critical agronomy steps with local extension.`;
    const actionSteps = [
        "Confirm crop stage and district weather before acting on spray advice.",
        "If pest/disease: take photos and note spread pattern.",
        "If market: verify mandi rate the same morning.",
        "If scheme: use only official portal links.",
    ];
    const costEstimate = {
        total: 0,
        currency: "INR",
        breakdown: [{ label: "In-app guidance", amount: 0 }],
        note: "Voice mode may use mobile data; use Wi-Fi if available.",
    };
    res.json({
        title: "AI assistant",
        language,
        answer: `Advisory generated for "${message ?? ""}"`,
        confidence,
        summary,
        recommendation: summary,
        actionSteps: [
            ...actionSteps,
            imageUrl ? "Image received: include more angles if diagnosis unclear." : "Add a photo for better pest/disease guidance.",
            voice ? "Voice mode: repeat key numbers back to confirm understanding." : "Text mode: save this response as screenshot if needed.",
        ],
        actions: [
            "Profile-aware guidance generated",
            imageUrl ? "Pest image analysis included" : "Text advisory mode used",
            voice ? "Voice response can be generated" : "Text response mode",
        ],
        costEstimate,
        followUpQuestions: [
            "What is your exact district and crop stage right now?",
            "Do you want low-cost options only, or standard recommended products too?",
        ],
    });
});
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    console.log(`Farmer API listening on port ${port}`);
});
