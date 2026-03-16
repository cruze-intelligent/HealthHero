(function () {
    const brand = {
        companyName: "Cruze Intelligent Systems(U) Ltd",
        companyWebsite: "cruzeintelligentsystems.com",
        gameWebsite: "https://games.cruze-tech.com",
        gameWebsiteLabel: "games.cruze-tech.com"
    };
    const brandText = brand.companyName + " at " + brand.companyWebsite + " and " + brand.gameWebsiteLabel;

    const tipsByTopic = {
        hygiene: [
            {
                title: "Twenty-second scrub",
                content: "Soap works best when you scrub the fronts, backs, thumbs, and nails of your hands for a full 20 seconds.",
                source: "Local Mission Guide"
            },
            {
                title: "Dry hands matter",
                content: "Clean, dry hands pick up fewer germs than wet hands, so finish with a clean towel or air dry.",
                source: "Local Mission Guide"
            },
            {
                title: "Toilet, then soap",
                content: "After using the toilet, washing with soap is one of the fastest ways to stop germs from spreading.",
                source: "Local Mission Guide"
            },
            {
                title: "Before food, after play",
                content: "Wash your hands before eating and after outdoor play so germs do not travel into your mouth.",
                source: "Local Mission Guide"
            },
            {
                title: "Clean nails",
                content: "Short, clean fingernails make it harder for dirt and germs to hide.",
                source: "Local Mission Guide"
            }
        ],
        nutrition: [
            {
                title: "Color signals nutrients",
                content: "A plate with different colors often gives your body a wider mix of vitamins and minerals.",
                source: "Local Mission Guide"
            },
            {
                title: "Water wins most days",
                content: "Water helps your body stay cool and focused without the extra sugar found in many drinks.",
                source: "Local Mission Guide"
            },
            {
                title: "Protein helps repair",
                content: "Beans, eggs, fish, nuts, and lean meats help your muscles grow and recover.",
                source: "Local Mission Guide"
            },
            {
                title: "Fiber keeps things moving",
                content: "Fruits, vegetables, and whole grains support digestion and help you feel full for longer.",
                source: "Local Mission Guide"
            },
            {
                title: "Treats are occasional",
                content: "Sweets and fried foods can fit sometimes, but not as the main fuel for every day.",
                source: "Local Mission Guide"
            }
        ],
        prevention: [
            {
                title: "Cover coughs well",
                content: "Coughing or sneezing into your elbow keeps droplets off your hands and away from shared surfaces.",
                source: "Local Mission Guide"
            },
            {
                title: "Safe water first",
                content: "Clean or treated water lowers the risk of stomach illnesses and dehydration.",
                source: "Local Mission Guide"
            },
            {
                title: "Mosquito barriers help",
                content: "Sleeping under a treated mosquito net helps block bites that spread disease.",
                source: "Local Mission Guide"
            },
            {
                title: "Open cuts need care",
                content: "Cleaning and covering small cuts can prevent dirt and germs from entering your body.",
                source: "Local Mission Guide"
            },
            {
                title: "Shared items spread germs",
                content: "Avoid sharing unwashed bottles, utensils, or towels when someone is sick.",
                source: "Local Mission Guide"
            }
        ],
        wellness: [
            {
                title: "Sleep is active repair",
                content: "During sleep, your brain stores learning and your body repairs muscles and tissues.",
                source: "Local Mission Guide"
            },
            {
                title: "Movement boosts mood",
                content: "At least an hour of active play or exercise can support strong bones, muscles, and focus.",
                source: "Local Mission Guide"
            },
            {
                title: "Breaks help attention",
                content: "Short breaks from screens and study help your eyes and mind reset.",
                source: "Local Mission Guide"
            },
            {
                title: "Hydration supports thinking",
                content: "When you drink enough water, it is easier to concentrate and stay alert in class or at play.",
                source: "Local Mission Guide"
            },
            {
                title: "Routine lowers stress",
                content: "A steady daily routine makes it easier to remember meals, hygiene, movement, and rest.",
                source: "Local Mission Guide"
            }
        ]
    };

    const quizBank = {
        hygiene: [
            {
                id: "hygiene-1",
                question: "How long should you scrub your hands with soap?",
                options: ["5 seconds", "10 seconds", "20 seconds", "45 seconds"],
                correct: 2,
                explanation: "Twenty seconds gives soap enough time to lift dirt and germs from your skin."
            },
            {
                id: "hygiene-2",
                question: "Which moment is the best time to wash your hands?",
                options: ["Before eating", "After using the toilet", "After playing outside", "All of these"],
                correct: 3,
                explanation: "All three moments can bring germs to your hands, so soap helps in each case."
            },
            {
                id: "hygiene-3",
                question: "Why should you clean under your nails?",
                options: ["Soap smells nice", "Germs can hide there", "It makes hands warmer", "It changes skin color"],
                correct: 1,
                explanation: "Dirt and germs can stay under long nails, even when hands look clean."
            },
            {
                id: "hygiene-4",
                question: "What is best to use when drying clean hands?",
                options: ["A clean towel", "Your shirt", "Dirty paper", "The floor"],
                correct: 0,
                explanation: "Drying with a clean towel or air drying helps keep hands clean after washing."
            },
            {
                id: "hygiene-5",
                question: "What should you do before touching your face after school?",
                options: ["Wash your hands", "Touch your eyes first", "Eat a snack first", "Nothing"],
                correct: 0,
                explanation: "Clean hands make it less likely that germs move into your eyes, nose, or mouth."
            },
            {
                id: "hygiene-6",
                question: "Which habit can lower the spread of germs in class?",
                options: ["Sharing used tissues", "Covering coughs with your elbow", "Skipping handwashing", "Leaving spills"],
                correct: 1,
                explanation: "Your elbow helps block cough droplets without covering your hands in germs."
            },
            {
                id: "hygiene-7",
                question: "Which item helps hands get fully clean?",
                options: ["Soap and water", "Only water", "Dust", "Juice"],
                correct: 0,
                explanation: "Soap helps break apart grease and dirt so germs can wash away."
            },
            {
                id: "hygiene-8",
                question: "Why should you avoid biting your nails?",
                options: ["It can bring germs into your mouth", "It makes you taller", "It gives you more energy", "It helps teeth grow"],
                correct: 0,
                explanation: "Hands touch many surfaces, so nail biting can move germs directly into your body."
            }
        ],
        nutrition: [
            {
                id: "nutrition-1",
                question: "Which drink is the strongest everyday choice?",
                options: ["Water", "Soda", "Energy drink", "Sugary tea"],
                correct: 0,
                explanation: "Water helps with hydration without extra sugar."
            },
            {
                id: "nutrition-2",
                question: "Which food group helps build and repair muscles?",
                options: ["Protein foods", "Candy foods", "Only oils", "Only sweets"],
                correct: 0,
                explanation: "Protein foods help your body repair tissues and build muscle."
            },
            {
                id: "nutrition-3",
                question: "What makes a plate more balanced?",
                options: ["Only sweets", "Only chips", "Different food groups together", "Skipping vegetables"],
                correct: 2,
                explanation: "Balanced plates combine different nutrients from different food groups."
            },
            {
                id: "nutrition-4",
                question: "Why are fruits and vegetables useful every day?",
                options: ["They glow", "They add vitamins and fiber", "They replace sleep", "They remove homework"],
                correct: 1,
                explanation: "Fruits and vegetables support your body with vitamins, minerals, and fiber."
            },
            {
                id: "nutrition-5",
                question: "Which breakfast choice gives steadier energy?",
                options: ["Fruit with eggs or porridge", "Only candy", "Only soda", "Skip breakfast"],
                correct: 0,
                explanation: "Balanced breakfasts can help you stay focused for longer."
            },
            {
                id: "nutrition-6",
                question: "What does fiber help with?",
                options: ["Digestion", "Making shoes", "Charging phones", "Changing weather"],
                correct: 0,
                explanation: "Fiber helps digestion and supports gut health."
            },
            {
                id: "nutrition-7",
                question: "Which snack is better for everyday fuel?",
                options: ["Fruit and nuts", "Candy and soda", "Only frosting", "Only crisps"],
                correct: 0,
                explanation: "Fruit and nuts bring more useful nutrients and steadier energy."
            },
            {
                id: "nutrition-8",
                question: "What should treats be in a healthy eating pattern?",
                options: ["Every meal", "Sometimes foods", "The only dinner", "The only drink"],
                correct: 1,
                explanation: "Treat foods fit best as occasional choices, not everyday fuel."
            }
        ],
        prevention: [
            {
                id: "prevention-1",
                question: "What is the safest cough habit?",
                options: ["Cough into your elbow", "Cough into your hands", "Cough at a friend", "Hold your breath all day"],
                correct: 0,
                explanation: "Your elbow blocks droplets and keeps your hands cleaner."
            },
            {
                id: "prevention-2",
                question: "What is best to do with drinking water if you are unsure it is safe?",
                options: ["Use it anyway", "Treat or boil it first", "Add sugar", "Leave it in the sun for a minute"],
                correct: 1,
                explanation: "Treating or boiling unsafe water can lower the risk of harmful germs."
            },
            {
                id: "prevention-3",
                question: "Why is a mosquito net useful?",
                options: ["It decorates the room", "It keeps books dry", "It helps block mosquito bites while sleeping", "It makes you taller"],
                correct: 2,
                explanation: "Mosquito nets can reduce bites that spread illness."
            },
            {
                id: "prevention-4",
                question: "What should you do with a small cut?",
                options: ["Ignore it", "Wash and cover it", "Rub dirt on it", "Share it with a friend"],
                correct: 1,
                explanation: "Cleaning and covering cuts helps keep germs out."
            },
            {
                id: "prevention-5",
                question: "What is safer when someone near you is sick?",
                options: ["Share bottles", "Share towels", "Use your own clean cup", "Swap tissues"],
                correct: 2,
                explanation: "Using your own clean cup lowers the chance of passing germs."
            },
            {
                id: "prevention-6",
                question: "What should happen after sneezing into a tissue?",
                options: ["Put the tissue in a bin and wash hands", "Keep it in your pocket forever", "Give it to someone else", "Leave it on a desk"],
                correct: 0,
                explanation: "Throwing away the tissue and washing hands helps stop germs from spreading."
            },
            {
                id: "prevention-7",
                question: "Which place can spread more germs if not cleaned well?",
                options: ["A shared bathroom", "A dry notebook", "A clean towel rack", "A sealed water bottle"],
                correct: 0,
                explanation: "Shared bathroom surfaces need good hygiene to stay safer."
            },
            {
                id: "prevention-8",
                question: "What helps prevent stomach illness the most?",
                options: ["Unsafe water", "Handwashing and safe food", "Skipping meals", "Eating from dirty surfaces"],
                correct: 1,
                explanation: "Safe food and clean hands lower the chance of swallowing harmful germs."
            }
        ],
        wellness: [
            {
                id: "wellness-1",
                question: "Why is sleep important for students?",
                options: ["It helps learning and body repair", "It replaces meals", "It removes exercise", "It stops all germs forever"],
                correct: 0,
                explanation: "Sleep supports memory, mood, growth, and recovery."
            },
            {
                id: "wellness-2",
                question: "How much active play or exercise is a strong daily goal?",
                options: ["5 minutes", "20 minutes a week", "About 60 minutes most days", "Never"],
                correct: 2,
                explanation: "Regular daily movement supports strength, mood, and heart health."
            },
            {
                id: "wellness-3",
                question: "What is a smart screen habit before bed?",
                options: ["Use screens right until sleep", "Take a break from bright screens before bed", "Drink soda while gaming", "Skip brushing teeth"],
                correct: 1,
                explanation: "Reducing bright screens before sleep can help your body settle down."
            },
            {
                id: "wellness-4",
                question: "What can help you stay focused during study?",
                options: ["Water and short breaks", "Only sugary drinks", "Never moving", "Skipping sleep"],
                correct: 0,
                explanation: "Hydration and short breaks can help attention and comfort."
            },
            {
                id: "wellness-5",
                question: "What is helpful about a daily routine?",
                options: ["It makes healthy habits easier to repeat", "It removes all work", "It ends hunger forever", "It replaces handwashing"],
                correct: 0,
                explanation: "A routine helps good habits become easier to remember."
            },
            {
                id: "wellness-6",
                question: "Which is a healthier way to recharge after school?",
                options: ["Water, snack, and movement", "Only candy", "Only scrolling for hours", "Skipping dinner"],
                correct: 0,
                explanation: "A mix of hydration, food, and movement helps recovery and energy."
            },
            {
                id: "wellness-7",
                question: "What supports strong bones and muscles over time?",
                options: ["Exercise and good food", "Only sweets", "Zero sleep", "Never going outside"],
                correct: 0,
                explanation: "Movement and balanced meals work together for long-term strength."
            },
            {
                id: "wellness-8",
                question: "What habit can improve mood and energy?",
                options: ["Staying indoors all day", "Moving your body regularly", "Skipping breakfast", "Sleeping too little"],
                correct: 1,
                explanation: "Regular movement often helps mood, sleep, and overall energy."
            }
        ]
    };

    const sequenceChallenges = {
        washHands: {
            title: "Wash-Up Order",
            prompt: "Tap the steps in the best order for clean hands.",
            passAt: 4,
            steps: [
                { id: "wet", label: "Wet your hands with clean water." },
                { id: "soap", label: "Apply soap." },
                { id: "scrub", label: "Scrub palms, backs, thumbs, and nails for 20 seconds." },
                { id: "rinse", label: "Rinse well with clean water." },
                { id: "dry", label: "Dry with a clean towel or air dry." },
                { id: "close", label: "Use the towel to turn off the tap if needed." }
            ]
        },
        dailyRoutine: {
            title: "Daily Routine Builder",
            prompt: "Build a steady routine from wake-up to sleep.",
            passAt: 4,
            steps: [
                { id: "wake", label: "Wake up and freshen up." },
                { id: "breakfast", label: "Eat breakfast and drink water." },
                { id: "school", label: "Learn, study, and take short movement breaks." },
                { id: "play", label: "Do active play or exercise." },
                { id: "dinner", label: "Eat dinner and prepare for tomorrow." },
                { id: "sleep", label: "Wind down and get enough sleep." }
            ]
        }
    };

    const sortChallenges = {
        everydayVsSometimes: {
            title: "Everyday vs Sometimes",
            leftLabel: "Everyday Fuel",
            rightLabel: "Sometimes Treat",
            passAt: 7,
            items: [
                { id: "water", label: "Water", correct: "everyday" },
                { id: "beans", label: "Beans", correct: "everyday" },
                { id: "apple", label: "Apple slices", correct: "everyday" },
                { id: "broccoli", label: "Broccoli", correct: "everyday" },
                { id: "porridge", label: "Porridge", correct: "everyday" },
                { id: "chips", label: "Fried chips", correct: "sometimes" },
                { id: "cake", label: "Cake", correct: "sometimes" },
                { id: "soda", label: "Soda", correct: "sometimes" },
                { id: "candy", label: "Candy", correct: "sometimes" },
                { id: "fried-chicken", label: "Greasy fast food meal", correct: "sometimes" }
            ]
        }
    };

    const scenarioChallenges = {
        preventionPatrol: {
            title: "Safe Choice",
            passAt: 5,
            prompts: [
                {
                    id: "toilet",
                    prompt: "You used the school toilet and the bell rings. What should you do first?",
                    options: ["Run to class immediately", "Wash your hands with soap", "Wipe hands on your clothes"],
                    correct: 1,
                    explanation: "Handwashing after using the toilet is one of the strongest protection habits."
                },
                {
                    id: "cough",
                    prompt: "You feel a cough coming while standing in a line. What is the safest action?",
                    options: ["Cough into your elbow", "Cough into your hands", "Turn and cough at the floor"],
                    correct: 0,
                    explanation: "Your elbow helps block droplets and keeps your hands cleaner."
                },
                {
                    id: "water",
                    prompt: "The only water nearby looks cloudy. What is the smart move?",
                    options: ["Drink it fast", "Treat or boil it first", "Mix it with juice"],
                    correct: 1,
                    explanation: "Treating uncertain water lowers the chance of harmful germs."
                },
                {
                    id: "mosquito",
                    prompt: "Night is coming in a place with many mosquitoes. What helps most while sleeping?",
                    options: ["A mosquito net", "An open window", "A bright lamp only"],
                    correct: 0,
                    explanation: "A mosquito net helps block bites while you sleep."
                },
                {
                    id: "cut",
                    prompt: "You scrape your knee during play. What should happen next?",
                    options: ["Add dirt so it dries", "Clean and cover the cut", "Ignore it all day"],
                    correct: 1,
                    explanation: "Cleaning and covering cuts helps prevent infection."
                },
                {
                    id: "sharing",
                    prompt: "A friend has a cold and asks to share a used bottle. What is safer?",
                    options: ["Share the bottle", "Use your own clean bottle", "Wipe it once on a sleeve"],
                    correct: 1,
                    explanation: "Using your own clean bottle lowers the spread of germs."
                }
            ]
        }
    };

    const foodBank = [
        { id: "apple", emoji: "🍎", label: "Apple", groups: ["fruit"], healthy: true, searchTerm: "apple" },
        { id: "banana", emoji: "🍌", label: "Banana", groups: ["fruit"], healthy: true, searchTerm: "banana" },
        { id: "greens", emoji: "🥬", label: "Leafy greens", groups: ["vegetable"], healthy: true, searchTerm: "spinach" },
        { id: "carrot", emoji: "🥕", label: "Carrot", groups: ["vegetable"], healthy: true, searchTerm: "carrot" },
        { id: "fish", emoji: "🐟", label: "Fish", groups: ["protein"], healthy: true, searchTerm: "fish" },
        { id: "beans", emoji: "🫘", label: "Beans", groups: ["protein"], healthy: true, searchTerm: "beans" },
        { id: "rice", emoji: "🍚", label: "Rice", groups: ["grain"], healthy: true, searchTerm: "rice" },
        { id: "bread", emoji: "🍞", label: "Whole-grain bread", groups: ["grain"], healthy: true, searchTerm: "whole grain bread" },
        { id: "yogurt", emoji: "🥛", label: "Yogurt", groups: ["dairy"], healthy: true, searchTerm: "yogurt" },
        { id: "chips", emoji: "🍟", label: "Chips", groups: ["sometimes"], healthy: false, searchTerm: "potato chips" },
        { id: "cake", emoji: "🍰", label: "Cake", groups: ["sometimes"], healthy: false, searchTerm: "cake" },
        { id: "burger", emoji: "🍔", label: "Burger", groups: ["sometimes"], healthy: false, searchTerm: "burger" }
    ];

    const missions = [
        {
            id: "hygiene-hq",
            title: "Hygiene HQ",
            icon: "🫧",
            topic: "hygiene",
            accent: "teal",
            tagline: "Stop slippery germs and lock in clean-hand habits.",
            learningObjectives: [
                "Know when to wash hands with soap.",
                "Practice the full order of strong handwashing.",
                "Explain how clean hands block the spread of germs."
            ],
            reportTakeaways: [
                "Soap and a full 20-second scrub help lift dirt and germs away.",
                "Key times to wash are before eating, after the toilet, and after messy play.",
                "Clean hands protect you and the people around you."
            ],
            badge: {
                id: "soap-defender",
                icon: "🫧",
                label: "Soap Defender"
            },
            stages: [
                {
                    id: "germ-burst",
                    title: "Germ Burst",
                    type: "action-targets",
                    intro: "You have one quick clean-up round to clear the roaming germs before the countdown expires.",
                    objective: "Clear 10 germs before the 30-second timer ends. You have 5 safety hearts.",
                    coachCopy: "Watch the countdown, wait for GO, then tap only the germs. Skip the decoys and stay ahead of the timer.",
                    config: {
                        goal: 10,
                        spawnIntervalMs: 900,
                        lifetimeMs: 3400,
                        maxMisses: 5,
                        startingEnergy: 5,
                        startingSoap: 24,
                        consumable: "soap",
                        badChance: 0.2,
                        countdownMs: 3000,
                        durationMs: 30000,
                        initialSpawnCount: 2,
                        maxActiveTargets: 5,
                        safeStartMs: 4800,
                        goodItems: [
                            { emoji: "🦠", label: "Germ" },
                            { emoji: "🧫", label: "Bacteria blob" },
                            { emoji: "🧬", label: "Virus" }
                        ],
                        badItems: [
                            { emoji: "✨", label: "Sparkle decoy" },
                            { emoji: "🌈", label: "Rainbow decoy" }
                        ]
                    }
                },
                {
                    id: "wash-up-order",
                    title: "Wash-Up Order",
                    type: "sequence",
                    intro: "Build the correct handwashing routine from first step to finish.",
                    objective: "Place the six steps in the best order. Reach at least 4 correct positions to pass.",
                    coachCopy: "Think from start to finish: water first, soap next, scrub well, then rinse and dry.",
                    challengeId: "washHands"
                },
                {
                    id: "hygiene-quiz",
                    title: "Hygiene Quiz",
                    type: "quiz",
                    intro: "Finish the mission with a quick hygiene knowledge check.",
                    objective: "Answer 3 questions. Score at least 2 correct to pass.",
                    coachCopy: "Use what you just practiced. The safest hygiene habits are also the easiest to repeat every day.",
                    topic: "hygiene",
                    questionCount: 3,
                    passAt: 2
                }
            ]
        },
        {
            id: "nutrition-lab",
            title: "Nutrition Lab",
            icon: "🥗",
            topic: "nutrition",
            accent: "leaf",
            tagline: "Build balanced meals and sort everyday fuel from sometimes treats.",
            learningObjectives: [
                "Build a balanced plate from key food groups.",
                "Spot everyday fuel and sometimes treats.",
                "Choose food and drink that support energy and growth."
            ],
            reportTakeaways: [
                "Balanced meals mix foods that help your body grow, think, and stay active.",
                "Water is a strong everyday drink choice.",
                "Treat foods fit best sometimes, not as your main fuel."
            ],
            badge: {
                id: "plate-planner",
                icon: "🥗",
                label: "Plate Planner"
            },
            stages: [
                {
                    id: "balanced-plate",
                    title: "Balanced Plate",
                    type: "plate",
                    intro: "Choose four foods that work together as a smart, balanced plate.",
                    objective: "Pick exactly 4 foods and cover fruit, vegetable, protein, and grain or dairy.",
                    coachCopy: "A strong plate mixes color, body-building foods, and steady energy foods.",
                    picks: 4,
                    requirements: [
                        { label: "Fruit", groups: ["fruit"] },
                        { label: "Vegetable", groups: ["vegetable"] },
                        { label: "Protein", groups: ["protein"] },
                        { label: "Grain or dairy", groups: ["grain", "dairy"] }
                    ]
                },
                {
                    id: "everyday-vs-sometimes",
                    title: "Everyday vs Sometimes",
                    type: "sort",
                    intro: "Sort foods into the right habit lane.",
                    objective: "Sort 10 foods. Get at least 7 correct to pass.",
                    coachCopy: "Everyday foods help your body often. Sometimes foods are fine once in a while, but not all the time.",
                    challengeId: "everydayVsSometimes"
                },
                {
                    id: "nutrition-quiz",
                    title: "Nutrition Quiz",
                    type: "quiz",
                    intro: "Show what you know about strong food choices.",
                    objective: "Answer 3 questions. Score at least 2 correct to pass.",
                    coachCopy: "Look for the choices that give steady energy, useful nutrients, and good daily habits.",
                    topic: "nutrition",
                    questionCount: 3,
                    passAt: 2
                }
            ]
        },
        {
            id: "prevention-patrol",
            title: "Prevention Patrol",
            icon: "🛡️",
            topic: "prevention",
            accent: "orange",
            tagline: "Spot safer choices before hazards spread.",
            learningObjectives: [
                "Choose safer actions in common health situations.",
                "Recognize items and habits that help prevent illness.",
                "Explain simple ways to protect yourself and others."
            ],
            reportTakeaways: [
                "Safe water, clean hands, and covered coughs lower the spread of illness.",
                "Small protective habits matter before a problem grows.",
                "Using your own clean items can help stop germs from traveling."
            ],
            badge: {
                id: "risk-radar",
                icon: "🛡️",
                label: "Risk Radar"
            },
            stages: [
                {
                    id: "safe-choice",
                    title: "Safe Choice",
                    type: "scenario",
                    intro: "Work through everyday health situations and choose the safer move.",
                    objective: "Solve 6 scenarios and get at least 5 right to pass.",
                    coachCopy: "Pause, spot the risk, then choose the action that keeps germs and hazards away.",
                    challengeId: "preventionPatrol"
                },
                {
                    id: "hazard-scan",
                    title: "Hazard Scan",
                    type: "action-targets",
                    intro: "Race the countdown by collecting the helpful health items and ignoring the risky ones.",
                    objective: "Collect 10 safe items before the timer ends. You have 5 safety hearts.",
                    coachCopy: "Wait for GO, then grab the helpful health items and leave the risky ones alone so your hearts last.",
                    config: {
                        goal: 10,
                        spawnIntervalMs: 950,
                        lifetimeMs: 3300,
                        maxMisses: 5,
                        startingEnergy: 5,
                        startingSoap: 0,
                        consumable: null,
                        badChance: 0.28,
                        countdownMs: 3000,
                        durationMs: 28000,
                        initialSpawnCount: 2,
                        maxActiveTargets: 5,
                        safeStartMs: 4800,
                        goodItems: [
                            { emoji: "🧼", label: "Soap" },
                            { emoji: "🚰", label: "Clean water" },
                            { emoji: "🛏️", label: "Mosquito net" }
                        ],
                        badItems: [
                            { emoji: "🗑️", label: "Open trash" },
                            { emoji: "🦟", label: "Mosquito swarm" },
                            { emoji: "💧", label: "Dirty water" }
                        ]
                    }
                },
                {
                    id: "prevention-quiz",
                    title: "Prevention Quiz",
                    type: "quiz",
                    intro: "Lock in the best ways to block illness spread.",
                    objective: "Answer 3 questions. Score at least 2 correct to pass.",
                    coachCopy: "Choose the habits that protect health before germs have a chance to spread.",
                    topic: "prevention",
                    questionCount: 3,
                    passAt: 2
                }
            ]
        },
        {
            id: "wellness-arena",
            title: "Wellness Arena",
            icon: "⚡",
            topic: "wellness",
            accent: "sky",
            tagline: "Balance sleep, movement, water, and routine for strong energy.",
            learningObjectives: [
                "Build a healthy daily routine from morning to bedtime.",
                "Choose habits that support energy, focus, and mood.",
                "Connect sleep, hydration, food, and movement to wellness."
            ],
            reportTakeaways: [
                "Daily routines make healthy choices easier to repeat.",
                "Water, movement, and rest help your body and brain stay ready.",
                "Small daily habits work together to build long-term wellness."
            ],
            badge: {
                id: "rhythm-runner",
                icon: "⚡",
                label: "Rhythm Runner"
            },
            stages: [
                {
                    id: "daily-routine-builder",
                    title: "Daily Routine Builder",
                    type: "sequence",
                    intro: "Lay out the strongest order for a healthy day.",
                    objective: "Place the six routine steps in order. Reach at least 4 correct positions to pass.",
                    coachCopy: "Healthy days work best with a steady rhythm: fuel up, learn, move, and rest.",
                    challengeId: "dailyRoutine"
                },
                {
                    id: "hydration-dash",
                    title: "Hydration Dash",
                    type: "action-targets",
                    intro: "Grab water and healthy boosts before the countdown reaches zero while dodging the energy drainers.",
                    objective: "Collect 12 good items before the 30-second timer ends. You have 5 safety hearts.",
                    coachCopy: "Wait for the countdown, then choose the habits that refill your energy instead of draining it.",
                    config: {
                        goal: 12,
                        spawnIntervalMs: 850,
                        lifetimeMs: 3200,
                        maxMisses: 5,
                        startingEnergy: 5,
                        startingSoap: 0,
                        consumable: null,
                        badChance: 0.25,
                        countdownMs: 3000,
                        durationMs: 30000,
                        initialSpawnCount: 2,
                        maxActiveTargets: 5,
                        safeStartMs: 4800,
                        goodItems: [
                            { emoji: "💧", label: "Water" },
                            { emoji: "😴", label: "Rest boost" },
                            { emoji: "🏃", label: "Active break" }
                        ],
                        badItems: [
                            { emoji: "🥤", label: "Sugary soda" },
                            { emoji: "🌙", label: "Late-night drain" },
                            { emoji: "🪑", label: "Too much sitting" }
                        ]
                    }
                },
                {
                    id: "wellness-quiz",
                    title: "Wellness Quiz",
                    type: "quiz",
                    intro: "Finish the campaign by proving your daily wellness knowledge.",
                    objective: "Answer 3 questions. Score at least 2 correct to pass.",
                    coachCopy: "Think about the daily habits that help you feel ready to learn, play, and rest well.",
                    topic: "wellness",
                    questionCount: 3,
                    passAt: 2
                }
            ]
        }
    ];

    window.HEALTH_HERO_CONTENT = {
        brand: brand,
        brandText: brandText,
        missions: missions,
        tipsByTopic: tipsByTopic,
        quizBank: quizBank,
        sortChallenges: sortChallenges,
        sequenceChallenges: sequenceChallenges,
        scenarioChallenges: scenarioChallenges,
        foodBank: foodBank
    };
}());
