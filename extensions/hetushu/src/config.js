var BASE_URL = "https://m.hetushu.com";
var DESKTOP_URL = "https://hetushu.com";
try { if (CONFIG_URL) BASE_URL = CONFIG_URL; } catch (e) {}

function hetuNormalizeUrl(url) {
    url = (url || "") + "";
    if (!url) return url;
    url = url.replace(/^http:\/\//i, "https://");
    url = url.replace(/https:\/\/(?:www\.)?hetushu\.com/i, BASE_URL);
    if (url.indexOf("http") !== 0) {
        if (url.indexOf("//") === 0) url = "https:" + url;
        else if (url.indexOf("/") === 0) url = BASE_URL + url;
        else url = BASE_URL + "/" + url;
    }
    return url;
}

function hetuAbsUrl(href) {
    href = (href || "") + "";
    if (!href) return "";
    href = href.replace(/^http:\/\//i, "https://");
    href = href.replace(/https:\/\/(?:www\.)?hetushu\.com/i, BASE_URL);
    if (href.indexOf("http") === 0) return href;
    if (href.indexOf("//") === 0) return "https:" + href;
    if (href.indexOf("/") === 0) return BASE_URL + href;
    return BASE_URL + "/" + href;
}

function hetuBookId(url) {
    var m = (url + "").match(/\/book\/(\d+)\//);
    return m ? m[1] : "";
}

function hetuChapterId(url) {
    var m = (url + "").match(/\/book\/\d+\/(\d+)\.html/);
    return m ? m[1] : "";
}

function hetuMobileChapterPair(url) {
    var bookId = hetuBookId(url);
    var chapId = hetuChapterId(url);
    if (!bookId || !chapId) return null;
    return {
        index: BASE_URL + "/book/" + bookId + "/index.html",
        chapter: BASE_URL + "/book/" + bookId + "/" + chapId + ".html"
    };
}

function hetuDesktopChapterPair(url) {
    var bookId = hetuBookId(url);
    var chapId = hetuChapterId(url);
    if (!bookId || !chapId) return null;
    return {
        index: DESKTOP_URL + "/book/" + bookId + "/index.html",
        chapter: DESKTOP_URL + "/book/" + bookId + "/" + chapId + ".html"
    };
}

function hetuIsChapterUrl(url) {
    return (url + "").match(/\/book\/\d+\/\d+\.html/) !== null;
}

function hetuHasChapterContent(doc) {
    if (!doc) return false;
    if (doc.select("#content, #hetu-chap").size() > 0) {
        var text = (doc.select("#content, #hetu-chap").text() || "") + "";
        if (text.length > 100) return true;
    }
    if (doc.select("#nr, .nr, .nr_content, #chapter-content, .chapter-content").size() > 0) return true;
    var bodyText = (doc.select("body").text() || "") + "";
    if (bodyText.length > 800 && bodyText.indexOf("牢狱之灾") > -1) return true;
    if (bodyText.length > 1500 && !hetuIsChallengeTitle((doc.select("title").text() || "") + "")) return true;
    return false;
}

function hetuHasContent(doc) {
    if (!doc) return false;
    if (hetuHasChapterContent(doc)) return true;
    if (doc.select(".book_info").size() > 0) return true;
    if (doc.select("#dir").size() > 0) return true;
    if (doc.select(".list dd").size() > 0) return true;
    if (doc.select("h2").size() > 0 && doc.select("a[href*='/book/']").size() > 0) return true;
    if (hetuCountChapterLinks(doc) > 3) return true;
    return false;
}

function hetuCountChapterLinks(doc) {
    var count = 0;
    doc.select("a[href*='/book/']").forEach(function (el) {
        var href = (el.attr("href") || "") + "";
        if (href.match(/\/book\/\d+\/\d+\.html/)) count++;
    });
    return count;
}

function hetuParseChaptersFromDoc(doc, bookId, seen, chapters) {
    if (!doc) return chapters;
    if (!seen) seen = {};
    if (!chapters) chapters = [];

    doc.select("#dir dd a, #dir a, .chapter-list a, a[href*='/book/']").forEach(function (el) {
        var chapName = (el.text() || "").trim() + "";
        var chapUrl = (el.attr("href") || "") + "";
        if (!chapName || !chapUrl) return;
        if (chapUrl.indexOf("/book/") === -1) return;
        if (chapUrl.indexOf("index.html") > -1) return;
        if (chapUrl.indexOf("catalog-") > -1) return;
        if (!chapUrl.match(/\/book\/\d+\/\d+\.html/)) return;
        chapUrl = hetuAbsUrl(chapUrl);
        if (seen[chapUrl]) return;
        seen[chapUrl] = true;
        chapters.push({ name: chapName, url: chapUrl, host: BASE_URL });
    });
    return chapters;
}

function hetuFetchDirJson(bookId) {
    if (!bookId) return [];

    var indexUrl = BASE_URL + "/book/" + bookId + "/index.html";
    var warmRes = fetch(indexUrl, {
        headers: hetuBuildHeaders(indexUrl, ""),
        timeout: 12000
    });
    var cookie = warmRes.ok ? hetuCollectCookie(warmRes) : "";

    var jsonUrls = [
        DESKTOP_URL + "/book/" + bookId + "/dir.json",
        BASE_URL + "/book/" + bookId + "/dir.json"
    ];
    var chapters = [];
    var seen = {};
    var i;
    var j;

    for (i = 0; i < jsonUrls.length; i++) {
        var jsonRes = fetch(jsonUrls[i], {
            headers: hetuBuildHeaders(indexUrl, cookie),
            timeout: 12000
        });
        if (!jsonRes.ok) {
            console.log("hetuFetchDirJson status=" + jsonRes.status + " url=" + jsonUrls[i]);
            continue;
        }
        var raw = jsonRes.text() + "";
        if (raw.indexOf("Just a moment") > -1 || raw.indexOf("Chờ một chút") > -1) continue;

        var re = /\["dd","([^"]*)","(\d+)"\]/g;
        var match;
        while ((match = re.exec(raw)) !== null) {
            var chapName = match[1];
            var chapId = match[2];
            var chapUrl = BASE_URL + "/book/" + bookId + "/" + chapId + ".html";
            if (!seen[chapUrl]) {
                seen[chapUrl] = true;
                chapters.push({ name: chapName, url: chapUrl, host: BASE_URL });
            }
        }
        if (chapters.length > 0) {
            console.log("hetuFetchDirJson: OK count=" + chapters.length);
            return chapters;
        }
    }
    return [];
}

function hetuCollectTocPageUrls(indexUrl, doc) {
    var bookId = hetuBookId(indexUrl);
    var pages = [];
    var seen = {};

    function addPage(href) {
        href = hetuAbsUrl(href);
        if (!href || seen[href]) return;
        seen[href] = true;
        pages.push(href);
    }

    addPage(indexUrl);
    if (doc) {
        doc.select("a[href*='catalog-']").forEach(function (el) {
            addPage(el.attr("href"));
        });
    }

    if (bookId && pages.length === 1) {
        var cat1 = BASE_URL + "/book/" + bookId + "/catalog-1.html";
        var catDoc = hetuFetchDoc(cat1, indexUrl, "");
        if (catDoc) {
            addPage(cat1);
            catDoc.select("a[href*='catalog-']").forEach(function (el) {
                addPage(el.attr("href"));
            });
        }
    }

    return pages.length > 0 ? pages : [indexUrl];
}

function hetuIsChallengeTitle(title) {
    title = (title || "") + "";
    if (title.indexOf("Just a moment") > -1) return true;
    if (title.indexOf("Chờ một chút") > -1) return true;
    if (title.indexOf("稍候") > -1) return true;
    if (title.indexOf("Attention") > -1) return true;
    return false;
}

function hetuIsChallenge(doc) {
    if (!doc) return true;
    if (hetuHasContent(doc)) return false;
    var title = "";
    var titleEl = doc.select("title").first();
    if (titleEl) title = (titleEl.text() || "") + "";
    if (hetuIsChallengeTitle(title)) return true;
    if (doc.select("#challenge-error-text").size() > 0) return true;
    var bodyText = (doc.select("body").text() || "") + "";
    if (bodyText.indexOf("Enable JavaScript") > -1) return true;
    if (bodyText.indexOf("cf-challenge") > -1) return true;
    return false;
}

function hetuBuildHeaders(referer, cookie) {
    var headers = {
        "User-Agent": UserAgent.android(),
        "Referer": referer || (BASE_URL + "/"),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,vi-VN,vi;q=0.8,en;q=0.8"
    };
    if (cookie) {
        headers.Cookie = cookie;
    } else {
        try {
            var stored = localCookie.getCookie();
            if (stored) headers.Cookie = stored;
        } catch (e) {}
    }
    return headers;
}

function hetuCollectCookie(res) {
    var cookie = "";
    try {
        if (res && res.request && res.request.headers) {
            cookie = (res.request.headers.cookie || res.request.headers.Cookie || "") + "";
        }
        if (!cookie) cookie = (localCookie.getCookie() || "") + "";
    } catch (e) {}
    return cookie;
}

function hetuFetchDoc(url, referer, cookie) {
    var res = fetch(url, {
        headers: hetuBuildHeaders(referer || url, cookie || ""),
        timeout: 12000
    });
    if (!res.ok) {
        console.log("hetuFetchDoc fail status=" + res.status + " url=" + url);
        return null;
    }
    var doc = res.html();
    if (hetuIsChallenge(doc)) {
        console.log("hetuFetchDoc challenge url=" + url);
        return null;
    }
    return doc;
}

function hetuFetchChapterPair(pair) {
    console.log("hetuFetchChapterPair: warm " + pair.index);
    var warmRes = fetch(pair.index, {
        headers: hetuBuildHeaders(pair.index, ""),
        timeout: 12000
    });
    var cookie = "";
    if (warmRes.ok) {
        cookie = hetuCollectCookie(warmRes);
    } else {
        console.log("hetuFetchChapterPair: warm status=" + warmRes.status);
    }

    console.log("hetuFetchChapterPair: chapter " + pair.chapter);
    var chapRes = fetch(pair.chapter, {
        headers: hetuBuildHeaders(pair.index, cookie),
        timeout: 12000
    });
    if (!chapRes.ok) {
        console.log("hetuFetchChapterPair: chapter status=" + chapRes.status);
        return null;
    }

    var doc = chapRes.html();
    if (hetuIsChallenge(doc)) {
        console.log("hetuFetchChapterPair: chapter challenge");
        return null;
    }
    return doc;
}

function hetuGetDoc(url) {
    url = hetuNormalizeUrl(url);
    if (hetuIsChapterUrl(url)) return hetuGetChapterDoc(url);

    var doc = hetuFetchDoc(url);
    if (doc) {
        console.log("hetuGetDoc: fetch OK");
        return doc;
    }

    return hetuBrowserDoc(url, BASE_URL + "/");
}

function hetuCleanChapterHtml(content) {
    content = (content || "") + "";
    content = content.replace(/<a[^>]*>([^<]*)<\/a>/gi, "$1");
    content = content.replace(/<\/?(?:strike|samp|bdo)[^>]*>/gi, "");
    content = content.replace(/&nbsp;/g, " ");
    content = content.replace(/小主，这个章节后面还有哦[\s\S]*?继续阅读[\s\S]*?/g, "");
    content = content.replace(/和[_*]*图[_*]*书/g, "");
    content = content.replace(/hetushu\.com/gi, "");
    content = content.replace(/(?:<(?:p|div)>\s*<\/(?:p|div)>\s*)+/g, "");
    return content;
}

function hetuB64Decode(input) {
    input = (input || "") + "";
    if (!input) return "";
    try {
        if (typeof CryptoJS !== "undefined") {
            return CryptoJS.enc.Base64.parse(input).toString(CryptoJS.enc.Utf8) + "";
        }
    } catch (e) {}
    try {
        var bytes = java.util.Base64.getDecoder().decode(input);
        return new java.lang.String(bytes, "UTF-8") + "";
    } catch (e2) {}
    return "";
}

function hetuElementTag(el) {
    var raw = (el.toString() || "") + "";
    var m = raw.match(/<\s*([a-zA-Z0-9]+)/);
    if (m) return m[1].toLowerCase();

    // VBook Rhino may not expose outer HTML in toString()
    raw = (el.html() || "") + "";
    if (raw.indexOf("<") === 0) {
        m = raw.match(/<\s*([a-zA-Z0-9]+)/);
        if (m) return m[1].toLowerCase();
    }

    var cls = (el.attr("class") || "") + "";
    if (cls) return "div";
    return "div";
}

function hetuHasClass(el, className) {
    var cls = (el.attr("class") || "") + "";
    var classes = cls.split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
        if (classes[i] === className) return true;
    }
    return false;
}

function hetuContentHasChapterH2(root) {
    var found = false;
    if (!root) return false;
    hetuCollectDirectChildren(root).forEach(function (el) {
        if (hetuElementTag(el) === "h2" && hetuHasClass(el, "h2")) found = true;
    });
    return found;
}

function hetuCollectDirectChildren(root) {
    var items = [];

    function pushAll(list) {
        list.forEach(function (el) {
            if (el) items.push(el);
        });
    }

    // Prefer child combinator (matches novel-downloader: //div[@id="content"]/*)
    pushAll(root.select("> div, > h2"));
    if (items.length === 0) {
        pushAll(root.select("> div"));
        pushAll(root.select("> h2"));
    }

    // Fallback when ">" is unsupported — skip nested div wrappers only
    if (items.length === 0) {
        root.select("div, h2").forEach(function (el) {
            var tag = hetuElementTag(el);
            if (tag === "div" && el.select("div").size() > 0) return;
            items.push(el);
        });
        console.log("hetuCollectDirectChildren: fallback nested-skip count=" + items.length);
    } else {
        console.log("hetuCollectDirectChildren: direct count=" + items.length);
    }

    return items;
}

function hetuBuildHiddenClassSet(doc) {
    var hidden = {};
    if (!doc) return hidden;

    var cssText = "";
    doc.select("style").forEach(function (el) {
        cssText += (el.html() || el.toString() || "") + "\n";
    });

    var re = /\.([a-zA-Z_][\w-]*)\s*\{[^}]*display\s*:\s*none[^}]*\}/gi;
    var m;
    while ((m = re.exec(cssText)) !== null) {
        hidden[m[1]] = true;
    }

    doc.select("script").forEach(function (el) {
        var js = (el.html() || el.toString() || "") + "";
        re = /\.([a-z]\d{8,10})\s*\{[^}]*display\s*:\s*none/gi;
        while ((m = re.exec(js)) !== null) {
            hidden[m[1]] = true;
        }
        re = /(?:display\s*=\s*['"]none['"]|\.style\.display\s*=\s*['"]none['"])/gi;
        if (re.test(js)) {
            re = /['"]([a-z]\d{8,10})['"]/g;
            while ((m = re.exec(js)) !== null) {
                hidden[m[1]] = true;
            }
        }
    });

    return hidden;
}

function hetuIsObfuscatedClass(cls) {
    cls = ((cls || "") + "").trim().split(/\s+/)[0];
    return /^[a-z]\d{8,10}$/i.test(cls);
}

function hetuDocUsesObfuscatedLayout(doc) {
    var root = doc.select("#content").first();
    if (!root) return false;

    var obf = 0;
    var total = 0;
    hetuCollectDirectChildren(root).forEach(function (el) {
        var cls = (el.attr("class") || "") + "";
        if (cls.indexOf("cmask") > -1) return;
        if (cls.indexOf("chapter") > -1) return;
        total++;
        if (hetuIsObfuscatedClass(cls)) obf++;
    });
    return total >= 3 && obf / total >= 0.6;
}

function hetuCountHiddenBlocks(doc, hiddenClasses) {
    var root = doc.select("#content").first();
    if (!root) return 0;
    var count = 0;
    hetuCollectDirectChildren(root).forEach(function (el) {
        if (hetuIsHiddenBlock(el, hiddenClasses)) count++;
    });
    return count;
}

function hetuBrowserVisibleChapter(pair) {
    if (!pair) return "";
    var b = Engine.newBrowser();
    try {
        b.setUserAgent(UserAgent.android());
        b.launch(pair.index, 8000);
        b.launch(pair.chapter, 30000);
        var js = "(function(){"
            + "var r=document.querySelector('#content');"
            + "if(!r)return '';"
            + "var h='',nodes=r.children,i,el,st,rect,t,cls;"
            + "for(i=0;i<nodes.length;i++){"
            + "el=nodes[i];"
            + "if(!el||el.tagName!=='DIV')continue;"
            + "cls=el.className||'';"
            + "if(cls.indexOf('cmask')>=0)continue;"
            + "st=window.getComputedStyle(el);"
            + "if(st.display==='none'||st.visibility==='hidden')continue;"
            + "if(parseFloat(st.opacity||'1')===0)continue;"
            + "rect=el.getBoundingClientRect();"
            + "if(rect.height<1&&rect.width<1)continue;"
            + "t=(el.innerText||'').trim();"
            + "if(!t)continue;"
            + "if(cls.indexOf('chapter')>=0)h+='<div class=\"chapter\">'+t+'</div>';"
            + "else h+='<div>'+t+'</div>';"
            + "}"
            + "return h;"
            + "})()";
        var result = b.callJs(js, 20000);
        var html = hetuCleanChapterHtml((result || "") + "");
        console.log("hetuBrowserVisibleChapter: out=" + (html ? html.length : 0));
        return html;
    } finally {
        b.close();
    }
}

function hetuIsHiddenBlock(el, hiddenClasses) {
    if (!el) return false;

    var style = ((el.attr("style") || "") + "").replace(/\s/g, "").toLowerCase();
    if (style.indexOf("display:none") >= 0) return true;
    if (style.indexOf("visibility:hidden") >= 0) return true;
    if (style.indexOf("opacity:0") >= 0) return true;
    if (style.indexOf("left:-9999") >= 0 || style.indexOf("left:-99999") >= 0) return true;
    if (style.indexOf("font-size:0") >= 0) return true;
    if (style.indexOf("height:0") >= 0 && style.indexOf("overflow:hidden") >= 0) return true;

    var cls = ((el.attr("class") || "") + "").trim();
    if (!cls || !hiddenClasses) return false;
    var parts = cls.split(/\s+/);
    var i;
    for (i = 0; i < parts.length; i++) {
        if (hiddenClasses[parts[i]]) return true;
    }
    return false;
}

function hetuBlockText(el) {
    var text = (el.text() || "").trim() + "";
    if (text) return text;
    var html = hetuCleanChapterHtml((el.html() || "") + "");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() + "";
}

function hetuExtractParagraphs(doc) {
    var title = "";
    var intro = [];
    var paragraphs = [];
    var blockMeta = [];
    if (!doc) return { title: title, intro: intro, paragraphs: paragraphs, blockMeta: blockMeta };

    var root = doc.select("#content").first();
    if (!root) root = doc.select("#hetu-chap").first();
    if (!root) return { title: title, intro: intro, paragraphs: paragraphs, blockMeta: blockMeta };

    var hiddenClasses = hetuBuildHiddenClassSet(doc);
    var hiddenMarked = 0;

    hetuCollectDirectChildren(root).forEach(function (el) {
        var cls = (el.attr("class") || "") + "";
        if (cls.indexOf("cmask") > -1) return;

        if (hetuHasClass(el, "h2")) {
            title = hetuBlockText(el) || title;
            return;
        }

        var hidden = hetuIsHiddenBlock(el, hiddenClasses);
        var text = hetuBlockText(el);
        var isChapter = cls.indexOf("chapter") > -1;

        if (isChapter) {
            if (text) intro.push(text);
            return;
        }

        // Keep hidden decoys in reorder array — token count includes them.
        paragraphs.push(text);
        blockMeta.push({ chapter: false, hidden: hidden });
        if (hidden) hiddenMarked++;
    });

    console.log(
        "hetuExtractParagraphs: intro=" + intro.length
        + " blocks=" + paragraphs.length
        + " hiddenMarked=" + hiddenMarked
    );
    return { title: title, intro: intro, paragraphs: paragraphs, blockMeta: blockMeta };
}

function hetuFilterVisibleBlocks(intro, paragraphs, blockMeta) {
    var out = [];
    var metaOut = [];
    var dropped = 0;
    var i;

    for (i = 0; i < paragraphs.length; i++) {
        var meta = blockMeta && blockMeta[i] ? blockMeta[i] : { hidden: false };
        if (meta.hidden) {
            dropped++;
            continue;
        }
        if (!paragraphs[i]) {
            dropped++;
            continue;
        }
        out.push(paragraphs[i]);
        metaOut.push(meta);
    }

    console.log(
        "hetuFilterVisibleBlocks: kept=" + out.length
        + " dropped=" + dropped
        + " intro=" + intro.length
    );
    return { intro: intro, paragraphs: out, blockMeta: metaOut };
}

function hetuFisherYatesOrder(n, seed) {
    if (n <= 0) return [];
    var i;
    if (n <= 20) {
        var identity = [];
        for (i = 0; i < n; i++) identity.push(i);
        return identity;
    }

    var fixed = [];
    for (i = 0; i < 20; i++) fixed.push(i);
    var rest = [];
    for (i = 20; i < n; i++) rest.push(i);

    var m = 233280, a = 9302, c = 49397;
    var s = seed;
    for (i = rest.length - 1; i > 0; i--) {
        s = (s * a + c) % m;
        var j = Math.floor((s * (i + 1)) / m);
        var tmp = rest[i];
        rest[i] = rest[j];
        rest[j] = tmp;
    }
    return fixed.concat(rest);
}

function hetuReorderParagraphsSeeded(paragraphs, chapId) {
    var cidNum = parseInt(chapId, 10);
    if (isNaN(cidNum)) return paragraphs;
    var n = paragraphs.length;
    var order = hetuFisherYatesOrder(n, cidNum * 127 + 235);
    if (order.length !== n) return paragraphs;

    var reordered = [];
    var i;
    for (i = 0; i < n; i++) reordered.push("");
    for (i = 0; i < n; i++) {
        reordered[order[i]] = paragraphs[i];
    }
    return reordered;
}

function hetuParseOrderToken(token) {
    token = (token || "") + "";
    if (!token) return [];
    var decoded = hetuB64Decode(token);
    if (!decoded) return [];
    var parts = decoded.split(/[A-Z]+%/);
    var orders = [];
    for (var i = 0; i < parts.length; i++) {
        var p = (parts[i] || "").trim();
        if (!p) continue;
        var n = parseInt(p, 10);
        if (!isNaN(n)) orders.push(n);
    }
    return orders;
}

function hetuReorderParagraphs(paragraphs, orders, blockMeta) {
    if (!paragraphs || paragraphs.length === 0) return [];
    if (!orders || orders.length === 0) return paragraphs;

    var reordered = [];
    var metaOut = [];
    var i;
    for (i = 0; i < paragraphs.length; i++) {
        reordered.push("");
        metaOut.push({ chapter: false });
    }

    var offset = 0;
    var count = Math.min(paragraphs.length, orders.length);
    for (i = 0; i < count; i++) {
        var order = orders[i];
        var target = order < 5 ? order : order - offset;
        if (target >= 0 && target < reordered.length) {
            reordered[target] = paragraphs[i];
            if (blockMeta && blockMeta[i]) metaOut[target] = blockMeta[i];
        }
        if (order < 5) offset++;
    }

    if (orders.length === paragraphs.length) {
        return { paragraphs: reordered, blockMeta: metaOut };
    }
    return { paragraphs: paragraphs, blockMeta: blockMeta || [] };
}

function hetuParagraphsToHtml(intro, blockMeta, paragraphs) {
    var html = "";
    var i;
    for (i = 0; i < intro.length; i++) {
        if (intro[i]) html += "<div class=\"chapter\">" + intro[i] + "</div>";
    }
    for (i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i]) {
            html += "<div>" + paragraphs[i] + "</div>";
        }
    }
    return hetuCleanChapterHtml(html);
}

