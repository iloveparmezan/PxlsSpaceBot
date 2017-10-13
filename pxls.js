"use strict";
window.App = (function () {
    // first we define the global helperfunctions and figure out what kind of settings our browser needs to use
    var storageFactory = function(storageType, prefix, exdays) {
            var getCookie = function(c_name) {
                var i, x, y, ARRcookies = document.cookie.split(";");
                    for (i = 0; i < ARRcookies.length; i++) {
                        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
                        y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
                        x = x.replace(/^\s+|\s+$/g,"");
                        if (x == c_name){
                            return unescape(y);
                        }
                }
            },
            setCookie = function(c_name, value, exdays) {
                var exdate = new Date(),
                    c_value = escape(value);
                exdate.setDate(exdate.getDate() + exdays);
                c_value += ((exdays===null) ? '' : '; expires=' + exdate.toUTCString());
                document.cookie = c_name + '=' + c_value;
            };
            return {
                haveSupport: null,
                support: function () {
                    if (this.haveSupport === null) {
                        try {
                            storageType.setItem('test', 1);
                            this.haveSupport = (storageType.getItem('test') == 1);
                            storageType.removeItem('test');
                        } catch(e) {
                            this.haveSupport = false;
                        }
                    }
                    return this.haveSupport;
                },
                get: function(name) {
                    var s;
                    if (this.support()) {
                        s = storageType.getItem(name)
                    } else {
                        s = getCookie(prefix+name);
                    }
                    if (s === undefined) {
                        s = null;
                    }
                    try {
                        return JSON.parse(s);
                    } catch(e) {
                        return null;
                    }
                },
                set: function(name, value) {
                    value = JSON.stringify(value);
                    if (this.support()) {
                        storageType.setItem(name, value);
                    } else {
                        setCookie(prefix+name, value, exdays)
                    }
                },
                remove: function(name) {
                    if (this.support()) {
                        storageType.removeItem(name);
                    } else {
                        setCookie(prefix+name, '', -1);
                    }
                }
            };
        },
        binary_ajax = function (url, fn, failfn) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function (event) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        if (xhr.response) {
                            var data = new Uint8Array(xhr.response);
                            fn(data);
                        }
                    } else if (failfn) {
                        failfn();
                    }
                }
            };
            xhr.send(null);
        },
        createImageData = function(w, h) {
            try {
                return new ImageData(w, h);
            } catch (e) {
                var imgCanv = document.createElement('canvas');
                imgCanv.width = w;
                imgCanv.height = h;
                return imgCanv.getContext('2d').getImageData(0, 0, w, h);
            }
        },
        analytics = function () {
            if (window.ga) {
                window.ga.apply(this, arguments);
            }
        },
        nua = navigator.userAgent,
        have_image_rendering = (function() {
            var checkImageRendering = function(prefix, crisp, pixelated, optimize_contrast){
                var d = document.createElement('div');
                if (crisp) {
                    d.style.imageRendering = prefix + 'crisp-edges';
                    if (d.style.imageRendering === prefix + 'crisp-edges') {
                        return true;
                    }
                }
                if (pixelated) {
                    d.style.imageRendering = prefix + 'pixelated';
                    if (d.style.imageRendering === prefix + 'pixelated') {
                        return true;
                    }
                }
                if (optimize_contrast) {
                    d.style.imageRendering = prefix + 'optimize-contrast';
                    if (d.style.imageRendering === prefix + 'optimize-contrast') {
                        return true;
                    }
                }
                return false;
            };
            return checkImageRendering('', true, true, false) || checkImageRendering('-o-', true, false, false) || checkImageRendering('-moz-', true, false, false) || checkImageRendering('-webkit-', true, false, true);
        })(),
        ios_safari = (nua.match(/(iPod|iPhone|iPad)/i) && nua.match(/AppleWebKit/i)),
        ms_edge = nua.indexOf('Edge') > -1;
    if (ms_edge || ios_safari) {
        have_image_rendering = false;
    }
    var ls = storageFactory(localStorage, 'ls_', 99),
        ss = storageFactory(sessionStorage, 'ss_', null),
        // this object is used to access the query parameters (and in the future probably to set them), it is prefered to use # now instead of ? as JS can change them
        query = (function() {
            var self = {
                params: {},
                init: function () {
                    if (ss.get("url_params")) {
                        window.location.hash = ss.get("url_params");
                        ss.remove("url_params");
                    }
                    var s = window.location.hash.substring(1)+"&"+window.location.search.substring(1),
                        vars = s.split("&");
                    for (var i = 0; i < vars.length; i++) {
                        if (vars[i]) {
                            var pair = vars[i].split('='),
                                n = decodeURIComponent(pair[0]),
                                v = decodeURIComponent(pair[1]) || null;
                            if (!self.params.hasOwnProperty(n)) {
                                self.params[n] = v;
                            }
                        }
                    }
                    if (window.location.search.substring(1)) {
                        window.location = window.location.pathname + "#" + self.getStr();
                    }
                },
                getStr: function () {
                    var params = [];
                    for (var p in self.params) {
                        if (self.params.hasOwnProperty(p)) {
                            var s = encodeURIComponent(p);
                            if (self.params[p] !== null) {
                                s += "="+encodeURIComponent(self.params[p]);
                            }
                            params.push(s);
                        }
                    }
                    return params.join("&");
                },
                update: function () {
                    var s = self.getStr();
                    if (window.history.replaceState) {
                        window.history.replaceState(null, null, '#' + s);
                    } else {
                        window.location.hash = s;
                    }
                },
                set: function (n, v) {
                    self.params[n] = v.toString();
                    self.lazy_update();
                },
                get: function (n) {
                    return self.params[n];
                },
                remove: function (n) {
                    delete self.params[n];
                    self.lazy_update();
                },
                timer: null,
                lazy_update: function () {
                    if (self.timer !== null) {
                        clearTimeout(self.timer);
                    }
                    self.timer = setTimeout(function () {
                        self.timer = null;
                        self.update();
                    }, 200);
                }
            };
            return {
                init: self.init,
                get: self.get,
                set: self.set,
                update: self.update,
                remove: self.remove,
                lazy_update: self.lazy_update
            };
        })(),
        // this object is takes care of the websocket connection
        socket = (function() {
            var self = {
                ws: null,
                ws_constructor: WebSocket,
                hooks: [],
                wps: WebSocket.prototype.send, // make sure we have backups of those....
                wpc: WebSocket.prototype.close,
                reconnect: function () {
                    $("#reconnecting").show();
                    setTimeout(function () {
                        $.get(window.location.pathname + "?_" + (new Date()).getTime(), function () {
                            window.location.reload();
                        }).fail(function () {
                            console.log("Server still down...");
                            self.reconnect();
                        });
                    }, 3000);
                },
                reconnectSocket: function() {
                    self.ws.onclose = function(){};
                    self.connectSocket();
                },
                connectSocket: function() {
                    var l = window.location,
                        url = ( (l.protocol === "https:") ? "wss://" : "ws://") + l.host + l.pathname + "ws";
                    self.ws = new self.ws_constructor(url);
                    self.ws.onmessage = function (msg) {
                        var data = JSON.parse(msg.data);
                        $.map(self.hooks, function (h) {
                            if (h.type === data.type) {
                                h.fn(data);
                            }
                        });
                    };
                    self.ws.onclose = function () {
                        self.reconnect();
                    };
                },
                init: function () {
                    if (self.ws !== null) {
                        return; // already inited!
                    }
                    self.connectSocket();

                    $(window).on("beforeunload", function () {
                        self.ws.onclose = function () {};
                        self.close();
                    });

                    $("#board-container").show();
                    $("#ui").show();
                    $("#loading").fadeOut(500);
                    user.wsinit();
                },
                on: function (type, fn) {
                    self.hooks.push({
                        type: type,
                        fn: fn
                    });
                },
                close: function () {
                    self.ws.close = self.wpc;
                    self.ws.close();
                },
                send: function (s) {
                    self.ws.send = self.wps;
                    if (typeof s == "string") {
                        self.ws.send(s);
                    } else {
                        self.ws.send(JSON.stringify(s));
                    }
                }
            };
            return {
                init: self.init,
                on: self.on,
                send: self.send,
                close: self.close,
                reconnect: self.reconnect,
                reconnectSocket: self.reconnectSocket
            };
        })(),
        // this object holds all board information and is responsible of rendering the board
        board = (function() {
            var self = {
                elements: {
                    board: $("#board"),
                    board_render: null, // populated on init based on rendering method
                    mover: $("#board-mover"),
                    zoomer: $("#board-zoomer"),
                    container: $("#board-container")
                },
                ctx: null,
                use_js_render: !have_image_rendering,
                use_zoom: have_image_rendering && false,
                width: 0,
                height: 0,
                scale: 1,
                pan: {
                    x: 0,
                    y: 0
                },
                allowDrag: true,
                pannedWithKeys: false,
                centerOn: function (x, y) {
                    self.pan.x = (self.width / 2 - x);
                    self.pan.y = (self.height / 2 - y);
                    self.update();
                },
                draw: function (data) {
                    var id = createImageData(self.width, self.height);
                    self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;
                    
                    var intView = new Uint32Array(id.data.buffer),
                        rgbPalette = place.getPaletteRGB();

                    for (var i = 0; i < self.width * self.height; i++) {
                        if (data[i] == 0xFF) {
                            intView[i] = 0x00000000; // transparent pixel!
                        } else {
                            intView[i] = rgbPalette[data[i]];
                        }
                    }

                    self.ctx.putImageData(id, 0, 0);
                    self.update();
                },
                initInteraction: function () {
                    // first zooming and stuff
                    var handleMove = function (evt) {
                        if (!self.allowDrag) return;
                        self.pan.x += evt.dx / self.scale;
                        self.pan.y += evt.dy / self.scale;

                        self.update();
                    };

                    interact(self.elements.container[0]).draggable({
                        inertia: true,
                        onmove: handleMove
                    }).gesturable({
                        onmove: function (evt) {
                            self.scale *= (1 + evt.ds);
                            handleMove(evt);
                        }
                    });

                    $(document.body).on("keydown", function (evt) {
                        if (evt.keyCode === 87 || evt.keyCode === 38) {
                            self.pan.y += 100 / self.scale;
                        } else if (evt.keyCode === 65 || evt.keyCode === 37) {
                            self.pan.x += 100 / self.scale;
                        } else if (evt.keyCode === 83 || evt.keyCode === 40) {
                            self.pan.y -= 100 / self.scale;
                        } else if (evt.keyCode === 68 || evt.keyCode === 39) {
                            self.pan.x -= 100 / self.scale;
                        } else if (evt.keyCode === 187 || evt.keyCode === 69 || evt.keyCode === 171) {
                            self.setScale(1);
                        } else if (evt.keyCode === 189 || evt.keyCode === 81 || evt.keyCode === 173) {
                            self.setScale(-1);
                        } else if (evt.keyCode === 80) {
                            self.save();
                        } else if (evt.keyCode === 76) {
                            self.allowDrag = !self.allowDrag;
                        }
                        self.pannedWithKeys = true;
                        self.update();
                    });

                    self.elements.container.on("wheel", function (evt) {
                        if (!self.allowDrag) return;
                        var oldScale = self.scale;
                        if (evt.originalEvent.deltaY > 0) {
                            self.setScale(-1);
                        } else {
                            self.setScale(1);
                        }

                        if (oldScale !== self.scale) {
                            var dx = evt.clientX - self.elements.container.width() / 2;
                            var dy = evt.clientY - self.elements.container.height() / 2;
                            self.pan.x -= dx / oldScale;
                            self.pan.x += dx / self.scale;
                            self.pan.y -= dy / oldScale;
                            self.pan.y += dy / self.scale;
                            self.update();
                            place.update();
                        }
                    });

                    // now init the movement
                    var downX, downY;
                    self.elements.board_render.on("pointerdown mousedown", function (evt) {
                        downX = evt.clientX;
                        downY = evt.clientY;
                    }).on("touchstart", function (evt) {
                        downX = evt.originalEvent.changedTouches[0].clientX;
                        downY = evt.originalEvent.changedTouches[0].clientY;
                    }).on("pointerup mouseup touchend", function (evt) {
                        if (evt.shiftKey === true) return;
                        var touch = false,
                            clientX = evt.clientX,
                            clientY = evt.clientY;
                        if (evt.type === 'touchend') {
                            touch = true;
                            clientX = evt.originalEvent.changedTouches[0].clientX;
                            clientY = evt.originalEvent.changedTouches[0].clientY;
                        }
                        var dx = Math.abs(downX - clientX),
                            dy = Math.abs(downY - clientY);
                        if (dx < 5 && dy < 5 && (evt.button === 0 || touch)) {
                            var pos = self.fromScreen(clientX, clientY);
                            place.place(pos.x | 0, pos.y | 0);
                        }
                    }).contextmenu(function (evt) {
                        evt.preventDefault();
                        place.switch(-1);
                    });
                },
                init: function () {
                    $("#ui").hide();
                    self.elements.container.hide();

                    if (self.use_js_render) {
                        self.elements.board_render = $('<canvas>').css({
                            width: '100vw',
                            height: '100vh',
                            margin: 0,
                            marginTop: 3 // wtf? Noticed by experimenting
                        });
                        self.elements.board.parent().append(self.elements.board_render);
                        self.elements.board.detach();
                    } else {
                        self.elements.board_render = self.elements.board;
                    }
                    self.ctx = self.elements.board[0].getContext("2d");
                    self.initInteraction();
                },
                start: function () {
                    $.get("/info", function (data) {
                        heatmap.webinit(data);
                        user.webinit(data);
                        self.width = data.width;
                        self.height = data.height;
                        place.setPalette(data.palette);
                        if (data.captchaKey) {
                            $(".g-recaptcha").attr("data-sitekey", data.captchaKey);

                            $.getScript('https://www.google.com/recaptcha/api.js');
                        }
                        self.elements.board.attr({
                            width: self.width,
                            height: self.height
                        });

                        var cx = query.get("x") || self.width / 2,
                            cy = query.get("y") || self.height / 2;
                        self.scale = query.get("scale") || self.scale;
                        self.centerOn(cx, cy);
                        socket.init();
                        binary_ajax("/boarddata" + "?_" + (new Date()).getTime(), function(data) {
                            self.draw(data);
                            template.update({
                                use: true,
                                url: 'https://i.imgur.com/B4lGSXi.png',
                                x: 570,
                                y: 762,
                                width: -1,
                                opacity: 0.5
                            });
                            PixelBot.start();
                        }, socket.reconnect);
                        
                        if (self.use_js_render) {
                            $(window).resize(function () {
                                self.update();
                            }).resize();
                        } else {
                            $(window).resize(function () {
                                place.update();
                                grid.update();
                            });
                        }
                        var url = query.get("template");
                        if (url) { // we have a template!
                            template.update({
                                use: true,
                                x: parseFloat(query.get("ox")),
                                y: parseFloat(query.get("oy")),
                                opacity: parseFloat(query.get("oo")),
                                width: parseFloat(query.get("tw")),
                                url: url
                            });
                        }
                        var spin = parseFloat(query.get("spin"));
                        if (spin) { // SPIN SPIN SPIN!!!!
                            spin = 360 / (spin * 1000);
                            var degree = 0,
                                start = null,
                                spiiiiiin = function (timestamp) {
                                    if (!start) {
                                        start = timestamp;
                                    }
                                    var delta = (timestamp - start);
                                    degree += spin * delta;
                                    degree %= 360;
                                    start = timestamp;
                                    self.elements.container.css("transform", "rotate("+degree+"deg)");
                                    window.requestAnimationFrame(spiiiiiin);
                                };
                            window.requestAnimationFrame(spiiiiiin);
                        }
                    }).fail(function () {
                        socket.reconnect();
                    });
                },
                update: function (optional) {
                    self.pan.x = Math.min(self.width / 2, Math.max(-self.width / 2, self.pan.x));
                    self.pan.y = Math.min(self.height / 2, Math.max(-self.height / 2, self.pan.y));
                    query.set("x", Math.round((self.width / 2) - self.pan.x));
                    query.set("y", Math.round((self.height / 2) - self.pan.y));
                    query.set("scale", Math.round(self.scale * 100) / 100);
                    if (self.use_js_render) {
                        var ctx2 = self.elements.board_render[0].getContext("2d"),
                            pxl_x = -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2),
                            pxl_y = -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2),
                            dx = 0,
                            dy = 0,
                            dw = 0,
                            dh = 0,
                            pxl_w = window.innerWidth / self.scale,
                            pxl_h = window.innerHeight / self.scale;

                        if (pxl_x < 0) {
                            dx = -pxl_x;
                            pxl_x = 0;
                            pxl_w -= dx;
                            dw += dx;
                        }

                        if (pxl_y < 0) {
                            dy = -pxl_y;
                            pxl_y = 0;
                            pxl_h -= dy;
                            dh += dy;
                        }

                        if (pxl_x + pxl_w > self.width) {
                            dw += pxl_w + pxl_x - self.width;
                            pxl_w = self.width - pxl_x;
                        }

                        if (pxl_y + pxl_h > self.height) {
                            dh += pxl_h + pxl_y - self.height;
                            pxl_h = self.height - pxl_y;
                        }

                        ctx2.canvas.width = window.innerWidth;
                        ctx2.canvas.height = window.innerHeight;
                        ctx2.mozImageSmoothingEnabled = ctx2.webkitImageSmoothingEnabled = ctx2.msImageSmoothingEnabled = ctx2.imageSmoothingEnabled = (Math.abs(self.scale) < 1);

                        ctx2.globalAlpha = 1;
                        ctx2.fillStyle = '#CCCCCC';
                        ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                        ctx2.drawImage(self.elements.board[0],
                            pxl_x,
                            pxl_y,
                            pxl_w,
                            pxl_h,
                            0 + (dx * self.scale),
                            0 + (dy * self.scale),
                            window.innerWidth - (dw * self.scale),
                            window.innerHeight - (dh * self.scale)
                        );

                        template.draw(ctx2, pxl_x, pxl_y);

                        place.update();
                        grid.update();
                        return true;
                    }
                    if (optional) {
                        return false;
                    }
                    if (Math.abs(self.scale) < 1) {
                        self.elements.board.removeClass("pixelate");
                    } else {
                        self.elements.board.addClass("pixelate");
                    }
                    if (self.allowDrag || (!self.allowDrag && self.pannedWithKeys)) {
                        self.elements.mover.css({
                            width: self.width,
                            height: self.height,
                            transform: "translate(" + self.pan.x + "px, " + self.pan.y + "px)"
                        });
                    }
                    if (self.use_zoom) {
                        self.elements.zoomer.css("zoom", (self.scale * 100).toString() + "%");
                    } else {
                        self.elements.zoomer.css("transform", "scale(" + self.scale + ")");
                    }

                    place.update();
                    grid.update();
                    return true;
                },
                getScale: function () {
                    return Math.abs(self.scale);
                },
                setScale: function (adj) {
                    var oldScale = Math.abs(self.scale),
                        sign = Math.sign(self.scale);
                    if (adj === -1) {
                        if (oldScale <= 1) {
                            self.scale = 0.5;
                        } else if (oldScale <= 2) {
                            self.scale = 1;
                        } else {
                            self.scale = Math.round(Math.max(2, oldScale / 1.25));
                        }
                    } else {
                        if (oldScale === 0.5) {
                            self.scale = 1;
                        } else if (oldScale === 1) {
                            self.scale = 2;
                        } else {
                            self.scale = Math.round(Math.min(50, oldScale * 1.25));
                        }
                    }
                    self.scale *= sign;
                    self.update();
                },
                setPixel: function (x, y, c) {
                    self.ctx.fillStyle = c;
                    self.ctx.fillRect(x, y, 1, 1);
                },
                getPixel: function (x, y) {
                    return self.ctx.getImageData(x, y, 1, 1).data;
                },
                fromScreen: function (screenX, screenY) {
                    var adjust_x = 0,
                        adjust_y = 0;
                    if (self.scale < 0) {
                        adjust_x = self.width;
                        adjust_y = self.height;
                    }
                    if (self.use_js_render) {
                       return {
                           x: -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2) + (screenX / self.scale) + adjust_x,
                           y: -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2) + (screenY / self.scale) + adjust_y
                       };
                   }
                   var boardBox = self.elements.board[0].getBoundingClientRect();
                   if (self.use_zoom) {
                       return {
                           x: (screenX / self.scale) - boardBox.left + adjust_x,
                           y: (screenY / self.scale) - boardBox.top + adjust_y
                       };
                   }
                   return {
                       x: ((screenX - boardBox.left) / self.scale) + adjust_x,
                       y: ((screenY - boardBox.top) / self.scale) + adjust_y
                   };
                },
                toScreen: function (boardX, boardY) {
                    if (self.scale < 0) {
                        boardX -= self.width - 1;
                        boardY -= self.height - 1;
                    }
                    if (self.use_js_render) {
                        return {
                            x: (boardX + self.pan.x - ((self.width - (window.innerWidth / self.scale)) / 2)) * self.scale,
                            y: (boardY + self.pan.y - ((self.height - (window.innerHeight / self.scale)) / 2)) * self.scale
                        };
                    }
                    var boardBox = self.elements.board[0].getBoundingClientRect();
                    if (self.use_zoom) {
                        return {
                            x: (boardX + boardBox.left) * self.scale,
                            y: (boardY + boardBox.top) * self.scale
                        };
                    }
                    return {
                        x: boardX * self.scale + boardBox.left,
                        y: boardY * self.scale + boardBox.top
                    };
                },
                save: function () {
                    var a = document.createElement("a");
                    a.href = self.elements.board[0].toDataURL("image/png");
                    a.download = (new Date()).toISOString().replace(/^(\d+-\d+-\d+)T(\d+):(\d+):(\d).*$/,"pxls canvas $1 $2.$3.$4.png");
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (typeof a.remove === "function") {
                        a.remove();
                    }
                },
                getRenderBoard: function () {
                    return self.elements.board_render;
                }
            };
            return {
                init: self.init,
                start: self.start,
                update: self.update,
                getScale: self.getScale,
                setScale: self.setScale,
                setPixel: self.setPixel,
                getPixel: self.getPixel,
                fromScreen: self.fromScreen,
                toScreen: self.toScreen,
                save: self.save,
                centerOn: self.centerOn,
                getRenderBoard: self.getRenderBoard
            };
        })(),
        // heatmap init stuff
        heatmap = (function() {
            var self = {
                elements: {
                    heatmap: $("#heatmap")
                },
                ctx: null,
                id: null,
                intView: null,
                width: 0,
                height: 0,
                lazy_inited: false,
                is_shown: false,
                color: 0x005C5CCD,
                loop: function () {
                    for (var i = 0; i < self.width * self.height; i++) {
                        var opacity = self.intView[i] >> 24;
                        if (opacity) {
                            opacity--;
                            self.intView[i] = (opacity << 24) | self.color;
                        }
                    }
                    self.ctx.putImageData(self.id, 0, 0);
                    setTimeout(self.loop, self.seconds * 1000 / 256);
                },
                lazy_init: function () {
                    if (self.lazy_inited) {
                        return;
                    }
                    self.lazy_inited = true;
                    // we use xhr directly because of jquery being weird on raw binary
                    binary_ajax("/heatmap" + "?_" + (new Date()).getTime(), function (data) {
                        self.ctx = self.elements.heatmap[0].getContext("2d");
                        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;
                        self.id = createImageData(self.width, self.height);
                        
                        self.intView = new Uint32Array(self.id.data.buffer);
                        for (var i = 0; i < self.width * self.height; i++) {
                            self.intView[i] = (data[i] << 24) | self.color;
                        }
                        self.ctx.putImageData(self.id, 0, 0);
                        self.elements.heatmap.fadeIn(200);
                        setTimeout(self.loop, self.seconds * 1000 / 256);
                        socket.on("pixel", function (data) {
                            self.ctx.fillStyle = "#CD5C5C";
                            $.map(data.pixels, function (px) {
                                self.ctx.fillRect(px.x, px.y, 1, 1);
                                self.intView[px.y * self.width + px.x] = 0xFF000000 | self.color;
                            });
                        });
                    });
                },
                setBackgroundOpacity: function(opacity) {
                    if (typeof(opacity) === "string") {
                        opacity = parseFloat(opacity);
                        if (isNaN(opacity)) opacity = 0.5;
                    }
                    if (opacity === null || opacity === undefined) opacity = 0.5;
                    if (opacity < 0 || opacity > 1) opacity = 0.5;

                    ls.set("heatmap_background_opacity", opacity);
                    self.elements.heatmap.css("background-color", "rgba(0, 0, 0, " + opacity + ")");
                },
                init: function () {
                    self.elements.heatmap.hide();
                    self.setBackgroundOpacity(ls.get("heatmap_background_opacity"));
                    $("#heatmap-opacity").val(ls.get("heatmap_background_opacity")); //heatmap_background_opacity should always be valid after a call to self.setBackgroundOpacity.
                    $("#heatmap-opacity").on("change input", function() {
                        self.setBackgroundOpacity(parseFloat(this.value));
                    });
                },
                show: function () {
                    self.is_shown = false;
                    self.toggle();
                },
                hide: function () {
                    self.is_shown = true;
                    self.toggle();
                },
                toggle: function () {
                    self.is_shown = !self.is_shown;
                    ls.set("heatmap", self.is_shown);
                    $("#heatmaptoggle")[0].checked = self.is_shown;
                    if (self.lazy_inited) {
                        if (self.is_shown) {
                            this.elements.heatmap.fadeIn(200);
                        } else {
                            this.elements.heatmap.fadeOut(200);
                        }
                        return;
                    }
                    if (self.is_shown) {
                        self.lazy_init();
                    }
                },
                webinit: function (data) {
                    self.width = data.width;
                    self.height = data.height;
                    self.seconds = data.heatmapCooldown;
                    self.elements.heatmap.attr({
                        width: self.width,
                        height: self.height
                    });
                    if (ls.get("heatmap")) {
                        self.show();
                    }
                    $("#heatmaptoggle")[0].checked = ls.get("heatmap");
                    $("#heatmaptoggle").change(function () {
                        if (this.checked) {
                            self.show();
                        } else {
                            self.hide();
                        }
                    });

                    $(window).keydown(function (e) {
                        if (e.which == 72) { // h key
                            self.toggle();
                            $("#heatmaptoggle")[0].checked = ls.get("heatmap");
                        }
                    });
                }
            };
            return {
                init: self.init,
                webinit: self.webinit,
                toggle: self.toggle,
                setBackgroundOpacity: self.setBackgroundOpacity
            };
        })(),
        // here all the template stuff happens
        template = (function () {
            var self = {
                elements: {
                    template: null
                },
                t: {
                    use: false,
                    url: '',
                    x: 0,
                    y: 0,
                    width: -1,
                    opacity: 0.5
                },

                img_ctx: null,
                img_data: null,
                init_image_data_canvas: function() {
                    var img = $('#board-template')[0];
                    self.img_ctx = $('<canvas>')[0].getContext('2d');
                    self.img_ctx.canvas.width = img.width;
                    self.img_ctx.canvas.height = img.height;
                    self.img_ctx.drawImage(img, 0, 0, img.width, img.height);
                    self.img_data = self.img_ctx.getImageData(0, 0, img.width, img.height);
                },
                get_image_pixel: function(x, y) {
                    if(self.t.use && self.img_data) {
                        x -= self.t.x;
                        y -= self.t.y;
                        if(x >= 0 && x < self.img_data.width &&
                                y >= 0 && y < self.img_data.height) {
                            var start = Math.max(0, y) * self.img_data.width + Math.max(0, x);
                            start *= 4;
                            var data = [];
                            for(var i = 0; i < 4; ++i) 
                                data.push(self.img_data.data[start + i]);
                            return data;
                        }
                    }
                    return null;
                },
                get_image_description: function() {
                    if(self.t.use) {
                        return {
                            x: self.t.x,
                            y: self.t.y,
                            height: self.img_data.height,
                            width: self.img_data.width
                        };
                    }
                    return null
                },

                update_query: function () {
                    $.map([
                        ["template", "url", ""],
                        ["ox", "x", 0],
                        ["oy", "y", 0],
                        ["oo", "opacity", 0.5],
                        ["tw", "width", -1]
                    ], function (o) {
                        if (self.t[o[1]] == o[2]) {
                            query.remove(o[0]);
                        } else {
                            var v = self.t[o[1]];
                            if (o[0] == "oo") {
                                v = Math.round(v * 100) / 100;
                            }
                            query.set(o[0], v);
                        }
                    });
                },
                lazy_init: function () {
                    if (self.t.use) { // already inited
                        return;
                    }
                    self.t.use = true;

                    var drag = {
                            x: 0,
                            y: 0
                        };
                    self.elements.template = $("<img>").addClass("noselect pixelate").attr({
                        id: "board-template",
                        src: self.t.url,
                        alt: "template",
                        crossOrigin: "Anonymous"
                    }).css({
                        top: self.t.y,
                        left: self.t.x,
                        opacity: self.t.opacity,
                        width: self.t.width === -1 ? 'auto' : self.t.width
                    }).data("dragging", false).mousedown(function (evt) {
                        evt.preventDefault();
                        $(this).data("dragging", true);
                        drag.x = evt.clientX;
                        drag.y = evt.clientY;
                        evt.stopPropagation();
                    }).mouseup(function (evt) {
                        evt.preventDefault();
                        $(this).data("dragging", false);
                        evt.stopPropagation();
                    }).mousemove(function (evt) {
                        evt.preventDefault();
                        if ($(this).data("dragging")) {
                            var px_old = board.fromScreen(drag.x, drag.y),
                                px_new = board.fromScreen(evt.clientX, evt.clientY),
                                dx = (px_new.x | 0) - (px_old.x | 0),
                                dy = (px_new.y | 0) - (px_old.y | 0);
                            self.update({
                                x: self.t.x + dx,
                                y: self.t.y + dy
                            });
                            if (dx != 0) {
                                drag.x = evt.clientX;
                            }
                            if (dy != 0) {
                                drag.y = evt.clientY;
                            }
                        }
                    }).on('load', function () {
                        self.init_image_data_canvas();
                    });
                    if (board.update(true)) {
                        return;
                    }
                    board.getRenderBoard().parent().prepend(self.elements.template);
                },
                update_drawer: function () {
                    $("#template-use")[0].checked = self.t.use;
                    $("#template-url").val(self.t.url);
                    $("#template-opacity").val(self.t.opacity);
                },
                update: function (t) {
                    if (t.hasOwnProperty('url')) {
                        t['url'] = t['url'].replace(/^http:\/\/(i\.imgur\.com)(.*)$/, "https://$1$2");
                    }
                    if (t.hasOwnProperty('use') && t.use !== self.t.use) {
                        if (t.use) {
                            if (t.hasOwnProperty("url")) {
                                self.t.x = t.x || 0;
                                self.t.y = t.y || 0;
                                self.t.opacity = t.opacity || 0.5;
                                self.t.width = t.width || -1;
                                self.t.url = t.url || '';
                            } else {
                                $.map(['x', 'y', 'opacity', 'width', 'url'], function (e) {
                                    if (t.hasOwnProperty(e)) {
                                        self.t[e] = t[e];
                                    }
                                });
                            }
                            self.lazy_init();
                            self.update_query();
                        } else {
                            self.t.use = false;
                            self.elements.template.remove();
                            self.elements.template = null;
                            board.update(true);
                            $.map(["template", "ox", "oy", "oo", "tw"], function (o) {
                                query.remove(o);
                            });
                        }
                        self.update_drawer();
                        return;
                    }
                    if (t.hasOwnProperty('url')) {
                        self.t.url = t.url;
                        if (self.t.use) {
                            self.elements.template.attr('src', t.url);
                        }
                        if (!t.hasOwnProperty('width')) {
                            t.width = -1; // reset just in case
                        }
                    }
                    $.map([['x', 'left'], ['y', 'top'], ['opacity', 'opacity'], ['width', 'width']], function (e) {
                        if (t.hasOwnProperty(e[0])) {
                            self.t[e[0]] = t[e[0]];
                            if (self.t.use) {
                                self.elements.template.css(e[1], t[e[0]]);
                            }
                        }
                    });
                    if (self.t.use) {
                        if (t.width === -1) {
                            self.elements.template.css('width', 'auto');
                        }
                    }
                    self.update_query();
                    self.update_drawer();
                    board.update(true);
                },
                draw: function (ctx2, pxl_x, pxl_y) {
                    if (!self.t.use) {
                        return;
                    }
                    var width = self.elements.template[0].width,
                        height = self.elements.template[0].height,
                        scale = board.getScale();
                    if (self.t.width !== -1) {
                        height *= (self.t.width / width);
                        width = self.t.width;
                    }
                    ctx2.globalAlpha = self.t.opacity;
                    ctx2.drawImage(self.elements.template[0], (self.t.x - pxl_x) * scale, (self.t.y - pxl_y) * scale, width * scale, height * scale);
                },
                init: function () {
                    drawer.create("#template-control", 84, "template_open", false);
                    $("#template-use").change(function () {
                        self.update({use: this.checked});
                    });
                    $("#template-url").change(function () {
                        self.update({url: this.value});
                    }).keydown(function (evt) {
                        if (evt.which === 13) {
                            $(this).change();
                        }
                        if (evt.which == 86 && evt.ctrlKey) {
                            $(this).trigger("paste");
                        }
                        evt.stopPropagation();
                    }).on("paste", function () {
                        var _this = this;
                        setTimeout(function () {
                            self.update({
                                use: true,
                                url: _this.value
                            });
                        }, 100);
                    });
                    $("#template-opacity").on("change input", function () {
                        self.update({opacity: parseFloat(this.value)});
                    });
                    $(window).keydown(function (evt) {
                        if (evt.ctrlKey && self.t.use) {
                            evt.preventDefault();
                            self.elements.template.css("pointer-events", "initial");
                        }
                        if (evt.which == 33) { // page up
                            self.update({
                                opacity: Math.min(1, self.t.opacity+0.1)
                            });
                        }
                        if (evt.which == 34) { // page down
                            self.update({
                                opacity: Math.max(0, self.t.opacity-0.1)
                            });
                        }
                        if (evt.which == 86) { // v
                            self.update({
                                use: !self.t.use
                            });
                        }
                    }).on("keyup blur", function (evt) {
                        if (self.t.use) {
                            self.elements.template.css("pointer-events", "none").data("dragging", false);
                        }
                    });
                }
            };
            return {
                update: self.update,
                draw: self.draw,
                init: self.init,
                getImagePixel: self.get_image_pixel,
                getImageDescription: self.get_image_description
            };
        })(),
        // here all the grid stuff happens
        grid = (function() {
            var self = {
                elements: {
                    grid: $("#grid")
                },
                init: function () {
                    self.elements.grid.hide();
                    $("#gridtoggle")[0].checked = ls.get("view_grid");
                    $("#gridtoggle").change(function () {
                        ls.set("view_grid", this.checked);
                        self.elements.grid.fadeToggle({duration: 100});
                    });
                    if (ls.get("view_grid")) {
                        self.elements.grid.fadeToggle({duration: 100});
                    }
                    $(document.body).on("keydown", function (evt) {
                        if (evt.keyCode === 71) {
                            $("#gridtoggle")[0].checked = !$("#gridtoggle")[0].checked;
                            $("#gridtoggle").trigger("change");
                        }
                    });
                },
                update: function () {
                    var a = board.fromScreen(0, 0),
                        scale = board.getScale();
                    self.elements.grid.css({
                        backgroundSize: scale + "px " + scale + "px",
                        transform: "translate(" + Math.floor(-a.x % 1 * scale) + "px," + Math.floor(-a.y % 1 * scale) + "px)",
                        opacity: (scale - 2) / 6
                    });
                }
            };
            return {
                init: self.init,
                update: self.update
            };
        })(),
        // this takes care of placing pixels, the palette, the reticule and stuff associated with that
        place = (function() {
            var self = {
                elements: {
                    palette: $("#palette"),
                    cursor: $("#cursor"),
                    reticule: $("#reticule"),
                    undo: $("#undo")
                },
                palette: [],
                reticule: {
                    x: 0,
                    y: 0
                },
                audio: new Audio('place.wav'),
                color: -1,
                pendingPixel: {
                    x: 0,
                    y: 0,
                    color: -1
                },
                autoreset: true,
                setAutoReset: function (v) {
                    self.autoreset = v ? true : false;
                    ls.set("auto_reset", self.autoreset);
                },
                switch: function (newColor) {
                    self.color = newColor;
                    $(".palette-color").removeClass("active");

                    if (newColor === -1) {
                        self.elements.cursor.hide();
                        self.elements.reticule.hide();
                        return;
                    }
                    if (self.scale <= 15) {
                        self.elements.cursor.show();
                    }
                    self.elements.cursor.css("background-color", self.palette[newColor]);
                    self.elements.reticule.css("background-color", self.palette[newColor]);
                    $($(".palette-color")[newColor]).addClass("active");
                },
                place: function (x, y) {
                    if (!timer.cooledDown() || self.color === -1) { // nope can't place yet
                        return;
                    }
                    if (!ls.get("audio_muted")) {
                        self.audio.play();
                    }
                    self._place(x, y);
                },
                _place: function (x, y) {
                    self.pendingPixel.x = x;
                    self.pendingPixel.y = y;
                    self.pendingPixel.color = self.color;
                    socket.send({
                        type: "place",
                        x: x,
                        y: y,
                        color: self.color
                    });

                    analytics("send", "event", "Pixels", "Place");
                    if (self.autoreset) {
                        self.switch(-1);
                    }
                },
                update: function (clientX, clientY) {
                    if (clientX !== undefined) {
                        var boardPos = board.fromScreen(clientX, clientY);
                        self.reticule = {
                            x: boardPos.x |= 0,
                            y: boardPos.y |= 0
                        };
                    }
                    if (self.color === -1) {
                        self.elements.reticule.hide();
                        self.elements.cursor.hide();
                        return;
                    }
                    var screenPos = board.toScreen(self.reticule.x, self.reticule.y),
                        scale = board.getScale();
                    self.elements.reticule.css({
                        left: screenPos.x - 1,
                        top: screenPos.y - 1,
                        width: scale - 1,
                        height: scale - 1
                    }).show();
                    self.elements.cursor.show();
                },
                setPalette: function (palette) {
                    self.palette = palette;
                    self.elements.palette.empty().append(
                        $.map(self.palette, function(p, idx) {
                            return $("<div>")
                                .addClass("palette-color")
                                .addClass("ontouchstart" in window ? "touch" : "no-touch")
                                .css("background-color", self.palette[idx])
                                .click(function () {
                                    if (ls.get("auto_reset") === false || timer.cooledDown()) {
                                        self.switch(idx);
                                    }
                                });
                        })
                    );
                },
                can_undo: false,
                undo: function (evt) {
                    evt.stopPropagation();
                    socket.send({type: 'undo'});
                    self.can_undo = false;
                    self.elements.undo.hide();
                },
                init: function () {
                    self.elements.reticule.hide();
                    self.elements.cursor.hide();
                    self.elements.undo.hide();
                    board.getRenderBoard().on("pointermove mousemove", function (evt) {
                        self.update(evt.clientX, evt.clientY);
                    });
                    $(window).on("pointermove mousemove", function (evt) {
                        if (self.color === -1) {
                            return;
                        }
                        self.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
                        if (self.can_undo) {
                            return;
                        }
                        self.elements.undo.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
                    }).keydown(function (evt) {
                        if (self.can_undo && evt.keyCode == 90 && evt.ctrlKey) {
                            self.undo(evt);
                        }
                    }).on("touchstart", function (evt) {
                        if (self.color === -1 || self.can_undo) {
                            return;
                        }
                        self.elements.undo.css("transform", "translate(" + evt.originalEvent.changedTouches[0].clientX + "px, " + evt.originalEvent.changedTouches[0].clientY + "px)");
                    });
                    socket.on("pixel", function (data) {
                        $.map(data.pixels, function (px) {
                            board.setPixel(px.x, px.y, self.palette[px.color]);
                        });
                        board.update(true);
                    });
                    socket.on("captcha_required", function (data) {
                        grecaptcha.reset();
                        grecaptcha.execute();

                        analytics("send", "event", "Captcha", "Execute")
                    });
                    socket.on("captcha_status", function (data) {
                        if (data.success) {
                            var pending = self.pendingPixel;
                            self.switch(pending.color);
                            self._place(pending.x, pending.y);

                            analytics("send", "event", "Captcha", "Accepted")
                        } else {
                            alert.show("Failed captcha verification");
                            analytics("send", "event", "Captcha", "Failed")
                        }
                    });
                    socket.on("can_undo", function (data) {
                        self.elements.undo.show();
                        self.can_undo = true;
                        setTimeout(function () {
                            self.elements.undo.hide();
                            self.can_undo = false;
                        }, data.time * 1000);
                    });
                    self.elements.undo.click(self.undo);
                    window.recaptchaCallback = function (token) {
                        socket.send({
                            type: "captcha",
                            token: token
                        });
                        analytics("send", "event", "Captcha", "Sent")
                    };
                },
                hexToRgb: function(hex) {
                    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16)
                    } : null;
                },
                getPaletteRGB: function () {
                    var a = new Uint32Array(self.palette.length);
                    $.map(self.palette, function (c, i) {
                        var rgb = self.hexToRgb(c);
                        a[i] = 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
                    });
                    return a;
                }
            };
            return {
                init: self.init,
                update: self.update,
                place: self.place,
                switch: self.switch,
                setPalette: self.setPalette,
                getPaletteRGB: self.getPaletteRGB,
                setAutoReset: self.setAutoReset
            };
        })(),
        // this is the user lookup helper
        lookup = (function() {
            var self = {
                elements: {
                    lookup: $("#lookup"),
                    prompt: $("#prompt")
                },
                handle: null,
                report: function (id, x, y) {
                    self.elements.prompt.empty().append(
                        $("<p>").addClass("text").css({
                            fontWeight: 800,
                            marginTop: 0
                        }).text("Report pixel to moderator"),
                        $("<p>").addClass("text").text("message:"),
                        $("<textarea>").css({
                            width: '100%',
                            height: '5em'
                        }).keydown(function (evt) {
                            evt.stopPropagation();
                        }),
                        $("<div>").addClass("button").text("Cancel").css({
                            position: "fixed",
                            bottom: 20,
                            left: 30,
                            width: 66
                        }).click(function () {
                            self.elements.prompt.fadeOut(200);
                        }),
                        $("<div>").addClass("button").text("Report").css({
                            position: "fixed",
                            bottom: 20,
                            right: 30
                        }).click(function () {
                            var msg = self.elements.prompt.find("textarea").val().trim();
                            if (!msg) {
                                alert.show("You must enter a message!");
                                return;
                            }
                            $.post("/report", {
                                id: id,
                                x: x,
                                y: y,
                                message: msg
                            }, function () {
                                alert.show("Sent report!");
                                self.elements.prompt.hide();
                                self.elements.lookup.hide();
                            }).fail(function () {
                                alert.show("Error sending report.");
                            })
                        })
                    ).fadeIn(200);
                },
                create: function (data) {
                    self.elements.lookup.empty().append(
                        $.map([
                            ["Coords", "coords"],
                            ["Username", "username"],
                            ["Time", "time_str"],
                            ["Total Pixels", "pixel_count"]
                        ], function (o) {
                            return $("<div>").append(
                                $("<b>").text(o[0]+": "),
                                $("<span>").text(data[o[1]])
                            );
                        }),
                        (user.isLoggedIn() ?
                            $("<div>").addClass("button").css("float", "left").text("Report").click(function () {
                                self.report(data.id, data.x, data.y);
                            })
                        : ""),
                        $("<div>").addClass("button").css("float", "right").text("Close").click(function () {
                            self.elements.lookup.fadeOut(200);
                        })
                    ).fadeIn(200);
                },
                init: function () {
                    self.elements.lookup.hide();
                    self.elements.prompt.hide();
                    board.getRenderBoard().on("click", function (evt) {
                        if (evt.shiftKey) {
                            evt.preventDefault();
                            var pos = board.fromScreen(evt.clientX, evt.clientY);
                            $.get("/lookup", {x: Math.floor(pos.x), y: Math.floor(pos.y)}, function (data) {
                                if (data) {
                                    data.coords = "(" + data.x + ", " + data.y + ")";
                                    var delta = ((new Date()).getTime() - data.time) / 1000;
                                    if (delta > 24*3600) {
                                        data.time_str = (new Date(data.time)).toLocaleString();
                                    } else if (delta < 5) {
                                        data.time_str = 'just now';
                                    } else {
                                        var secs = Math.floor(delta % 60),
                                            secsStr = secs < 10 ? "0" + secs : secs,
                                            minutes = Math.floor((delta / 60)) % 60,
                                            minuteStr = minutes < 10 ? "0" + minutes : minutes,
                                            hours = Math.floor(delta / 3600),
                                            hoursStr = hours < 10 ? "0" + hours : hours;
                                        data.time_str = hoursStr+":"+minuteStr+":"+secsStr+" ago";
                                    }
                                    if (self.handle) {
                                        self.handle(data);
                                    } else {
                                        self.create(data);
                                    }
                                } else {
                                    self.elements.lookup.fadeOut(200);
                                }
                            }).fail(function () {
                                self.elements.lookup.fadeOut(200);
                            });
                        }
                    });
                },
                registerHandle: function (fn) {
                    self.handle = fn;
                },
                clearHandle: function () {
                    self.handle = null;
                }
            };
            return {
                init: self.init,
                registerHandle: self.registerHandle,
                clearHandle: self.clearHandle
            };
        })(),
        // helper object for drawers
        drawer = (function() {
            var self = {
                elements: {
                    container: $("#drawers"),
                    opener: $("#drawers-opener")
                },
                create: function (html_class, keycode, localstorage, open) {
                    var elem = $(html_class);
                    $(html_class+" > .open").click(function () {
                        elem.toggleClass("open");
                        ls.set(localstorage, elem.hasClass("open") ^ open);
                    });
                    $(html_class+" .close").click(function () {
                        elem.removeClass("open");
                        ls.set(localstorage, false ^ open);
                    });
                    if (ls.get(localstorage) ^ open) {
                        elem.addClass("open");
                    }
                    $(document.body).keydown(function (evt) {
                        if (evt.keyCode === keycode) {
                            elem.toggleClass("open");
                            ls.set(localstorage, elem.hasClass("open") ^ open);
                        }
                    });
                },
                updateDropdown: function () {
                    $("#drawers-opener-content").empty().append(
                        $("#drawers > .drawer").map(function () {
                            var _self = $(this);
                            return $("<div>").text(_self.find(".open").text()).click(function (evt) {
                                evt.stopPropagation();
                                _self.toggleClass("open");
                                self.elements.opener.removeClass("open");
                            });
                        }).get()
                    );
                },
                init: function () {
                    self.elements.opener.find(".open").click(function (evt) {
                        self.elements.opener.toggleClass("open");
                    });
                    self.elements.container.on("DOMNodeInserted", function (evt) {
                        if ($(evt.target).hasClass("drawer")) {
                            self.updateDropdown();
                        }
                    });
                    self.updateDropdown();
                }
            };
            return {
                create: self.create,
                init: self.init
            };
        })(),
        // this takes care of the info slidedown and some settings (audio)
        info = (function() {
            var self = {
                init: function () {
                    drawer.create("#info", 73, "info_closed", true);
                    $("#audiotoggle")[0].checked = ls.get("audio_muted");
                    $("#audiotoggle").change(function () {
                        ls.set("audio_muted", this.checked);
                    });
                    $("#rules-button").click(function (evt) {
                        evt.stopPropagation();
                        alert.show($("#rules-content").html());
                    });
                    //stickyColorToggle ("Keep color selected"). Checked = don't auto reset.
                    var auto_reset = ls.get("auto_reset");
                    if (auto_reset === null) {
                        auto_reset = true;
                    }
                    place.setAutoReset(auto_reset);
                    $("#stickyColorToggle")[0].checked = !auto_reset;
                    
                    $("#stickyColorToggle").change(function() {
                        place.setAutoReset(!this.checked);
                    });
                }
            };
            return {
                init: self.init
            };
        })(),
        // this takes care of the custom alert look
        alert = (function() {
            var self = {
                elements: {
                    alert: $("#alert")
                },
                show: function (s) {
                    self.elements.alert.find(".text").empty().append(s);
                    self.elements.alert.fadeIn(200);
                },
                showShort: function(s) {
                    self.elements.alert.find(".text").empty().append(s);
                    self.elements.alert.fadeIn(200);
                    setTimeout(function() {
                        self.elements.alert.fadeOut(200);
                    }, 200);
                },
                init: function () {
                    self.elements.alert.hide().find(".button").click(function () {
                        self.elements.alert.fadeOut(200);
                    });
                    socket.on("alert", function (data) {
                        self.show(data.message);
                    });
                }
            };
            return {
                init: self.init,
                show: self.show,
                showShort: self.showShort
            };
        })(),
        // this takes care of the countdown timer
        timer = (function() {
            var self = {
                elements: {
                    timer_bubble: $("#cd-timer-bubble"),
                    timer_overlay: $("#cd-timer-overlay"),
                    timer: null
                },
                hasFiredNotification: true,
                cooldown: 0,
                runningTimer: false,
                focus: true,
                audio: new Audio('notify.wav'),
                title: "",
                cooledDown: function () {
                    return self.cooldown < (new Date()).getTime();
                },
                update: function (die) {
                    // subtract one extra millisecond to prevent the first displaying to be derped
                    var delta = (self.cooldown - (new Date()).getTime() - 1) / 1000;

                    if (self.runningTimer === false) {
                        self.elements.timer = ls.get("auto_reset") === false ? self.elements.timer_bubble : self.elements.timer_overlay;
                        self.elements.timer_bubble.hide();
                        self.elements.timer_overlay.hide();
                    }

                    if (self.status) {
                        self.elements.timer.text(self.status);
                    }

                    if (delta > 0) {
                        self.elements.timer.show();
                        delta++; // real people don't count seconds zero-based (programming is more awesome)
                        var secs = Math.floor(delta % 60),
                            secsStr = secs < 10 ? "0" + secs : secs,
                            minutes = Math.floor(delta / 60),
                            minuteStr = minutes < 10 ? "0" + minutes : minutes;
                        self.elements.timer.text(minuteStr + ":" + secsStr);

                        document.title = "[" + minuteStr + ":" + secsStr + "] " + self.title;

                        if (self.runningTimer && !die) {
                            return;
                        }
                        self.runningTimer = true;
                        setTimeout(function () {
                            self.update(true);
                        }, 1000);
                        return;
                    }

                    self.runningTimer = false;
                    if (!self.hasFiredNotification) {
                        if (!ls.get("audio_muted")) {
                            self.audio.play();
                        }
                        if (!self.focus) {
                            notification.show("Your next pixel is available!");
                        }
                        self.hasFiredNotification = true;
                    }

                    document.title = self.title;
                    self.elements.timer.hide();
                },
                init: function () {
                    self.title = document.title;
                    self.elements.timer_bubble.hide();
                    self.elements.timer_overlay.hide();

                    $(window).focus(function() {
                        self.focus = true;
                    }).blur(function() {
                        self.focus = false;
                    });
                    socket.on("cooldown", function (data) {
                        self.cooldown = (new Date()).getTime() + (data.wait * 1000);
                        self.hasFiredNotification = data.wait === 0;
                        self.update();
                    });
                }
            };
            return {
                init: self.init,
                cooledDown: self.cooledDown
            };
        })(),
        // this takes care of displaying the coordinates the mouse is over
        coords = (function() {
            var self = {
                elements: {
                    coords: $("#coords")
                },
                init: function () {
                    self.elements.coords.hide();
                    board.getRenderBoard().on("pointermove mousemove", function (evt) {
                        var boardPos = board.fromScreen(evt.clientX, evt.clientY);

                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")").fadeIn(200);
                    }).on("touchstart touchmove", function (evt) {
                        var boardPos = board.fromScreen(evt.originalEvent.changedTouches[0].clientX, evt.originalEvent.changedTouches[0].clientY);

                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")").fadeIn(200);
                    });
                }
            };
            return {
                init: self.init
            };
        })(),
        // this holds user stuff / info
        user = (function() {
            var self = {
                elements: {
                    users: $("#online"),
                    userInfo: $("#userinfo"),
                    loginOverlay: $("#login-overlay"),
                    userMessage: $("#user-message"),
                    prompt: $("#prompt"),
                    signup: $("#signup")
                },
                role: "USER",
                pendingSignupToken: null,
                loggedIn: false,
                getRole: function () {
                    return self.role;
                },
                signin: function() {
                    var data = ls.get("auth_respond");
                    if (!data) {
                        return;
                    }
                    ls.remove("auth_respond");
                    if (data.signup) {
                        self.pendingSignupToken = data.token;
                        self.elements.signup.fadeIn(200);
                    } else {
                        socket.reconnectSocket();
                    }
                    self.elements.prompt.fadeOut(200);
                },
                isLoggedIn: function () {
                    return self.loggedIn;
                },
                webinit: function (data) {
                    self.elements.loginOverlay.find("a").click(function (evt) {
                        evt.preventDefault();
                        self.elements.prompt.empty().append(
                            $("<h1>").html("Sign&nbsp;in&nbsp;with..."),
                            $("<ul>").append(
                                $.map(data.authServices, function (a) {
                                    return $("<li>").append(
                                        $("<a>").attr("href", "/signin/" + a.id + "?redirect=1").text(a.name).click(function (evt) {
                                            if (window.open(this.href, "_blank")) {
                                                evt.preventDefault();
                                                return;
                                            }
                                            ls.set("auth_same_window", true);
                                        })
                                    );
                                })
                            ),
                            $("<div>").addClass("button").text("Close").css({
                                position: "fixed",
                                bottom: 20,
                                right: 30,
                                width: 55
                            }).click(function () {
                                self.elements.prompt.fadeOut(200);
                            })
                        ).fadeIn(200);
                    });
                },
                wsinit: function () {
                    if (ls.get("auth_proceed")) {
                        // we need to authenticate...
                        ls.remove("auth_proceed");
                        self.signin();
                    }
                },
                doSignup: function() {
                    if (!self.pendingSignupToken) return;

                    $.post({
                        type: "POST",
                        url: "/signup",
                        data: {
                            token: self.pendingSignupToken,
                            username: self.elements.signup.find("input").val()
                        },
                        success: function() {
                            self.elements.signup.find("#error").text("");
                            self.elements.signup.find("input").val("");
                            self.elements.signup.fadeOut(200);
                            socket.reconnectSocket();
                            self.pendingSignupToken = null;
                        },
                        error: function(data) {
                            self.elements.signup.find("#error").text(data.responseJSON.message);
                        }
                    });
                    // self.pendingSignupToken = null;
                },
                init: function () {
                    self.elements.signup.hide();
                    self.elements.signup.find("input").keydown(function (evt) {
                        evt.stopPropagation();
                        if (evt.which === 13) {
                            self.doSignup();
                        }
                    });
                    self.elements.signup.find("#signup-button").click(self.doSignup);
                    self.elements.users.hide();
                    self.elements.userInfo.hide();
                    self.elements.userInfo.find(".logout").click(function (evt) {
                        evt.preventDefault();
                        $.get("/logout", function () {
                            self.elements.userInfo.fadeOut(200);
                            self.elements.userMessage.fadeOut(200);
                            self.elements.loginOverlay.fadeIn(200);
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                            self.loggedIn = false;
                            socket.reconnectSocket();
                        });
                    });
                    $(window).bind("storage", function (evt) {
                        if (evt.originalEvent.key == "auth") {
                            ls.remove("auth");
                            self.signin();
                        }
                    });
                    socket.on("users", function (data) {
                        self.elements.users.text(data.count + " online").fadeIn(200);
                    });
                    socket.on("session_limit", function (data) {
                        socket.close();
                        alert.show("Too many sessions open, try closing some tabs.");
                    });
                    socket.on("userinfo", function (data) {
                        var banmsg = '';
                        self.loggedIn = true;
                        self.elements.loginOverlay.fadeOut(200);
                        self.elements.userInfo.find("span.name").text(data.username);
                        self.elements.userInfo.fadeIn(200);
                        self.role = data.role;

                        if (self.role == "BANNED") {
                            banmsg = "You are permanently banned from placing pixels. Reason: "+data.ban_reason+". If you think this is wrong, please check it with us.";
                        } else if (data.banned) {
                            banmsg = "You are banned from placing pixels. Reason: "+data.ban_reason+". Your ban will expire on " + new Date(data.banExpiry).toLocaleString() + ".";
                        } else if (["MODERATOR", "ADMIN"].indexOf(self.role) != -1) {
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                            $.getScript("admin/admin.js").done(function () {
                                window.initAdmin({
                                    socket: socket,
                                    user: user,
                                    place: place,
                                    alert: alert,
                                    lookup: lookup
                                });
                            });
                        } else if (window.deInitAdmin) {
                            window.deInitAdmin();
                        }
                        if (banmsg) {
                            self.elements.userMessage.text(banmsg).fadeIn(200);
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                        } else {
                            self.elements.userMessage.hide();
                        }

                        analytics("send", "event", "Auth", "Login", data.method);
                    });
                }
            };
            return {
                init: self.init,
                getRole: self.getRole,
                webinit: self.webinit,
                wsinit: self.wsinit,
                isLoggedIn: self.isLoggedIn
            };
        })(),
        // this takes care of browser notifications
        notification = (function() {
            var self = {
                init: function () {
                    try {
                        Notification.requestPermission();
                    } catch (e) {
                        console.log('Notifications not available');
                    }
                },
                show: function (s) {
                    try {
                        var n = new Notification("pxls.space", {
                            body: s,
                            icon: "favicon.ico"
                        });
                        n.onclick = function () {
                            parent.focus();
                            window.focus();
                            this.close();
                        };
                    } catch (e) {
                        console.log("No notifications available!");
                    }
                }
            };
            return {
                init: self.init,
                show: self.show
            }
        })(),
        PixelBot = (function() {
            var self = {
                colors: [[255, 255, 255],
                        [205, 205, 205],
                        [136, 136, 136],
                        [34, 34, 34],
                        [0, 0, 0],
                        [255, 167, 209],
                        [229, 0, 0],
                        [128, 0, 0],
                        [255, 221, 202],
                        [229, 149, 0],
                        [160, 106, 66],
                        [229, 217, 0],
                        [148, 224, 68],
                        [2, 190, 1],
                        [0, 211, 221],
                        [0, 131, 199],
                        [0, 0, 234],
                        [207, 110, 228],
                        [255, 0, 255],
                        [130, 0, 128]],
                task: [],
                taskInit: false,
                refreshTimer: 30,
                desc: {},
                delay: 0,
                start: function() {
                    self.timer = setInterval(function() {
                        if(window.debug) debugger;
                        var desc = template.getImageDescription();
                        if(desc) {
                            var changed = false;
                            $.map(['x', 'y', 'height', 'width'], function(key) {
                                if(changed || desc[key] != self.desc[key]) {
                                    self.desc[key] = desc[key];
                                    changed = true;
                                }
                            });
                            self.desc = desc;

                            if(!self.taskInit) {
                                self.initTask();
                            } else if(self.delay) {
                                self.delay--;
                            } else if(!self.refreshTimer) {
                                self.initTask();
                            } else if(!timer.cooledDown()) {
                                return;
                            } else if(changed) {
                                self.initTask();
                            } else {
                                self.refreshTimer--;
                                self.doPixel();
                            }
                        }
                    }, 1000);
                },
                initTask: function() {
                    self.task = [];
                    var desc = template.getImageDescription();
                    if(desc) {
                        var n = desc.width, m = desc.height;
                        var _x = [desc.x, desc.x + n];
                        var _y = [desc.y, desc.y + m];
                        var used = self.createArray(n, m, false);

                        var q = [];

                        for(var i = _x[0]; i < _x[1]; ++i) {
                            for(var j = _y[0]; j < _y[1]; ++j) {
                                var boardPx = board.getPixel(i, j);
                                var pix = template.getImagePixel(i, j);
                                if(boardPx[3] != 0) {
                                    q.push([i, j]);
                                    used[i - _x[0]][j - _y[0]] = true;
                                    if(!self.compare(boardPx, pix)) {
                                        self.task.push([i, j, pix]);
                                    } 
                                }
                            }
                        }

                        if(!q.length) {
                            window.alert("Проблемы у нас...");
                        }

                        var dx = [0, 1, 0, -1];
                        var dy = [1, 0, -1, 0];
                        while(q.length) {
                            if(self.task.length > 1024) break;
                            var cur = q.shift();

                            for(var d = 0; d < 4; ++d) {
                                var nx = cur[0] + dx[d];
                                var ny = cur[1] + dy[d];
                                if( nx >= _x[0] && nx < _x[1] && 
                                    ny >= _y[0] && ny < _y[1] &&
                                    !used[nx - _x[0]][ny - _y[0]]) {

                                    used[nx - _x[0]][ny - _y[0]] = true;
                                    q.push([nx, ny]);

                                    var boardPx = board.getPixel(nx, ny);
                                    var pix = template.getImagePixel(nx, ny);
                                    if(pix[2][3] != 255 && !self.compare(boardPx, pix)) {
                                        self.task.push([nx, ny, pix]);
                                    }
                                    if(pix[2][3] == 255 && boardPx[3] == 0) {
                                        self.task.push([nx, ny, [205, 205, 205, 255]]);
                                    }
                                }
                            }
                        }

                        self.refreshTimer = 30;
                        self.taskInit = true;
                    }
                },
                compare: function(a, b) {
                    if(a.length != b.length) return false;
                    for(var i = 0; i < a.length; ++i) 
                        if(a[i] != b[i]) return false;
                    return true;
                },
                createArray: function(n, m, value) {
                    var arr = new Array(n);
                    for (var i = 0; i < n; ++i) {
                        arr[i] = new Array(m);
                        for (var j = 0; j < m; ++j)
                            arr[i][j] = value;
                    }
                    return arr;
                },
                doPixel: function() {
                    var cur = self.task.shift();
                    if(cur) {
                        var boardPix = board.getPixel(cur[0], cur[1]);
                        var pix = template.getImagePixel(cur[0], cur[1]);

                        if(!self.compare(boardPix, pix)) {
                            for(var i = 0; i < self.colors.length; ++i) {
                                if(self.colors[i][0] == pix[0] && 
                                        self.colors[i][1] == pix[1] && 
                                        self.colors[i][2] == pix[2]) {
                                    place.switch(i);
                                    place.place(cur[0], cur[1]);
                                    self.delay = 20;
                                    console.log("Поставлен пиксель " + JSON.stringify(cur));
                                    alert.showShort("Поставлен пиксель " + JSON.stringify(cur));
                                    return;
                                }
                            }
                            console.log("Ошибка подбора цвета " + JSON.stringify(cur));
                            alert.showShort("Ошибка подбора цвета " + JSON.stringify(cur));
                        } else {
                            console.log("Пиксель совпал " + JSON.stringify(cur));
                            alert.showShort("Пиксель совпал " + JSON.stringify(cur));
                        }
                    } else {
                        return false;
                    }
                }
            };
            return {
                start: self.start,
            };
        })();
    // init progress
    query.init();
    board.init();
    heatmap.init();
    drawer.init();
    lookup.init();
    template.init();
    grid.init();
    place.init();
    info.init();
    alert.init();
    timer.init();
    coords.init();
    user.init();
    notification.init();
    // and here we finally go...
    board.start();

    return {
        ls: ls,
        ss: ss,
        query: query,
        centerBoardOn: function(x, y) {
            board.centerOn(x, y);
        },
        updateTemplate: function(t) {
            template.update(t);
        },
        alert: function(s) {
            alert.show(s);
        },
        socket: socket,
        template: template,
        board: board,
        place: place,
        PixelBot: PixelBot
    };
})();
