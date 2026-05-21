export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const PRIORITY_COLORS = {
  knee: "#E8453C",
  heart: "#3B82F6",
  flex: "#10B981",
  cali: "#F59E0B",
  recovery: "#8B5CF6",
  sport: "#EC4899",
};

export const PRIORITY_LABELS = {
  knee: "Knee Fix",
  heart: "Heart Rate",
  flex: "Flexibility",
  cali: "Calisthenics",
  recovery: "Recovery",
  sport: "Sport",
};

export const ACTIVITIES = {
  mobility: {
    name: "Mobility Routine",
    icon: "🧘",
    duration: "20 min",
    priority: "flex",
    mustDo: [
      "Hip flexor couch stretch — 90s each side. Kneel with back foot on couch/wall, squeeze glute, lean forward until stretch in front of hip.",
      "Pigeon pose — 90s each side. Front shin roughly parallel to mat, back leg extended. Stay upright or fold forward.",
      "90/90 hip switches — 10 reps each way. Sit with both legs at 90°, rotate from one side to other keeping knees on ground.",
      "Hamstring stretch with strap/towel — 60s each side. Lie on back, loop strap around foot, straighten leg toward ceiling.",
      "Thoracic spine rotations (open book) — 10 each side. Lie on side, knees stacked at 90°, rotate top arm across body.",
      "Deep squat hold — 2 min cumulative (break into sets). Heels down, chest up, push knees out with elbows.",
      "Ankle dorsiflexion wall stretch — 30s each side. Front foot 10cm from wall, push knee over toes.",
    ],
    avoid: [
      "Never bounce into stretches — smooth, sustained holds only",
      "Don't push through sharp pain in the right knee — work around it",
      "Avoid bending the right knee past the angle that triggers your medial pain",
    ],
    notes:
      "Longer holds (60–90s) are far more effective than short 20–30s stretches for actual range-of-motion gains. It takes at least 20–30s just to overcome the stretch reflex. Do this barefoot for better proprioceptive feedback. Breathe deeply and steadily through each hold — exhale into the stretch.",
    links: [
      { text: "Couch Stretch form (Tom Merrick)", url: "https://www.youtube.com/watch?v=K-iSByoOcYI" },
      { text: "Pigeon Pose guide (Yoga with Adriene)", url: "https://www.youtube.com/watch?v=dqVhBbmcNAg" },
      { text: "90/90 Hip Switches (Squat University)", url: "https://www.youtube.com/watch?v=bPCnS6GGD3I" },
      { text: "Thoracic Rotation drill", url: "https://www.youtube.com/watch?v=MKjOlBiEbf0" },
      { text: "Deep Squat Mobility (Tom Merrick)", url: "https://www.youtube.com/watch?v=M9W01erRwbg" },
    ],
  },
  foam: {
    name: "Foam Rolling",
    icon: "🔵",
    duration: "10 min",
    priority: "flex",
    mustDo: [
      "ITB / outer thigh — 60s each side. Lie on side, roll from hip to just above knee. Pause on tender spots.",
      "VMO / inner quad above kneecap — 60s each side. Lie face down, angle leg out, roll the inner quad area slowly.",
      "Adductors / inner thigh — 60s each side. Lie face down with one leg out to side, roll inner thigh.",
      "Calves — 60s each side. Sit with roller under calf, cross other leg on top for pressure. Rotate foot in/out to hit different fibers.",
    ],
    avoid: [
      "Never roll directly on the kneecap or directly behind the knee",
      "Don't roll the lower back (use a ball on specific spots instead)",
      "Avoid rolling too fast — slow, deliberate passes are effective",
    ],
    notes:
      "Foam roll BEFORE stretching for better results — it reduces trigger point tension first, allowing deeper stretch. The VMO and adductors rolling is especially important for your medial knee pain — trigger points in these muscles can refer pain into the knee joint.",
    links: [
      { text: "VMO & Adductor foam rolling", url: "https://www.youtube.com/watch?v=fKCVRpLMaQI" },
      { text: "ITB foam rolling technique", url: "https://www.youtube.com/watch?v=MaEN5PVnJNc" },
      { text: "Calf foam rolling (Physiotutors)", url: "https://www.youtube.com/watch?v=emKAEgjGPgs" },
    ],
  },
  upper: {
    name: "Upper Body + Core",
    icon: "💪",
    duration: "30 min",
    priority: "cali",
    mustDo: [
      "Push-up progression — 3×10-12. Standard → diamond → archer. Full range, chest to floor, controlled tempo.",
      "Pull-up or inverted row progression — 3×8-10. Dead hang → negatives → full pull-ups. Squeeze shoulder blades.",
      "Overhead press (dumbbell or barbell) — 3×10. Stand tall, brace core, press directly overhead.",
      "Dead bugs — 3×10 each side. Back flat on floor (no arch), opposite arm and leg extend, breathe out as you extend.",
      "Pallof press — 3×10 each side. Cable or band at chest height, press straight out, resist rotation.",
      "Hanging leg raises — 3×8. Dead hang, lift knees to chest (progress to straight legs). No swinging.",
    ],
    avoid: [
      "No ego loading — controlled reps with full range beat heavy sloppy reps",
      "If overhead press bothers your shoulders, substitute landmine press",
      "Don't hold your breath during core work — exhale on exertion",
    ],
    notes:
      "Superset TKEs between upper body sets — e.g., do a set of push-ups, immediately do 15 TKEs on the right leg, then rest. This way you get your VMO rehab done without adding time. For calisthenics progression: track your max reps each week. When you hit 3×12 clean, progress to the next variation.",
    links: [
      { text: "Push-up progression guide (FitnessFAQs)", url: "https://www.youtube.com/watch?v=GdISLQcbGEo" },
      { text: "Pull-up progression (Hybrid Calisthenics)", url: "https://www.youtube.com/watch?v=fO3dKSQayfg" },
      { text: "Dead Bug form (Squat University)", url: "https://www.youtube.com/watch?v=I5xbsA71v1I" },
      { text: "Pallof Press technique", url: "https://www.youtube.com/watch?v=AH_QZLm_0-s" },
      { text: "Hanging Leg Raise progression", url: "https://www.youtube.com/watch?v=Pr1ieGZ5atk" },
    ],
  },
  upper2: {
    name: "Upper Body Session 2",
    icon: "💪",
    duration: "25 min",
    priority: "cali",
    mustDo: [
      "Pull-up progression — 3×max reps. Focus on full dead hang at bottom, chin over bar at top.",
      "Pike push-ups (handstand progression) — 3×6-8. Feet elevated on bench, hips high, head toward floor between hands.",
      "Dumbbell rows — 3×10 each arm. Brace on bench, pull elbow past ribcage, squeeze at top.",
      "L-sit holds — 3×max time. On parallel bars or floor with hands beside hips. Legs straight, hold.",
      "Ab wheel rollouts — 3×8. Kneel, roll out slowly with core tight, don't let lower back sag.",
    ],
    avoid: [
      "Don't kip on pull-ups — strict form builds real strength",
      "If pike push-ups cause wrist pain, use push-up handles or parallettes",
      "Stop ab wheel before your lower back arches — that's your current limit, not failure",
    ],
    notes:
      "This is your second upper body session of the week. Slightly more pull-dominant and calisthenics-focused than Monday. If you're fresh, try to progress one exercise (add a rep, hold longer, try harder variation). TKEs between sets as always.",
    links: [
      { text: "Pike Push-up to Handstand progression", url: "https://www.youtube.com/watch?v=Oy5sOi6WfbI" },
      { text: "L-Sit progression (FitnessFAQs)", url: "https://www.youtube.com/watch?v=IUZJoSP66HI" },
      { text: "Ab Wheel form guide", url: "https://www.youtube.com/watch?v=rqiTPdK1c_I" },
    ],
  },
  tke: {
    name: "TKE + VMO Activation",
    icon: "🦵",
    duration: "10 min",
    priority: "knee",
    mustDo: [
      "Terminal Knee Extensions — 3×15 right leg. Loop resistance band behind knee at 30° flexion, straighten to full extension. Slow and deliberate. Feel the VMO contract.",
      "Place two fingers on VMO (inner quad above kneecap) during each rep — biofeedback accelerates neural re-education.",
      "Pause at full extension for 1 second, squeezing the quad hard.",
    ],
    avoid: [
      "Don't use a band that's too heavy — moderate resistance with perfect activation beats heavy resistance with compensation",
      "Don't rush — each rep should take 3-4 seconds",
      "Never push through sharp medial knee pain during these",
    ],
    notes:
      "This is your #1 non-negotiable exercise. Do it before EVERY activity — running, football, gym, even swimming. The purpose is to wake up the inhibited VMO and train the nervous system to fully activate the inner quad. Your right quad produces only 127 Nm vs 182 Nm on the left (30% deficit). This exercise directly targets the arthrogenic muscle inhibition from your cartilage surgery.",
    links: [
      { text: "TKE form guide (E3 Rehab)", url: "https://www.youtube.com/watch?v=WDyMnIBnMJI" },
      { text: "VMO activation explained (Physiotutors)", url: "https://www.youtube.com/watch?v=cFYMnONJmrI" },
    ],
  },
  quads: {
    name: "Quad Sets (100 reps)",
    icon: "⚡",
    duration: "10 min total (spread through day)",
    priority: "knee",
    mustDo: [
      "Place rolled towel under right knee while seated or lying down.",
      "Squeeze quadriceps to straighten the leg, pressing knee down into towel.",
      "Hold each contraction 5 seconds. Two fingers on VMO for biofeedback.",
      "100 reps daily — split into batches of 20-25 throughout the day.",
    ],
    avoid: [
      "Don't skip these because they seem 'too easy' — the volume is what drives neural re-education",
      "Don't do them all in one sitting — spread through the day for repeated neural stimulus",
    ],
    notes:
      "Do these at your desk, watching TV, on calls, waiting for code to compile. Each rep takes 5 seconds. 100 reps = 10 minutes total. Nobody will notice you doing them at work. This is the base layer neural work that makes everything else effective.",
    links: [
      { text: "Quad Sets tutorial", url: "https://www.youtube.com/watch?v=F5FNj7GBBII" },
    ],
  },
  cycling: {
    name: "Cycling Zone 2",
    icon: "🚴",
    duration: "45 min",
    priority: "heart",
    mustDo: [
      "HR strictly under 130 BPM throughout. If it creeps up, reduce resistance or slow down.",
      "Cadence 80-90 RPM — high cadence, low resistance is easier on the knee.",
      "Keep saddle high enough — 25-30° bend at bottom of pedal stroke. Too low = deep flexion on every rep.",
      "Steady effort — should be conversational throughout. If you can't talk, you're too hard.",
    ],
    avoid: [
      "Don't stand on the pedals (loads the knee in deep flexion)",
      "Don't use high resistance/low cadence — that's strength work, not aerobic base",
      "Don't coast — constant pedaling maintains the aerobic stimulus",
    ],
    notes:
      "Cycling Zone 2 is the cornerstone of your heart rate improvement goal. Your heart can't tell whether you're running or cycling at the same HR — the aerobic adaptation is equivalent. But cycling is zero impact and the concentric-only quad loading actually helps VMO activation without eccentric damage. On nice days, ride your bike outdoors on flat Delft routes instead of the gym bike.",
    links: [
      { text: "Zone 2 training explained (Dr. Iñigo San-Millán)", url: "https://www.youtube.com/watch?v=kDFVsLfaKpY" },
      { text: "Proper bike saddle height", url: "https://www.youtube.com/watch?v=FEMeNnNRhG4" },
      { text: "Heart Rate Zone guide (Polar)", url: "https://www.polar.com/blog/running-heart-rate-zones-basics/" },
    ],
  },
  cycling_short: {
    name: "Cycling Z2 (short)",
    icon: "🚴",
    duration: "25 min",
    priority: "heart",
    mustDo: [
      "Same rules as full cycling session — HR under 130, cadence 80-90 RPM.",
      "This is a shorter session doubling as active recovery from football the night before.",
      "Gentle spin to flush metabolic waste and promote blood flow to legs.",
    ],
    avoid: [
      "Don't push intensity — this is recovery + aerobic base, not a hard session",
      "If legs feel heavy from football, reduce resistance further",
    ],
    notes:
      "Shorter cycling session before your second upper body block. The active recovery effect from easy cycling accelerates clearance of metabolic waste from Thursday football.",
    links: [
      { text: "Active recovery cycling", url: "https://www.youtube.com/watch?v=Y1YO1fy0jns" },
    ],
  },
  legreh: {
    name: "Leg Rehab + Glute Med",
    icon: "🏋️",
    duration: "40 min",
    priority: "knee",
    mustDo: [
      "Warm up: TKEs 3×15 right leg first (always).",
      "Spanish squats — 3×12, 3-second descent. Band at knee height around fixed point. Sit into squat. Quad dominant, minimal hamstring.",
      "Single-leg eccentric step-downs (right leg) — 3×10, 5-second descent. Stand on 15-20cm step, lower left foot toward floor. Don't touch floor. Track knee over middle toe, press slightly outward.",
      "Single-leg press RIGHT leg — 3×12 moderate weight. Drive through heel, feel VMO fire, pause at full extension 1 second.",
      "Single-leg press LEFT leg heavy — 3×12. Cross-education: heavy training on the unaffected leg produces neural adaptations that transfer to the inhibited right side.",
      "Side-lying hip abduction — 3×15 each side. Bottom hip/knee bent, top leg straight, ankle in line with shoulder. Lift and hold 2s at top.",
      "Banded lateral walks — 2×10 steps each direction. Band around ankles, semi-squat position, feet forward, controlled steps.",
      "Clamshells — 3×15 each side. Side-lying, knees bent 90°, heels together, open top knee. Band above knees for progression.",
    ],
    avoid: [
      "Don't pile on weight on the right leg press — moderate load with conscious VMO activation beats heavy load",
      "Don't push through medial knee pain on step-downs — reduce step height",
      "Avoid full depth squats — stay in the pain-free range",
      "Skip the leg extension machine entirely — it loads the patella at the worst angles",
    ],
    notes:
      "This is your most important gym session of the week. The Spanish squat is quad-dominant with minimal hamstring, directly countering your inverted H:Q ratio (109%). The eccentric step-downs mimic the demand where your right leg fails. Track step-down depth week-over-week — progress from 15cm → 20cm → 25cm.\n\nWhy gluteus medius matters: A systematic review (Nascimento et al., JOSPT 2018) found hip + knee strengthening combined is more effective than knee strengthening alone for patellofemoral pain. PFPS patients show 14% weaker hip abductors — this allows excessive femoral adduction during running/cutting, increasing lateral patellofemoral contact pressure. Just 10° of hip internal rotation increases PF joint stress by 50%.",
    links: [
      { text: "Spanish Squat form (E3 Rehab)", url: "https://www.youtube.com/watch?v=6LmAkCmTQoI" },
      { text: "Eccentric Step-Down technique (Physiotutors)", url: "https://www.youtube.com/watch?v=R6qf3sAjjMk" },
      { text: "Single-leg press VMO focus", url: "https://www.youtube.com/watch?v=8DoaiLQiSck" },
      { text: "Cross-education research explained", url: "https://www.youtube.com/watch?v=H1kz0F5PTF0" },
      { text: "Gluteus Medius strengthening (E3 Rehab)", url: "https://www.youtube.com/watch?v=oyGEVPuumtk" },
      { text: "Banded lateral walks technique", url: "https://www.youtube.com/watch?v=jghbMRtGNYo" },
      { text: "Clamshell exercise guide", url: "https://www.youtube.com/watch?v=cjk0VGMzYms" },
    ],
  },
  swim: {
    name: "Swimming",
    icon: "🏊",
    duration: "30-40 min",
    priority: "recovery",
    mustDo: [
      "Freestyle and backstroke only. Easy to moderate effort.",
      "Focus on long, smooth strokes and bilateral breathing (every 3 strokes).",
      "Mix in some backstroke for shoulder mobility and to break up freestyle.",
      "Aim for continuous swimming — 1000-1500m total is a good target.",
    ],
    avoid: [
      "NO breaststroke — the whip kick loads the medial knee in exactly the position that causes your pain",
      "Don't use a kickboard excessively — sustained kicking can aggravate the knee",
      "Don't sprint — keep this as active recovery / low-intensity aerobic work",
    ],
    notes:
      "Swimming is zero-impact and the hydrostatic pressure of water aids recovery. It works your upper body, core, shoulders and back in ways cycling and running can't. Wednesday evening swim after leg rehab is especially beneficial — the water recovery effect helps your legs before Thursday football. Sunday swim is pure active recovery from Saturday's long run.",
    links: [
      { text: "Freestyle technique for beginners/improvers", url: "https://www.youtube.com/watch?v=Sb7moHqEiig" },
      { text: "Backstroke technique", url: "https://www.youtube.com/watch?v=bPb7euliQ7E" },
      { text: "Why swimmers should skip breaststroke with knee issues", url: "https://www.youtube.com/watch?v=MiE6BTNQCF0" },
    ],
  },
  rest: {
    name: "Daytime Rest",
    icon: "😴",
    duration: "—",
    priority: "recovery",
    mustDo: [
      "No gym session today. Legs need to be completely fresh for football tonight.",
      "Do quad sets at your desk through the day (50 reps before football, 50 after).",
      "Stay hydrated — electrolytes if needed.",
    ],
    avoid: [
      "Don't sneak in a gym session — real rest is part of the plan",
      "Avoid sitting for extended periods — walk around, take the stairs",
    ],
    notes:
      "Rest days are when adaptation happens. Your muscles and nervous system rebuild stronger during rest, not during training. Trust the process.",
    links: [],
  },
  football: {
    name: "5-a-side Football",
    icon: "⚽",
    duration: "50 min",
    priority: "sport",
    mustDo: [
      "TKEs 3×15 as activation warm-up before playing (2 min, non-negotiable).",
      "Dynamic warm-up: leg swings, hip circles, lateral shuffles, short sprints.",
      "During play: if right knee starts talking, reduce sharp direction changes.",
      "After: 10 min mobility — hip flexors, adductors, hamstrings (60s holds).",
    ],
    avoid: [
      "Don't skip the TKE warm-up — it primes the VMO for the cutting movements",
      "Avoid sudden full-speed direction changes if knee is sore",
      "Don't play through medial knee pain — your football isn't worth setting back weeks of rehab",
    ],
    notes:
      "Football counts as your high-intensity interval training for the week. The sprints, direction changes and reactive movements push your cardiovascular system in ways steady-state cycling/running can't. The morning TKEs prime your VMO so it's more active during play, reducing compensatory hamstring loading. Kicking with the inside of the foot is actually a functional VMO exercise — the adductor magnus shares innervation with the VMO.",
    links: [
      { text: "Pre-football dynamic warm-up", url: "https://www.youtube.com/watch?v=Y5JMnMEOGPU" },
      { text: "Knee-safe direction changes", url: "https://www.youtube.com/watch?v=1CkGkhVGFJY" },
    ],
  },
  run: {
    name: "Long Run (sub-150 HR)",
    icon: "🏃",
    duration: "60-90 min",
    priority: "heart",
    mustDo: [
      "TKEs 3×15 right leg before you start (non-negotiable).",
      "Dynamic warm-up: leg swings, hip circles, walking lunges with rotation, 5 min easy jog.",
      "HR strictly under 150 BPM throughout. Walk if needed to keep HR down.",
      "Prefer soft surfaces — gravel paths, grass, athletics track. Avoid Delft cobblestones and concrete.",
      "After run: foam roll everything (ITB, quads, hamstrings, calves, adductors).",
      "Post-run static stretches: hip flexors, hamstrings, calves, piriformis — 60s holds each.",
    ],
    avoid: [
      "Don't chase pace — this is purely aerobic base building. Speed is irrelevant.",
      "If right knee gives medial pain: shorten stride, increase cadence. If it persists, stop.",
      "Don't skip post-run foam rolling and stretching — your muscles tighten most after running",
      "No downhill running — each downhill step produces 5-8× bodyweight eccentric force your right quad can't handle yet",
    ],
    notes:
      "Your once-weekly long run builds mitochondrial density and fat oxidation capacity. Zone 2 training improves all zones above it — training in higher zones does NOT improve lower-zone fitness. The sub-150 HR cap means this will feel slow. That's correct. Track your pace at 150 HR month-over-month — as your aerobic base improves, you'll run faster at the same HR.\n\n24-hour rule: If pain is the same or better 24 hours after running, you tolerated the load. If pain is worse 24h later, reduce distance next week.",
    links: [
      { text: "Zone 2 running explained (Dr. Howard Luks)", url: "https://www.howardluksmd.com/zone-2-hr-training-live-longer-less-injury/" },
      { text: "Heart Rate Drift test (Uphill Athlete)", url: "https://uphillathlete.com/aerobic-training/heart-rate-drift/" },
      { text: "Post-run stretching routine", url: "https://www.youtube.com/watch?v=6vhssknCAQg" },
    ],
  },
  deep: {
    name: "Deep Mobility Session",
    icon: "🧎",
    duration: "25-30 min",
    priority: "flex",
    mustDo: [
      "Couch stretch for hip flexors — 90s each side. Back foot on wall/couch, squeeze glute, lean in.",
      "Pigeon pose — 90s each side. Go deeper than your daily mobility session. Fold forward for max stretch.",
      "Hamstring with strap — 90s each side (longer hold than daily).",
      "90/90 hip switches — 10 each direction, slow and controlled.",
      "Thoracic rotations — 10 each side, 3-second holds at end range.",
      "Deep squat hold — 3 min cumulative. Heels down, chest up, breathe deep.",
      "Ankle dorsiflexion — 45s each side against wall.",
      "Seated forward fold — 90s. Legs straight, hinge at hips, reach for feet.",
      "Supine spinal twist — 60s each side. Knees to one side, look opposite.",
    ],
    avoid: [
      "Don't rush — this is your longest mobility session. Quality over quantity.",
      "Don't stretch cold muscles — foam roll first or do after a warm shower",
      "Avoid any position that reproduces your medial knee pain",
      "No deep pigeon, Virasana (hero pose), or full lotus — these force extreme knee flexion/rotation",
    ],
    notes:
      "This is your weekly 'investment' session. The longer holds (90s) are where real range-of-motion gains happen. Friday deep session loosens hips and hamstrings before Saturday's long run. Sunday deep session is the most restorative session of the week. Consider putting on a podcast or relaxing music.\n\nUse supine figure-4 stretch (lying on back, ankle on opposite knee) instead of deep pigeon if pigeon triggers medial knee pain.",
    links: [
      { text: "Full 30-min flexibility routine (Tom Merrick)", url: "https://www.youtube.com/watch?v=L_xrDAtykMI" },
      { text: "Deep squat mobility flow", url: "https://www.youtube.com/watch?v=M9W01erRwbg" },
      { text: "Spinal twist stretch guide", url: "https://www.youtube.com/watch?v=WCLMgVP_MrI" },
      { text: "Science of Stretching (YOGABODY)", url: "https://www.yogabody.com/stretching/" },
    ],
  },
  warmup: {
    name: "Pre-run Warm-up",
    icon: "🔥",
    duration: "15 min",
    priority: "knee",
    mustDo: [
      "TKEs 3×15 right leg — always first.",
      "Leg swings forward/back — 15 each leg.",
      "Leg swings side-to-side — 15 each leg.",
      "Hip circles — 10 each direction each leg.",
      "Walking lunges with rotation — 10 each side (shallow depth).",
      "Light foam roll: quads, calves (2 min).",
      "5 min easy jog building to run pace.",
    ],
    avoid: [
      "Don't static stretch before running — dynamic only pre-run. Static stretching can temporarily reduce force production.",
      "Don't skip TKEs — this is the moment to prime the VMO",
    ],
    notes:
      "Dynamic warm-up before running reduces injury risk and prepares the neuromuscular system. Static stretching before running can temporarily reduce force production — save it for after.",
    links: [
      { text: "Dynamic warm-up for runners", url: "https://www.youtube.com/watch?v=Y5JMnMEOGPU" },
    ],
  },
};

