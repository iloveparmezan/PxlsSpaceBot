// ==UserScript==
// @name         Pxls Bot Loader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  try to take over the world!
// @author       DarkKeks
// @match        https://pxls.space/*
// @downloadURL  https://rawgit.com/DarkKeks/PxlsSpaceBot/master/PxlsBotLoader.user.js
// @updateURL    https://rawgit.com/DarkKeks/PxlsSpaceBot/master/PxlsBotLoader.user.js
// @grant        none
// ==/UserScript==

var inject = function() {
    console.log("Injecting");
    var script = document.createElement('script');
    script.src = 'https://rawgit.com/iloveparmezan/PxlsSpaceBot/master/pxls.js' + '?v=' + Math.random();
    document.body.appendChild(script);
    (document.body || document.head || document.documentElement).appendChild(script);
};

if (document.readyState == 'complete') {
    inject();
} else {
    window.addEventListener("load", function() {
        inject();
    });
}
