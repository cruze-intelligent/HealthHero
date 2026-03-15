"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT_DIR = path.resolve(__dirname, "..");
const GAME_URL = pathToFileURL(path.join(ROOT_DIR, "index.html")).href;
const DEVTOOLS_PORT = Number(process.env.HEALTH_HERO_CDP_PORT || (10000 + Math.floor(Math.random() * 1000)));
const DEVTOOLS_HOSTS = ["127.0.0.1", "[::1]"];
const USER_DATA_DIR = path.join(os.tmpdir(), "healthhero-smoke-profile-" + Date.now());
const HELPER_SOURCE = String.raw`
(() => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const helper = {
        click(selector) {
            const node = document.querySelector(selector);
            if (!node) {
                return false;
            }

            node.click();
            return true;
        },
        state() {
            const game = window.HealthHeroGame;
            const result = game.state.currentStageResult;

            return {
                screen: game.state.screen,
                stageMode: game.state.stageMode,
                missionId: game.state.missionId,
                stageIndex: game.state.stageIndex,
                resultKind: game.state.resultKind,
                currentMissionScore: game.state.currentMissionScore,
                badges: game.state.badges.slice(),
                unlockedMissionIds: game.state.unlockedMissionIds.slice(),
                bestScores: Object.assign({}, game.state.bestScores),
                checkpoint: game.state.checkpoint ? {
                    missionId: game.state.checkpoint.missionId,
                    stageIndex: game.state.checkpoint.stageIndex,
                    currentMissionScore: game.state.checkpoint.currentMissionScore
                } : null,
                currentStageResult: result ? {
                    missionId: result.missionId || null,
                    stageId: result.stageId || null,
                    passed: Boolean(result.passed),
                    title: result.title,
                    scoreDelta: result.scoreDelta
                } : null,
                displayScore: document.getElementById("topbar-score") ? Number(document.getElementById("topbar-score").textContent) : null,
                progressText: document.getElementById("topbar-progress") ? document.getElementById("topbar-progress").textContent : ""
            };
        },
        getMission(missionId) {
            return window.HEALTH_HERO_CONTENT.missions.find((mission) => mission.id === missionId) || null;
        },
        getActiveStage() {
            const game = window.HealthHeroGame;
            const mission = this.getMission(game.state.missionId);

            return mission ? mission.stages[game.state.stageIndex] : null;
        },
        async openMap() {
            if (window.HealthHeroGame.state.screen === "map") {
                return this.state();
            }

            if (this.click("[data-action=\"back-to-map\"]")) {
                await sleep(180);
                return this.state();
            }

            if (this.click("[data-action=\"open-map\"]")) {
                await sleep(180);
                return this.state();
            }

            if (this.click("[data-action=\"go-home\"]")) {
                await sleep(180);
            }

            if (this.click("[data-action=\"open-map\"]")) {
                await sleep(180);
            }

            return this.state();
        },
        async startAdventure() {
            this.click("[data-action=\"start-adventure\"]");
            await sleep(180);
            return this.state();
        },
        async startMission(missionId) {
            await this.openMap();
            this.click("[data-action=\"mission-cta\"][data-mission-id=\"" + missionId + "\"]");
            await sleep(180);
            return this.state();
        },
        async continueFromResults() {
            if (this.click("[data-action=\"next-stage\"]")) {
                await sleep(180);
                return this.state();
            }

            if (this.click("[data-action=\"open-final-report\"]")) {
                await sleep(180);
                return this.state();
            }

            if (this.click("[data-action=\"back-to-map\"]")) {
                await sleep(180);
                return this.state();
            }

            if (this.click("[data-action=\"return-dashboard\"]")) {
                await sleep(180);
            }

            return this.state();
        },
        async retryStage() {
            this.click("[data-action=\"retry-stage\"]");
            await sleep(180);
            return this.state();
        },
        async idle(ms) {
            await sleep(ms);
            return this.state();
        },
        async beginStage() {
            if (window.HealthHeroGame.state.screen === "stage" && window.HealthHeroGame.state.stageMode === "intro") {
                this.click("[data-action=\"begin-stage\"]");
                await sleep(240);
            }

            return this.state();
        },
        async waitForStageToFinish(timeoutMs = 8000) {
            for (let elapsed = 0; elapsed < timeoutMs; elapsed += 100) {
                if (window.HealthHeroGame.state.screen !== "stage") {
                    return this.state();
                }

                await sleep(100);
            }

            return this.state();
        },
        async playAction(perfect) {
            const stage = this.getActiveStage();

            if (!perfect) {
                await sleep((stage.config.safeStartMs || 6000) + 300);

                for (let i = 0; i < 60 && window.HealthHeroGame.state.screen === "stage"; i += 1) {
                    const badTarget = document.querySelector(".playfield-target.bad");

                    if (badTarget) {
                        badTarget.click();
                        break;
                    }

                    await sleep(80);
                }
            }

            for (let i = 0; i < 500 && window.HealthHeroGame.state.screen === "stage"; i += 1) {
                document.querySelectorAll(".playfield-target.good").forEach((node) => node.click());
                await sleep(50);
            }

            return this.state();
        },
        async playSequence(perfect) {
            const stage = this.getActiveStage();
            const challenge = window.HEALTH_HERO_CONTENT.sequenceChallenges[stage.challengeId];
            const plan = challenge.steps.map((step) => step.id);

            if (!perfect && plan.length >= 2) {
                const lastIndex = plan.length - 1;
                const previousIndex = plan.length - 2;
                const swap = plan[lastIndex];
                plan[lastIndex] = plan[previousIndex];
                plan[previousIndex] = swap;
            }

            for (const stepId of plan) {
                this.click("[data-stage-action=\"choose-sequence-step\"][data-step-id=\"" + stepId + "\"]");
                await sleep(30);
            }

            this.click("[data-stage-action=\"submit-sequence\"]");
            return this.waitForStageToFinish();
        },
        async playQuiz(perfect) {
            const stage = this.getActiveStage();

            for (let index = 0; index < stage.questionCount; index += 1) {
                const questionText = document.querySelector(".stage-headline").textContent.trim();
                const question = window.HEALTH_HERO_CONTENT.quizBank[stage.topic].find((item) => item.question === questionText);
                const choiceIndex = !perfect && index === stage.questionCount - 1
                    ? (question.correct + 1) % question.options.length
                    : question.correct;

                this.click("[data-stage-action=\"choose-quiz-answer\"][data-choice-index=\"" + choiceIndex + "\"]");
                await sleep(40);
                this.click("[data-stage-action=\"next-quiz\"]");
                await sleep(120);
            }

            return this.waitForStageToFinish();
        },
        async playPlate() {
            const picks = ["apple", "greens", "fish", "rice"];

            for (const foodId of picks) {
                this.click("[data-stage-action=\"toggle-plate-food\"][data-food-id=\"" + foodId + "\"]");
                await sleep(30);
            }

            this.click("[data-stage-action=\"submit-plate\"]");
            return this.waitForStageToFinish(10000);
        },
        async playSort(perfect) {
            const stage = this.getActiveStage();
            const challenge = window.HEALTH_HERO_CONTENT.sortChallenges[stage.challengeId];

            challenge.items.forEach((item, index) => {
                const choice = !perfect && index >= challenge.items.length - 2
                    ? (item.correct === "everyday" ? "sometimes" : "everyday")
                    : item.correct;

                this.click("[data-stage-action=\"sort-answer\"][data-item-id=\"" + item.id + "\"][data-choice=\"" + choice + "\"]");
            });

            await sleep(80);
            this.click("[data-stage-action=\"submit-sort\"]");
            return this.waitForStageToFinish();
        },
        async playScenario(perfect) {
            const stage = this.getActiveStage();
            const challenge = window.HEALTH_HERO_CONTENT.scenarioChallenges[stage.challengeId];

            for (let index = 0; index < challenge.prompts.length; index += 1) {
                const promptText = document.querySelector(".stage-headline").textContent.trim();
                const prompt = challenge.prompts.find((item) => item.prompt === promptText);
                const choiceIndex = !perfect && index === challenge.prompts.length - 1
                    ? (prompt.correct + 1) % prompt.options.length
                    : prompt.correct;

                this.click("[data-stage-action=\"choose-scenario-answer\"][data-choice-index=\"" + choiceIndex + "\"]");
                await sleep(40);
                this.click("[data-stage-action=\"next-scenario\"]");
                await sleep(120);
            }

            return this.waitForStageToFinish();
        },
        async playCurrentStage(options = {}) {
            const perfect = options.perfect !== false;

            await this.beginStage();

            if (window.HealthHeroGame.state.screen !== "stage") {
                return this.state();
            }

            const stage = this.getActiveStage();

            if (!stage) {
                return this.state();
            }

            if (stage.type === "action-targets") {
                return this.playAction(perfect);
            }

            if (stage.type === "sequence") {
                return this.playSequence(perfect);
            }

            if (stage.type === "quiz") {
                return this.playQuiz(perfect);
            }

            if (stage.type === "plate") {
                return this.playPlate();
            }

            if (stage.type === "sort") {
                return this.playSort(perfect);
            }

            if (stage.type === "scenario") {
                return this.playScenario(perfect);
            }

            return this.state();
        },
        async completeMission(options = {}) {
            const missionId = options.missionId || null;
            const perfect = options.perfect !== false;

            if (missionId) {
                await this.startMission(missionId);
            }

            for (let step = 0; step < 40; step += 1) {
                const snapshot = this.state();

                if (snapshot.screen === "results" && snapshot.resultKind === "mission") {
                    return snapshot;
                }

                if (snapshot.screen === "stage") {
                    await this.playCurrentStage({ perfect: perfect });
                    continue;
                }

                if (snapshot.screen === "results" && snapshot.resultKind === "stage") {
                    if (snapshot.currentStageResult && !snapshot.currentStageResult.passed) {
                        await this.retryStage();
                    } else {
                        await this.continueFromResults();
                    }
                    continue;
                }

                await sleep(120);
            }

            return this.state();
        }
    };

    window.__healthHeroSmoke = helper;
    return true;
})()
`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
    process.stdout.write(message + "\n");
}

