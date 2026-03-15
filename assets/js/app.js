(function () {
    function registerServiceWorker() {
        if (!("serviceWorker" in window.navigator)) {
            return;
        }

        window.addEventListener("load", function () {
            window.navigator.serviceWorker.register("./service-worker.js").catch(function () {
                return;
            });
        });
    }

    window.addEventListener("DOMContentLoaded", function () {
        registerServiceWorker();

        if (window.HealthHeroGame && typeof window.HealthHeroGame.init === "function") {
            window.HealthHeroGame.init();
        }
    });
}());