export const WEEKLY_PLAN = [
  {
    day: "Monday",
    label: "Upper Body + Mobility",
    activities: [
      { id: "mobility", time: "Morning" },
      { id: "foam", time: "Morning" },
      { id: "upper", time: "Lunch" },
      { id: "tke", time: "During gym" },
      { id: "quads", time: "Through day" },
    ],
  },
  {
    day: "Tuesday",
    label: "Cycling + VMO",
    activities: [
      { id: "tke", time: "Morning" },
      { id: "foam", time: "Morning" },
      { id: "cycling", time: "Lunch" },
      { id: "quads", time: "Through day" },
      {
        id: "stretch",
        time: "Evening",
        customName: "Light Stretch (10 min)",
        customActivity: {
          name: "Light Evening Stretch",
          icon: "🌊",
          duration: "10 min",
          priority: "flex",
          mustDo: [
            "Hip flexor stretch 60s each side",
            "Hamstring stretch 60s each side",
            "Calves 30s each side",
          ],
          avoid: ["Don't overdo it — this is maintenance, not a deep session"],
          notes: "Quick maintenance stretching before bed. Focus on hip flexors and hamstrings which tighten from sitting all day.",
          links: [],
        },
      },
    ],
  },
  {
    day: "Wednesday",
    label: "Leg Rehab + Swim",
    activities: [
      { id: "mobility", time: "Morning" },
      { id: "foam", time: "Morning" },
      { id: "legreh", time: "Lunch" },
      { id: "swim", time: "Evening" },
      { id: "quads", time: "Through day" },
    ],
  },
  {
    day: "Thursday",
    label: "Rest + Football",
    activities: [
      { id: "tke", time: "Morning" },
      { id: "quads", time: "Through day" },
      { id: "rest", time: "Lunch" },
      { id: "football", time: "Evening" },
    ],
  },
  {
    day: "Friday",
    label: "Cycling + Upper Body 2",
    activities: [
      { id: "mobility", time: "Morning" },
      { id: "foam", time: "Morning" },
      { id: "cycling_short", time: "Lunch (first)" },
      { id: "upper2", time: "Lunch (second)" },
      { id: "tke", time: "During gym" },
      { id: "deep", time: "Evening" },
      { id: "quads", time: "Through day" },
    ],
  },
  {
    day: "Saturday",
    label: "Long Run Day",
    activities: [
      { id: "warmup", time: "Before run" },
      { id: "run", time: "Main session" },
      { id: "foam", time: "After run" },
      { id: "quads", time: "Through day" },
    ],
  },
  {
    day: "Sunday",
    label: "Recovery Day",
    activities: [
      { id: "swim", time: "Morning" },
      { id: "deep", time: "Afternoon" },
      { id: "tke", time: "Any time" },
      { id: "quads", time: "Through day" },
    ],
  },
];