function hetuHostOf(url) {
    var m = (url + "").match(/^https?:\/\/[^\/]+/);
    return m ? m[0] : "";
}

function hetuFetchOrderToken(bookId, chapId, chapterUrl, cookie) {
    if (!bookId || !chapId) return [];
    var host = hetuHostOf(chapterUrl);
    if (!host) return [];

    // Token must come from the SAME host as the fetched chapter HTML,
    // otherwise the paragraph order/count it encodes won't match.
    var tokenUrl = host + "/book/" + bookId + "/r" + chapId + ".json";
    var headers = hetuBuildHeaders(chapterUrl, cookie);
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    headers["Accept"] = "*/*";

    var res = fetch(tokenUrl, {
        headers: headers,
        timeout: 12000
    });
    if (!res.ok) {
        console.log("hetuFetchOrderToken status=" + res.status + " url=" + tokenUrl);
        return [];
    }

    var token = "";
    try {
        token = (res.header("Token") || res.header("token") || "") + "";
    } catch (e) {}
    if (!token && res.headers) {
        try {
            token = (res.headers["Token"] || res.headers["token"] || res.headers["TOKEN"] || "") + "";
        } catch (e2) {}
    }
    if (!token) {
        try {
            token = (res.text() || "") + "";
        } catch (e3) {}
    }

    var orders = hetuParseOrderToken(token);
    console.log("hetuFetchOrderToken: host=" + host + " count=" + orders.length);
    return orders;
}