function assert(condition, message, context) {
    if (!condition) {
        const error = new Error(message);
        error.context = context;
        throw error;
    }
}

function findChromeBinary() {
    const candidates = [
        process.env.CHROME_BIN,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error("Chrome binary not found. Set CHROME_BIN to a Chrome/Chromium executable.");
}

function requestJson(targetUrl, method) {
    return new Promise((resolve, reject) => {
        const request = http.request(new URL(targetUrl), { method: method || "GET" }, (response) => {
            let body = "";

            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                body += chunk;
            });
            response.on("end", () => {
                if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error("HTTP " + response.statusCode + " for " + targetUrl + ": " + body));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        });

        request.on("error", reject);
        request.end();
    });
}

async function waitForDevTools(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        for (const host of DEVTOOLS_HOSTS) {
            try {
                const payload = await requestJson("http://" + host + ":" + port + "/json/version");

                return {
                    host: host,
                    payload: payload
                };
            } catch (error) {
                continue;
            }
        }

        if (Date.now() < deadline) {
            await sleep(150);
        }
    }

    throw new Error("Timed out waiting for Chrome DevTools.");
}

async function createTarget(host, port, targetUrl) {
    return requestJson("http://" + host + ":" + port + "/json/new?" + encodeURI(targetUrl), "PUT");
}

