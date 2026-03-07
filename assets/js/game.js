(function () {
    const content = window.HEALTH_HERO_CONTENT;

    if (!content) {
        return;
    }

    const storageKeys = {
        progress: "healthHeroProgress.v2",
        tips: "healthTipsCache.v2",
        nutrition: "nutritionCache.v2"
    };

    const defaultState = {
        screen: "dashboard",
        missionId: null,
        stageIndex: 0,
        stageMode: "intro",
        score: 0,
        energy: null,
        soap: 0,
        misses: 0,
        badges: [],
        unlockedMissionIds: [content.missions[0].id],
        bestScores: {},
        currentStageResult: null,
        lastSelectedMission: null,
        hasSeenIntro: false,
        checkpoint: null,
        currentMissionScore: 0,
        currentMissionStageScores: [],
        baseScoreBeforeMission: 0,
        resultKind: null,
        dashboardTip: null,
        stageTip: null,
        resultsTip: null,
        tipDrawerOpen: false
    };

    const state = clone(defaultState);

    const runtime = {
        dom: {},
        apiService: null,
        installPrompt: null,
        stageRuntime: null,
        loadingDone: false,
        toastTimer: null,
        tipToken: 0
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function safeLoad(key, fallbackValue) {
        try {
            const raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallbackValue;
        } catch (error) {
            return fallbackValue;
        }
    }

    function safeSave(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            return;
        }
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function shuffle(items) {
        const copy = items.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            const temp = copy[index];
            copy[index] = copy[randomIndex];
            copy[randomIndex] = temp;
        }

        return copy;
    }

    function sample(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getMission(missionId) {
        return content.missions.find(function (mission) {
            return mission.id === missionId;
        }) || null;
    }

    function getMissionIndex(missionId) {
        return content.missions.findIndex(function (mission) {
            return mission.id === missionId;
        });
    }

    function getActiveMission() {
        return state.missionId ? getMission(state.missionId) : null;
    }

    function getActiveStage() {
        const mission = getActiveMission();
        return mission ? mission.stages[state.stageIndex] : null;
    }

    function getBadgeEarned(mission) {
        return state.badges.some(function (badgeId) {
            return badgeId === mission.badge.id;
        });
    }

    function isMissionLocked(missionId) {
        return state.unlockedMissionIds.indexOf(missionId) === -1;
    }

    function getCheckpointForMission(missionId) {
        if (!state.checkpoint || state.checkpoint.missionId !== missionId) {
            return null;
        }

        return state.checkpoint;
    }

    function getDisplayScore() {
        if (
            state.missionId &&
            state.screen !== "dashboard" &&
            state.screen !== "map" &&
            state.resultKind !== "mission" &&
            state.resultKind !== "final" &&
            state.baseScoreBeforeMission >= 0
        ) {
            return state.baseScoreBeforeMission + state.currentMissionScore;
        }

        return state.score;
    }

    function getTopbarProgressText() {
        if (state.screen === "dashboard") {
            return "Dashboard";
        }

        if (state.screen === "map") {
            return "Mission Map";
        }

        const mission = getActiveMission();

        if (!mission) {
            return "Mission Report";
        }

        return "Mission " + (getMissionIndex(mission.id) + 1) + " • Stage " + (state.stageIndex + 1) + "/" + mission.stages.length;
    }

    function serializeProgress() {
        return {
            screen: state.screen,
            missionId: state.missionId,
            stageIndex: state.stageIndex,
            stageMode: state.stageMode,
            score: state.score,
            badges: state.badges,
            unlockedMissionIds: state.unlockedMissionIds,
            bestScores: state.bestScores,
            currentStageResult: state.currentStageResult,
            lastSelectedMission: state.lastSelectedMission,
            hasSeenIntro: state.hasSeenIntro,
            checkpoint: state.checkpoint,
            currentMissionScore: state.currentMissionScore,
            currentMissionStageScores: state.currentMissionStageScores,
            baseScoreBeforeMission: state.baseScoreBeforeMission,
            resultKind: state.resultKind,
            tipDrawerOpen: state.tipDrawerOpen
        };
    }

    function saveProgress() {
        safeSave(storageKeys.progress, serializeProgress());
    }

    function restoreProgress() {
        const persisted = safeLoad(storageKeys.progress, null);

        if (!persisted) {
            return;
        }

        Object.keys(defaultState).forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(persisted, key)) {
                state[key] = persisted[key];
            }
        });

        state.unlockedMissionIds = Array.from(new Set(state.unlockedMissionIds.concat(content.missions[0].id)));
        state.badges = Array.isArray(state.badges) ? state.badges : [];
        state.bestScores = state.bestScores || {};
        state.currentMissionStageScores = Array.isArray(state.currentMissionStageScores) ? state.currentMissionStageScores : [];
        state.score = typeof state.score === "number" ? state.score : 0;
    }

    function clearStageRuntime() {
        if (!runtime.stageRuntime) {
            return;
        }

        if (runtime.stageRuntime.spawnTimer) {
            window.clearInterval(runtime.stageRuntime.spawnTimer);
        }

        if (runtime.stageRuntime.targetTimers) {
            runtime.stageRuntime.targetTimers.forEach(function (timerId) {
                window.clearTimeout(timerId);
            });
        }

        runtime.stageRuntime = null;
    }

    function resetTransientMeters() {
        state.energy = null;
        state.soap = 0;
        state.misses = 0;
    }

    function resetMissionState(options) {
        const missionId = options.missionId;
        const previousBest = state.bestScores[missionId] || 0;

        state.missionId = missionId;
        state.stageIndex = options.stageIndex || 0;
        state.stageMode = "intro";
        state.resultKind = null;
        state.currentStageResult = null;
        state.lastSelectedMission = missionId;
        state.hasSeenIntro = true;
        state.baseScoreBeforeMission = typeof options.baseScoreBeforeMission === "number"
            ? options.baseScoreBeforeMission
            : state.score - previousBest;
        state.currentMissionScore = typeof options.currentMissionScore === "number" ? options.currentMissionScore : 0;
        state.currentMissionStageScores = Array.isArray(options.stageScores) ? options.stageScores.slice() : [];
        state.screen = "stage";
        resetTransientMeters();

        state.checkpoint = {
            missionId: missionId,
            stageIndex: state.stageIndex,
            stageMode: "intro",
            currentMissionScore: state.currentMissionScore,
            stageScores: state.currentMissionStageScores.slice(),
            baseScoreBeforeMission: state.baseScoreBeforeMission
        };
    }

    function updateUrl(view) {
        const url = new URL(window.location.href);
        url.searchParams.set("view", view);
        window.history.replaceState({}, "", url.toString());
    }

    function openHelp() {
        runtime.dom.helpModal.classList.add("modal-open");
        runtime.dom.helpModal.setAttribute("aria-hidden", "false");
    }

    function closeHelp() {
        runtime.dom.helpModal.classList.remove("modal-open");
        runtime.dom.helpModal.setAttribute("aria-hidden", "true");
    }

    function showToast(message) {
        window.clearTimeout(runtime.toastTimer);
        runtime.dom.toastRegion.textContent = message;
        runtime.dom.toastRegion.classList.add("toast-visible");
        runtime.toastTimer = window.setTimeout(function () {
            runtime.dom.toastRegion.classList.remove("toast-visible");
        }, 1800);
    }

    function renderTipCard(tip, emptyLabel) {
        if (!tip) {
            return "<div class=\"tip-body\"><p class=\"tip-title\">" + escapeHtml(emptyLabel) + "</p><p class=\"tip-content\">Loading a health fact...</p></div>";
        }

        return [
            "<div class=\"tip-body\">",
            "<p class=\"tip-title\">" + escapeHtml(tip.title) + "</p>",
            "<p class=\"tip-content\">" + escapeHtml(tip.content) + "</p>",
            "<p class=\"tip-source\">Source: " + escapeHtml(tip.source) + "</p>",
            "</div>"
        ].join("");
    }

    function updateTipCard(element, tip, emptyLabel) {
        if (!element) {
            return;
        }

        element.innerHTML = renderTipCard(tip, emptyLabel);
    }

    class APIService {
        constructor() {
            this.healthTipCache = safeLoad(storageKeys.tips, { remote: [] });
            this.nutritionCache = safeLoad(storageKeys.nutrition, {});
        }

        async loadRemoteTips() {
            if (Array.isArray(this.healthTipCache.remote) && this.healthTipCache.remote.length > 0) {
                return this.healthTipCache.remote;
            }

            if (!window.navigator.onLine) {
                return [];
            }

            try {
                const response = await window.fetch("https://health.gov/myhealthfinder/api/v3/topicsearch.json?lang=en");
                const data = await response.json();
                const resources = data && data.Result && data.Result.Resources && data.Result.Resources.Resource;

                if (!Array.isArray(resources)) {
                    return [];
                }

                const remoteTips = resources.slice(0, 18).map(function (resource) {
                    return {
                        title: resource.Title || "Health Tip",
                        content: resource.Categories && resource.Categories.Category && resource.Categories.Category[0]
                            ? resource.Categories.Category[0].Name + " recommendation from MyHealthfinder."
                            : "Trusted public health guidance from MyHealthfinder.",
                        source: "MyHealthfinder.gov"
                    };
                });

                this.healthTipCache.remote = remoteTips;
                safeSave(storageKeys.tips, this.healthTipCache);
                return remoteTips;
            } catch (error) {
                return [];
            }
        }

        async getTip(topic) {
            const localTips = content.tipsByTopic[topic] || [];
            const remoteTips = await this.loadRemoteTips();

            if (remoteTips.length > 0) {
                const remoteTip = sample(remoteTips);
                return {
                    title: remoteTip.title,
                    content: remoteTip.content,
                    source: remoteTip.source
                };
            }

            if (localTips.length > 0) {
                return sample(localTips);
            }

            return {
                title: "Mission Fact",
                content: "Healthy habits become stronger every time you practice them.",
                source: "Local Mission Guide"
            };
        }

        async getNutritionInfo(food) {
            const cacheKey = String(food.searchTerm || food.label || food).toLowerCase();

            if (this.nutritionCache[cacheKey]) {
                return this.nutritionCache[cacheKey];
            }

            if (!window.navigator.onLine) {
                const fallback = {
                    name: food.label || food,
                    calories: "Unknown",
                    protein: "Unknown",
                    source: "Local Data"
                };

                this.nutritionCache[cacheKey] = fallback;
                safeSave(storageKeys.nutrition, this.nutritionCache);
                return fallback;
            }

            try {
                const response = await window.fetch(
                    "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(cacheKey) + "&search_simple=1&json=1&page_size=1",
                    {
                        headers: {
                            "User-Agent": "HealthHeroAdventure/2.0"
                        }
                    }
                );
                const data = await response.json();
                const product = data && data.products && data.products[0];

                if (!product) {
                    throw new Error("No product");
                }

                const nutrition = {
                    name: food.label || food,
                    calories: product.nutriments && product.nutriments["energy-kcal_100g"] ? String(product.nutriments["energy-kcal_100g"]) : "Unknown",
                    protein: product.nutriments && product.nutriments.proteins_100g ? String(product.nutriments.proteins_100g) : "Unknown",
                    source: "Open Food Facts"
                };

                this.nutritionCache[cacheKey] = nutrition;
                safeSave(storageKeys.nutrition, this.nutritionCache);
                return nutrition;
            } catch (error) {
                const fallback = {
                    name: food.label || food,
                    calories: "Unknown",
                    protein: "Unknown",
                    source: "Local Data"
                };

                this.nutritionCache[cacheKey] = fallback;
                safeSave(storageKeys.nutrition, this.nutritionCache);
                return fallback;
            }
        }
    }

    function cacheDom() {
        runtime.dom.screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
        runtime.dom.dashboardScreen = document.getElementById("dashboard-screen");
        runtime.dom.mapScreen = document.getElementById("map-screen");
        runtime.dom.stageScreen = document.getElementById("stage-screen");
        runtime.dom.resultsScreen = document.getElementById("results-screen");
        runtime.dom.loadingScreen = document.getElementById("loading-screen");
        runtime.dom.offlineIndicator = document.getElementById("offline-indicator");
        runtime.dom.helpModal = document.getElementById("help-modal");
        runtime.dom.toastRegion = document.getElementById("toast-region");
        runtime.dom.installButton = document.getElementById("install-button");
        runtime.dom.topbarScore = document.getElementById("topbar-score");
        runtime.dom.topbarEnergy = document.getElementById("topbar-energy");
        runtime.dom.topbarProgress = document.getElementById("topbar-progress");
        runtime.dom.dashboardCampaign = document.getElementById("dashboard-campaign");
        runtime.dom.dashboardUnlocked = document.getElementById("dashboard-unlocked");
        runtime.dom.dashboardBadges = document.getElementById("dashboard-badges");
        runtime.dom.dashboardBestScore = document.getElementById("dashboard-best-score");
        runtime.dom.dashboardProgressSummary = document.getElementById("dashboard-progress-summary");
        runtime.dom.dashboardBadgeList = document.getElementById("dashboard-badge-list");
        runtime.dom.dashboardTipCard = document.getElementById("dashboard-tip-card");
        runtime.dom.missionMapGrid = document.getElementById("mission-map-grid");
        runtime.dom.stagePanel = document.getElementById("stage-panel");
        runtime.dom.stageMeta = document.getElementById("stage-meta");
        runtime.dom.stageTipCard = document.getElementById("stage-tip-card");
        runtime.dom.resultsPanel = document.getElementById("results-panel");
    }

    function bindEvents() {
        document.addEventListener("click", function (event) {
            if (event.target === runtime.dom.helpModal) {
                closeHelp();
                return;
            }

            const actionNode = event.target.closest("[data-action]");

            if (actionNode) {
                handleAction(actionNode.dataset.action, actionNode);
                return;
            }

            const stageActionNode = event.target.closest("[data-stage-action]");

            if (stageActionNode) {
                handleStageAction(stageActionNode.dataset.stageAction, stageActionNode);
            }
        });

        window.addEventListener("online", function () {
            runtime.dom.offlineIndicator.hidden = true;
        });

        window.addEventListener("offline", function () {
            runtime.dom.offlineIndicator.hidden = false;
        });

        window.addEventListener("beforeinstallprompt", function (event) {
            event.preventDefault();
            runtime.installPrompt = event;
            runtime.dom.installButton.classList.remove("hidden");
        });
    }

    function handleAction(action, node) {
        switch (action) {
        case "start-adventure":
            if (state.checkpoint) {
                game.resume();
                return;
            }
            game.startMission(content.missions[0].id);
            break;
        case "resume":
            game.resume();
            break;
        case "open-map":
            clearStageRuntime();
            state.screen = "map";
            updateUrl("map");
            renderAll();
            saveProgress();
            break;
        case "go-home":
            clearStageRuntime();
            state.screen = "dashboard";
            updateUrl("start");
            renderAll();
            saveProgress();
            break;
        case "open-help":
            openHelp();
            break;
        case "close-help":
            closeHelp();
            break;
        case "refresh-tip":
            refreshDashboardTip(true);
            break;
        case "toggle-tip-drawer":
            state.tipDrawerOpen = !state.tipDrawerOpen;
            renderDashboard();
            saveProgress();
            break;
        case "install":
            promptInstall();
            break;
        case "mission-cta":
            startMissionFromCard(node.dataset.missionId);
            break;
        case "begin-stage":
            beginStage();
            break;
        case "retry-stage":
            game.retryStage();
            break;
        case "next-stage":
            advanceFromStageResult();
            break;
        case "back-to-map":
            clearStageRuntime();
            state.screen = "map";
            updateUrl("map");
            renderAll();
            saveProgress();
            break;
        case "replay-mission":
            game.startMission(node.dataset.missionId || state.lastSelectedMission || content.missions[0].id);
            break;
        case "open-final-report":
            presentFinalReport();
            break;
        case "return-dashboard":
            clearMissionContext();
            state.screen = "dashboard";
            updateUrl("start");
            renderAll();
            saveProgress();
            break;
        default:
            break;
        }
    }

    function handleStageAction(action, node) {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime) {
            return;
        }

        switch (action) {
        case "choose-sequence-step":
            chooseSequenceStep(node.dataset.stepId);
            break;
        case "remove-sequence-step":
            removeSequenceStep(node.dataset.stepId);
            break;
        case "submit-sequence":
            submitSequenceStage();
            break;
        case "choose-quiz-answer":
            chooseQuizAnswer(Number(node.dataset.choiceIndex));
            break;
        case "next-quiz":
            advanceQuiz();
            break;
        case "toggle-plate-food":
            togglePlateFood(node.dataset.foodId);
            break;
        case "submit-plate":
            submitPlateStage();
            break;
        case "sort-answer":
            setSortAnswer(node.dataset.itemId, node.dataset.choice);
            break;
        case "submit-sort":
            submitSortStage();
            break;
        case "choose-scenario-answer":
            chooseScenarioAnswer(Number(node.dataset.choiceIndex));
            break;
        case "next-scenario":
            advanceScenario();
            break;
        case "hit-target":
            hitActionTarget(node.dataset.targetId);
            break;
        default:
            break;
        }
    }

    async function promptInstall() {
        if (!runtime.installPrompt) {
            return;
        }

        runtime.installPrompt.prompt();
        await runtime.installPrompt.userChoice;
        runtime.installPrompt = null;
        runtime.dom.installButton.classList.add("hidden");
    }

    async function refreshDashboardTip(forceNew) {
        const token = ++runtime.tipToken;
        updateTipCard(runtime.dom.dashboardTipCard, forceNew ? null : state.dashboardTip, "Mission Fact");

        const candidateMission = getMission(state.lastSelectedMission) || content.missions[0];
        const tip = await runtime.apiService.getTip(candidateMission.topic);

        if (token !== runtime.tipToken) {
            return;
        }

        state.dashboardTip = tip;
        updateTipCard(runtime.dom.dashboardTipCard, state.dashboardTip, "Mission Fact");
    }

    async function refreshStageTip() {
        const mission = getActiveMission();

        if (!mission) {
            return;
        }

        const tip = await runtime.apiService.getTip(mission.topic);

        if (!getActiveMission() || getActiveMission().id !== mission.id) {
            return;
        }

        state.stageTip = tip;
        updateTipCard(runtime.dom.stageTipCard, state.stageTip, "Mission Fact");
    }

    async function refreshResultsTip(topic) {
        const tip = await runtime.apiService.getTip(topic);
        state.resultsTip = tip;

        if (state.screen === "results") {
            renderResults();
        }
    }

    function updateScreenVisibility() {
        runtime.dom.screens.forEach(function (screen) {
            const isActive = screen.dataset.screen === state.screen;
            screen.classList.toggle("screen-active", isActive);
        });
    }

    function renderTopbar() {
        runtime.dom.topbarScore.textContent = String(getDisplayScore());
        runtime.dom.topbarEnergy.textContent = state.energy === null ? "Study" : String(state.energy) + "/5";
        runtime.dom.topbarProgress.textContent = getTopbarProgressText();
        runtime.dom.offlineIndicator.hidden = window.navigator.onLine;
    }

    function renderDashboard() {
        runtime.dom.dashboardCampaign.textContent = content.missions.length + " missions";
        runtime.dom.dashboardUnlocked.textContent = String(state.unlockedMissionIds.length);
        runtime.dom.dashboardBadges.textContent = String(state.badges.length);
        runtime.dom.dashboardBestScore.textContent = String(state.score);

        const nextMission = content.missions.find(function (mission) {
            return state.unlockedMissionIds.indexOf(mission.id) > -1 && !getBadgeEarned(mission);
        }) || content.missions[content.missions.length - 1];

        const checkpointSummary = state.checkpoint
            ? "Resume " + getMission(state.checkpoint.missionId).title + " at stage " + (state.checkpoint.stageIndex + 1) + "."
            : "No active checkpoint. Start the next mission when you are ready.";

        runtime.dom.dashboardProgressSummary.innerHTML = [
            buildSummaryItem("Next focus", nextMission.title + " • " + nextMission.tagline),
            buildSummaryItem("Resume", checkpointSummary),
            buildSummaryItem("Best mission", getStrongestMissionLabel())
        ].join("");

        runtime.dom.dashboardBadgeList.innerHTML = state.badges.length > 0
            ? content.missions.filter(function (mission) { return getBadgeEarned(mission); }).map(function (mission) {
                return [
                    "<div class=\"badge-card earned\">",
                    "<span class=\"badge-icon\">" + escapeHtml(mission.badge.icon) + "</span>",
                    "<span class=\"badge-label\">" + escapeHtml(mission.badge.label) + "</span>",
                    "</div>"
                ].join("");
            }).join("")
            : "<div class=\"empty-state\">No badges yet. Finish a mission to earn your first one.</div>";

        updateTipCard(runtime.dom.dashboardTipCard, state.dashboardTip, "Mission Fact");
        runtime.dom.dashboardTipCard.parentElement.classList.toggle("drawer-open", state.tipDrawerOpen);

        const resumeButton = document.querySelector("[data-action=\"resume\"]");

        if (resumeButton) {
            resumeButton.disabled = !state.checkpoint;
        }
    }

    function buildSummaryItem(label, value) {
        return [
            "<div class=\"summary-item\">",
            "<p class=\"summary-label\">" + escapeHtml(label) + "</p>",
            "<p class=\"summary-value\">" + escapeHtml(value) + "</p>",
            "</div>"
        ].join("");
    }

    function getMissionStatus(mission) {
        if (isMissionLocked(mission.id)) {
            return "locked";
        }

        if (state.checkpoint && state.checkpoint.missionId === mission.id) {
            return "in-progress";
        }

        if (getBadgeEarned(mission)) {
            return "completed";
        }

        return "ready";
    }

    function getMissionButtonLabel(mission, status) {
        if (status === "locked") {
            return "Locked";
        }

        if (status === "in-progress") {
            return "Continue";
        }

        if (status === "completed") {
            return "Replay";
        }

        return "Start";
    }

    function renderMap() {
        runtime.dom.missionMapGrid.innerHTML = content.missions.map(function (mission, index) {
            const status = getMissionStatus(mission);
            const buttonDisabled = status === "locked" ? "disabled" : "";
            const bestScore = state.bestScores[mission.id] || 0;

            return [
                "<article class=\"mission-card " + escapeHtml(status) + "\">",
                "<div class=\"mission-card-top\">",
                "<div class=\"mission-icon\">" + escapeHtml(mission.icon) + "</div>",
                "<div>",
                "<p class=\"section-kicker\">Mission " + (index + 1) + "</p>",
                "<h3 class=\"panel-title\">" + escapeHtml(mission.title) + "</h3>",
                "<p class=\"mission-tagline\">" + escapeHtml(mission.tagline) + "</p>",
                "</div>",
                "</div>",
                "<div class=\"mission-stats\">",
                "<span>Status: " + escapeHtml(status.replace("-", " ")) + "</span>",
                "<span>Stages: " + mission.stages.length + "</span>",
                "<span>Best: " + bestScore + "</span>",
                "</div>",
                "<div class=\"mission-badge-line\">Badge: " + escapeHtml(mission.badge.icon + " " + mission.badge.label) + "</div>",
                "<button type=\"button\" class=\"primary-button mission-button\" data-action=\"mission-cta\" data-mission-id=\"" + escapeHtml(mission.id) + "\" " + buttonDisabled + ">" + escapeHtml(getMissionButtonLabel(mission, status)) + "</button>",
                "</article>"
            ].join("");
        }).join("");
    }

    function renderStageMeta() {
        const mission = getActiveMission();
        const stage = getActiveStage();

        if (!mission || !stage) {
            runtime.dom.stageMeta.innerHTML = "";
            return;
        }

        runtime.dom.stageMeta.innerHTML = [
            "<div class=\"summary-item\">",
            "<p class=\"summary-label\">Mission</p>",
            "<p class=\"summary-value\">" + escapeHtml(mission.title) + "</p>",
            "</div>",
            "<div class=\"summary-item\">",
            "<p class=\"summary-label\">Stage</p>",
            "<p class=\"summary-value\">" + escapeHtml(stage.title) + " (" + (state.stageIndex + 1) + "/" + mission.stages.length + ")</p>",
            "</div>",
            "<div class=\"summary-item\">",
            "<p class=\"summary-label\">Goal</p>",
            "<p class=\"summary-value\">" + escapeHtml(stage.objective) + "</p>",
            "</div>",
            "<div class=\"summary-item\">",
            "<p class=\"summary-label\">Mission badge</p>",
            "<p class=\"summary-value\">" + escapeHtml(mission.badge.icon + " " + mission.badge.label) + "</p>",
            "</div>"
        ].join("");

        updateTipCard(runtime.dom.stageTipCard, state.stageTip, "Mission Fact");
    }

    function renderStageIntro() {
        const mission = getActiveMission();
        const stage = getActiveStage();

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"stage-intro\">",
            "<p class=\"section-kicker\">" + escapeHtml(mission.title) + "</p>",
            "<h3 class=\"stage-headline\">" + escapeHtml(stage.title) + "</h3>",
            "<p class=\"stage-copy\">" + escapeHtml(stage.intro) + "</p>",
            "<div class=\"objective-callout\">" + escapeHtml(stage.objective) + "</div>",
            "<div class=\"stage-trail\">",
            mission.stages.map(function (missionStage, index) {
                const className = index === state.stageIndex ? "trail-step current" : index < state.stageIndex ? "trail-step done" : "trail-step";
                return "<span class=\"" + className + "\">" + (index + 1) + ". " + escapeHtml(missionStage.title) + "</span>";
            }).join(""),
            "</div>",
            "<div class=\"stage-actions\">",
            "<button type=\"button\" class=\"primary-button\" data-action=\"begin-stage\">Begin Stage</button>",
            "<button type=\"button\" class=\"ghost-button\" data-action=\"back-to-map\">Back to Map</button>",
            "</div>",
            "</div>"
        ].join("");
    }

    function renderStage() {
        renderStageMeta();

        if (state.screen !== "stage") {
            return;
        }

        if (state.stageMode === "intro" || !runtime.stageRuntime) {
            renderStageIntro();
            return;
        }

        if (runtime.stageRuntime.type === "sequence") {
            renderSequenceStage();
        } else if (runtime.stageRuntime.type === "quiz") {
            renderQuizStage();
        } else if (runtime.stageRuntime.type === "plate") {
            renderPlateStage();
        } else if (runtime.stageRuntime.type === "sort") {
            renderSortStage();
        } else if (runtime.stageRuntime.type === "scenario") {
            renderScenarioStage();
        } else if (runtime.stageRuntime.type === "action-targets") {
            renderActionStageFrame();
        }
    }

    function renderResults() {
        if (state.screen !== "results") {
            return;
        }

        if (state.resultKind === "final") {
            renderFinalReport();
            return;
        }

        if (!state.currentStageResult) {
            runtime.dom.resultsPanel.innerHTML = "<div class=\"empty-state\">No result available yet.</div>";
            return;
        }

        const result = state.currentStageResult;
        const buttons = buildResultsButtons(result);
        const details = (result.details || []).map(function (detail) {
            return "<div class=\"summary-item\"><p class=\"summary-label\">" + escapeHtml(detail.label) + "</p><p class=\"summary-value\">" + escapeHtml(detail.value) + "</p></div>";
        }).join("");
        const nutrition = result.nutrition && result.nutrition.length > 0
            ? "<div class=\"nutrition-stack\">" + result.nutrition.map(function (item) {
                return "<div class=\"nutrition-item\"><strong>" + escapeHtml(item.name) + "</strong><span>" + escapeHtml("Calories: " + item.calories + " • Protein: " + item.protein + " • " + item.source) + "</span></div>";
            }).join("") + "</div>"
            : "";

        runtime.dom.resultsPanel.innerHTML = [
            "<div class=\"result-hero " + (result.passed ? "success" : "warning") + "\">",
            "<p class=\"section-kicker\">" + escapeHtml(result.eyebrow) + "</p>",
            "<h3 class=\"result-title\">" + escapeHtml(result.title) + "</h3>",
            "<p class=\"result-copy\">" + escapeHtml(result.summary) + "</p>",
            "<p class=\"result-score\">" + (result.passed ? "+" + result.scoreDelta : "0") + " points</p>",
            "</div>",
            "<div class=\"summary-stack result-detail-grid\">" + details + "</div>",
            nutrition,
            "<div class=\"result-tip-shell\">" + renderTipCard(state.resultsTip, "Mission Fact") + "</div>",
            "<div class=\"stage-actions\">" + buttons + "</div>"
        ].join("");
    }

    function buildResultsButtons(result) {
        if (state.resultKind === "stage") {
            if (!result.passed) {
                return [
                    "<button type=\"button\" class=\"primary-button\" data-action=\"retry-stage\">Retry Stage</button>",
                    "<button type=\"button\" class=\"ghost-button\" data-action=\"back-to-map\">Back to Map</button>"
                ].join("");
            }

            if (result.isLastStage) {
                return [
                    "<button type=\"button\" class=\"primary-button\" data-action=\"next-stage\">View Mission Report</button>",
                    "<button type=\"button\" class=\"ghost-button\" data-action=\"back-to-map\">Back to Map</button>"
                ].join("");
            }

            return [
                "<button type=\"button\" class=\"primary-button\" data-action=\"next-stage\">Continue to Next Stage</button>",
                "<button type=\"button\" class=\"ghost-button\" data-action=\"back-to-map\">Back to Map</button>"
            ].join("");
        }

        if (state.resultKind === "mission") {
            const finalMission = content.missions[content.missions.length - 1];
            const primaryAction = result.missionId === finalMission.id
                ? "<button type=\"button\" class=\"primary-button\" data-action=\"open-final-report\">Open Final Report</button>"
                : "<button type=\"button\" class=\"primary-button\" data-action=\"back-to-map\">Back to Map</button>";

            return [
                primaryAction,
                "<button type=\"button\" class=\"ghost-button\" data-action=\"replay-mission\" data-mission-id=\"" + escapeHtml(result.missionId) + "\">Replay Mission</button>"
            ].join("");
        }

        return "";
    }

    function renderFinalReport() {
        const strongestMission = getStrongestMission();
        const missionCards = content.missions.map(function (mission) {
            return [
                "<div class=\"report-card\">",
                "<h3>" + escapeHtml(mission.icon + " " + mission.title) + "</h3>",
                "<p>Best score: " + (state.bestScores[mission.id] || 0) + "</p>",
                "<p>Badge: " + escapeHtml(mission.badge.label) + "</p>",
                "<button type=\"button\" class=\"ghost-button\" data-action=\"replay-mission\" data-mission-id=\"" + escapeHtml(mission.id) + "\">Replay</button>",
                "</div>"
            ].join("");
        }).join("");

        const badges = content.missions.filter(function (mission) {
            return getBadgeEarned(mission);
        }).map(function (mission) {
            return "<div class=\"badge-card earned\"><span class=\"badge-icon\">" + escapeHtml(mission.badge.icon) + "</span><span class=\"badge-label\">" + escapeHtml(mission.badge.label) + "</span></div>";
        }).join("");

        runtime.dom.resultsPanel.innerHTML = [
            "<div class=\"result-hero success\">",
            "<p class=\"section-kicker\">Campaign Complete</p>",
            "<h3 class=\"result-title\">Healthy Habits Adventure complete</h3>",
            "<p class=\"result-copy\">You finished all four missions and built a stronger habit map for hygiene, nutrition, prevention, and wellness.</p>",
            "<p class=\"result-score\">" + state.score + " total points</p>",
            "</div>",
            "<div class=\"summary-stack result-detail-grid\">",
            buildSummaryItem("Strongest topic", strongestMission ? strongestMission.title : "No clear leader yet"),
            buildSummaryItem("Badges earned", String(state.badges.length)),
            buildSummaryItem("Attribution", content.brandText),
            "</div>",
            "<div class=\"report-grid\">" + missionCards + "</div>",
            "<div class=\"badge-grid final-badges\">" + badges + "</div>",
            "<div class=\"stage-actions\">",
            "<button type=\"button\" class=\"primary-button\" data-action=\"back-to-map\">Mission Map</button>",
            "<button type=\"button\" class=\"ghost-button\" data-action=\"return-dashboard\">Dashboard</button>",
            "</div>"
        ].join("");
    }

    function renderAll() {
        renderTopbar();
        renderDashboard();
        renderMap();
        renderStage();
        renderResults();
        updateScreenVisibility();
    }

    function applyRouteFromUrl() {
        const url = new URL(window.location.href);
        const view = url.searchParams.get("view");

        if (!view) {
            if (state.screen === "stage" && state.checkpoint) {
                resetMissionState({
                    missionId: state.checkpoint.missionId,
                    stageIndex: state.checkpoint.stageIndex,
                    currentMissionScore: state.checkpoint.currentMissionScore,
                    stageScores: state.checkpoint.stageScores,
                    baseScoreBeforeMission: state.checkpoint.baseScoreBeforeMission
                });
            }
            return;
        }

        game.handleShortcut(view);
    }

    function startMissionFromCard(missionId) {
        const checkpoint = getCheckpointForMission(missionId);

        if (checkpoint) {
            resetMissionState({
                missionId: checkpoint.missionId,
                stageIndex: checkpoint.stageIndex,
                currentMissionScore: checkpoint.currentMissionScore,
                stageScores: checkpoint.stageScores,
                baseScoreBeforeMission: checkpoint.baseScoreBeforeMission
            });
            updateUrl("play");
            renderAll();
            refreshStageTip();
            saveProgress();
            return;
        }

        game.startMission(missionId);
    }

    function beginStage() {
        const stage = getActiveStage();

        if (!stage) {
            return;
        }

        state.stageMode = "play";
        state.checkpoint = {
            missionId: state.missionId,
            stageIndex: state.stageIndex,
            stageMode: "intro",
            currentMissionScore: state.currentMissionScore,
            stageScores: state.currentMissionStageScores.slice(),
            baseScoreBeforeMission: state.baseScoreBeforeMission
        };
        saveProgress();

        switch (stage.type) {
        case "action-targets":
            startActionStage(stage);
            break;
        case "sequence":
            startSequenceStage(stage);
            break;
        case "quiz":
            startQuizStage(stage);
            break;
        case "plate":
            startPlateStage(stage);
            break;
        case "sort":
            startSortStage(stage);
            break;
        case "scenario":
            startScenarioStage(stage);
            break;
        default:
            break;
        }
    }

    function renderActionStageFrame() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime) {
            return;
        }

        const config = stageRuntime.config;

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"action-stage-shell\">",
            "<div class=\"action-status-bar\">",
            "<div class=\"status-chip\"><span>Goal</span><strong id=\"action-goal\">" + stageRuntime.hits + "/" + config.goal + "</strong></div>",
            "<div class=\"status-chip\"><span>Misses</span><strong id=\"action-misses\">" + state.misses + "/" + config.maxMisses + "</strong></div>",
            "<div class=\"status-chip\"><span>Soap</span><strong id=\"action-soap\">" + (config.consumable === "soap" ? state.soap : "Not used") + "</strong></div>",
            "</div>",
            "<div class=\"playfield-frame\">",
            "<div id=\"playfield\" class=\"playfield\"></div>",
            "</div>",
            "<p class=\"screen-copy action-copy\">Collect the good targets. Missing them or tapping decoys costs energy.</p>",
            "</div>"
        ].join("");

        stageRuntime.playfield = document.getElementById("playfield");
        repaintActionTargets();
    }

    function startActionStage(stage) {
        clearStageRuntime();
        const config = stage.config;

        state.energy = config.startingEnergy;
        state.soap = config.startingSoap || 0;
        state.misses = 0;

        runtime.stageRuntime = {
            type: "action-targets",
            config: config,
            hits: 0,
            targetCounter: 0,
            targets: new Map(),
            targetTimers: new Map(),
            spawnTimer: null,
            playfield: null
        };

        renderAll();

        runtime.stageRuntime.spawnTimer = window.setInterval(function () {
            spawnActionTarget();
        }, config.spawnIntervalMs);

        for (let initial = 0; initial < 4; initial += 1) {
            spawnActionTarget();
        }
    }

    function spawnActionTarget() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || !stageRuntime.playfield) {
            return;
        }

        if (stageRuntime.targets.size >= 8) {
            return;
        }

        const isBad = Math.random() < stageRuntime.config.badChance;
        const pool = isBad ? stageRuntime.config.badItems : stageRuntime.config.goodItems;
        const item = sample(pool);
        const rect = stageRuntime.playfield.getBoundingClientRect();
        const width = Math.max(rect.width - 84, 24);
        const height = Math.max(rect.height - 84, 24);
        const id = "target-" + Date.now() + "-" + stageRuntime.targetCounter;

        stageRuntime.targetCounter += 1;

        stageRuntime.targets.set(id, {
            id: id,
            bad: isBad,
            item: item,
            left: Math.random() * width,
            top: Math.random() * height
        });

        const timerId = window.setTimeout(function () {
            expireActionTarget(id);
        }, stageRuntime.config.lifetimeMs);

        stageRuntime.targetTimers.set(id, timerId);
        repaintActionTargets();
    }

    function repaintActionTargets() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || !stageRuntime.playfield) {
            return;
        }

        stageRuntime.playfield.innerHTML = Array.from(stageRuntime.targets.values()).map(function (target) {
            return [
                "<button type=\"button\" class=\"playfield-target " + (target.bad ? "bad" : "good") + "\"",
                " data-stage-action=\"hit-target\" data-target-id=\"" + escapeHtml(target.id) + "\"",
                " style=\"left:" + target.left + "px;top:" + target.top + "px;\">",
                "<span class=\"target-emoji\">" + escapeHtml(target.item.emoji) + "</span>",
                "<span class=\"target-label\">" + escapeHtml(target.item.label) + "</span>",
                "</button>"
            ].join("");
        }).join("");

        updateActionStatusBar();
    }

    function updateActionStatusBar() {
        const goalNode = document.getElementById("action-goal");
        const missesNode = document.getElementById("action-misses");
        const soapNode = document.getElementById("action-soap");

        if (goalNode && runtime.stageRuntime) {
            goalNode.textContent = runtime.stageRuntime.hits + "/" + runtime.stageRuntime.config.goal;
        }

        if (missesNode && runtime.stageRuntime) {
            missesNode.textContent = state.misses + "/" + runtime.stageRuntime.config.maxMisses;
        }

        if (soapNode && runtime.stageRuntime) {
            soapNode.textContent = runtime.stageRuntime.config.consumable === "soap" ? String(state.soap) : "Not used";
        }

        renderTopbar();
    }

    function removeActionTarget(targetId) {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || !stageRuntime.targets.has(targetId)) {
            return null;
        }

        const target = stageRuntime.targets.get(targetId);
        stageRuntime.targets.delete(targetId);

        if (stageRuntime.targetTimers.has(targetId)) {
            window.clearTimeout(stageRuntime.targetTimers.get(targetId));
            stageRuntime.targetTimers.delete(targetId);
        }

        repaintActionTargets();
        return target;
    }

    function registerActionMiss(reason) {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime) {
            return;
        }

        state.misses += 1;
        state.energy = clamp((state.energy || 0) - 1, 0, 5);
        showToast(reason);
        updateActionStatusBar();

        if (state.misses >= stageRuntime.config.maxMisses || state.energy === 0) {
            finishStage({
                passed: false,
                eyebrow: "Stage failed",
                title: getActiveStage().title,
                summary: "Energy ran out before the goal was complete.",
                details: [
                    { label: "Targets cleared", value: String(stageRuntime.hits) },
                    { label: "Misses", value: String(state.misses) },
                    { label: "Soap left", value: String(state.soap) }
                ],
                scoreDelta: 0,
                nutrition: []
            });
        }
    }

    function expireActionTarget(targetId) {
        const target = removeActionTarget(targetId);

        if (!target || target.bad) {
            return;
        }

        registerActionMiss("Missed " + target.item.label + ".");
    }

    function hitActionTarget(targetId) {
        const stageRuntime = runtime.stageRuntime;
        const target = removeActionTarget(targetId);

        if (!stageRuntime || !target) {
            return;
        }

        if (target.bad) {
            registerActionMiss("Avoid the " + target.item.label + ".");
            return;
        }

        if (stageRuntime.config.consumable === "soap") {
            if (state.soap <= 0) {
                finishStage({
                    passed: false,
                    eyebrow: "Stage failed",
                    title: getActiveStage().title,
                    summary: "Soap ran out before the area was clean.",
                    details: [
                        { label: "Targets cleared", value: String(stageRuntime.hits) },
                        { label: "Misses", value: String(state.misses) },
                        { label: "Soap left", value: String(state.soap) }
                    ],
                    scoreDelta: 0,
                    nutrition: []
                });
                return;
            }

            state.soap = clamp(state.soap - 1, 0, stageRuntime.config.startingSoap);
        }

        stageRuntime.hits += 1;
        updateActionStatusBar();

        if (stageRuntime.hits >= stageRuntime.config.goal) {
            const perfect = state.misses === 0;
            const scoreDelta = 100 + (perfect ? 25 : 0) + (state.energy || 0) * 10 + (stageRuntime.config.consumable === "soap" ? state.soap * 5 : 0);

            finishStage({
                passed: true,
                eyebrow: "Stage complete",
                title: getActiveStage().title,
                summary: "You cleared the mission target before the zone got out of control.",
                details: [
                    { label: "Targets cleared", value: String(stageRuntime.hits) },
                    { label: "Misses", value: String(state.misses) },
                    { label: "Energy bonus", value: String((state.energy || 0) * 10) },
                    { label: "Soap bonus", value: stageRuntime.config.consumable === "soap" ? String(state.soap * 5) : "0" }
                ],
                scoreDelta: scoreDelta,
                nutrition: []
            });
            return;
        }

        if (stageRuntime.config.consumable === "soap" && state.soap === 0) {
            finishStage({
                passed: false,
                eyebrow: "Stage failed",
                title: getActiveStage().title,
                summary: "Soap ran out before the remaining targets could be cleared.",
                details: [
                    { label: "Targets cleared", value: String(stageRuntime.hits) },
                    { label: "Misses", value: String(state.misses) },
                    { label: "Soap left", value: "0" }
                ],
                scoreDelta: 0,
                nutrition: []
            });
        }
    }

    function startSequenceStage(stage) {
        clearStageRuntime();
        const challenge = content.sequenceChallenges[stage.challengeId];

        resetTransientMeters();
        runtime.stageRuntime = {
            type: "sequence",
            challenge: challenge,
            selectedIds: [],
            availableIds: shuffle(challenge.steps.map(function (step) { return step.id; }))
        };

        renderAll();
    }

    function renderSequenceStage() {
        const challenge = runtime.stageRuntime.challenge;
        const stepLookup = {};

        challenge.steps.forEach(function (step) {
            stepLookup[step.id] = step;
        });

        const selectedMarkup = runtime.stageRuntime.selectedIds.length > 0
            ? runtime.stageRuntime.selectedIds.map(function (stepId, index) {
                return "<button type=\"button\" class=\"sequence-choice picked\" data-stage-action=\"remove-sequence-step\" data-step-id=\"" + escapeHtml(stepId) + "\">" + (index + 1) + ". " + escapeHtml(stepLookup[stepId].label) + "</button>";
            }).join("")
            : "<div class=\"empty-state\">Pick the first step to start the routine.</div>";

        const availableMarkup = runtime.stageRuntime.availableIds.map(function (stepId) {
            return "<button type=\"button\" class=\"sequence-choice\" data-stage-action=\"choose-sequence-step\" data-step-id=\"" + escapeHtml(stepId) + "\">" + escapeHtml(stepLookup[stepId].label) + "</button>";
        }).join("");

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"learning-stage\">",
            "<p class=\"stage-copy\">" + escapeHtml(challenge.prompt) + "</p>",
            "<div class=\"sequence-columns\">",
            "<div class=\"sequence-column\"><h3>Your order</h3><div class=\"sequence-stack\">" + selectedMarkup + "</div></div>",
            "<div class=\"sequence-column\"><h3>Available steps</h3><div class=\"sequence-stack\">" + availableMarkup + "</div></div>",
            "</div>",
            "<div class=\"stage-actions\">",
            "<button type=\"button\" class=\"primary-button\" data-stage-action=\"submit-sequence\"" + (runtime.stageRuntime.selectedIds.length !== challenge.steps.length ? " disabled" : "") + ">Check Order</button>",
            "</div>",
            "</div>"
        ].join("");
    }

    function chooseSequenceStep(stepId) {
        const availableIndex = runtime.stageRuntime.availableIds.indexOf(stepId);

        if (availableIndex === -1) {
            return;
        }

        runtime.stageRuntime.availableIds.splice(availableIndex, 1);
        runtime.stageRuntime.selectedIds.push(stepId);
        renderSequenceStage();
    }

    function removeSequenceStep(stepId) {
        const selectedIndex = runtime.stageRuntime.selectedIds.indexOf(stepId);

        if (selectedIndex === -1) {
            return;
        }

        runtime.stageRuntime.selectedIds.splice(selectedIndex, 1);
        runtime.stageRuntime.availableIds.push(stepId);
        renderSequenceStage();
    }

    function submitSequenceStage() {
        const challenge = runtime.stageRuntime.challenge;
        const correctCount = runtime.stageRuntime.selectedIds.reduce(function (count, stepId, index) {
            return count + (stepId === challenge.steps[index].id ? 1 : 0);
        }, 0);
        const passed = correctCount >= challenge.passAt;
        const perfect = correctCount === challenge.steps.length;

        finishStage({
            passed: passed,
            eyebrow: passed ? "Stage complete" : "Stage failed",
            title: getActiveStage().title,
            summary: passed ? "You built a strong routine sequence." : "The order needs a little more work.",
            details: [
                { label: "Correct positions", value: String(correctCount) + "/" + challenge.steps.length },
                { label: "Pass mark", value: String(challenge.passAt) + " correct" },
                { label: "Perfect bonus", value: perfect ? "25" : "0" }
            ],
            scoreDelta: passed ? 100 + (perfect ? 25 : 0) : 0,
            nutrition: []
        });
    }

    function startQuizStage(stage) {
        clearStageRuntime();
        resetTransientMeters();
        runtime.stageRuntime = {
            type: "quiz",
            questions: shuffle(content.quizBank[stage.topic]).slice(0, stage.questionCount),
            currentIndex: 0,
            answers: [],
            correctCount: 0,
            locked: false
        };

        renderAll();
    }

    function renderQuizStage() {
        const stageRuntime = runtime.stageRuntime;
        const question = stageRuntime.questions[stageRuntime.currentIndex];
        const selected = stageRuntime.answers[stageRuntime.currentIndex];

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"learning-stage\">",
            "<div class=\"quiz-progress\">Question " + (stageRuntime.currentIndex + 1) + " of " + stageRuntime.questions.length + "</div>",
            "<h3 class=\"stage-headline\">" + escapeHtml(question.question) + "</h3>",
            "<div class=\"quiz-options\">",
            question.options.map(function (option, index) {
                const isSelected = selected === index;
                const isCorrect = stageRuntime.locked && index === question.correct;
                const isWrong = stageRuntime.locked && isSelected && index !== question.correct;
                let className = "quiz-option";

                if (isCorrect) {
                    className += " correct";
                } else if (isWrong) {
                    className += " wrong";
                } else if (isSelected) {
                    className += " selected";
                }

                return "<button type=\"button\" class=\"" + className + "\" data-stage-action=\"choose-quiz-answer\" data-choice-index=\"" + index + "\"" + (stageRuntime.locked ? " disabled" : "") + ">" + escapeHtml(option) + "</button>";
            }).join(""),
            "</div>",
            stageRuntime.locked ? "<div class=\"explanation-card\">" + escapeHtml(question.explanation) + "</div>" : "",
            "<div class=\"stage-actions\">" + (stageRuntime.locked ? "<button type=\"button\" class=\"primary-button\" data-stage-action=\"next-quiz\">" + (stageRuntime.currentIndex === stageRuntime.questions.length - 1 ? "Finish Quiz" : "Next Question") + "</button>" : "") + "</div>",
            "</div>"
        ].join("");
    }

    function chooseQuizAnswer(choiceIndex) {
        const stageRuntime = runtime.stageRuntime;
        const question = stageRuntime.questions[stageRuntime.currentIndex];

        if (stageRuntime.locked) {
            return;
        }

        stageRuntime.answers[stageRuntime.currentIndex] = choiceIndex;
        stageRuntime.locked = true;

        if (choiceIndex === question.correct) {
            stageRuntime.correctCount += 1;
        }

        renderQuizStage();
    }

    function advanceQuiz() {
        const stageRuntime = runtime.stageRuntime;

        if (stageRuntime.currentIndex >= stageRuntime.questions.length - 1) {
            const stage = getActiveStage();
            const passed = stageRuntime.correctCount >= stage.passAt;
            const perfect = stageRuntime.correctCount === stageRuntime.questions.length;

            finishStage({
                passed: passed,
                eyebrow: passed ? "Stage complete" : "Stage failed",
                title: stage.title,
                summary: passed ? "You passed the quiz and locked in the lesson." : "You need a stronger score to pass the quiz.",
                details: [
                    { label: "Correct answers", value: String(stageRuntime.correctCount) + "/" + stageRuntime.questions.length },
                    { label: "Pass mark", value: String(stage.passAt) + " correct" },
                    { label: "Perfect bonus", value: perfect ? "25" : "0" }
                ],
                scoreDelta: passed ? 100 + (perfect ? 25 : 0) : 0,
                nutrition: []
            });
            return;
        }

        stageRuntime.currentIndex += 1;
        stageRuntime.locked = false;
        renderQuizStage();
    }

    function startPlateStage() {
        clearStageRuntime();
        resetTransientMeters();
        runtime.stageRuntime = {
            type: "plate",
            selectedIds: [],
            checking: false
        };
        renderAll();
    }

    function renderPlateStage() {
        const stage = getActiveStage();

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"learning-stage\">",
            "<p class=\"stage-copy\">Pick exactly " + stage.picks + " foods and cover every target group.</p>",
            "<div class=\"requirement-row\">" + stage.requirements.map(function (requirement) {
                return "<span class=\"requirement-chip\">" + escapeHtml(requirement.label) + "</span>";
            }).join("") + "</div>",
            "<div class=\"plate-grid\">",
            content.foodBank.map(function (food) {
                const selected = runtime.stageRuntime.selectedIds.indexOf(food.id) > -1;
                return [
                    "<button type=\"button\" class=\"food-card " + (selected ? "selected" : "") + "\"",
                    " data-stage-action=\"toggle-plate-food\" data-food-id=\"" + escapeHtml(food.id) + "\">",
                    "<span class=\"food-emoji\">" + escapeHtml(food.emoji) + "</span>",
                    "<span class=\"food-name\">" + escapeHtml(food.label) + "</span>",
                    "</button>"
                ].join("");
            }).join(""),
            "</div>",
            "<div class=\"stage-actions\">",
            "<button type=\"button\" class=\"primary-button\" data-stage-action=\"submit-plate\"" + (runtime.stageRuntime.selectedIds.length !== stage.picks || runtime.stageRuntime.checking ? " disabled" : "") + ">" + (runtime.stageRuntime.checking ? "Checking..." : "Check Plate") + "</button>",
            "</div>",
            "</div>"
        ].join("");
    }

    function togglePlateFood(foodId) {
        const picked = runtime.stageRuntime.selectedIds;
        const index = picked.indexOf(foodId);
        const stage = getActiveStage();

        if (index > -1) {
            picked.splice(index, 1);
        } else if (picked.length < stage.picks) {
            picked.push(foodId);
        } else {
            showToast("Choose exactly " + stage.picks + " foods.");
        }

        renderPlateStage();
    }

    async function submitPlateStage() {
        const stage = getActiveStage();
        const selectedFoods = runtime.stageRuntime.selectedIds.map(function (foodId) {
            return content.foodBank.find(function (food) {
                return food.id === foodId;
            });
        });

        runtime.stageRuntime.checking = true;
        renderPlateStage();

        const covered = stage.requirements.map(function (requirement) {
            const matched = selectedFoods.some(function (food) {
                return food.groups.some(function (group) {
                    return requirement.groups.indexOf(group) > -1;
                });
            });
            return { label: requirement.label, matched: matched };
        });
        const passed = covered.every(function (requirement) {
            return requirement.matched;
        });
        const perfect = passed && selectedFoods.every(function (food) {
            return food.healthy;
        });
        const nutrition = await Promise.all(selectedFoods.map(function (food) {
            return runtime.apiService.getNutritionInfo(food);
        }));

        finishStage({
            passed: passed,
            eyebrow: passed ? "Stage complete" : "Stage failed",
            title: stage.title,
            summary: passed ? "Your plate covers the key food groups." : "The plate is missing at least one key group.",
            details: covered.map(function (item) {
                return {
                    label: item.label,
                    value: item.matched ? "Covered" : "Missing"
                };
            }).concat([
                { label: "Perfect bonus", value: perfect ? "25" : "0" }
            ]),
            scoreDelta: passed ? 100 + (perfect ? 25 : 0) : 0,
            nutrition: nutrition
        });
    }

    function startSortStage(stage) {
        clearStageRuntime();
        resetTransientMeters();
        runtime.stageRuntime = {
            type: "sort",
            challenge: content.sortChallenges[stage.challengeId],
            answers: {}
        };

        renderAll();
    }

    function renderSortStage() {
        const challenge = runtime.stageRuntime.challenge;
        const answeredCount = Object.keys(runtime.stageRuntime.answers).length;

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"learning-stage\">",
            "<p class=\"stage-copy\">Sort each food into the right lane.</p>",
            "<div class=\"sort-grid\">",
            challenge.items.map(function (item) {
                const currentChoice = runtime.stageRuntime.answers[item.id];
                return [
                    "<div class=\"sort-card\">",
                    "<p class=\"sort-label\">" + escapeHtml(item.label) + "</p>",
                    "<div class=\"sort-actions\">",
                    "<button type=\"button\" class=\"mini-button " + (currentChoice === "everyday" ? "selected" : "") + "\" data-stage-action=\"sort-answer\" data-item-id=\"" + escapeHtml(item.id) + "\" data-choice=\"everyday\">" + escapeHtml(challenge.leftLabel) + "</button>",
                    "<button type=\"button\" class=\"mini-button " + (currentChoice === "sometimes" ? "selected" : "") + "\" data-stage-action=\"sort-answer\" data-item-id=\"" + escapeHtml(item.id) + "\" data-choice=\"sometimes\">" + escapeHtml(challenge.rightLabel) + "</button>",
                    "</div>",
                    "</div>"
                ].join("");
            }).join(""),
            "</div>",
            "<div class=\"stage-actions\">",
            "<button type=\"button\" class=\"primary-button\" data-stage-action=\"submit-sort\"" + (answeredCount !== challenge.items.length ? " disabled" : "") + ">Check Sort</button>",
            "</div>",
            "</div>"
        ].join("");
    }

    function setSortAnswer(itemId, choice) {
        runtime.stageRuntime.answers[itemId] = choice;
        renderSortStage();
    }

    function submitSortStage() {
        const challenge = runtime.stageRuntime.challenge;
        const correctCount = challenge.items.reduce(function (count, item) {
            return count + (runtime.stageRuntime.answers[item.id] === item.correct ? 1 : 0);
        }, 0);
        const passed = correctCount >= challenge.passAt;
        const perfect = correctCount === challenge.items.length;

        finishStage({
            passed: passed,
            eyebrow: passed ? "Stage complete" : "Stage failed",
            title: getActiveStage().title,
            summary: passed ? "You sorted the foods into the right habit lanes." : "Some foods landed in the wrong lane.",
            details: [
                { label: "Correct sorts", value: String(correctCount) + "/" + challenge.items.length },
                { label: "Pass mark", value: String(challenge.passAt) + " correct" },
                { label: "Perfect bonus", value: perfect ? "25" : "0" }
            ],
            scoreDelta: passed ? 100 + (perfect ? 25 : 0) : 0,
            nutrition: []
        });
    }

    function startScenarioStage(stage) {
        clearStageRuntime();
        resetTransientMeters();
        runtime.stageRuntime = {
            type: "scenario",
            challenge: content.scenarioChallenges[stage.challengeId],
            currentIndex: 0,
            answers: [],
            correctCount: 0,
            locked: false
        };

        renderAll();
    }

    function renderScenarioStage() {
        const stageRuntime = runtime.stageRuntime;
        const prompt = stageRuntime.challenge.prompts[stageRuntime.currentIndex];
        const selected = stageRuntime.answers[stageRuntime.currentIndex];

        runtime.dom.stagePanel.innerHTML = [
            "<div class=\"learning-stage\">",
            "<div class=\"quiz-progress\">Scenario " + (stageRuntime.currentIndex + 1) + " of " + stageRuntime.challenge.prompts.length + "</div>",
            "<h3 class=\"stage-headline\">" + escapeHtml(prompt.prompt) + "</h3>",
            "<div class=\"quiz-options\">",
            prompt.options.map(function (option, index) {
                const isSelected = selected === index;
                const isCorrect = stageRuntime.locked && index === prompt.correct;
                const isWrong = stageRuntime.locked && isSelected && index !== prompt.correct;
                let className = "quiz-option";

                if (isCorrect) {
                    className += " correct";
                } else if (isWrong) {
                    className += " wrong";
                } else if (isSelected) {
                    className += " selected";
                }

                return "<button type=\"button\" class=\"" + className + "\" data-stage-action=\"choose-scenario-answer\" data-choice-index=\"" + index + "\"" + (stageRuntime.locked ? " disabled" : "") + ">" + escapeHtml(option) + "</button>";
            }).join(""),
            "</div>",
            stageRuntime.locked ? "<div class=\"explanation-card\">" + escapeHtml(prompt.explanation) + "</div>" : "",
            "<div class=\"stage-actions\">" + (stageRuntime.locked ? "<button type=\"button\" class=\"primary-button\" data-stage-action=\"next-scenario\">" + (stageRuntime.currentIndex === stageRuntime.challenge.prompts.length - 1 ? "Finish Scenarios" : "Next Scenario") + "</button>" : "") + "</div>",
            "</div>"
        ].join("");
    }

    function chooseScenarioAnswer(choiceIndex) {
        const stageRuntime = runtime.stageRuntime;
        const prompt = stageRuntime.challenge.prompts[stageRuntime.currentIndex];

        if (stageRuntime.locked) {
            return;
        }

        stageRuntime.answers[stageRuntime.currentIndex] = choiceIndex;
        stageRuntime.locked = true;

        if (choiceIndex === prompt.correct) {
            stageRuntime.correctCount += 1;
        }

        renderScenarioStage();
    }

    function advanceScenario() {
        const stageRuntime = runtime.stageRuntime;

        if (stageRuntime.currentIndex >= stageRuntime.challenge.prompts.length - 1) {
            const passed = stageRuntime.correctCount >= stageRuntime.challenge.passAt;
            const perfect = stageRuntime.correctCount === stageRuntime.challenge.prompts.length;

            finishStage({
                passed: passed,
                eyebrow: passed ? "Stage complete" : "Stage failed",
                title: getActiveStage().title,
                summary: passed ? "You chose the safer responses in the prevention scenarios." : "A few safer choices were missed.",
                details: [
                    { label: "Correct choices", value: String(stageRuntime.correctCount) + "/" + stageRuntime.challenge.prompts.length },
                    { label: "Pass mark", value: String(stageRuntime.challenge.passAt) + " correct" },
                    { label: "Perfect bonus", value: perfect ? "25" : "0" }
                ],
                scoreDelta: passed ? 100 + (perfect ? 25 : 0) : 0,
                nutrition: []
            });
            return;
        }

        stageRuntime.currentIndex += 1;
        stageRuntime.locked = false;
        renderScenarioStage();
    }

    function finishStage(result) {
        const mission = getActiveMission();
        const stage = getActiveStage();
        const passed = result.passed;

        clearStageRuntime();

        if (passed) {
            state.currentMissionScore += result.scoreDelta;
            state.currentMissionStageScores[state.stageIndex] = result.scoreDelta;
        }

        state.currentStageResult = {
            missionId: mission.id,
            stageId: stage.id,
            eyebrow: result.eyebrow,
            title: result.title,
            summary: result.summary,
            details: result.details,
            scoreDelta: result.scoreDelta,
            passed: passed,
            nutrition: result.nutrition || [],
            isLastStage: state.stageIndex === mission.stages.length - 1
        };
        state.resultKind = "stage";
        state.screen = "results";
        resetTransientMeters();

        if (passed && state.stageIndex < mission.stages.length - 1) {
            state.checkpoint = {
                missionId: mission.id,
                stageIndex: state.stageIndex + 1,
                stageMode: "intro",
                currentMissionScore: state.currentMissionScore,
                stageScores: state.currentMissionStageScores.slice(),
                baseScoreBeforeMission: state.baseScoreBeforeMission
            };
        } else if (!passed) {
            state.checkpoint = {
                missionId: mission.id,
                stageIndex: state.stageIndex,
                stageMode: "intro",
                currentMissionScore: state.currentMissionScore,
                stageScores: state.currentMissionStageScores.slice(),
                baseScoreBeforeMission: state.baseScoreBeforeMission
            };
        } else {
            state.checkpoint = null;
        }

        updateUrl("play");
        renderAll();
        saveProgress();
        refreshResultsTip(mission.topic);
    }

    function advanceFromStageResult() {
        if (!state.currentStageResult || state.resultKind !== "stage") {
            return;
        }

        if (!state.currentStageResult.passed) {
            game.retryStage();
            return;
        }

        if (state.currentStageResult.isLastStage) {
            presentMissionResult();
            return;
        }

        state.stageIndex += 1;
        state.stageMode = "intro";
        state.screen = "stage";
        state.currentStageResult = null;
        state.resultKind = null;
        resetTransientMeters();
        state.checkpoint = {
            missionId: state.missionId,
            stageIndex: state.stageIndex,
            stageMode: "intro",
            currentMissionScore: state.currentMissionScore,
            stageScores: state.currentMissionStageScores.slice(),
            baseScoreBeforeMission: state.baseScoreBeforeMission
        };
        updateUrl("play");
        renderAll();
        saveProgress();
        refreshStageTip();
    }

    function presentMissionResult() {
        const mission = getActiveMission();
        const previousBest = state.bestScores[mission.id] || 0;
        const storedBest = Math.max(previousBest, state.currentMissionScore);
        const unlockedIndex = getMissionIndex(mission.id) + 1;
        const firstClear = !getBadgeEarned(mission);

        state.bestScores[mission.id] = storedBest;
        state.score = state.baseScoreBeforeMission + storedBest;

        if (firstClear) {
            state.badges.push(mission.badge.id);
        }

        if (content.missions[unlockedIndex]) {
            state.unlockedMissionIds = Array.from(new Set(state.unlockedMissionIds.concat(content.missions[unlockedIndex].id)));
        }

        state.currentStageResult = {
            missionId: mission.id,
            eyebrow: "Mission complete",
            title: mission.title,
            summary: "Mission score recorded. " + (storedBest > previousBest ? "New best score saved." : "Best score held steady."),
            details: [
                { label: "Mission score", value: String(state.currentMissionScore) },
                { label: "Best mission score", value: String(storedBest) },
                { label: "Badge earned", value: mission.badge.label },
                { label: "Total best score", value: String(state.score) }
            ],
            scoreDelta: state.currentMissionScore,
            passed: true,
            nutrition: []
        };
        state.resultKind = "mission";
        state.screen = "results";
        state.lastSelectedMission = mission.id;
        state.checkpoint = null;
        resetTransientMeters();
        updateUrl("play");
        renderAll();
        saveProgress();
        refreshResultsTip(mission.topic);
    }

    function presentFinalReport() {
        clearStageRuntime();
        state.resultKind = "final";
        state.screen = "results";
        state.currentStageResult = null;
        state.checkpoint = null;
        resetTransientMeters();
        updateUrl("play");
        renderAll();
        saveProgress();
    }

    function clearMissionContext() {
        clearStageRuntime();
        state.missionId = null;
        state.stageIndex = 0;
        state.stageMode = "intro";
        state.currentMissionScore = 0;
        state.currentMissionStageScores = [];
        state.baseScoreBeforeMission = state.score;
        state.currentStageResult = null;
        state.resultKind = null;
        state.checkpoint = null;
        resetTransientMeters();
    }

    function getStrongestMission() {
        return content.missions.reduce(function (best, mission) {
            if (!best) {
                return mission;
            }

            return (state.bestScores[mission.id] || 0) > (state.bestScores[best.id] || 0) ? mission : best;
        }, null);
    }

    function getStrongestMissionLabel() {
        const strongestMission = getStrongestMission();

        if (!strongestMission || !state.bestScores[strongestMission.id]) {
            return "No mission score yet";
        }

        return strongestMission.title + " • " + state.bestScores[strongestMission.id] + " points";
    }

    const game = {
        state: state,
        init: function () {
            cacheDom();
            bindEvents();
            runtime.apiService = new APIService();
            restoreProgress();
            applyRouteFromUrl();
            renderAll();
            refreshDashboardTip(false);

            if (state.missionId) {
                refreshStageTip();
            }

            window.setTimeout(function () {
                runtime.loadingDone = true;
                runtime.dom.loadingScreen.classList.add("hidden");
            }, 500);
        },
        startMission: function (missionId) {
            if (isMissionLocked(missionId)) {
                return;
            }

            clearStageRuntime();
            resetMissionState({
                missionId: missionId,
                stageIndex: 0,
                currentMissionScore: 0,
                stageScores: [],
                baseScoreBeforeMission: state.score - (state.bestScores[missionId] || 0)
            });
            updateUrl("play");
            renderAll();
            saveProgress();
            refreshStageTip();
        },
        resume: function () {
            if (!state.checkpoint) {
                this.startMission(content.missions[0].id);
                return;
            }

            clearStageRuntime();
            resetMissionState({
                missionId: state.checkpoint.missionId,
                stageIndex: state.checkpoint.stageIndex,
                currentMissionScore: state.checkpoint.currentMissionScore,
                stageScores: state.checkpoint.stageScores,
                baseScoreBeforeMission: state.checkpoint.baseScoreBeforeMission
            });
            updateUrl("play");
            renderAll();
            saveProgress();
            refreshStageTip();
        },
        retryStage: function () {
            if (!state.missionId) {
                return;
            }

            clearStageRuntime();
            state.screen = "stage";
            state.stageMode = "intro";
            state.resultKind = null;
            state.currentStageResult = null;
            state.checkpoint = {
                missionId: state.missionId,
                stageIndex: state.stageIndex,
                stageMode: "intro",
                currentMissionScore: state.currentMissionScore,
                stageScores: state.currentMissionStageScores.slice(),
                baseScoreBeforeMission: state.baseScoreBeforeMission
            };
            resetTransientMeters();
            updateUrl("play");
            renderAll();
            saveProgress();
            refreshStageTip();
        },
        goHome: function () {
            clearStageRuntime();
            state.screen = "dashboard";
            updateUrl("start");
            renderAll();
            saveProgress();
        },
        handleShortcut: function (view) {
            if (view === "play") {
                if (state.checkpoint) {
                    this.resume();
                } else {
                    this.startMission(content.missions[0].id);
                }
                return;
            }

            if (view === "map") {
                clearStageRuntime();
                state.screen = "map";
                renderAll();
                saveProgress();
                return;
            }

            if (view === "tips") {
                state.screen = "dashboard";
                state.tipDrawerOpen = true;
                renderAll();
                saveProgress();
                return;
            }

            clearStageRuntime();
            state.screen = "dashboard";
            renderAll();
            saveProgress();
        }
    };

    window.HealthHeroGame = game;
}());