function hetuDecodeChapterDoc(doc, bookId, chapId, chapterUrl, cookie) {
    if (!doc) return "";
    var parts = hetuExtractParagraphs(doc);
    if (parts.paragraphs.length === 0) {
        console.log("hetuDecodeChapterDoc: no paragraphs, fallback html");
        return hetuExtractChapterHtml(doc);
    }

    var orders = hetuFetchOrderToken(bookId, chapId, chapterUrl, cookie);
    var paragraphs = parts.paragraphs;
    var blockMeta = parts.blockMeta || [];
    var intro = parts.intro || [];
    if (orders.length > 0 && orders.length === parts.paragraphs.length) {
        var reordered = hetuReorderParagraphs(parts.paragraphs, orders, blockMeta);
        paragraphs = reordered.paragraphs;
        blockMeta = reordered.blockMeta;
        console.log("hetuDecodeChapterDoc: token-reorder paras=" + parts.paragraphs.length);
    } else {
        paragraphs = hetuReorderParagraphsSeeded(parts.paragraphs, chapId);
        console.log(
            "hetuDecodeChapterDoc: seeded-reorder paras=" + parts.paragraphs.length
            + " tokenOrders=" + orders.length + " (mismatch, ignored)"
        );
    }

    var visible = hetuFilterVisibleBlocks(intro, paragraphs, blockMeta);
    var html = hetuParagraphsToHtml(visible.intro, visible.blockMeta, visible.paragraphs);
    console.log("hetuDecodeChapterDoc: out=" + (html ? html.length : 0));

    if (!html || html.length < 50) {
        return hetuExtractChapterHtml(doc);
    }
    return html;
}