async function connectToTarget(webSocketUrl) {
    if (typeof WebSocket !== "function") {
        throw new Error("Global WebSocket is not available in this Node runtime.");
    }

    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let id = 0;

    socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);

        if (!payload.id || !pending.has(payload.id)) {
            return;
        }

        const request = pending.get(payload.id);
        pending.delete(payload.id);

        if (payload.error) {
            request.reject(new Error(request.method + ": " + JSON.stringify(payload.error)));
            return;
        }

        request.resolve(payload.result);
    };

    socket.onerror = (error) => {
        for (const request of pending.values()) {
            request.reject(error);
        }
        pending.clear();
    };

    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        setTimeout(() => reject(new Error("Timed out connecting to target websocket.")), 3000);
    });

    return {
        async send(method, params) {
            return new Promise((resolve, reject) => {
                const messageId = ++id;
                pending.set(messageId, {
                    resolve: resolve,
                    reject: reject,
                    method: method
                });
                socket.send(JSON.stringify({
                    id: messageId,
                    method: method,
                    params: params || {}
                }));
            });
        },
        close() {
            socket.close();
        }
    };
}

async function evaluate(session, expression, awaitPromise) {
    const result = await session.send("Runtime.evaluate", {
        expression: expression,
        awaitPromise: awaitPromise !== false,
        returnByValue: true
    });

    return result.result.value;
}

async function waitForGameReady(session, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const ready = await evaluate(session, "Boolean(window.HealthHeroGame && window.HEALTH_HERO_CONTENT)");

        if (ready) {
            return;
        }

        await sleep(100);
    }

    throw new Error("Health Hero did not finish booting.");
}

