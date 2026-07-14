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
    return false;
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

function hetuBrowserChapter(pair) {
    var b = Engine.newBrowser();
    try {
        b.setUserAgent(UserAgent.android());
        console.log("hetuBrowserChapter: warm " + pair.index);
        b.launch(pair.index, 12000);
        console.log("hetuBrowserChapter: open " + pair.chapter);
        b.launchAsync(pair.chapter);

        var tries = 0;
        while (tries < 20) {
            var title = (b.callJs("document.title", 2000) || "") + "";
            if (!hetuIsChallengeTitle(title)) {
                var html = (b.callJs(
                    "document.querySelector('#content') ? document.querySelector('#content').innerHTML : ''",
                    3000
                ) || "") + "";
                if (html.length > 100) {
                    console.log("hetuBrowserChapter: #content via JS");
                    return Html.parse("<div id='hetu-chap'>" + html + "</div>");
                }
            }
            sleep(1000);
            tries++;
        }

        return b.html(8000);
    } finally {
        b.close();
    }
}

function hetuGetChapterDoc(url) {
    url = hetuNormalizeUrl(url);

    var mobile = hetuMobileChapterPair(url);
    if (mobile) {
        console.log("hetuGetChapterDoc: direct " + mobile.chapter);
        var doc = hetuFetchDoc(mobile.chapter, mobile.index, "");
        if (doc && hetuHasChapterContent(doc)) {
            console.log("hetuGetChapterDoc: direct OK");
            return doc;
        }

        doc = hetuFetchChapterPair(mobile);
        if (doc && hetuHasChapterContent(doc)) {
            console.log("hetuGetChapterDoc: mobile pair OK");
            return doc;
        }
    }

    var desktop = hetuDesktopChapterPair(url);
    if (desktop) {
        doc = hetuFetchChapterPair(desktop);
        if (doc && hetuHasChapterContent(doc)) {
            console.log("hetuGetChapterDoc: desktop pair OK");
            return doc;
        }
    }

    console.log("hetuGetChapterDoc: browser mode");
    if (mobile) return hetuBrowserChapter(mobile);
    return hetuBrowserChapter(desktop);
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

    if (!contentEl) {
        var lastH2 = null;
        doc.select("h2").forEach(function (el) {
            lastH2 = el;
        });
        if (lastH2 && lastH2.parent()) contentEl = lastH2.parent();
    }

    if (!contentEl) return "";

    contentEl.select("h2, .pagelink, a, script, style, .read-setting").remove();
    var content = (contentEl.html() || "") + "";
    content = content.replace(/&nbsp;/g, " ");
    return content;
}

function hetuDebugDoc(doc) {
    if (!doc) return "doc=null";
    var titleEl = doc.select("title").first();
    var title = titleEl ? (titleEl.text() + "") : "none";
    return "title=" + title
        + " content=" + doc.select("#content, #hetu-chap").size()
        + " h2=" + doc.select("h2").size();
}
