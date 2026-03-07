(function () {
    window.addEventListener("DOMContentLoaded", function () {
        if (window.HealthHeroGame && typeof window.HealthHeroGame.init === "function") {
            window.HealthHeroGame.init();
        }
    });
}());
