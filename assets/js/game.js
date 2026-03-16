(function () {
    const content = window.HEALTH_HERO_CONTENT;

    if (!content) {
        return;
    }

    const storageKeys = {
        progress: "healthHeroProgress.v3",
        tips: "healthTipsCache.v2",
        nutrition: "nutritionCache.v2"
    };
    const legacyStorageKeys = {
        progress: "healthHeroProgress.v2"
    };
    const brand = content.brand || {
        companyName: "Cruze Intelligent Systems(U) Ltd",
        companyWebsite: "cruzeintelligentsystems.com",
        gameWebsite: "https://games.cruze-tech.com",
        gameWebsiteLabel: "games.cruze-tech.com"
    };
    const exportTheme = {
        navy: "#0D2A38",
        teal: "#0E7490",
        sky: "#22C7F0",
        mango: "#F4B942",
        orange: "#F97316",
        leaf: "#69B34C",
        paper: "#FFF8E8",
        white: "#FFFFFF",
        inkSoft: "rgba(13, 42, 56, 0.72)",
        line: "rgba(13, 42, 56, 0.12)"
    };

    const defaultState = {
        screen: "dashboard",
        missionId: null,
        stageIndex: 0,
        stageMode: "intro",
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
        loadingStartedAt: 0,
        toastTimer: null,
        tipToken: 0,
        lastExportCanvas: null,
        lastExportMeta: null
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

    function getCommittedScore() {
        return content.missions.reduce(function (total, mission) {
            return total + (state.bestScores[mission.id] || 0);
        }, 0);
    }

    function getMissionBaselineScore(missionId) {
        return getCommittedScore() - (state.bestScores[missionId] || 0);
    }

    function getDisplayScore() {
        if (
            state.missionId &&
            state.screen !== "dashboard" &&
            state.screen !== "map" &&
            state.resultKind !== "mission" &&
            state.resultKind !== "final"
        ) {
            return getMissionBaselineScore(state.missionId) + state.currentMissionScore;
        }

        return getCommittedScore();
    }

    function getTopbarProgressText() {
        if (state.screen === "dashboard") {
            return "Dashboard";
        }

        if (state.screen === "map") {
            return "Mission Map";
        }

        if (state.screen === "results" && state.resultKind === "final") {
            return "Final Report";
        }

        if (state.screen === "results") {
            return "Mission Report";
        }

        const mission = getActiveMission();

        if (!mission) {
            return "Mission Report";
        }

        return "Mission " + (getMissionIndex(mission.id) + 1) + " • Stage " + (state.stageIndex + 1) + "/" + mission.stages.length;
    }

    function sanitizeUnlockedMissionIds(unlockedMissionIds) {
        const validMissionIds = content.missions.map(function (mission) {
            return mission.id;
        });
        const unlocked = (Array.isArray(unlockedMissionIds) ? unlockedMissionIds : []).filter(function (missionId) {
            return validMissionIds.indexOf(missionId) > -1;
        });

        unlocked.unshift(content.missions[0].id);

        return Array.from(new Set(unlocked));
    }

    function sanitizeBadges(badgeIds) {
        const validBadgeIds = content.missions.map(function (mission) {
            return mission.badge.id;
        });

        return Array.from(new Set((Array.isArray(badgeIds) ? badgeIds : []).filter(function (badgeId) {
            return validBadgeIds.indexOf(badgeId) > -1;
        })));
    }

    function sanitizeBestScores(bestScores) {
        const sanitized = {};

        content.missions.forEach(function (mission) {
            const rawScore = bestScores && typeof bestScores[mission.id] === "number" ? bestScores[mission.id] : 0;
            sanitized[mission.id] = Math.max(0, Math.floor(rawScore));
        });

        return sanitized;
    }

    function sanitizeCheckpoint(checkpoint) {
        if (!checkpoint || !getMission(checkpoint.missionId)) {
            return null;
        }

        const mission = getMission(checkpoint.missionId);
        const stageIndex = clamp(typeof checkpoint.stageIndex === "number" ? checkpoint.stageIndex : 0, 0, mission.stages.length - 1);
        const stageScores = Array.isArray(checkpoint.stageScores) ? checkpoint.stageScores.map(function (score) {
            return typeof score === "number" ? Math.max(0, Math.floor(score)) : 0;
        }).slice(0, mission.stages.length) : [];

        return {
            missionId: mission.id,
            stageIndex: stageIndex,
            stageMode: "intro",
            currentMissionScore: typeof checkpoint.currentMissionScore === "number" ? Math.max(0, Math.floor(checkpoint.currentMissionScore)) : 0,
            stageScores: stageScores
        };
    }

    function sanitizeStageResult(result) {
        if (!result || typeof result !== "object") {
            return null;
        }

        if (result.missionId && !getMission(result.missionId)) {
            return null;
        }

        return {
            missionId: result.missionId || null,
            stageId: result.stageId || null,
            eyebrow: result.eyebrow || "Mission update",
            title: result.title || "Mission update",
            summary: result.summary || "",
            details: Array.isArray(result.details) ? result.details.filter(function (detail) {
                return detail && typeof detail.label === "string" && typeof detail.value === "string";
            }).map(function (detail) {
                return {
                    label: detail.label,
                    value: detail.value
                };
            }) : [],
            scoreDelta: typeof result.scoreDelta === "number" ? result.scoreDelta : 0,
            passed: Boolean(result.passed),
            nutrition: Array.isArray(result.nutrition) ? result.nutrition : [],
            isLastStage: Boolean(result.isLastStage),
            takeaways: Array.isArray(result.takeaways) ? result.takeaways : [],
            rewardHighlights: Array.isArray(result.rewardHighlights) ? result.rewardHighlights : []
        };
    }

    function getPersistedScreen() {
        if (state.screen === "stage") {
            return state.checkpoint ? "stage" : "dashboard";
        }

        if (state.screen === "results" && state.resultKind === "final") {
            return "final";
        }

        if (state.screen === "results" && state.currentStageResult) {
            return "results";
        }

        if (state.screen === "map") {
            return "map";
        }

        return "dashboard";
    }

    function buildCheckpoint(missionId, stageIndex) {
        return {
            missionId: missionId,
            stageIndex: stageIndex,
            stageMode: "intro",
            currentMissionScore: state.currentMissionScore,
            stageScores: state.currentMissionStageScores.slice()
        };
    }

    function hydrateCheckpoint(checkpoint) {
        const sanitizedCheckpoint = sanitizeCheckpoint(checkpoint);

        if (!sanitizedCheckpoint) {
            state.checkpoint = null;
            return;
        }

        state.missionId = sanitizedCheckpoint.missionId;
        state.stageIndex = sanitizedCheckpoint.stageIndex;
        state.stageMode = "intro";
        state.screen = "stage";
        state.resultKind = null;
        state.currentStageResult = null;
        state.lastSelectedMission = sanitizedCheckpoint.missionId;
        state.currentMissionScore = sanitizedCheckpoint.currentMissionScore;
        state.currentMissionStageScores = sanitizedCheckpoint.stageScores.slice();
        state.checkpoint = buildCheckpoint(sanitizedCheckpoint.missionId, sanitizedCheckpoint.stageIndex);
        resetTransientMeters();
    }

    function serializeProgress() {
        const persistedScreen = getPersistedScreen();

        return {
            version: 3,
            screen: persistedScreen,
            missionId: state.missionId,
            stageIndex: state.stageIndex,
            stageMode: state.stageMode === "play" ? "intro" : state.stageMode,
            badges: state.badges,
            unlockedMissionIds: state.unlockedMissionIds,
            bestScores: state.bestScores,
            currentStageResult: persistedScreen === "results" ? state.currentStageResult : null,
            lastSelectedMission: state.lastSelectedMission,
            hasSeenIntro: state.hasSeenIntro,
            checkpoint: state.checkpoint,
            currentMissionScore: state.currentMissionScore,
            currentMissionStageScores: state.currentMissionStageScores,
            resultKind: persistedScreen === "results" ? state.resultKind : (persistedScreen === "final" ? "final" : null),
            tipDrawerOpen: state.tipDrawerOpen
        };
    }

    function saveProgress() {
        safeSave(storageKeys.progress, serializeProgress());
    }

    function restoreProgress() {
        const persisted = safeLoad(storageKeys.progress, null) || safeLoad(legacyStorageKeys.progress, null);

        if (!persisted) {
            return;
        }

        state.badges = sanitizeBadges(persisted.badges);
        state.unlockedMissionIds = sanitizeUnlockedMissionIds(persisted.unlockedMissionIds);
        state.bestScores = sanitizeBestScores(persisted.bestScores);
        state.lastSelectedMission = getMission(persisted.lastSelectedMission) ? persisted.lastSelectedMission : null;
        state.hasSeenIntro = Boolean(persisted.hasSeenIntro);
        state.tipDrawerOpen = Boolean(persisted.tipDrawerOpen);
        state.currentMissionScore = typeof persisted.currentMissionScore === "number" ? Math.max(0, Math.floor(persisted.currentMissionScore)) : 0;
        state.currentMissionStageScores = Array.isArray(persisted.currentMissionStageScores) ? persisted.currentMissionStageScores.map(function (score) {
            return typeof score === "number" ? Math.max(0, Math.floor(score)) : 0;
        }) : [];
        state.checkpoint = sanitizeCheckpoint(persisted.checkpoint);
        state.currentStageResult = sanitizeStageResult(persisted.currentStageResult);
        state.resultKind = persisted.resultKind === "stage" || persisted.resultKind === "mission" || persisted.resultKind === "final"
            ? persisted.resultKind
            : null;

        if (persisted.screen === "stage" && state.checkpoint) {
            hydrateCheckpoint(state.checkpoint);
            return;
        }

        if (persisted.screen === "results" && state.currentStageResult && (state.resultKind === "stage" || state.resultKind === "mission")) {
            state.screen = "results";
            state.missionId = state.currentStageResult.missionId || state.lastSelectedMission;
            state.stageIndex = typeof persisted.stageIndex === "number" ? persisted.stageIndex : 0;
            state.stageMode = "intro";
            resetTransientMeters();
            return;
        }

        if (persisted.screen === "final" && state.resultKind === "final") {
            state.screen = "results";
            state.currentStageResult = null;
            state.missionId = state.lastSelectedMission || content.missions[content.missions.length - 1].id;
            state.stageIndex = content.missions[content.missions.length - 1].stages.length - 1;
            state.stageMode = "intro";
            state.checkpoint = null;
            resetTransientMeters();
            return;
        }

        state.screen = persisted.screen === "map" ? "map" : "dashboard";
        state.resultKind = null;
        state.currentStageResult = null;
        state.stageMode = "intro";
        state.missionId = null;
        state.stageIndex = 0;
        resetTransientMeters();
    }

    function clearStageRuntime() {
        if (!runtime.stageRuntime) {
            return;
        }

        if (runtime.stageRuntime.spawnTimer) {
            window.clearInterval(runtime.stageRuntime.spawnTimer);
        }

        if (runtime.stageRuntime.overlayTimer) {
            window.clearInterval(runtime.stageRuntime.overlayTimer);
        }

        if (runtime.stageRuntime.targetTimers) {
            runtime.stageRuntime.targetTimers.forEach(function (timerId) {
                window.clearTimeout(timerId);
            });
        }

        if (runtime.stageRuntime.targetNodes) {
            runtime.stageRuntime.targetNodes.forEach(function (node) {
                node.remove();
            });
            runtime.stageRuntime.targetNodes.clear();
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

        state.missionId = missionId;
        state.stageIndex = options.stageIndex || 0;
        state.stageMode = "intro";
        state.resultKind = null;
        state.currentStageResult = null;
        state.lastSelectedMission = missionId;
        state.hasSeenIntro = true;
        state.currentMissionScore = typeof options.currentMissionScore === "number" ? options.currentMissionScore : 0;
        state.currentMissionStageScores = Array.isArray(options.stageScores) ? options.stageScores.slice() : [];
        state.screen = "stage";
        resetTransientMeters();

        state.checkpoint = buildCheckpoint(missionId, state.stageIndex);
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
        }, 2800);
    }

    function renderTipCard(tip, emptyLabel) {
        if (!tip) {
            return [
                "<div class=\"tip-loading\" aria-label=\"Loading health fact\">",
                "<div class=\"tip-loading-bar short\"></div>",
                "<div class=\"tip-loading-bar\"></div>",
                "<div class=\"tip-loading-bar short\"></div>",
                "</div>"
            ].join("");
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
            const storedTipCache = safeLoad(storageKeys.tips, {});

            this.healthTipCache = {
                remote: Array.isArray(storedTipCache.remote) ? storedTipCache.remote : [],
                remoteUnavailableUntil: typeof storedTipCache.remoteUnavailableUntil === "number" ? storedTipCache.remoteUnavailableUntil : 0,
                remoteLastError: storedTipCache.remoteLastError || null
            };
            this.nutritionCache = safeLoad(storageKeys.nutrition, {});
            this.remoteTipRequest = null;
        }

        markRemoteTipsUnavailable(errorMessage) {
            this.healthTipCache.remoteUnavailableUntil = Date.now() + (6 * 60 * 60 * 1000);
            this.healthTipCache.remoteLastError = errorMessage || "Unavailable";
            safeSave(storageKeys.tips, this.healthTipCache);
        }

        async loadRemoteTips() {
            if (Array.isArray(this.healthTipCache.remote) && this.healthTipCache.remote.length > 0) {
                return this.healthTipCache.remote;
            }

            if (Date.now() < this.healthTipCache.remoteUnavailableUntil) {
                return [];
            }

            if (!window.navigator.onLine) {
                return [];
            }

            if (this.remoteTipRequest) {
                return this.remoteTipRequest;
            }

            this.remoteTipRequest = (async () => {
                try {
                    const response = await window.fetch("https://health.gov/myhealthfinder/api/v3/topicsearch.json?lang=en");

                    if (!response.ok) {
                        throw new Error("MyHealthfinder request failed with status " + response.status);
                    }

                    const data = await response.json();
                    const resources = data && data.Result && data.Result.Resources && data.Result.Resources.Resource;

                    if (!Array.isArray(resources) || resources.length === 0) {
                        throw new Error("MyHealthfinder returned no usable resources");
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
                    this.healthTipCache.remoteUnavailableUntil = 0;
                    this.healthTipCache.remoteLastError = null;
                    safeSave(storageKeys.tips, this.healthTipCache);
                    return remoteTips;
                } catch (error) {
                    this.markRemoteTipsUnavailable(error && error.message ? error.message : "MyHealthfinder unavailable");
                    return [];
                } finally {
                    this.remoteTipRequest = null;
                }
            })();

            return this.remoteTipRequest;
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
                    "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(cacheKey) + "&search_simple=1&json=1&page_size=1"
                );

                if (!response.ok) {
                    throw new Error("Open Food Facts request failed with status " + response.status);
                }

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
        runtime.dom.loadingCopy = document.getElementById("loading-copy");
        runtime.dom.loadingStage = document.getElementById("loading-stage");
        runtime.dom.loadingProgressBar = document.getElementById("loading-progress-bar");
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

    function setLoadingState(copy, detail, progress) {
        if (runtime.dom.loadingCopy && typeof copy === "string") {
            runtime.dom.loadingCopy.textContent = copy;
        }

        if (runtime.dom.loadingStage && typeof detail === "string") {
            runtime.dom.loadingStage.textContent = detail;
        }

        if (runtime.dom.loadingProgressBar && typeof progress === "number") {
            runtime.dom.loadingProgressBar.style.width = clamp(progress, 0, 100) + "%";
        }
    }

    function hideLoadingScreen() {
        const elapsed = Date.now() - runtime.loadingStartedAt;
        const delay = Math.max(0, 950 - elapsed);

        window.setTimeout(function () {
            runtime.loadingDone = true;
            setLoadingState("Ready to play.", "Mission control is live.", 100);
            runtime.dom.loadingScreen.classList.add("hidden");
        }, delay);
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

        // Close help modal on Escape key
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && runtime.dom.helpModal.classList.contains("modal-open")) {
                closeHelp();
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
            // Always start fresh from mission 1 — Resume Mission button handles checkpoint resuming
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
        case "download-progress-png":
            downloadProgressPng().catch(function () {
                showToast("Could not create the progress PNG.");
            });
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

    function buildChecklist(items, className) {
        if (!items || items.length === 0) {
            return "";
        }

        return "<ul class=\"" + escapeHtml(className) + "\">" + items.map(function (item) {
            return "<li>" + escapeHtml(item) + "</li>";
        }).join("") + "</ul>";
    }

    function buildRewardHighlights(highlights) {
        if (!highlights || highlights.length === 0) {
            return "";
        }

        return "<div class=\"reward-strip\">" + highlights.map(function (highlight) {
            return [
                "<div class=\"reward-card " + escapeHtml(highlight.tone || "default") + "\">",
                "<p class=\"summary-label\">" + escapeHtml(highlight.label) + "</p>",
                "<p class=\"summary-value\">" + escapeHtml(highlight.value) + "</p>",
                "</div>"
            ].join("");
        }).join("") + "</div>";
    }

    function buildTakeawayPanel(title, items) {
        if (!items || items.length === 0) {
            return "";
        }

        return [
            "<div class=\"lesson-panel\">",
            "<p class=\"section-kicker\">" + escapeHtml(title) + "</p>",
            buildChecklist(items, "lesson-list"),
            "</div>"
        ].join("");
    }

    function formatDurationClock(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return String(minutes) + ":" + String(seconds).padStart(2, "0");
    }

    function getActionDurationMs(stageOrRuntime) {
        if (!stageOrRuntime) {
            return 30000;
        }

        if (stageOrRuntime.config && typeof stageOrRuntime.config.durationMs === "number") {
            return stageOrRuntime.config.durationMs;
        }

        if (typeof stageOrRuntime.durationMs === "number") {
            return stageOrRuntime.durationMs;
        }

        return 30000;
    }

    function getStageHowToPlay(stage) {
        if (!stage) {
            return [];
        }

        switch (stage.type) {
        case "action-targets":
            return [
                "Wait for the countdown, then start tapping only the correct targets when GO appears.",
                "Beat the target threshold before the stage timer ends.",
                "After the warm-up window, misses cost safety hearts, so ignore the decoys."
            ];
        case "sequence":
            return [
                "Read each step, then place the full routine in the strongest order from first to last.",
                "Use the selected list to review your order before you submit it.",
                "You only need most positions correct to pass, so focus on the key start and finish steps."
            ];
        case "quiz":
            return [
                "Read the question fully before choosing an answer.",
                "Use the explanation card after each answer to learn from the feedback.",
                "Reach the pass mark shown in the mission brief to clear the stage."
            ];
        case "plate":
            return [
                "Pick exactly the number of foods shown in the mission brief.",
                "Cover each required food group instead of stacking similar foods.",
                "Review the requirement chips before submitting your plate."
            ];
        case "sort":
            return [
                "Sort every item before pressing the submit button.",
                "Think about which foods help most days and which belong in the occasional lane.",
                "You do not need perfection, but you do need a strong majority of correct answers."
            ];
        case "scenario":
            return [
                "Pause on each situation and choose the safest action, not just the fastest one.",
                "Use the explanation after each answer to adjust for the next scenario.",
                "Aim to beat the pass mark shown in the mission brief."
            ];
        default:
            return ["Read the mission brief, follow the goal, and use the coach note before you begin."];
        }
    }

    function getStageRewardPreview(stage) {
        const parts = [
            "Pass to earn 100 points.",
            "Perfect play adds 25 bonus points."
        ];

        if (stage.type === "action-targets") {
            parts.push(
                "Action stages now show a live timer, and accurate play protects your heart bonus" +
                (stage.config.consumable === "soap" ? " and soap bonus." : ".")
            );
        }

        return parts.join(" ");
    }

    function getStageTakeaways(stage, mission, passed) {
        if (passed) {
            return stage.coachCopy ? [stage.coachCopy].concat(mission.reportTakeaways.slice(0, 1)) : mission.reportTakeaways.slice(0, 2);
        }

        return [
            stage.coachCopy || "Read the mission tip, then try the stage again.",
            getStageHowToPlay(stage)[0] || "Retrying helps the lesson stick."
        ];
    }

    function getNextMissionForExport() {
        return content.missions.find(function (mission) {
            return state.unlockedMissionIds.indexOf(mission.id) > -1 && !getBadgeEarned(mission);
        }) || content.missions[content.missions.length - 1];
    }

    function getMissionCompletedStageCount(mission) {
        if (getBadgeEarned(mission)) {
            return mission.stages.length;
        }

        let completedStages = 0;

        if (state.checkpoint && state.checkpoint.missionId === mission.id) {
            completedStages = Math.max(completedStages, state.checkpoint.stageScores.filter(function (score) {
                return score > 0;
            }).length);
        }

        if (state.missionId === mission.id) {
            completedStages = Math.max(completedStages, state.currentMissionStageScores.filter(function (score) {
                return score > 0;
            }).length);

            if (state.currentStageResult && state.currentStageResult.missionId === mission.id && state.resultKind === "stage" && state.currentStageResult.passed) {
                completedStages = Math.max(completedStages, state.stageIndex + 1);
            }
        }

        return clamp(completedStages, 0, mission.stages.length);
    }

    function getMissionExportStatus(mission) {
        if (getBadgeEarned(mission)) {
            return {
                label: "Completed",
                textColor: "#1A5C30",
                background: "rgba(105, 179, 76, 0.18)",
                border: "rgba(43, 147, 72, 0.3)"
            };
        }

        if ((state.checkpoint && state.checkpoint.missionId === mission.id) || (state.missionId === mission.id && !isMissionLocked(mission.id))) {
            return {
                label: "In Progress",
                textColor: "#8C4B00",
                background: "rgba(244, 185, 66, 0.2)",
                border: "rgba(249, 115, 22, 0.28)"
            };
        }

        if (!isMissionLocked(mission.id)) {
            return {
                label: "Ready",
                textColor: exportTheme.teal,
                background: "rgba(34, 199, 240, 0.12)",
                border: "rgba(14, 116, 144, 0.18)"
            };
        }

        return {
            label: "Locked",
            textColor: "rgba(13, 42, 56, 0.55)",
            background: "rgba(13, 42, 56, 0.08)",
            border: "rgba(13, 42, 56, 0.12)"
        };
    }

    function getCheckpointSummary() {
        if (!state.checkpoint) {
            return "No active checkpoint saved yet.";
        }

        const mission = getMission(state.checkpoint.missionId);

        if (!mission) {
            return "No active checkpoint saved yet.";
        }

        return "Resume " + mission.title + " at Stage " + (state.checkpoint.stageIndex + 1) + " of " + mission.stages.length + ".";
    }

    function getLatestProgressSummary() {
        if (state.resultKind === "final") {
            return {
                eyebrow: "Campaign complete",
                title: "Healthy Habits Adventure complete",
                summary: "All four missions are cleared and the full campaign report is ready to share.",
                details: [
                    "Total score: " + getCommittedScore(),
                    "Badges earned: " + state.badges.length + " of " + content.missions.length,
                    "Game site: " + brand.gameWebsiteLabel
                ]
            };
        }

        if (state.currentStageResult && (state.resultKind === "stage" || state.resultKind === "mission")) {
            return {
                eyebrow: state.resultKind === "mission" ? "Latest mission report" : "Latest stage report",
                title: state.currentStageResult.title,
                summary: state.currentStageResult.summary,
                details: [
                    "Status: " + (state.currentStageResult.passed ? "Passed" : "Needs retry"),
                    "Score impact: " + (state.currentStageResult.passed ? "+" + state.currentStageResult.scoreDelta : "0") + " points"
                ].concat((state.currentStageResult.details || []).slice(0, 2).map(function (detail) {
                    return detail.label + ": " + detail.value;
                }))
            };
        }

        if (state.checkpoint) {
            return {
                eyebrow: "Current checkpoint",
                title: "Mission progress is saved locally",
                summary: getCheckpointSummary(),
                details: [
                    "Resume anytime from this device.",
                    "Unlocked missions and best scores stay saved.",
                    "Download this PNG to share progress outside the app."
                ]
            };
        }

        const nextMission = getNextMissionForExport();

        return {
            eyebrow: "Ready to start",
            title: nextMission.title,
            summary: nextMission.tagline,
            details: [
                "Next focus: " + nextMission.learningObjectives[0],
                "Campaign progress: " + state.badges.length + " of " + content.missions.length + " missions completed",
                "Game site: " + brand.gameWebsiteLabel
            ]
        };
    }

    function formatExportTimestamp(date) {
        try {
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: "long",
                timeStyle: "short"
            }).format(date);
        } catch (error) {
            return date.toLocaleString();
        }
    }

    function getExportFileName() {
        return "health-hero-progress-" + new Date().toISOString().replace(/[:.]/g, "-") + ".png";
    }

    function getMissionAccentColors(accent) {
        if (accent === "leaf") {
            return {
                start: "#69B34C",
                end: "#A0D468",
                soft: "rgba(105, 179, 76, 0.14)"
            };
        }

        if (accent === "teal") {
            return {
                start: "#0E7490",
                end: "#22C7F0",
                soft: "rgba(34, 199, 240, 0.14)"
            };
        }

        return {
            start: "#F4B942",
            end: "#F97316",
            soft: "rgba(244, 185, 66, 0.16)"
        };
    }

    function waitForFontsReady() {
        if (!document.fonts || !document.fonts.ready) {
            return Promise.resolve();
        }

        return document.fonts.ready.then(function () {
            return;
        }, function () {
            return;
        });
    }

    function drawRoundedRectPath(ctx, x, y, width, height, radius) {
        const safeRadius = Math.min(radius, width / 2, height / 2);

        ctx.beginPath();
        ctx.moveTo(x + safeRadius, y);
        ctx.lineTo(x + width - safeRadius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
        ctx.lineTo(x + width, y + height - safeRadius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
        ctx.lineTo(x + safeRadius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
        ctx.lineTo(x, y + safeRadius);
        ctx.quadraticCurveTo(x, y, x + safeRadius, y);
        ctx.closePath();
    }

    function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
        ctx.save();
        ctx.fillStyle = fillStyle;
        drawRoundedRectPath(ctx, x, y, width, height, radius);
        ctx.fill();
        ctx.restore();
    }

    function strokeRoundedRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth) {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth || 1;
        drawRoundedRectPath(ctx, x, y, width, height, radius);
        ctx.stroke();
        ctx.restore();
    }

    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        const lines = [];
        let currentLine = "";

        if (words.length === 0) {
            return y;
        }

        words.forEach(function (word) {
            const tentative = currentLine ? currentLine + " " + word : word;

            if (currentLine && ctx.measureText(tentative).width > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = tentative;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        if (maxLines && lines.length > maxLines) {
            const visibleLines = lines.slice(0, maxLines);
            let lastLine = visibleLines[visibleLines.length - 1];

            while (lastLine.length > 0 && ctx.measureText(lastLine + "...").width > maxWidth) {
                lastLine = lastLine.slice(0, -1);
            }

            visibleLines[visibleLines.length - 1] = lastLine + "...";
            visibleLines.forEach(function (line, index) {
                ctx.fillText(line, x, y + index * lineHeight);
            });

            return y + visibleLines.length * lineHeight;
        }

        lines.forEach(function (line, index) {
            ctx.fillText(line, x, y + index * lineHeight);
        });

        return y + lines.length * lineHeight;
    }

    function drawDetailBlock(ctx, label, value, x, y, width) {
        ctx.save();
        ctx.fillStyle = "rgba(13, 42, 56, 0.56)";
        ctx.font = '700 18px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.fillText(label.toUpperCase(), x, y);
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '700 28px "Baloo 2", "Trebuchet MS", sans-serif';
        const endY = drawWrappedText(ctx, value, x, y + 34, width, 30, 3);
        ctx.restore();

        return endY;
    }

    function drawStatCard(ctx, x, y, width, height, label, value, accentColor) {
        fillRoundedRect(ctx, x, y, width, height, 26, "rgba(255, 255, 255, 0.95)");
        strokeRoundedRect(ctx, x, y, width, height, 26, "rgba(255, 255, 255, 0.34)", 1);
        fillRoundedRect(ctx, x + 20, y + 20, width - 40, 8, 6, accentColor);

        ctx.save();
        ctx.fillStyle = "rgba(13, 42, 56, 0.56)";
        ctx.font = '700 18px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.fillText(label.toUpperCase(), x + 24, y + 58);
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '800 34px "Baloo 2", "Trebuchet MS", sans-serif';
        drawWrappedText(ctx, value, x + 24, y + 96, width - 48, 34, 2);
        ctx.restore();
    }

    function drawMissionExportCard(ctx, mission, x, y, width, height) {
        const accent = getMissionAccentColors(mission.accent);
        const status = getMissionExportStatus(mission);
        const completedStages = getMissionCompletedStageCount(mission);
        const bestScore = state.bestScores[mission.id] || 0;
        const badgeLine = getBadgeEarned(mission) ? "Badge earned: " + mission.badge.label : "Badge pending: " + mission.badge.label;

        fillRoundedRect(ctx, x, y, width, height, 28, "rgba(255, 255, 255, 0.95)");
        strokeRoundedRect(ctx, x, y, width, height, 28, accent.soft, 2);

        const accentBar = ctx.createLinearGradient(x, y, x + width, y);
        accentBar.addColorStop(0, accent.start);
        accentBar.addColorStop(1, accent.end);
        fillRoundedRect(ctx, x + 22, y + 20, width - 44, 10, 6, accentBar);

        fillRoundedRect(ctx, x + width - 186, y + 34, 150, 40, 20, status.background);
        strokeRoundedRect(ctx, x + width - 186, y + 34, 150, 40, 20, status.border, 1);

        ctx.save();
        ctx.fillStyle = status.textColor;
        ctx.font = '700 18px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText(status.label, x + width - 111, y + 60);
        ctx.textAlign = "left";

        ctx.fillStyle = exportTheme.navy;
        ctx.font = '800 34px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText(mission.title, x + 24, y + 70);

        ctx.fillStyle = exportTheme.inkSoft;
        ctx.font = '400 20px "Atkinson Hyperlegible", "Verdana", sans-serif';
        drawWrappedText(ctx, mission.tagline, x + 24, y + 108, width - 48, 26, 2);

        ctx.fillStyle = "rgba(13, 42, 56, 0.56)";
        ctx.font = '700 18px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.fillText("STAGE PROGRESS", x + 24, y + 164);
        ctx.fillText("BEST SCORE", x + 24, y + 214);
        ctx.fillText("BADGE", x + 24, y + 264);

        ctx.fillStyle = exportTheme.navy;
        ctx.font = '700 26px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText(completedStages + "/" + mission.stages.length + " stages cleared", x + 24, y + 192);
        ctx.fillText(String(bestScore) + " points", x + 24, y + 242);
        drawWrappedText(ctx, badgeLine, x + 24, y + 292, width - 48, 24, 2);
        ctx.restore();
    }

    function appendBits(value, bitCount, output) {
        for (let shift = bitCount - 1; shift >= 0; shift -= 1) {
            output.push((value >>> shift) & 1);
        }
    }

    function getQrMathTables() {
        if (getQrMathTables.cache) {
            return getQrMathTables.cache;
        }

        const exp = new Array(512);
        const log = new Array(256);
        let value = 1;

        for (let index = 0; index < 255; index += 1) {
            exp[index] = value;
            log[value] = index;
            value <<= 1;

            if (value & 0x100) {
                value ^= 0x11D;
            }
        }

        for (let index = 255; index < exp.length; index += 1) {
            exp[index] = exp[index - 255];
        }

        getQrMathTables.cache = {
            exp: exp,
            log: log
        };

        return getQrMathTables.cache;
    }

    function qrMultiply(left, right) {
        if (left === 0 || right === 0) {
            return 0;
        }

        const tables = getQrMathTables();

        return tables.exp[tables.log[left] + tables.log[right]];
    }

    function buildQrGeneratorPolynomial(degree) {
        const tables = getQrMathTables();
        let polynomial = [1];

        for (let index = 0; index < degree; index += 1) {
            const next = new Array(polynomial.length + 1).fill(0);

            for (let coefficient = 0; coefficient < polynomial.length; coefficient += 1) {
                next[coefficient] ^= polynomial[coefficient];
                next[coefficient + 1] ^= qrMultiply(polynomial[coefficient], tables.exp[index]);
            }

            polynomial = next;
        }

        return polynomial;
    }

    function computeQrErrorCorrection(dataCodewords, eccCodewordCount) {
        const generator = buildQrGeneratorPolynomial(eccCodewordCount);
        const remainder = new Array(eccCodewordCount).fill(0);

        dataCodewords.forEach(function (dataByte) {
            const factor = dataByte ^ remainder[0];

            remainder.shift();
            remainder.push(0);

            for (let index = 0; index < eccCodewordCount; index += 1) {
                remainder[index] ^= qrMultiply(generator[index + 1], factor);
            }
        });

        return remainder;
    }

    function createQrMatrix(text) {
        const payload = Array.prototype.slice.call(new TextEncoder().encode(text));
        const version = 2;
        const size = 25;
        const dataCodewordCount = 34;
        const eccCodewordCount = 10;
        const capacityBits = dataCodewordCount * 8;
        const bitStream = [];

        appendBits(0x4, 4, bitStream);
        appendBits(payload.length, 8, bitStream);
        payload.forEach(function (byte) {
            appendBits(byte, 8, bitStream);
        });

        if (bitStream.length > capacityBits) {
            throw new Error("QR payload is too large for the export card.");
        }

        appendBits(0, Math.min(4, capacityBits - bitStream.length), bitStream);

        while (bitStream.length % 8 !== 0) {
            bitStream.push(0);
        }

        const padBytes = [0xEC, 0x11];
        let padIndex = 0;

        while (bitStream.length < capacityBits) {
            appendBits(padBytes[padIndex % padBytes.length], 8, bitStream);
            padIndex += 1;
        }

        const dataCodewords = [];

        for (let index = 0; index < bitStream.length; index += 8) {
            let value = 0;

            for (let bit = 0; bit < 8; bit += 1) {
                value = (value << 1) | bitStream[index + bit];
            }

            dataCodewords.push(value);
        }

        const allCodewords = dataCodewords.concat(computeQrErrorCorrection(dataCodewords, eccCodewordCount));
        const modules = Array.from({ length: size }, function () {
            return Array(size).fill(false);
        });
        const reserved = Array.from({ length: size }, function () {
            return Array(size).fill(false);
        });
        const setModule = function (x, y, isDark) {
            if (x < 0 || y < 0 || x >= size || y >= size) {
                return;
            }

            modules[y][x] = Boolean(isDark);
            reserved[y][x] = true;
        };
        const placeFinder = function (x, y) {
            for (let offsetY = -1; offsetY <= 7; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 7; offsetX += 1) {
                    const targetX = x + offsetX;
                    const targetY = y + offsetY;

                    if (targetX < 0 || targetY < 0 || targetX >= size || targetY >= size) {
                        continue;
                    }

                    const inBody = offsetX >= 0 && offsetX <= 6 && offsetY >= 0 && offsetY <= 6;
                    const isDark = inBody && (
                        offsetX === 0 || offsetX === 6 || offsetY === 0 || offsetY === 6 ||
                        (offsetX >= 2 && offsetX <= 4 && offsetY >= 2 && offsetY <= 4)
                    );

                    setModule(targetX, targetY, isDark);
                }
            }
        };
        const placeAlignment = function (centerX, centerY) {
            for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
                for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
                    const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY));
                    setModule(centerX + offsetX, centerY + offsetY, distance !== 1);
                }
            }
        };
        const drawFormatBits = function (maskPattern) {
            let data = (1 << 3) | maskPattern;
            let remainder = data;

            for (let index = 0; index < 10; index += 1) {
                remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
            }

            const bits = ((data << 10) | remainder) ^ 0x5412;
            const getBit = function (index) {
                return ((bits >>> index) & 1) === 1;
            };

            for (let index = 0; index <= 5; index += 1) {
                setModule(8, index, getBit(index));
            }

            setModule(8, 7, getBit(6));
            setModule(8, 8, getBit(7));
            setModule(7, 8, getBit(8));

            for (let index = 9; index < 15; index += 1) {
                setModule(14 - index, 8, getBit(index));
            }

            for (let index = 0; index < 8; index += 1) {
                setModule(size - 1 - index, 8, getBit(index));
            }

            for (let index = 8; index < 15; index += 1) {
                setModule(8, size - 15 + index, getBit(index));
            }
        };

        placeFinder(0, 0);
        placeFinder(size - 7, 0);
        placeFinder(0, size - 7);
        placeAlignment(18, 18);

        for (let index = 8; index < size - 8; index += 1) {
            if (!reserved[6][index]) {
                setModule(index, 6, index % 2 === 0);
            }

            if (!reserved[index][6]) {
                setModule(6, index, index % 2 === 0);
            }
        }

        for (let index = 0; index < 9; index += 1) {
            if (index !== 6) {
                reserved[8][index] = true;
                reserved[index][8] = true;
            }
        }

        for (let index = 0; index < 8; index += 1) {
            reserved[8][size - 1 - index] = true;
        }

        for (let index = 0; index < 7; index += 1) {
            reserved[size - 1 - index][8] = true;
        }

        setModule(8, size - 8, true);

        const dataBits = [];

        allCodewords.forEach(function (codeword) {
            appendBits(codeword, 8, dataBits);
        });

        let bitIndex = 0;
        let movingUp = true;

        for (let right = size - 1; right >= 1; right -= 2) {
            const column = right === 6 ? 5 : right;

            for (let offset = 0; offset < size; offset += 1) {
                const row = movingUp ? size - 1 - offset : offset;

                for (let pair = 0; pair < 2; pair += 1) {
                    const currentColumn = column - pair;

                    if (reserved[row][currentColumn]) {
                        continue;
                    }

                    let bit = bitIndex < dataBits.length ? dataBits[bitIndex] : 0;

                    bitIndex += 1;

                    if ((row + currentColumn) % 2 === 0) {
                        bit ^= 1;
                    }

                    modules[row][currentColumn] = bit === 1;
                }
            }

            movingUp = !movingUp;
        }

        drawFormatBits(0);

        return modules;
    }

    function drawQrCode(ctx, text, x, y, size) {
        const matrix = createQrMatrix(text);
        const quietZone = 4;
        const moduleSize = Math.floor(size / (matrix.length + quietZone * 2));
        const qrSize = moduleSize * (matrix.length + quietZone * 2);
        const offsetX = x + Math.floor((size - qrSize) / 2);
        const offsetY = y + Math.floor((size - qrSize) / 2);

        ctx.save();
        ctx.fillStyle = exportTheme.white;
        ctx.fillRect(offsetX, offsetY, qrSize, qrSize);
        ctx.fillStyle = exportTheme.navy;

        matrix.forEach(function (row, rowIndex) {
            row.forEach(function (isDark, columnIndex) {
                if (!isDark) {
                    return;
                }

                ctx.fillRect(
                    offsetX + (columnIndex + quietZone) * moduleSize,
                    offsetY + (rowIndex + quietZone) * moduleSize,
                    moduleSize,
                    moduleSize
                );
            });
        });

        ctx.restore();
    }

    async function renderProgressExportCanvas() {
        await waitForFontsReady();

        const canvas = document.createElement("canvas");
        const width = 1600;
        const height = 1760;
        const margin = 60;
        const columnGap = 24;
        const missionCardWidth = (width - margin * 2 - columnGap) / 2;
        const missionCardHeight = 320;
        const ctx = canvas.getContext("2d");
        const generatedAt = formatExportTimestamp(new Date());
        const strongestMission = getStrongestMission();
        const nextMission = getNextMissionForExport();
        const latest = getLatestProgressSummary();

        if (!ctx) {
            throw new Error("Canvas export is not available in this browser.");
        }

        canvas.width = width;
        canvas.height = height;

        const background = ctx.createLinearGradient(0, 0, width, height);
        background.addColorStop(0, "#071E2B");
        background.addColorStop(0.55, "#0B4A60");
        background.addColorStop(1, "#0E7490");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.fillStyle = "rgba(244, 185, 66, 0.18)";
        ctx.beginPath();
        ctx.arc(width - 170, 180, 180, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(34, 199, 240, 0.14)";
        ctx.beginPath();
        ctx.arc(160, height - 180, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        fillRoundedRect(ctx, margin, margin, width - margin * 2, 250, 40, "rgba(255, 248, 232, 0.96)");
        strokeRoundedRect(ctx, margin, margin, width - margin * 2, 250, 40, "rgba(255, 255, 255, 0.3)", 1);

        const headerGradient = ctx.createLinearGradient(margin, margin, width - margin, margin + 250);
        headerGradient.addColorStop(0, exportTheme.mango);
        headerGradient.addColorStop(1, exportTheme.orange);
        fillRoundedRect(ctx, margin + 28, margin + 26, 130, 130, 34, headerGradient);

        ctx.save();
        ctx.fillStyle = exportTheme.navy;
        ctx.textAlign = "center";
        ctx.font = '800 52px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText("HH", margin + 93, margin + 106);
        ctx.textAlign = "left";
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '800 58px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText("Health Hero Progress Report", margin + 188, margin + 82);
        ctx.font = '700 30px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText("Healthy Habits Adventure", margin + 188, margin + 126);
        ctx.fillStyle = exportTheme.inkSoft;
        ctx.font = '400 22px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.fillText("Generated " + generatedAt, margin + 188, margin + 170);
        ctx.fillText(brand.companyName, margin + 188, margin + 204);
        ctx.fillText(brand.companyWebsite + "  |  " + brand.gameWebsiteLabel, margin + 188, margin + 234);
        ctx.restore();

        const statY = margin + 280;
        const statWidth = (width - margin * 2 - columnGap * 3) / 4;

        drawStatCard(ctx, margin, statY, statWidth, 150, "Total score", String(getCommittedScore()), exportTheme.orange);
        drawStatCard(ctx, margin + statWidth + columnGap, statY, statWidth, 150, "Badges", state.badges.length + " / " + content.missions.length, exportTheme.leaf);
        drawStatCard(ctx, margin + (statWidth + columnGap) * 2, statY, statWidth, 150, "Unlocked missions", state.unlockedMissionIds.length + " / " + content.missions.length, exportTheme.sky);
        drawStatCard(
            ctx,
            margin + (statWidth + columnGap) * 3,
            statY,
            statWidth,
            150,
            "Strongest mission",
            strongestMission ? strongestMission.title : "No mission score yet",
            exportTheme.teal
        );

        const snapshotY = statY + 180;
        fillRoundedRect(ctx, margin, snapshotY, width - margin * 2, 230, 32, "rgba(255, 255, 255, 0.94)");
        strokeRoundedRect(ctx, margin, snapshotY, width - margin * 2, 230, 32, "rgba(255, 255, 255, 0.28)", 1);

        ctx.save();
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '800 34px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText("Progress Snapshot", margin + 26, snapshotY + 50);
        drawDetailBlock(ctx, "Checkpoint", getCheckpointSummary(), margin + 26, snapshotY + 92, 470);
        drawDetailBlock(ctx, "Next mission", nextMission.title + " - " + nextMission.tagline, margin + 540, snapshotY + 92, 470);
        drawDetailBlock(
            ctx,
            "Share link",
            "Scan the QR code below or visit " + brand.gameWebsiteLabel,
            margin + 1040,
            snapshotY + 92,
            420
        );
        ctx.restore();

        const missionGridY = snapshotY + 260;

        content.missions.forEach(function (mission, index) {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const cardX = margin + column * (missionCardWidth + columnGap);
            const cardY = missionGridY + row * (missionCardHeight + columnGap);

            drawMissionExportCard(ctx, mission, cardX, cardY, missionCardWidth, missionCardHeight);
        });

        const bottomY = missionGridY + missionCardHeight * 2 + columnGap;
        const latestWidth = 970;
        const qrWidth = width - margin * 2 - latestWidth - columnGap;

        fillRoundedRect(ctx, margin, bottomY, latestWidth, 360, 32, "rgba(255, 255, 255, 0.95)");
        strokeRoundedRect(ctx, margin, bottomY, latestWidth, 360, 32, "rgba(255, 255, 255, 0.28)", 1);

        ctx.save();
        ctx.fillStyle = "rgba(13, 42, 56, 0.56)";
        ctx.font = '700 18px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.fillText(latest.eyebrow.toUpperCase(), margin + 26, bottomY + 42);
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '800 40px "Baloo 2", "Trebuchet MS", sans-serif';
        drawWrappedText(ctx, latest.title, margin + 26, bottomY + 88, latestWidth - 52, 42, 2);
        ctx.fillStyle = exportTheme.inkSoft;
        ctx.font = '400 22px "Atkinson Hyperlegible", "Verdana", sans-serif';
        const summaryBottom = drawWrappedText(ctx, latest.summary, margin + 26, bottomY + 158, latestWidth - 52, 30, 4);
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '700 22px "Atkinson Hyperlegible", "Verdana", sans-serif';
        latest.details.forEach(function (line, index) {
            ctx.fillText("• " + line, margin + 30, summaryBottom + 34 + index * 34);
        });
        ctx.restore();

        const qrX = margin + latestWidth + columnGap;
        fillRoundedRect(ctx, qrX, bottomY, qrWidth, 360, 32, "rgba(255, 248, 232, 0.98)");
        strokeRoundedRect(ctx, qrX, bottomY, qrWidth, 360, 32, "rgba(255, 255, 255, 0.28)", 1);

        ctx.save();
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '800 34px "Baloo 2", "Trebuchet MS", sans-serif';
        ctx.fillText("Scan To Play", qrX + 26, bottomY + 48);
        ctx.fillStyle = exportTheme.inkSoft;
        ctx.font = '400 20px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.fillText("Open the live game site from this report.", qrX + 26, bottomY + 82);
        drawQrCode(ctx, brand.gameWebsite, qrX + 94, bottomY + 108, 250);
        ctx.fillStyle = exportTheme.navy;
        ctx.font = '700 20px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText(brand.gameWebsiteLabel, qrX + qrWidth / 2, bottomY + 334);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "rgba(255, 248, 232, 0.82)";
        ctx.font = '400 20px "Atkinson Hyperlegible", "Verdana", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText(
            brand.companyName + "  •  " + brand.companyWebsite + "  •  " + brand.gameWebsiteLabel,
            width / 2,
            height - 30
        );
        ctx.restore();

        runtime.lastExportCanvas = canvas;
        runtime.lastExportMeta = {
            width: width,
            height: height,
            fileName: getExportFileName(),
            qrUrl: brand.gameWebsite,
            generatedAt: generatedAt
        };
        window.__healthHeroLastExportCanvas = canvas;
        window.__healthHeroLastExportMeta = runtime.lastExportMeta;

        return canvas;
    }

    async function downloadProgressPng(options) {
        const settings = options || {};
        const shouldDownload = settings.download !== false;
        const canvas = await renderProgressExportCanvas();

        if (!shouldDownload) {
            return Object.assign({}, runtime.lastExportMeta);
        }

        const triggerDownload = function (href) {
            const link = document.createElement("a");

            link.href = href;
            link.download = runtime.lastExportMeta.fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
        };

        if (typeof canvas.toBlob === "function") {
            const blob = await new Promise(function (resolve) {
                canvas.toBlob(resolve, "image/png");
            });

            if (blob) {
                const objectUrl = URL.createObjectURL(blob);

                triggerDownload(objectUrl);
                window.setTimeout(function () {
                    URL.revokeObjectURL(objectUrl);
                }, 1500);
                showToast("Progress PNG downloaded.");

                return Object.assign({}, runtime.lastExportMeta);
            }
        }

        triggerDownload(canvas.toDataURL("image/png"));
        showToast("Progress PNG downloaded.");

        return Object.assign({}, runtime.lastExportMeta);
    }

    function renderTopbar() {
        runtime.dom.topbarScore.textContent = String(getDisplayScore());
        // Only show energy/5 during action stages; otherwise show an em dash
        if (state.energy !== null) {
            runtime.dom.topbarEnergy.textContent = String(state.energy) + "/5";
        } else {
            runtime.dom.topbarEnergy.textContent = "\u2014";
        }
        runtime.dom.topbarProgress.textContent = getTopbarProgressText();
        runtime.dom.offlineIndicator.hidden = window.navigator.onLine;
    }

    function renderDashboard() {
        runtime.dom.dashboardCampaign.textContent = content.missions.length + " guided missions";
        runtime.dom.dashboardUnlocked.textContent = String(state.unlockedMissionIds.length);
        runtime.dom.dashboardBadges.textContent = String(state.badges.length);
        runtime.dom.dashboardBestScore.textContent = String(getCommittedScore());

        const nextMission = content.missions.find(function (mission) {
            return state.unlockedMissionIds.indexOf(mission.id) > -1 && !getBadgeEarned(mission);
        }) || content.missions[content.missions.length - 1];

        const checkpointSummary = state.checkpoint
            ? "Resume " + getMission(state.checkpoint.missionId).title + " at stage " + (state.checkpoint.stageIndex + 1) + "."
            : "No active checkpoint. Start " + nextMission.title + " when you are ready.";

        runtime.dom.dashboardProgressSummary.innerHTML = [
            buildSummaryItem("Next mission", nextMission.title + " • " + nextMission.tagline),
            buildSummaryItem("What you will practice", nextMission.learningObjectives.slice(0, 2).join(" ")),
            buildSummaryItem("Checkpoint", checkpointSummary),
            buildSummaryItem("Strongest mission", getStrongestMissionLabel())
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
            : "<div class=\"empty-state\">No badges yet. Finish a mission to unlock your first classroom-ready health badge.</div>";

        updateTipCard(runtime.dom.dashboardTipCard, state.dashboardTip, "Mission Fact");
        runtime.dom.dashboardTipCard.parentElement.classList.toggle("drawer-open", state.tipDrawerOpen);

        // Show or hide the Resume Mission button (and its wrapper) based on checkpoint
        const resumeWrapper = document.getElementById("resume-wrapper");
        if (resumeWrapper) {
            resumeWrapper.classList.toggle("hidden", !state.checkpoint);
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
            const objectivePreview = buildChecklist(mission.learningObjectives.slice(0, 2), "mission-objective-list");

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
                "<div class=\"mission-learning-block\">",
                "<p class=\"summary-label\">Skills in this mission</p>",
                objectivePreview,
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
            "</div>",
            "<div class=\"lesson-panel sidebar-lesson-panel\">",
            "<p class=\"summary-label\">Skills you will practice</p>",
            buildChecklist(mission.learningObjectives, "lesson-list compact"),
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
            "<div class=\"stage-prep-grid\">",
            "<div class=\"summary-item stage-prep-card\"><p class=\"summary-label\">Lesson goal</p><p class=\"summary-value\">" + escapeHtml(stage.intro) + "</p></div>",
            "<div class=\"summary-item stage-prep-card\"><p class=\"summary-label\">Pass condition</p><p class=\"summary-value\">" + escapeHtml(stage.objective) + "</p></div>",
            "<div class=\"summary-item stage-prep-card\"><p class=\"summary-label\">Reward preview</p><p class=\"summary-value\">" + escapeHtml(getStageRewardPreview(stage)) + "</p></div>",
            "</div>",
            stage.coachCopy ? "<div class=\"coach-card\"><p class=\"summary-label\">Coach note</p><p class=\"summary-value\">" + escapeHtml(stage.coachCopy) + "</p></div>" : "",
            buildTakeawayPanel("How to play", getStageHowToPlay(stage)),
            buildTakeawayPanel("What this mission teaches", mission.learningObjectives),
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
        const rewardHighlights = buildRewardHighlights(result.rewardHighlights);
        const takeawayPanel = buildTakeawayPanel(result.passed ? "What you learned" : "How to win next try", result.takeaways);
        const stageHelpPanel = state.resultKind === "stage" ? buildTakeawayPanel("How to play this stage", getStageHowToPlay(getActiveStage())) : "";
        const recoveryPanel = !result.passed && state.resultKind === "stage"
            ? [
                "<div class=\"recovery-grid\">",
                "<div class=\"recovery-card retry\">",
                "<p class=\"summary-label\">Retry stage</p>",
                "<p class=\"summary-value\">Replay this challenge right away with your mission progress still intact.</p>",
                "</div>",
                "<div class=\"recovery-card exit\">",
                "<p class=\"summary-label\">Exit mission</p>",
                "<p class=\"summary-value\">Leave to the mission map now. Your unlocked missions and best scores stay saved.</p>",
                "</div>",
                "</div>"
            ].join("")
            : "";
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
            rewardHighlights,
            recoveryPanel,
            "<div class=\"summary-stack result-detail-grid\">" + details + "</div>",
            takeawayPanel,
            stageHelpPanel,
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
                    "<button type=\"button\" class=\"ghost-button\" data-action=\"back-to-map\">Exit Mission</button>"
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
        const campaignTakeaways = content.missions.map(function (mission) {
            return mission.reportTakeaways[0];
        });
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
            "<p class=\"result-score\">" + getCommittedScore() + " total points</p>",
            "</div>",
            buildRewardHighlights([
                { label: "Campaign badges", value: String(state.badges.length) + " of " + content.missions.length, tone: "badge" },
                { label: "Strongest topic", value: strongestMission ? strongestMission.title : "No clear leader yet", tone: "unlock" }
            ]),
            "<div class=\"summary-stack result-detail-grid\">",
            buildSummaryItem("Strongest topic", strongestMission ? strongestMission.title : "No clear leader yet"),
            buildSummaryItem("Badges earned", String(state.badges.length)),
            buildSummaryItem("Attribution", content.brandText),
            "</div>",
            buildTakeawayPanel("Healthy habits to keep", campaignTakeaways),
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

        if (view === "play" && state.checkpoint) {
            hydrateCheckpoint(state.checkpoint);
            return;
        }

        if (view === "results" && state.currentStageResult && (state.resultKind === "stage" || state.resultKind === "mission")) {
            state.screen = "results";
            return;
        }

        if (view === "final" && state.resultKind === "final") {
            state.screen = "results";
            return;
        }

        if (state.screen === "stage" && state.checkpoint) {
            hydrateCheckpoint(state.checkpoint);
            return;
        }

        if (state.screen === "results" && (state.resultKind === "final" || state.currentStageResult)) {
            return;
        }

        if (view === "map" && state.screen === "map") {
            return;
        }

        if (state.screen !== "map") {
            state.screen = "dashboard";
        }
    }

    function startMissionFromCard(missionId) {
        const checkpoint = getCheckpointForMission(missionId);

        if (checkpoint) {
            resetMissionState({
                missionId: checkpoint.missionId,
                stageIndex: checkpoint.stageIndex,
                currentMissionScore: checkpoint.currentMissionScore,
                stageScores: checkpoint.stageScores
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
        state.checkpoint = buildCheckpoint(state.missionId, state.stageIndex);
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

    function getActionTimeRemainingMs(stageRuntime) {
        if (!stageRuntime) {
            return 0;
        }

        if (!stageRuntime.live || !stageRuntime.playEndsAt) {
            return getActionDurationMs(stageRuntime);
        }

        return Math.max(0, stageRuntime.playEndsAt - Date.now());
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
            "<div class=\"status-chip timer-chip\"><span>Time</span><strong id=\"action-time\">" + formatDurationClock(getActionTimeRemainingMs(stageRuntime)) + "</strong></div>",
            "<div class=\"status-chip\"><span>Hearts</span><strong id=\"action-hearts\">" + (state.energy || 0) + "/" + config.startingEnergy + "</strong></div>",
            "<div class=\"status-chip\"><span>Soap</span><strong id=\"action-soap\">" + (config.consumable === "soap" ? state.soap : "Not used") + "</strong></div>",
            "</div>",
            "<div class=\"playfield-frame\">",
            "<div id=\"playfield\" class=\"playfield\"></div>",
            "<div id=\"playfield-overlay\" class=\"playfield-overlay\"></div>",
            "</div>",
            "<p class=\"screen-copy action-copy\">Watch the countdown, clear " + config.goal + " targets before " + formatDurationClock(getActionDurationMs(stageRuntime)) + " runs out, and use the warm-up window to settle in before hearts are at risk.</p>",
            "</div>"
        ].join("");

        stageRuntime.playfield = document.getElementById("playfield");
        stageRuntime.overlay = document.getElementById("playfield-overlay");
        stageRuntime.targetNodes = new Map();
        updateActionOverlay();
        repaintActionTargets();
    }

    function updateActionOverlay() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || !stageRuntime.overlay) {
            return;
        }

        if (!stageRuntime.live) {
            const seconds = Math.max(1, Math.ceil((stageRuntime.countdownEndsAt - Date.now()) / 1000));

            stageRuntime.overlay.hidden = false;
            stageRuntime.overlay.className = "playfield-overlay countdown";
            stageRuntime.overlay.innerHTML = [
                "<div class=\"overlay-badge\">" + seconds + "</div>",
                "<p class=\"overlay-title\">Get ready</p>",
                "<p class=\"overlay-copy\">Targets go live when the countdown reaches GO.</p>"
            ].join("");
            return;
        }

        if (Date.now() < stageRuntime.safeUntil) {
            const secondsLeft = Math.max(1, Math.ceil((stageRuntime.safeUntil - Date.now()) / 1000));

            stageRuntime.overlay.hidden = false;
            stageRuntime.overlay.className = "playfield-overlay warmup";
            stageRuntime.overlay.innerHTML = [
                "<div class=\"overlay-badge\">GO</div>",
                "<p class=\"overlay-title\">Warm-up window</p>",
                "<p class=\"overlay-copy\">You have " + secondsLeft + " more seconds where mistakes do not cost hearts. The stage timer is already running.</p>"
            ].join("");
            return;
        }

        stageRuntime.overlay.hidden = true;
        stageRuntime.overlay.className = "playfield-overlay hidden";
        stageRuntime.overlay.innerHTML = "";
    }

    function isActionPenaltyLive(stageRuntime) {
        return stageRuntime && stageRuntime.live && Date.now() >= stageRuntime.safeUntil;
    }

    function activateActionStage() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || stageRuntime.live) {
            return;
        }

        stageRuntime.live = true;
        stageRuntime.liveStartedAt = Date.now();
        stageRuntime.playEndsAt = stageRuntime.liveStartedAt + getActionDurationMs(stageRuntime);
        stageRuntime.safeUntil = stageRuntime.liveStartedAt + stageRuntime.gracePeriodMs;
        updateActionOverlay();
        updateActionStatusBar();
        stageRuntime.spawnTimer = window.setInterval(function () {
            spawnActionTarget();
        }, stageRuntime.config.spawnIntervalMs);

        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                for (var initial = 0; initial < stageRuntime.config.initialSpawnCount; initial += 1) {
                    spawnActionTarget();
                }
            });
        });
    }

    function startActionStage(stage) {
        clearStageRuntime();
        const config = stage.config;
        const startedAt = Date.now();
        const countdownMs = config.countdownMs || 3000;
        const gracePeriodMs = Math.max((config.safeStartMs || 4800) - countdownMs, 1200);

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
            playfield: null,
            targetNodes: new Map(),
            overlay: null,
            overlayTimer: null,
            startedAt: startedAt,
            countdownEndsAt: startedAt + countdownMs,
            gracePeriodMs: gracePeriodMs,
            safeUntil: startedAt + countdownMs + gracePeriodMs,
            playEndsAt: null,
            live: false,
            lastWarmupToastAt: 0
        };

        renderAll();
        runtime.stageRuntime.overlayTimer = window.setInterval(function () {
            const activeRuntime = runtime.stageRuntime;

            if (!activeRuntime) {
                return;
            }

            if (!activeRuntime.live && Date.now() >= activeRuntime.countdownEndsAt) {
                activateActionStage();
            }

            if (activeRuntime.live && activeRuntime.playEndsAt && Date.now() >= activeRuntime.playEndsAt) {
                finishStage({
                    passed: false,
                    eyebrow: "Time up",
                    title: getActiveStage().title,
                    summary: "The countdown finished before you reached the target threshold.",
                    details: [
                        { label: "Targets cleared", value: String(activeRuntime.hits) },
                        { label: "Target threshold", value: String(activeRuntime.config.goal) },
                        { label: "Hearts left", value: String(state.energy || 0) },
                        { label: "Time", value: formatDurationClock(getActionDurationMs(activeRuntime)) }
                    ],
                    scoreDelta: 0,
                    nutrition: [],
                    takeaways: [
                        getActiveStage().coachCopy || "Start quickly after GO and focus on the correct targets.",
                        "You can retry immediately or exit to the mission map without losing unlocked progress."
                    ],
                    rewardHighlights: [
                        { label: "Try again", value: "Replay the stage now and keep building the habit.", tone: "unlock" },
                        { label: "Need a break?", value: "Exit to the mission map and come back later.", tone: "default" }
                    ]
                });
                return;
            }

            updateActionOverlay();
            updateActionStatusBar();
        }, 250);
    }

    function spawnActionTarget() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || !stageRuntime.playfield || !stageRuntime.live) {
            return;
        }

        if (stageRuntime.targets.size >= stageRuntime.config.maxActiveTargets) {
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
        }, Math.max(stageRuntime.config.lifetimeMs, Math.max(0, stageRuntime.safeUntil - Date.now()) + 800));

        stageRuntime.targetTimers.set(id, timerId);
        repaintActionTargets();
    }

    function createActionTargetNode(target) {
        const node = document.createElement("button");

        node.type = "button";
        node.className = "playfield-target " + (target.bad ? "bad" : "good");
        node.dataset.stageAction = "hit-target";
        node.dataset.targetId = target.id;
        node.style.left = target.left + "px";
        node.style.top = target.top + "px";
        node.setAttribute("aria-label", target.item.label);
        node.innerHTML = [
            "<span class=\"target-emoji\">" + escapeHtml(target.item.emoji) + "</span>",
            "<span class=\"target-label\">" + escapeHtml(target.item.label) + "</span>"
        ].join("");

        return node;
    }

    function repaintActionTargets() {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime || !stageRuntime.playfield) {
            return;
        }

        stageRuntime.targets.forEach(function (target, targetId) {
            if (stageRuntime.targetNodes.has(targetId)) {
                return;
            }

            const node = createActionTargetNode(target);
            stageRuntime.targetNodes.set(targetId, node);
            stageRuntime.playfield.appendChild(node);
        });

        stageRuntime.targetNodes.forEach(function (node, targetId) {
            if (stageRuntime.targets.has(targetId)) {
                return;
            }

            node.remove();
            stageRuntime.targetNodes.delete(targetId);
        });

        updateActionStatusBar();
    }

    function updateActionStatusBar() {
        const goalNode = document.getElementById("action-goal");
        const timeNode = document.getElementById("action-time");
        const heartsNode = document.getElementById("action-hearts");
        const soapNode = document.getElementById("action-soap");

        if (goalNode && runtime.stageRuntime) {
            goalNode.textContent = runtime.stageRuntime.hits + "/" + runtime.stageRuntime.config.goal;
        }

        if (timeNode && runtime.stageRuntime) {
            timeNode.textContent = formatDurationClock(getActionTimeRemainingMs(runtime.stageRuntime));
        }

        if (heartsNode && runtime.stageRuntime) {
            heartsNode.textContent = (state.energy || 0) + "/" + runtime.stageRuntime.config.startingEnergy;
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

        if (stageRuntime.targetNodes.has(targetId)) {
            stageRuntime.targetNodes.get(targetId).remove();
            stageRuntime.targetNodes.delete(targetId);
        }

        repaintActionTargets();
        return target;
    }

    function registerActionMiss(reason) {
        const stageRuntime = runtime.stageRuntime;

        if (!stageRuntime) {
            return;
        }

        if (!isActionPenaltyLive(stageRuntime)) {
            if (Date.now() - stageRuntime.lastWarmupToastAt > 1400) {
                showToast("Warm-up window: no penalty for that one.");
                stageRuntime.lastWarmupToastAt = Date.now();
            }
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
                summary: "You ran out of safety hearts before reaching the target threshold.",
                details: [
                    { label: "Targets cleared", value: String(stageRuntime.hits) },
                    { label: "Target threshold", value: String(stageRuntime.config.goal) },
                    { label: "Misses", value: String(state.misses) },
                    { label: "Soap left", value: String(state.soap) }
                ],
                scoreDelta: 0,
                nutrition: [],
                takeaways: [
                    getActiveStage().coachCopy || "Wait for GO, then tap the helpful target only.",
                    "Use Retry Stage for another attempt, or Exit Mission if you want to step away."
                ],
                rewardHighlights: [
                    { label: "Retry path", value: "Start the same stage again right away.", tone: "unlock" },
                    { label: "Exit path", value: "Return to the mission map without losing progress.", tone: "default" }
                ]
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
                    summary: "Your soap ran out before the target threshold was complete.",
                    details: [
                        { label: "Targets cleared", value: String(stageRuntime.hits) },
                        { label: "Target threshold", value: String(stageRuntime.config.goal) },
                        { label: "Misses", value: String(state.misses) },
                        { label: "Soap left", value: String(state.soap) }
                    ],
                    scoreDelta: 0,
                    nutrition: [],
                    takeaways: [
                        getActiveStage().coachCopy || "Tap only the real target so your supplies last longer.",
                        "Retry the stage for another run, or exit back to the mission map."
                    ],
                    rewardHighlights: [
                        { label: "Retry path", value: "Replay this stage immediately.", tone: "unlock" },
                        { label: "Exit path", value: "Leave the mission and come back later.", tone: "default" }
                    ]
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
                    { label: "Time left", value: formatDurationClock(getActionTimeRemainingMs(stageRuntime)) },
                    { label: "Energy bonus", value: String((state.energy || 0) * 10) },
                    { label: "Soap bonus", value: stageRuntime.config.consumable === "soap" ? String(state.soap * 5) : "0" }
                ],
                scoreDelta: scoreDelta,
                nutrition: [],
                rewardHighlights: [
                    { label: "Stage reward", value: "+" + scoreDelta + " points", tone: "badge" },
                    { label: "Warm-up lesson", value: "You kept your cool and chose the right targets.", tone: "unlock" }
                ]
            });
            return;
        }

        if (stageRuntime.config.consumable === "soap" && state.soap === 0) {
            finishStage({
                passed: false,
                eyebrow: "Stage failed",
                title: getActiveStage().title,
                summary: "Your soap ran out before the remaining targets could be cleared.",
                details: [
                    { label: "Targets cleared", value: String(stageRuntime.hits) },
                    { label: "Target threshold", value: String(stageRuntime.config.goal) },
                    { label: "Misses", value: String(state.misses) },
                    { label: "Soap left", value: "0" }
                ],
                scoreDelta: 0,
                nutrition: [],
                takeaways: [
                    getActiveStage().coachCopy || "Tap only the real target so your supplies last longer.",
                    "Use Retry Stage to jump straight back in, or Exit Mission if you want to leave."
                ],
                rewardHighlights: [
                    { label: "Retry path", value: "Replay the same stage now.", tone: "unlock" },
                    { label: "Exit path", value: "Return to the mission map safely.", tone: "default" }
                ]
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
                return "<button type=\"button\" class=\"sequence-choice picked\" data-stage-action=\"remove-sequence-step\" data-step-id=\"" + escapeHtml(stepId) + "\" title=\"Click to remove this step\">" + (index + 1) + ". " + escapeHtml(stepLookup[stepId].label) + "</button>";
            }).join("")
            : "<div class=\"empty-state\">Pick the first step from the right to build your order.</div>";

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
            isLastStage: state.stageIndex === mission.stages.length - 1,
            takeaways: result.takeaways || getStageTakeaways(stage, mission, passed),
            rewardHighlights: result.rewardHighlights || (passed
                ? [{ label: "Stage reward", value: "+" + result.scoreDelta + " points", tone: "badge" }]
                : [{ label: "Retry plan", value: "Read the coach note, then try the stage again.", tone: "default" }])
        };
        state.resultKind = "stage";
        state.screen = "results";
        resetTransientMeters();

        if (passed && state.stageIndex < mission.stages.length - 1) {
            state.checkpoint = buildCheckpoint(mission.id, state.stageIndex + 1);
        } else if (!passed) {
            state.checkpoint = buildCheckpoint(mission.id, state.stageIndex);
        } else {
            state.checkpoint = null;
        }

        updateUrl("results");
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
        state.checkpoint = buildCheckpoint(state.missionId, state.stageIndex);
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
        const nextMission = content.missions[unlockedIndex] || null;
        const badgeLabel = mission.badge.icon + " " + mission.badge.label;

        state.bestScores[mission.id] = storedBest;

        if (firstClear) {
            state.badges.push(mission.badge.id);
        }

        if (nextMission) {
            state.unlockedMissionIds = Array.from(new Set(state.unlockedMissionIds.concat(nextMission.id)));
        }

        state.currentStageResult = {
            missionId: mission.id,
            eyebrow: "Mission complete",
            title: mission.title,
            summary: storedBest > previousBest
                ? "Mission complete. Your new best score is now saved."
                : "Mission complete. Your best score stays on the board.",
            details: [
                { label: "Mission score", value: String(state.currentMissionScore) },
                { label: "Best mission score", value: String(storedBest) },
                { label: "Badge", value: badgeLabel },
                { label: "Total score", value: String(getCommittedScore()) }
            ],
            scoreDelta: state.currentMissionScore,
            passed: true,
            nutrition: [],
            takeaways: mission.reportTakeaways,
            rewardHighlights: [
                {
                    label: firstClear ? "Badge earned" : "Badge kept",
                    value: badgeLabel,
                    tone: "badge"
                },
                {
                    label: nextMission ? "Mission unlocked" : "Campaign status",
                    value: nextMission ? nextMission.icon + " " + nextMission.title + " is now ready to play." : "All missions are complete. Open the final report next.",
                    tone: "unlock"
                }
            ]
        };
        state.resultKind = "mission";
        state.screen = "results";
        state.lastSelectedMission = mission.id;
        state.checkpoint = null;
        resetTransientMeters();
        updateUrl("results");
        renderAll();
        saveProgress();
        refreshResultsTip(mission.topic);

        // Celebrate badge and unlock
        window.setTimeout(function () {
            if (firstClear) {
                showToast(mission.badge.icon + " Badge earned: " + mission.badge.label + "!");
            }
            if (nextMission) {
                window.setTimeout(function () {
                    showToast("\uD83D\uDD13 Mission unlocked: " + nextMission.title + "!");
                }, 3200);
            }
        }, 400);
    }

    function presentFinalReport() {
        clearStageRuntime();
        state.resultKind = "final";
        state.screen = "results";
        state.currentStageResult = null;
        state.checkpoint = null;
        state.lastSelectedMission = content.missions[content.missions.length - 1].id;
        resetTransientMeters();
        updateUrl("final");
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
            runtime.loadingStartedAt = Date.now();
            cacheDom();
            setLoadingState("Preparing your mission...", "Booting mission control...", 12);
            bindEvents();
            setLoadingState("Restoring your progress...", "Checking badges, scores, and checkpoints...", 32);
            runtime.apiService = new APIService();
            restoreProgress();
            setLoadingState("Loading your missions...", "Laying out the dashboard and mission map...", 58);
            applyRouteFromUrl();
            renderAll();
            setLoadingState("Finalizing your game...", "Health tips will continue loading in the background.", 84);
            refreshDashboardTip(false);

            if (state.screen === "stage" && state.missionId) {
                refreshStageTip();
            } else if (state.screen === "results" && state.missionId && state.resultKind !== "final") {
                refreshResultsTip(getMission(state.missionId).topic);
            }

            hideLoadingScreen();
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
                stageScores: []
            });
            updateUrl("play");
            renderAll();
            saveProgress();
            refreshStageTip();
        },
        resume: function () {
            if (!state.checkpoint) {
                return;
            }

            clearStageRuntime();
            resetMissionState({
                missionId: state.checkpoint.missionId,
                stageIndex: state.checkpoint.stageIndex,
                currentMissionScore: state.checkpoint.currentMissionScore,
                stageScores: state.checkpoint.stageScores
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
            state.checkpoint = buildCheckpoint(state.missionId, state.stageIndex);
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
        exportProgressPng: function (options) {
            return downloadProgressPng(options);
        },
        handleShortcut: function (view) {
            if (view === "play") {
                if (state.checkpoint) {
                    this.resume();
                }
                return;
            }

            if (view === "map") {
                clearStageRuntime();
                state.screen = "map";
                updateUrl("map");
                renderAll();
                saveProgress();
                return;
            }

            if (view === "results" && state.currentStageResult) {
                state.screen = "results";
                updateUrl("results");
                renderAll();
                saveProgress();
                return;
            }

            if (view === "final" && state.resultKind === "final") {
                state.screen = "results";
                updateUrl("final");
                renderAll();
                saveProgress();
                return;
            }

            if (view === "tips") {
                state.screen = "dashboard";
                state.tipDrawerOpen = true;
                updateUrl("start");
                renderAll();
                saveProgress();
                return;
            }

            clearStageRuntime();
            state.screen = "dashboard";
            updateUrl("start");
            renderAll();
            saveProgress();
        }
    };

    window.HealthHeroGame = game;
}());