async function installHelpers(session) {
    await evaluate(session, HELPER_SOURCE);
}

async function reloadAndReinstall(session) {
    await session.send("Page.reload", { ignoreCache: true });
    await waitForGameReady(session, 6000);
    await installHelpers(session);
}

async function helper(session, method, argument) {
    const expression = argument === undefined
        ? "window.__healthHeroSmoke." + method + "()"
        : "window.__healthHeroSmoke." + method + "(" + JSON.stringify(argument) + ")";

    return evaluate(session, expression);
}

async function clearSavedState(session) {
    await evaluate(session, "window.localStorage.clear(); true");
    await reloadAndReinstall(session);
}

async function run() {
    const chromeBinary = findChromeBinary();
    let chromeErrorLog = "";
    const browser = spawn(chromeBinary, [
        "--headless=new",
        "--disable-gpu",
        "--remote-debugging-port=" + DEVTOOLS_PORT,
        "--user-data-dir=" + USER_DATA_DIR,
        "about:blank"
    ], {
        stdio: ["ignore", "ignore", "pipe"]
    });
    let session = null;

    browser.stderr.on("data", (chunk) => {
        chromeErrorLog += chunk.toString("utf8");
        chromeErrorLog = chromeErrorLog.slice(-4000);
    });

    try {
        let devToolsHost = DEVTOOLS_HOSTS[0];

        try {
            const devToolsInfo = await waitForDevTools(DEVTOOLS_PORT, 12000);

            devToolsHost = devToolsInfo.host;
        } catch (error) {
            throw new Error(error.message + (chromeErrorLog ? "\nChrome stderr:\n" + chromeErrorLog : ""));
        }

        const target = await createTarget(devToolsHost, DEVTOOLS_PORT, GAME_URL);

        session = await connectToTarget(target.webSocketDebuggerUrl);
        await session.send("Runtime.enable");
        await session.send("Page.enable");
        await waitForGameReady(session, 6000);
        await installHelpers(session);
        await clearSavedState(session);

        log("Checking action-stage safe-start window...");
        let snapshot = await helper(session, "startAdventure");
        assert(snapshot.screen === "stage" && snapshot.stageMode === "intro", "Start Adventure should open Mission 1 intro.", snapshot);

        await helper(session, "beginStage");
        snapshot = await helper(session, "idle", 5500);
        assert(snapshot.screen === "stage", "Mission 1 should still be active before the 6-second safe-start window ends.", snapshot);

        snapshot = await helper(session, "idle", 3500);
        assert(snapshot.screen === "results" && snapshot.resultKind === "stage" && snapshot.currentStageResult && !snapshot.currentStageResult.passed, "Idling long enough should eventually fail the stage after the safe window.", snapshot);

        log("Checking retry behavior...");
        snapshot = await helper(session, "retryStage");
        assert(snapshot.screen === "stage" && snapshot.stageMode === "intro" && snapshot.stageIndex === 0, "Retry should return to the same stage intro.", snapshot);
        assert(snapshot.currentMissionScore === 0, "Retry should preserve the current mission score state for Mission 1 stage 1.", snapshot);

        log("Checking stage-result persistence...");
        snapshot = await helper(session, "playCurrentStage", { perfect: true });
        assert(snapshot.screen === "results" && snapshot.currentStageResult && snapshot.currentStageResult.stageId === "germ-burst" && snapshot.currentStageResult.passed, "Mission 1 stage 1 should complete successfully.", snapshot);

        snapshot = await helper(session, "continueFromResults");
        assert(snapshot.screen === "stage" && snapshot.stageIndex === 1 && snapshot.stageMode === "intro", "Continuing from stage 1 should open stage 2 intro.", snapshot);

        await reloadAndReinstall(session);
        snapshot = await helper(session, "state");
        assert(snapshot.screen === "stage" && snapshot.stageIndex === 1 && snapshot.stageMode === "intro", "Reloading on stage intro should restore the checkpoint intro.", snapshot);

        snapshot = await helper(session, "playCurrentStage", { perfect: true });
        assert(snapshot.screen === "results" && snapshot.currentStageResult && snapshot.currentStageResult.stageId === "wash-up-order", "Mission 1 stage 2 should reach its results screen.", snapshot);

        await reloadAndReinstall(session);
        snapshot = await helper(session, "state");
        assert(snapshot.screen === "results" && snapshot.resultKind === "stage" && snapshot.currentStageResult && snapshot.currentStageResult.stageId === "wash-up-order", "Reloading on a stage result should keep the stage result screen.", snapshot);

        snapshot = await helper(session, "continueFromResults");
        assert(snapshot.screen === "stage" && snapshot.stageIndex === 2, "Continuing from stage 2 should open stage 3.", snapshot);

        snapshot = await helper(session, "playCurrentStage", { perfect: true });
        assert(snapshot.screen === "results" && snapshot.currentStageResult && snapshot.currentStageResult.stageId === "hygiene-quiz", "Mission 1 stage 3 should finish on its stage result.", snapshot);

        snapshot = await helper(session, "continueFromResults");
        assert(snapshot.screen === "results" && snapshot.resultKind === "mission" && snapshot.currentStageResult && snapshot.currentStageResult.missionId === "hygiene-hq", "Viewing the mission report should show Mission 1 results.", snapshot);

        await reloadAndReinstall(session);
        snapshot = await helper(session, "state");
        assert(snapshot.screen === "results" && snapshot.resultKind === "mission" && snapshot.currentStageResult && snapshot.currentStageResult.missionId === "hygiene-hq", "Reloading on a mission result should keep the mission result screen.", snapshot);
        assert(snapshot.unlockedMissionIds.length === 2, "Mission 1 should unlock Mission 2 exactly once.", snapshot);

        snapshot = await helper(session, "continueFromResults");
        assert(snapshot.screen === "map", "Leaving the Mission 1 report should return to the mission map.", snapshot);

        log("Running campaign completion smoke test...");
        const missionOrder = ["nutrition-lab", "prevention-patrol", "wellness-arena"];
        const expectedUnlockCounts = [3, 4, 4];

        for (let index = 0; index < missionOrder.length; index += 1) {
            snapshot = await helper(session, "completeMission", {
                missionId: missionOrder[index],
                perfect: true
            });

            assert(snapshot.screen === "results" && snapshot.resultKind === "mission" && snapshot.currentStageResult && snapshot.currentStageResult.missionId === missionOrder[index], "Mission should finish on its mission report: " + missionOrder[index], snapshot);
            assert(snapshot.unlockedMissionIds.length === expectedUnlockCounts[index], "Mission unlock count mismatch after " + missionOrder[index], snapshot);

            if (index < missionOrder.length - 1) {
                snapshot = await helper(session, "continueFromResults");
                assert(snapshot.screen === "map", "Mission report should return to map before the next mission.", snapshot);
            }
        }

        const campaignSnapshot = await helper(session, "state");
        const totalFromBestScores = Object.values(campaignSnapshot.bestScores).reduce((total, value) => total + value, 0);

        assert(campaignSnapshot.badges.length === 4, "All four badges should be unlocked by the end of the campaign.", campaignSnapshot);
        assert(campaignSnapshot.unlockedMissionIds.length === 4, "All four missions should be unlocked by the end of the campaign.", campaignSnapshot);
        assert(campaignSnapshot.displayScore === totalFromBestScores, "Topbar score should equal the sum of mission best scores.", campaignSnapshot);

        log("Checking final report persistence...");
        snapshot = await helper(session, "continueFromResults");
        assert(snapshot.screen === "results" && snapshot.resultKind === "final", "Final mission report should open the final report.", snapshot);

        await reloadAndReinstall(session);
        snapshot = await helper(session, "state");
        assert(snapshot.screen === "results" && snapshot.resultKind === "final" && snapshot.missionId !== "hygiene-hq", "Reloading on the final report must not restart Mission 1.", snapshot);

        log("Checking replay score protection...");
        await helper(session, "openMap");
        snapshot = await helper(session, "completeMission", {
            missionId: "hygiene-hq",
            perfect: false
        });

        const replayTotal = Object.values(snapshot.bestScores).reduce((total, value) => total + value, 0);

        assert(snapshot.screen === "results" && snapshot.resultKind === "mission", "Replaying Hygiene HQ should still reach the mission report.", snapshot);
        assert(replayTotal === totalFromBestScores, "Replaying a mission with a lower score must not reduce total progress.", snapshot);

        log("Smoke test passed.");
    } finally {
        if (session) {
            session.close();
        }

        browser.kill("SIGKILL");
        fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
}

run().catch((error) => {
    process.stderr.write((error.stack || String(error)) + "\n");

    if (error.context) {
        process.stderr.write(JSON.stringify(error.context, null, 2) + "\n");
    }

    process.exit(1);
});