function hetuFetchChapterContent(pair) {
    if (!pair) return "";
    var bookId = hetuBookId(pair.chapter);
    var chapId = hetuChapterId(pair.chapter);

    var warmRes = fetch(pair.index, {
        headers: hetuBuildHeaders(pair.index, ""),
        timeout: 12000
    });
    var cookie = warmRes.ok ? hetuCollectCookie(warmRes) : "";

    var doc = hetuFetchDoc(pair.chapter, pair.index, cookie);
    if (!doc || !hetuHasChapterContent(doc)) {
        console.log("hetuFetchChapterContent: retry pair fetch");
        doc = hetuFetchChapterPair(pair);
    }
    if (!doc || !hetuHasChapterContent(doc)) {
        console.log("hetuFetchChapterContent: chapter doc fail");
        return "";
    }

    var obfuscated = hetuDocUsesObfuscatedLayout(doc);
    var hiddenClasses = hetuBuildHiddenClassSet(doc);
    var html = hetuDecodeChapterDoc(doc, bookId, chapId, pair.chapter, cookie);

    // New obfuscated layout: decoy divs stay in HTML but browser hides them via CSS/JS.
    if (obfuscated && hetuCountHiddenBlocks(doc, hiddenClasses) === 0) {
        console.log("hetuFetchChapterContent: obfuscated layout, browser visible");
        var browserHtml = hetuBrowserVisibleChapter(pair);
        if (browserHtml && browserHtml.length > 50) return browserHtml;
    }

    return html;
}

function hetuGetChapterContent(url) {
    url = hetuNormalizeUrl(url);
    var bookId = hetuBookId(url);
    var chapId = hetuChapterId(url);
    if (!bookId || !chapId) return "";

    var mobile = {
        index: BASE_URL + "/book/" + bookId + "/index.html",
        chapter: BASE_URL + "/book/" + bookId + "/" + chapId + ".html"
    };
    var desktop = {
        index: DESKTOP_URL + "/book/" + bookId + "/index.html",
        chapter: DESKTOP_URL + "/book/" + bookId + "/" + chapId + ".html"
    };
    var html = "";

    console.log("hetuGetChapterContent: fetch mobile");
    html = hetuFetchChapterContent(mobile);
    if (html && html.length > 50) return html;

    console.log("hetuGetChapterContent: fetch desktop");
    html = hetuFetchChapterContent(desktop);
    if (html && html.length > 50) return html;

    return "";
}

function hetuGetChapterDoc(url) {
    url = hetuNormalizeUrl(url);
    var content = hetuGetChapterContent(url);
    if (content && content.length > 50) {
        return Html.parse("<div id='hetu-chap'>" + content + "</div>");
    }
    return null;
}

function hetuBrowserDoc(url, refererUrl) {
    var b = Engine.newBrowser();
    var doc = null;
    try {
        b.setUserAgent(UserAgent.android());
        if (refererUrl && refererUrl !== url) {
            b.launch(refererUrl, 8000);
        }
        b.launch(url, 20000);
        doc = b.html(20000);
        return doc;
    } finally {
        b.close();
    }
}

function hetuExtractChapterHtml(doc) {
    if (!doc) return "";

    doc.select("script, style, ins, iframe, .ads, .advertisement, .banner, nav, header, footer").remove();
    doc.select("[class*='ads'], [id*='ads'], .read-setting, .tool").remove();

    var contentEl = doc.select("#content, #hetu-chap").first();
    if (!contentEl) contentEl = doc.select("#nr, .nr, .nr_content, #chapter-content, .chapter-content").first();
    if (!contentEl) contentEl = doc.select("article, .article, .readcontent, #BookText").first();

    if (!contentEl) return "";

    contentEl.select("h2, .pagelink, script, style, .read-setting").remove();
    return hetuCleanChapterHtml((contentEl.html() || "") + "");
}

function hetuDebugDoc(doc) {
    if (!doc) return "doc=null";
    var titleEl = doc.select("title").first();
    var title = titleEl ? (titleEl.text() + "") : "none";
    return "title=" + title
        + " content=" + doc.select("#content, #hetu-chap").size()
        + " dir=" + doc.select("#dir").size()
        + " chapLinks=" + hetuCountChapterLinks(doc)
        + " h2=" + doc.select("h2").size();
}
